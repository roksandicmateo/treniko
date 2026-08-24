// backend/controllers/exportController.js  (NEW FILE)

const { pool } = require('../config/database');
const archiver = require('archiver');
const { Parser } = require('json2csv');
const { sanitizeCsvValue } = require('../utils/validation');

/**
 * Helper — convert array of objects to CSV string
 *
 * Every value is passed through sanitizeCsvValue first (TR-MED-2). Client
 * records carry free-text fields — goals, injuries, diet notes, names — that
 * the trainer's own clients supply, and a value beginning with =, +, -, @, tab
 * or CR is interpreted as a formula by Excel, LibreOffice and Google Sheets.
 * The victim here is the trainer: they export their own data and open it, and
 * the formula runs in their spreadsheet with their access.
 *
 * Field *names* are not sanitised — they are column names chosen by this
 * application, never user input.
 */
const toCSV = (data, fields) => {
  if (!data.length) return '';
  try {
    const safeData = data.map((row) => {
      const out = {};
      for (const [key, value] of Object.entries(row)) {
        out[key] = sanitizeCsvValue(value);
      }
      return out;
    });
    const parser = new Parser({ fields });
    return parser.parse(safeData);
  } catch {
    return '';
  }
};

/**
 * Everything the export contains, declared once.
 *
 * ── Why this is a list rather than seven hand-written queries ────────────────
 * The export used to name five stores: clients, sessions, training_logs,
 * exercise_entries and consents. Live QA downloaded a real trainer's archive
 * and found json/training_logs.json and json/exercise_entries.json both empty
 * — because the Treninzi feature writes `trainings` and `training_exercises`,
 * which the export had never heard of. Progress measurements, payments,
 * packages and groups were absent for the same reason: each was added to the
 * product without being added here.
 *
 * A GDPR Article 20 export that quietly omits most of what the product stores
 * is worse than a missing feature; it answers the request incorrectly. So the
 * contents are declared in one list, and a test asserts that every
 * tenant-scoped table in the database is either exported or explicitly and
 * deliberately excluded (see EXCLUDED_FROM_EXPORT). A new product table now
 * fails that test until somebody decides which it is.
 *
 * ── Tenant isolation ─────────────────────────────────────────────────────────
 * Every statement filters on the caller's own tenant, and the tables that carry
 * no tenant_id of their own (set rows, group membership, template detail) are
 * reached only through a parent that does. Nothing is filtered by the client
 * ids of the rows already fetched: an id is not an authorisation, and building
 * the second query from the first result would mean a bug in the first widens
 * the second.
 */
