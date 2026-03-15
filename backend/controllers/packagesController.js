// backend/controllers/packagesController.js  (NEW FILE)

const { pool } = require('../config/database');

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
    const activeCheck = await pool.query(
      `SELECT COUNT(*) FROM client_packages
       WHERE package_id = $1 AND status = 'active'`,
      [id]
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

  await runExpiry();

  try {
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

  await runExpiry();

  try {
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
    console.error('getActiveClientPackage error:', error);
    return res.status(500).json({ error: 'Failed to fetch active package.' });
  }
};

/**
 * POST /api/clients/:clientId/packages
 * Assign a package to a client.
 */
const assignPackage = async (req, res) => {
  const tenantId = req.user.tenantId;
  const { clientId } = req.params;
  const { packageId, startDate, notes } = req.body;

  if (!packageId) {
    return res.status(400).json({ error: 'packageId is required.' });
  }

  try {
    // Fetch package template
    const pkgRes = await pool.query(
      `SELECT * FROM packages WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
      [packageId, tenantId]
    );
    if (!pkgRes.rows.length) {
      return res.status(404).json({ error: 'Package not found or inactive.' });
    }
    const pkg = pkgRes.rows[0];

    // Verify client belongs to tenant
    const clientCheck = await pool.query(
      `SELECT id FROM clients WHERE id = $1 AND tenant_id = $2`,
      [clientId, tenantId]
    );
    if (!clientCheck.rows.length) {
      return res.status(404).json({ error: 'Client not found.' });
    }

    // Calculate end_date
    const start = startDate ? new Date(startDate) : new Date();
    let endDate = null;
    if (pkg.duration_days) {
      endDate = new Date(start);
      endDate.setDate(endDate.getDate() + pkg.duration_days);
    }

    const result = await pool.query(
      `INSERT INTO client_packages
        (tenant_id, client_id, package_id, package_name, package_type,
         total_sessions, sessions_per_period, period_days, duration_days,
         price, currency, start_date, end_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        tenantId, clientId, packageId,
        pkg.name, pkg.package_type,
        pkg.total_sessions, pkg.sessions_per_period, pkg.period_days, pkg.duration_days,
        pkg.price, pkg.currency,
        start.toISOString().split('T')[0],
        endDate ? endDate.toISOString().split('T')[0] : null,
        notes || null
      ]
    );

    return res.status(201).json({ success: true, package: result.rows[0] });
  } catch (error) {
    console.error('assignPackage error:', error);
    return res.status(500).json({ error: 'Failed to assign package.' });
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
    console.error('updateClientPackage error:', error);
    return res.status(500).json({ error: 'Failed to update client package.' });
  }
};

/**
 * POST /api/clients/:clientId/packages/:id/use-session
 * Record a session against a client package (called when session is completed).
 */
const useSession = async (req, res) => {
  const tenantId = req.user.tenantId;
  const { id } = req.params;
  const { sessionId } = req.body;

  try {
    // Verify client package exists and is active
    const cpRes = await pool.query(
      `SELECT * FROM client_packages WHERE id = $1 AND tenant_id = $2 AND status = 'active'`,
      [id, tenantId]
    );
    if (!cpRes.rows.length) {
      return res.status(404).json({ error: 'Active client package not found.' });
    }
    const cp = cpRes.rows[0];

    // Check if session already logged
    if (sessionId) {
      const existing = await pool.query(
        `SELECT id FROM package_session_usage WHERE session_id = $1`,
        [sessionId]
      );
      if (existing.rows.length) {
        return res.status(409).json({ error: 'Session already recorded against a package.' });
      }
    }

    // Insert usage record
    await pool.query(
      `INSERT INTO package_session_usage (tenant_id, client_package_id, session_id)
       VALUES ($1, $2, $3)`,
      [tenantId, id, sessionId || null]
    );

    // Increment sessions_used
    const updated = await pool.query(
      `UPDATE client_packages
       SET sessions_used = sessions_used + 1,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    const updatedCp = updated.rows[0];

    // Auto-complete if session_based and all sessions used
    if (updatedCp.package_type === 'session_based' &&
        updatedCp.total_sessions !== null &&
        updatedCp.sessions_used >= updatedCp.total_sessions) {
      await pool.query(
        `UPDATE client_packages SET status = 'completed', updated_at = NOW() WHERE id = $1`,
        [id]
      );
      updatedCp.status = 'completed';
    }

    return res.json({ success: true, package: updatedCp });
  } catch (error) {
    console.error('useSession error:', error);
    return res.status(500).json({ error: 'Failed to record session usage.' });
  }
};

module.exports = {
  getPackages, getPackage, createPackage, updatePackage, deletePackage,
  getClientPackages, getActiveClientPackage, assignPackage,
  updateClientPackage, useSession
};
