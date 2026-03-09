// backend/controllers/exportController.js  (NEW FILE)

const { pool } = require('../config/database');
const archiver = require('archiver');
const { Parser } = require('json2csv');

/**
 * Helper — convert array of objects to CSV string
 */
const toCSV = (data, fields) => {
  if (!data.length) return '';
  try {
    const parser = new Parser({ fields });
    return parser.parse(data);
  } catch {
    return '';
  }
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
    // ── Fetch all data ───────────────────────────────────────────────

    const [
      clientsRes,
      sessionsRes,
      trainingLogsRes,
      exerciseEntriesRes,
      consentsRes,
      subscriptionRes,
      auditRes
    ] = await Promise.all([
      pool.query(`SELECT * FROM clients WHERE tenant_id = $1 ORDER BY created_at`, [tenantId]),
      pool.query(`SELECT * FROM training_sessions WHERE tenant_id = $1 ORDER BY start_time`, [tenantId]),
      pool.query(`SELECT tl.* FROM training_logs tl
                  JOIN training_sessions ts ON tl.session_id = ts.id
                  WHERE ts.tenant_id = $1 ORDER BY tl.created_at`, [tenantId]),
      pool.query(`SELECT ee.* FROM exercise_entries ee
                  JOIN training_logs tl ON ee.training_log_id = tl.id
                  JOIN training_sessions ts ON tl.session_id = ts.id
                  WHERE ts.tenant_id = $1 ORDER BY ee.id`, [tenantId]),
      pool.query(`SELECT * FROM client_consents WHERE trainer_id = $1 ORDER BY created_at`, [trainerId]),
      pool.query(`SELECT * FROM tenant_subscriptions WHERE tenant_id = $1`, [tenantId]),
      pool.query(`SELECT * FROM audit_log WHERE trainer_id = $1 ORDER BY created_at DESC LIMIT 1000`, [trainerId])
    ]);

    const clients = clientsRes.rows;
    const sessions = sessionsRes.rows;
    const trainingLogs = trainingLogsRes.rows;
    const exerciseEntries = exerciseEntriesRes.rows;
    const consents = consentsRes.rows;
    const subscription = subscriptionRes.rows;
    const auditLog = auditRes.rows;

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

    // JSON files
    archive.append(JSON.stringify(clients, null, 2), { name: 'json/clients.json' });
    archive.append(JSON.stringify(sessions, null, 2), { name: 'json/sessions.json' });
    archive.append(JSON.stringify(trainingLogs, null, 2), { name: 'json/training_logs.json' });
    archive.append(JSON.stringify(exerciseEntries, null, 2), { name: 'json/exercise_entries.json' });
    archive.append(JSON.stringify(consents, null, 2), { name: 'json/consents.json' });
    archive.append(JSON.stringify(subscription, null, 2), { name: 'json/subscription.json' });
    archive.append(JSON.stringify(auditLog, null, 2), { name: 'json/audit_log.json' });

    // CSV files
    if (clients.length) {
      archive.append(toCSV(clients, Object.keys(clients[0])), { name: 'csv/clients.csv' });
    }
    if (sessions.length) {
      archive.append(toCSV(sessions, Object.keys(sessions[0])), { name: 'csv/sessions.csv' });
    }
    if (trainingLogs.length) {
      archive.append(toCSV(trainingLogs, Object.keys(trainingLogs[0])), { name: 'csv/training_logs.csv' });
    }
    if (exerciseEntries.length) {
      archive.append(toCSV(exerciseEntries, Object.keys(exerciseEntries[0])), { name: 'csv/exercise_entries.csv' });
    }
    if (consents.length) {
      archive.append(toCSV(consents, Object.keys(consents[0])), { name: 'csv/consents.csv' });
    }

    // README
    const readme = `TRENIKO Data Export
Generated: ${new Date().toISOString()}
Trainer ID: ${trainerId}

Contents:
  json/clients.json           — All your clients
  json/sessions.json          — All training sessions
  json/training_logs.json     — Training logs
  json/exercise_entries.json  — Exercise entries
  json/consents.json          — Client consent records
  json/subscription.json      — Subscription history
  json/audit_log.json         — Access and activity log
  csv/                        — Same data in CSV format

This export was generated in compliance with GDPR Article 20 (Right to Data Portability).
`;
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

module.exports = { exportAllData, exportClientData };