const tenantDatasets = (tenantId, trainerId) => [
  // ── People ────────────────────────────────────────────────────────────────
  { name: 'clients',
    sql: 'SELECT * FROM clients WHERE tenant_id = $1 ORDER BY created_at',
    params: [tenantId] },

  // The trainer's own profile. Explicit column list, never SELECT * — the row
  // also holds password_hash, verification_token and password_changed_at, none
  // of which are the subject's data to receive and all of which are credential
  // material.
  { name: 'trainer_profile',
    sql: `SELECT id, tenant_id, email, first_name, last_name, phone, bio, city,
                 country, website, language, email_verified, dpa_accepted,
                 dpa_accepted_at, created_at, updated_at
            FROM users WHERE tenant_id = $1 ORDER BY created_at`,
    params: [tenantId] },

  { name: 'business',
    sql: 'SELECT * FROM tenants WHERE id = $1',
    params: [tenantId] },

  // Migration 034. How this trainer arrived: the campaign labels that were in
  // the landing-page URL at first touch. Included deliberately — it is data
  // about the subject, it contains no third-party personal data, and including
  // it is the more defensible Article 15 answer than leaving it out.
  { name: 'signup_attribution',
    sql: 'SELECT * FROM signup_attribution WHERE tenant_id = $1',
    params: [tenantId] },

  // ── Scheduling ────────────────────────────────────────────────────────────
  { name: 'sessions',
    sql: 'SELECT * FROM training_sessions WHERE tenant_id = $1 ORDER BY session_date, start_time',
    params: [tenantId] },

  { name: 'session_attendees',
    sql: 'SELECT * FROM session_attendees WHERE tenant_id = $1 ORDER BY id',
    params: [tenantId] },

  // ── Trainings (the store QA found missing) ────────────────────────────────
  { name: 'trainings',
    sql: 'SELECT * FROM trainings WHERE tenant_id = $1 ORDER BY start_time',
    params: [tenantId] },

  { name: 'training_exercises',
    sql: `SELECT te.* FROM training_exercises te
            JOIN trainings t ON t.id = te.training_id
           WHERE t.tenant_id = $1
           ORDER BY te.training_id, te.sort_order`,
    params: [tenantId] },

  { name: 'training_sets',
    sql: `SELECT ts.* FROM training_sets ts
            JOIN training_exercises te ON te.id = ts.training_exercise_id
            JOIN trainings t           ON t.id  = te.training_id
           WHERE t.tenant_id = $1
           ORDER BY ts.training_exercise_id, ts.set_number`,
    params: [tenantId] },

  { name: 'training_images',
    sql: 'SELECT * FROM training_images WHERE tenant_id = $1 ORDER BY created_at',
    params: [tenantId] },

  // ── The older session-log model, kept: databases predating Treninzi still
  //    hold data here, and an export must not drop it. ───────────────────────
  { name: 'training_logs',
    sql: 'SELECT * FROM training_logs WHERE tenant_id = $1 ORDER BY created_at',
    params: [tenantId] },

  { name: 'exercise_entries',
    sql: `SELECT ee.* FROM exercise_entries ee
            JOIN training_logs tl ON tl.id = ee.training_log_id
           WHERE tl.tenant_id = $1
           ORDER BY ee.training_log_id, ee.order_index`,
    params: [tenantId] },

  // ── Library and templates ─────────────────────────────────────────────────
  { name: 'exercises',
    sql: 'SELECT * FROM exercises WHERE tenant_id = $1 ORDER BY name',
    params: [tenantId] },

  { name: 'training_templates',
    sql: 'SELECT * FROM training_templates WHERE tenant_id = $1 ORDER BY created_at',
    params: [tenantId] },

  { name: 'template_exercises',
    sql: `SELECT te.* FROM template_exercises te
            JOIN training_templates tt ON tt.id = te.template_id
           WHERE tt.tenant_id = $1
           ORDER BY te.template_id, te.sort_order`,
    params: [tenantId] },

  { name: 'template_sets',
    sql: `SELECT ts.* FROM template_sets ts
            JOIN template_exercises te ON te.id = ts.template_exercise_id
            JOIN training_templates tt ON tt.id = te.template_id
           WHERE tt.tenant_id = $1
           ORDER BY ts.template_exercise_id, ts.set_number`,
    params: [tenantId] },

  // ── Progress ──────────────────────────────────────────────────────────────
  { name: 'progress_entries',
    sql: `SELECT id, tenant_id, client_id, metric_name, value, unit,
                 date::text AS date, source, notes, created_at
            FROM progress_entries WHERE tenant_id = $1
           ORDER BY client_id, date`,
    params: [tenantId] },

  // ── Groups ────────────────────────────────────────────────────────────────
  { name: 'groups',
    sql: 'SELECT * FROM groups WHERE tenant_id = $1 ORDER BY created_at',
    params: [tenantId] },

  { name: 'group_members',
    sql: `SELECT gm.* FROM group_members gm
            JOIN groups g ON g.id = gm.group_id
           WHERE g.tenant_id = $1
           ORDER BY gm.group_id, gm.joined_at`,
    params: [tenantId] },

  { name: 'group_sessions',
    sql: 'SELECT * FROM group_sessions WHERE tenant_id = $1 ORDER BY session_date, start_time',
    params: [tenantId] },

  { name: 'group_session_attendance',
    sql: `SELECT gsa.* FROM group_session_attendance gsa
            JOIN group_sessions gs ON gs.id = gsa.group_session_id
           WHERE gs.tenant_id = $1
           ORDER BY gsa.group_session_id`,
    params: [tenantId] },

  // ── Commercial ────────────────────────────────────────────────────────────
  { name: 'packages',
    sql: 'SELECT * FROM packages WHERE tenant_id = $1 ORDER BY created_at',
    params: [tenantId] },

  { name: 'client_packages',
    sql: 'SELECT * FROM client_packages WHERE tenant_id = $1 ORDER BY assigned_at',
    params: [tenantId] },

  { name: 'package_session_usage',
    sql: 'SELECT * FROM package_session_usage WHERE tenant_id = $1 ORDER BY id',
    params: [tenantId] },

  { name: 'client_payments',
    sql: 'SELECT * FROM client_payments WHERE tenant_id = $1 ORDER BY payment_date',
    params: [tenantId] },

  { name: 'subscription',
    sql: 'SELECT * FROM tenant_subscriptions WHERE tenant_id = $1',
    params: [tenantId] },

  { name: 'subscription_history',
    sql: 'SELECT * FROM subscription_history WHERE tenant_id = $1 ORDER BY effective_date',
    params: [tenantId] },

  { name: 'subscription_usage',
    sql: 'SELECT * FROM subscription_usage WHERE tenant_id = $1 ORDER BY period_start',
    params: [tenantId] },

  // ── Consent, requests and the access log ──────────────────────────────────
  { name: 'consents',
    sql: 'SELECT * FROM client_consents WHERE trainer_id = $1 ORDER BY created_at',
    params: [trainerId] },

  { name: 'trainer_consents',
    sql: 'SELECT * FROM trainer_consents WHERE trainer_id = $1 ORDER BY created_at',
    params: [trainerId] },

  { name: 'data_export_requests',
    sql: 'SELECT * FROM data_export_requests WHERE trainer_id = $1 ORDER BY requested_at',
    params: [trainerId] },

  { name: 'deletion_requests',
    sql: 'SELECT * FROM deletion_requests WHERE trainer_id = $1 ORDER BY created_at',
    params: [trainerId] },

  { name: 'audit_log',
    sql: 'SELECT * FROM audit_log WHERE trainer_id = $1 ORDER BY created_at DESC LIMIT 1000',
    params: [trainerId] },
];

