// backend/controllers/packagesController.js  (NEW FILE)

const { pool, getClient } = require('../config/database');
const { sendDbClientError } = require('../utils/dbErrors');
const packageUsage = require('../services/packageUsageService');
const { parseMoney, parseCount } = require('../utils/validation');

// Mirrors chk_client_package_status (migration 037). A status outside this set
// parks a package in a state no screen looks for, holding the client's sessions
// while being invisible everywhere.
const CLIENT_PACKAGE_STATUSES = ['active', 'completed', 'expired', 'cancelled'];

// ── Helper: expire packages before any read ───────────────────────────────────
const runExpiry = async () => {
  try {
    await pool.query('SELECT expire_client_packages()');
  } catch (e) {
    console.error('[packagesController] expiry error:', e.message);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
//  PACKAGES (trainer-defined templates)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/packages
 * List all packages for the trainer.
 */
const getPackages = async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    const result = await pool.query(
      `SELECT * FROM packages WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId]
    );
    return res.json({ success: true, packages: result.rows });
  } catch (error) {
    if (sendDbClientError(res, error)) return;
    console.error('getPackages error:', error);
    return res.status(500).json({ error: 'Failed to fetch packages.' });
  }
};

/**
 * GET /api/packages/:id
 */
const getPackage = async (req, res) => {
  const tenantId = req.user.tenantId;
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM packages WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Package not found.' });
    return res.json({ success: true, package: result.rows[0] });
  } catch (error) {
    if (sendDbClientError(res, error)) return;
    console.error('getPackage error:', error);
    return res.status(500).json({ error: 'Failed to fetch package.' });
  }
};

/**
 * POST /api/packages
 * Create a new package template.
 */
const createPackage = async (req, res) => {
  const tenantId = req.user.tenantId;
  const {
    name, description, price, currency = 'EUR',
    packageType, totalSessions, durationDays,
    sessionsPerPeriod, periodDays
  } = req.body;

  if (!name || !packageType) {
    return res.status(400).json({ error: 'Name and package type are required.' });
  }

  const validTypes = ['session_based', 'time_based', 'unlimited'];
  if (!validTypes.includes(packageType)) {
    return res.status(400).json({ error: 'Invalid package type.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO packages
        (tenant_id, name, description, price, currency, package_type,
         total_sessions, duration_days, sessions_per_period, period_days)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [tenantId, name, description, price, currency, packageType,
       totalSessions || null, durationDays || null,
       sessionsPerPeriod || null, periodDays || null]
    );
    return res.status(201).json({ success: true, package: result.rows[0] });
  } catch (error) {
    if (sendDbClientError(res, error)) return;
    console.error('createPackage error:', error);
    return res.status(500).json({ error: 'Failed to create package.' });
  }
};

/**
 * PUT /api/packages/:id
 */
const updatePackage = async (req, res) => {
  const tenantId = req.user.tenantId;
  const { id } = req.params;
  const {
    name, description, price, currency,
    packageType, totalSessions, durationDays,
    sessionsPerPeriod, periodDays, isActive
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE packages SET
        name                = COALESCE($1, name),
        description         = COALESCE($2, description),
        price               = COALESCE($3, price),
        currency            = COALESCE($4, currency),
        package_type        = COALESCE($5, package_type),
        total_sessions      = COALESCE($6, total_sessions),
        duration_days       = COALESCE($7, duration_days),
        sessions_per_period = COALESCE($8, sessions_per_period),
        period_days         = COALESCE($9, period_days),
        is_active           = COALESCE($10, is_active),
        updated_at          = NOW()
       WHERE id = $11 AND tenant_id = $12
       RETURNING *`,
 [name || null, description || null, price || null, currency || null, packageType || null,
 totalSessions || null, durationDays || null, sessionsPerPeriod || null, periodDays || null,
 isActive ?? null, id, tenantId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Package not found.' });
    return res.json({ success: true, package: result.rows[0] });
  } catch (error) {
    if (sendDbClientError(res, error)) return;
    console.error('updatePackage error:', error);
    return res.status(500).json({ error: 'Failed to update package.' });
  }
};

/**
 * DELETE /api/packages/:id
 * Only allowed if no active client packages reference it.
 */
const deletePackage = async (req, res) => {
  const tenantId = req.user.tenantId;
  const { id } = req.params;

  try {
    // `tenant_id` is not redundant here even though package_id is ours: the
    // guard must count OUR assignments, not every row in the table that happens
    // to reference this id. A query that reaches across tenants to decide what
    // this tenant may delete is wrong even when the answer comes out the same.
    const activeCheck = await pool.query(
      `SELECT COUNT(*) FROM client_packages
       WHERE package_id = $1 AND tenant_id = $2 AND status = 'active'`,
      [id, tenantId]
    );
    if (parseInt(activeCheck.rows[0].count) > 0) {
      return res.status(409).json({
        error: 'Cannot delete a package that has active client assignments. Deactivate it instead.'
      });
    }

    const result = await pool.query(
      `DELETE FROM packages WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [id, tenantId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Package not found.' });
    return res.json({ success: true });
  } catch (error) {
    if (sendDbClientError(res, error)) return;
    console.error('deletePackage error:', error);
    return res.status(500).json({ error: 'Failed to delete package.' });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
//  CLIENT PACKAGES (assignments)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/clients/:clientId/packages
 * All packages for a client (active first, then history).
 */
const getClientPackages = async (req, res) => {
  const tenantId = req.user.tenantId;
  const { clientId } = req.params;

  try {
    // Inside the try: runExpiry() touches the database, and a rejection from an
    // async handler is not caught by Express — the request would go unanswered
    // and the process would terminate.
    await runExpiry();

    const result = await pool.query(
      `SELECT cp.*,
              p.name AS package_template_name
       FROM client_packages cp
       LEFT JOIN packages p ON cp.package_id = p.id
       WHERE cp.client_id = $1 AND cp.tenant_id = $2
       ORDER BY
         CASE WHEN cp.status = 'active' THEN 0 ELSE 1 END,
         cp.assigned_at DESC`,
      [clientId, tenantId]
    );
    return res.json({ success: true, packages: result.rows });
  } catch (error) {
    if (sendDbClientError(res, error)) return;
    console.error('getClientPackages error:', error);
    return res.status(500).json({ error: 'Failed to fetch client packages.' });
  }
};

/**
 * GET /api/clients/:clientId/packages/active
 * Returns the single active package for a client (or null).
 */
const getActiveClientPackage = async (req, res) => {
  const tenantId = req.user.tenantId;
  const { clientId } = req.params;

  try {
    // Inside the try: runExpiry() touches the database, and a rejection from an
    // async handler is not caught by Express — the request would go unanswered
    // and the process would terminate.
    await runExpiry();

    const result = await pool.query(
      `SELECT cp.*,
              p.name AS package_template_name
       FROM client_packages cp
       LEFT JOIN packages p ON cp.package_id = p.id
       WHERE cp.client_id = $1 AND cp.tenant_id = $2 AND cp.status = 'active'
       ORDER BY cp.assigned_at DESC
       LIMIT 1`,
      [clientId, tenantId]
    );
    return res.json({
      success: true,
      package: result.rows[0] || null
    });
  } catch (error) {
    if (sendDbClientError(res, error)) return;
    console.error('getActiveClientPackage error:', error);
    return res.status(500).json({ error: 'Failed to fetch active package.' });
  }
};

/**
 * POST /api/clients/:clientId/packages
 * Assign a package to a client.
 *
 * ── Why price and session count are overridable ──────────────────────────────
 * The template is a starting point, not a price list. Individual rates are the
 * rule in personal training ("35 for you, because you come twice a week"), and
 * a product that cannot record the actual deal sends the trainer back to the
 * spreadsheet that can. `client_packages` already snapshots both columns at
 * assignment time — the assign endpoint simply never let the caller set them.
 *
 * ── Why the payment is recorded here ─────────────────────────────────────────
 * Buying the block and starting it are one event for the trainer and were two
 * unconnected screens in the product. `client_payments.client_package_id` has
 * existed since migration 020 and nothing ever populated it. Both writes share
 * one transaction, so a package can never exist with a payment that was lost,
 * or the reverse.
 */
const assignPackage = async (req, res) => {
  const tenantId = req.user.tenantId;
  const userId = req.user.userId;
  const { clientId } = req.params;
  const {
    packageId, startDate, notes,
    price, totalSessions,
    markPaid, paymentMethod, paymentAmount,
  } = req.body;

  if (!packageId) {
    return res.status(400).json({ error: 'packageId is required.' });
  }

  const priceOverride = parseMoney(price);
  if (price !== undefined && price !== null && price !== '' && priceOverride === null) {
    return res.status(400).json({ error: 'price must be a non-negative amount.' });
  }

  const sessionsOverride = parseCount(totalSessions);
  if (totalSessions !== undefined && totalSessions !== null && totalSessions !== ''
      && sessionsOverride === null) {
    return res.status(400).json({ error: 'totalSessions must be a positive whole number.' });
  }

  const db = await getClient();
  let responded = false;

  try {
    await db.query('BEGIN');

    const pkgRes = await db.query(
      `SELECT * FROM packages WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
      [packageId, tenantId]
    );
    if (!pkgRes.rows.length) {
      responded = true;
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Package not found or inactive.' });
    }
    const pkg = pkgRes.rows[0];

    const clientCheck = await db.query(
      `SELECT id FROM clients WHERE id = $1 AND tenant_id = $2`,
      [clientId, tenantId]
    );
    if (!clientCheck.rows.length) {
      responded = true;
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Client not found.' });
    }

    // Dates are calendar dates and are computed as such. `new Date()` followed
    // by `toISOString()` reports the UTC day, so a package assigned at 01:00 in
    // Zagreb used to start "yesterday" — and its end date inherited the same
    // shift. CURRENT_DATE and an INTERVAL keep the whole calculation in the
    // database's calendar, where a date has no time zone to lose.
    const effectiveSessions = sessionsOverride !== null ? sessionsOverride : pkg.total_sessions;
    const effectivePrice = priceOverride !== null ? priceOverride : pkg.price;

    const result = await db.query(
      `INSERT INTO client_packages
        (tenant_id, client_id, package_id, package_name, package_type,
         total_sessions, sessions_per_period, period_days, duration_days,
         price, currency, start_date, end_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
               COALESCE($12::date, CURRENT_DATE),
               CASE WHEN $9::int IS NULL THEN NULL
                    ELSE COALESCE($12::date, CURRENT_DATE) + ($9::int || ' days')::interval
               END,
               $13)
       RETURNING *`,
      [
        tenantId, clientId, packageId,
        pkg.name, pkg.package_type,
        effectiveSessions, pkg.sessions_per_period, pkg.period_days, pkg.duration_days,
        effectivePrice, pkg.currency,
        startDate || null,
        notes || null,
      ]
    );
    const clientPackage = result.rows[0];

    // The trainer said the client paid. Record it against this package so
    // "has she paid for these?" is answerable from one row rather than from
    // memory.
    let payment = null;
    if (markPaid === true) {
      const amount = parseMoney(paymentAmount);
      const chargedAmount = amount !== null ? amount : effectivePrice;
      if (chargedAmount === null) {
        responded = true;
        await db.query('ROLLBACK');
        return res.status(400).json({
          error: 'This package has no price, so an amount is required to record a payment.',
        });
      }
      const method = ['cash', 'bank_transfer', 'card', 'other'].includes(paymentMethod)
        ? paymentMethod
        : 'cash';

      const paymentRes = await db.query(
        `INSERT INTO client_payments
           (tenant_id, client_id, client_package_id, amount, currency,
            payment_date, payment_method, status, note)
         VALUES ($1,$2,$3,$4,$5,CURRENT_DATE,$6,'paid',$7)
         RETURNING *`,
        [tenantId, clientId, clientPackage.id, chargedAmount, pkg.currency || 'EUR',
         method, `${clientPackage.package_name}`]
      );
      payment = paymentRes.rows[0];
    }

    await db.query(
      `INSERT INTO audit_log (trainer_id, action, entity_type, entity_id, ip_address)
       VALUES ($1, 'package_assigned', 'client_package', $2, $3)`,
      [userId, clientPackage.id, req.ip || null]
    );

    await db.query('COMMIT');
    return res.status(201).json({ success: true, package: clientPackage, payment });
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    if (responded) return;
    if (sendDbClientError(res, error)) return;
    console.error('assignPackage error:', error);
    return res.status(500).json({ error: 'Failed to assign package.' });
  } finally {
    db.release();
  }
};

/**
 * PUT /api/clients/:clientId/packages/:id
 * Update status or notes of a client package.
 */
const updateClientPackage = async (req, res) => {
  const tenantId = req.user.tenantId;
  const { id } = req.params;
  const { status, notes } = req.body;

  if (status !== undefined && status !== null && !CLIENT_PACKAGE_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `status must be one of: ${CLIENT_PACKAGE_STATUSES.join(', ')}`,
    });
  }

  try {
    const result = await pool.query(
      `UPDATE client_packages
       SET status     = COALESCE($1, status),
           notes      = COALESCE($2, notes),
           updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4
       RETURNING *`,
      [status, notes, id, tenantId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Client package not found.' });
    return res.json({ success: true, package: result.rows[0] });
  } catch (error) {
    if (sendDbClientError(res, error)) return;
    console.error('updateClientPackage error:', error);
    return res.status(500).json({ error: 'Failed to update client package.' });
  }
};

/**
 * POST /api/clients/:clientId/packages/:id/use-session
 *
 * Charges a session against ONE named package, rather than letting the service
 * pick. It exists for the "log this against that block specifically" case; the
 * automatic path is session completion, which chooses the next-expiring package
 * itself (services/packageUsageService.js).
 *
 * It used to write `client_packages.sessions_used` directly with `+ 1`, which
 * made the counter a second source of truth that could drift from the rows
 * meant to explain it. It now writes the ledger and lets the counter be
 * recomputed from it, exactly like every other charge.
 */
const useSession = async (req, res) => {
  const tenantId = req.user.tenantId;
  const userId = req.user.userId;
  const { id } = req.params;
  const { sessionId } = req.body;

  const db = await getClient();
  let responded = false;

  try {
    await db.query('BEGIN');

    const cpRes = await db.query(
      `SELECT * FROM client_packages
        WHERE id = $1 AND tenant_id = $2 AND status = 'active'
        FOR UPDATE`,
      [id, tenantId]
    );
    if (!cpRes.rows.length) {
      responded = true;
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Active client package not found.' });
    }

    // A session id from the request body is not trusted to be ours. It used to
    // be written straight into the ledger, so a caller could attach their own
    // package charge to a session id belonging to someone else.
    if (sessionId) {
      const owned = await db.query(
        'SELECT id FROM training_sessions WHERE id = $1 AND tenant_id = $2',
        [sessionId, tenantId]
      );
      if (!owned.rows.length) {
        responded = true;
        await db.query('ROLLBACK');
        return res.status(404).json({ error: 'Session not found.' });
      }

      const existing = await db.query(
        'SELECT id FROM package_session_usage WHERE session_id = $1 AND tenant_id = $2',
        [sessionId, tenantId]
      );
      if (existing.rows.length) {
        responded = true;
        await db.query('ROLLBACK');
        return res.status(409).json({ error: 'Session already recorded against a package.' });
      }

      // The client is part of the ledger key (migration 039): one session can
      // charge several clients when it is an ad-hoc group session, so a charge
      // has to say whose it is.
      await db.query(
        `INSERT INTO package_session_usage
           (tenant_id, client_package_id, session_id, client_id, kind, quantity, created_by)
         VALUES ($1, $2, $3, $4, 'session', 1, $5)`,
        [tenantId, id, sessionId, cpRes.rows[0].client_id, userId || null]
      );
    } else {
      // No session to point at: this is a manual charge and is recorded as one,
      // so the balance still has a row that explains it.
      await db.query(
        `INSERT INTO package_session_usage
           (tenant_id, client_package_id, client_id, kind, quantity, reason, created_by)
         VALUES ($1, $2, $3, 'adjustment', 1, $4, $5)`,
        [tenantId, id, cpRes.rows[0].client_id, 'Session recorded manually', userId || null]
      );
    }

    const updated = await packageUsage.syncPackage(db, id);
    await db.query('COMMIT');
    return res.json({ success: true, package: updated });
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    if (responded) return;
    if (sendDbClientError(res, error)) return;
    console.error('useSession error:', error);
    return res.status(500).json({ error: 'Failed to record session usage.' });
  } finally {
    db.release();
  }
};

/**
 * POST /api/clients/:clientId/packages/:id/adjust
 *
 * "Give him one back, he was ill." Before this, the only way to express that
 * was to invent or delete a session in the calendar — corrupting the training
 * history to fix a balance. An adjustment is a ledger row with a reason and an
 * author, so the balance still equals the sum of its explanations.
 */
const adjustClientPackage = async (req, res) => {
  const tenantId = req.user.tenantId;
  const userId = req.user.userId;
  const { id } = req.params;
  const { quantity, reason } = req.body;

  const amount = Number.parseInt(quantity, 10);
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 999) {
    return res.status(400).json({
      error: 'quantity must be a non-zero whole number (negative gives sessions back).',
    });
  }
  if (typeof reason !== 'string' || reason.trim().length < 3) {
    return res.status(400).json({ error: 'A reason is required for a manual adjustment.' });
  }

  const db = await getClient();
  try {
    await db.query('BEGIN');
    const result = await packageUsage.adjustPackage(db, {
      tenantId,
      clientPackageId: id,
      quantity: amount,
      reason: reason.trim().slice(0, 500),
      actorId: userId || null,
    });
    if (!result) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Client package not found.' });
    }

    await db.query(
      `INSERT INTO audit_log (trainer_id, action, entity_type, entity_id, ip_address)
       VALUES ($1, 'package_adjusted', 'client_package', $2, $3)`,
      [userId, id, req.ip || null]
    );

    await db.query('COMMIT');
    return res.json({ success: true, package: result.clientPackage, entry: result.entry });
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    if (sendDbClientError(res, error)) return;
    console.error('adjustClientPackage error:', error);
    return res.status(500).json({ error: 'Failed to adjust package.' });
  } finally {
    db.release();
  }
};

/**
 * GET /api/clients/:clientId/packages/:id/ledger
 * Every charge and credit behind one package's balance — the answer to
 * "why does it say four?".
 */
const getClientPackageLedger = async (req, res) => {
  const tenantId = req.user.tenantId;
  const { id } = req.params;
  try {
    const owned = await pool.query(
      'SELECT id FROM client_packages WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (!owned.rows.length) return res.status(404).json({ error: 'Client package not found.' });

    const entries = await packageUsage.getLedger(pool, { tenantId, clientPackageId: id });
    return res.json({ success: true, entries });
  } catch (error) {
    if (sendDbClientError(res, error)) return;
    console.error('getClientPackageLedger error:', error);
    return res.status(500).json({ error: 'Failed to fetch package history.' });
  }
};

module.exports = {
  getPackages, getPackage, createPackage, updatePackage, deletePackage,
  getClientPackages, getActiveClientPackage, assignPackage,
  updateClientPackage, useSession, adjustClientPackage, getClientPackageLedger
};