/**
 * Tables deliberately NOT in the export, each with the reason.
 *
 * The completeness test reads this: a tenant-scoped table that is neither
 * exported nor listed here fails the suite, which is what stops the next
 * feature from being silently missing from everybody's archive.
 */
const EXCLUDED_FROM_EXPORT = {
  password_reset_tokens:
    'credential material — a live reset token in a downloadable file would be a way in, not a record',
  subscription_notifications:
    'operational reminders generated by the billing checker, not data the trainer supplied or the product holds about them',
  subscription_plans:
    'the public product catalogue, identical for every tenant',
  schema_migrations:
    'database bookkeeping, no tenant data',
  admin_audit_log:
    'TRENIKO internal record of platform-administrator actions (migration ' +
    '033). It names the staff member who acted, by email, so including it in a ' +
    'self-serve customer download would disclose TRENIKO personnel rather than ' +
    'data about the trainer. The trainer-facing record of activity on their ' +
    'own account is audit_log, which IS exported. Where a subject access ' +
    'request genuinely reaches admin actions, it is answered manually with the ' +
    'staff identifiers redacted',
};

/**
 * GET /api/export
 * Full trainer data export — returns a ZIP with JSON + CSV files.
 */
const exportAllData = async (req, res) => {
  const trainerId = req.user.userId;
  const tenantId = req.user.tenantId;
  const ip = req.ip || req.connection.remoteAddress;

  try {
    const datasets = tenantDatasets(tenantId, trainerId);

    // A table missing on an older database must not fail the whole export —
    // the trainer still gets everything that does exist, and the README says
    // what could not be read.
    const results = await Promise.all(
      datasets.map((d) =>
        pool.query(d.sql, d.params)
          .then((r) => ({ ...d, rows: r.rows }))
          .catch((err) => ({ ...d, rows: [], error: err.message }))
      )
    );

    // ── Audit log the export ─────────────────────────────────────────
    await pool.query(
      `INSERT INTO audit_log (trainer_id, action, entity_type, ip_address)
       VALUES ($1, 'full_data_export', 'trainer', $2)`,
      [trainerId, ip]
    );

    // ── Build ZIP ────────────────────────────────────────────────────
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="treniko-export-${Date.now()}.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    for (const set of results) {
      archive.append(JSON.stringify(set.rows, null, 2), { name: `json/${set.name}.json` });
      if (set.rows.length) {
        archive.append(toCSV(set.rows, Object.keys(set.rows[0])), { name: `csv/${set.name}.csv` });
      }
    }

    const failed = results.filter((r) => r.error);
    const readme = [
      'TRENIKO Data Export',
      `Generated: ${new Date().toISOString()}`,
      `Trainer ID: ${trainerId}`,
      '',
      'This archive contains the data TRENIKO holds for your account, in JSON',
      '(json/) and, where there are rows, the same data as CSV (csv/).',
      '',
      'Contents:',
      ...results.map((r) => `  ${`${r.name}.json`.padEnd(30)} ${r.rows.length} row(s)`),
      '',
      'Not included, deliberately:',
      ...Object.entries(EXCLUDED_FROM_EXPORT).map(([t, why]) => `  ${t.padEnd(30)} ${why}`),
      '',
      'Password hashes, password reset tokens and email verification tokens are',
      'never exported: they are credentials, not records.',
      ...(failed.length
        ? ['', 'Could not be read on this database:',
           ...failed.map((f) => `  ${f.name}: ${f.error}`)]
        : []),
      '',
      'This export was generated in compliance with GDPR Article 20 (Right to Data Portability).',
      '',
    ].join('\n');
    archive.append(readme, { name: 'README.txt' });

    await archive.finalize();

  } catch (error) {
    console.error('exportAllData error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate export.' });
    }
  }
};

/**
 * GET /api/clients/:id/export
 * Single client data export — returns a ZIP with that client's data only.
 */
const exportClientData = async (req, res) => {
  const trainerId = req.user.userId;
  const tenantId = req.user.tenantId;
  const clientId = req.params.id;
  const ip = req.ip || req.connection.remoteAddress;

  try {
    // Verify client belongs to this trainer
    const clientCheck = await pool.query(
      `SELECT * FROM clients WHERE id = $1 AND tenant_id = $2`,
      [clientId, tenantId]
    );
    if (!clientCheck.rows.length) {
      return res.status(404).json({ error: 'Client not found.' });
    }

    const client = clientCheck.rows[0];

    const [sessionsRes, logsRes, entriesRes, consentsRes, progressRes] = await Promise.all([
      pool.query(`SELECT * FROM training_sessions WHERE client_id = $1 AND tenant_id = $2 ORDER BY start_time`, [clientId, tenantId]),
      pool.query(`SELECT tl.* FROM training_logs tl
                  JOIN training_sessions ts ON tl.session_id = ts.id
                  WHERE ts.client_id = $1 ORDER BY tl.created_at`, [clientId]),
      pool.query(`SELECT ee.* FROM exercise_entries ee
                  JOIN training_logs tl ON ee.training_log_id = tl.id
                  JOIN training_sessions ts ON tl.session_id = ts.id
                  WHERE ts.client_id = $1 ORDER BY ee.id`, [clientId]),
      pool.query(`SELECT * FROM client_consents WHERE client_id = $1 AND trainer_id = $2`, [clientId, trainerId]),
      pool.query(`SELECT * FROM progress_entries WHERE client_id = $1 ORDER BY created_at`, [clientId]).catch(() => ({ rows: [] }))
    ]);

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (trainer_id, action, entity_type, entity_id, ip_address)
       VALUES ($1, 'client_data_export', 'client', $2, $3)`,
      [trainerId, clientId, ip]
    );

    const clientName = `${client.first_name}-${client.last_name}`.toLowerCase().replace(/\s/g, '-');

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="treniko-client-${clientName}-${Date.now()}.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    archive.append(JSON.stringify([client], null, 2), { name: 'json/client.json' });
    archive.append(JSON.stringify(sessionsRes.rows, null, 2), { name: 'json/sessions.json' });
    archive.append(JSON.stringify(logsRes.rows, null, 2), { name: 'json/training_logs.json' });
    archive.append(JSON.stringify(entriesRes.rows, null, 2), { name: 'json/exercise_entries.json' });
    archive.append(JSON.stringify(consentsRes.rows, null, 2), { name: 'json/consents.json' });
    archive.append(JSON.stringify(progressRes.rows, null, 2), { name: 'json/progress.json' });

    if (sessionsRes.rows.length) {
      archive.append(toCSV(sessionsRes.rows, Object.keys(sessionsRes.rows[0])), { name: 'csv/sessions.csv' });
    }
    if (logsRes.rows.length) {
      archive.append(toCSV(logsRes.rows, Object.keys(logsRes.rows[0])), { name: 'csv/training_logs.csv' });
    }
    if (progressRes.rows.length) {
      archive.append(toCSV(progressRes.rows, Object.keys(progressRes.rows[0])), { name: 'csv/progress.csv' });
    }

    const readme = `TRENIKO Client Data Export
Client: ${client.first_name} ${client.last_name}
Generated: ${new Date().toISOString()}

This export was generated in compliance with GDPR Article 20 (Right to Data Portability).
`;
    archive.append(readme, { name: 'README.txt' });

    await archive.finalize();

  } catch (error) {
    console.error('exportClientData error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate client export.' });
    }
  }
};

// toCSV is exported for the security tests, which assert that spreadsheet
// formula injection is neutralised in the generated CSV (TR-MED-2). It is not
// mounted on any route.
module.exports = {
  exportAllData,
  exportClientData,
  toCSV,
  // Exported for the regression suite, which asserts that the archive is
  // complete (every tenant-scoped table is exported or explicitly excluded)
  // and that every statement is scoped to the caller's own tenant.
  tenantDatasets,
  EXCLUDED_FROM_EXPORT,
};
