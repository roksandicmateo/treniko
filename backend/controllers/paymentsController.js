// backend/controllers/paymentsController.js
'use strict';

const { pool } = require('../config/database');

// ── helpers ───────────────────────────────────────────────────────────────────

const ALLOWED_METHODS  = ['cash', 'bank_transfer', 'card', 'other'];
const ALLOWED_STATUSES = ['paid', 'pending'];

// ── GET /api/clients/:clientId/payments ───────────────────────────────────────
/**
 * List all payments for a client, newest first.
 * Includes a joined snapshot of the linked package name (if any).
 */
const getClientPayments = async (req, res) => {
  const tenantId  = req.user.tenantId;
  const { clientId } = req.params;

  try {
    // Verify the client belongs to this tenant
    const clientCheck = await pool.query(
      `SELECT id FROM clients WHERE id = $1 AND tenant_id = $2`,
      [clientId, tenantId]
    );
    if (!clientCheck.rows.length) {
      return res.status(404).json({ error: 'Client not found.' });
    }

    const result = await pool.query(
      `SELECT
         cp.*,
         cpkg.package_name
       FROM client_payments cp
       LEFT JOIN client_packages cpkg ON cp.client_package_id = cpkg.id
       WHERE cp.client_id = $1
         AND cp.tenant_id = $2
       ORDER BY cp.payment_date DESC, cp.created_at DESC`,
      [clientId, tenantId]
    );

    // Also return a quick summary (total paid, total pending)
    const summary = await pool.query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE status = 'paid'),    0) AS total_paid,
         COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) AS total_pending,
         COUNT(*) FILTER (WHERE status = 'paid')    AS count_paid,
         COUNT(*) FILTER (WHERE status = 'pending') AS count_pending
       FROM client_payments
       WHERE client_id = $1 AND tenant_id = $2`,
      [clientId, tenantId]
    );

    return res.json({
      success:  true,
      payments: result.rows,
      summary:  summary.rows[0],
    });
  } catch (err) {
    console.error('getClientPayments error:', err);
    return res.status(500).json({ error: 'Failed to fetch payments.' });
  }
};

// ── POST /api/clients/:clientId/payments ──────────────────────────────────────
/**
 * Log a new payment for a client.
 */
const createPayment = async (req, res) => {
  const tenantId  = req.user.tenantId;
  const { clientId } = req.params;
  const {
    amount,
    clientPackageId = null,
    paymentDate     = new Date().toISOString().split('T')[0],
    paymentMethod   = 'cash',
    status          = 'paid',
    note            = null,
  } = req.body;

  // ── validation ──────────────────────────────────────────────────────────────
  if (amount == null || isNaN(Number(amount)) || Number(amount) < 0) {
    return res.status(400).json({ error: 'A valid amount (≥ 0) is required.' });
  }
  if (!ALLOWED_METHODS.includes(paymentMethod)) {
    return res.status(400).json({
      error: `payment_method must be one of: ${ALLOWED_METHODS.join(', ')}.`,
    });
  }
  if (!ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `status must be one of: ${ALLOWED_STATUSES.join(', ')}.`,
    });
  }

  try {
    // Verify client belongs to tenant
    const clientCheck = await pool.query(
      `SELECT id FROM clients WHERE id = $1 AND tenant_id = $2`,
      [clientId, tenantId]
    );
    if (!clientCheck.rows.length) {
      return res.status(404).json({ error: 'Client not found.' });
    }

    // If a package is linked, verify it belongs to this client + tenant
    if (clientPackageId) {
      const pkgCheck = await pool.query(
        `SELECT id FROM client_packages
         WHERE id = $1 AND client_id = $2 AND tenant_id = $3`,
        [clientPackageId, clientId, tenantId]
      );
      if (!pkgCheck.rows.length) {
        return res.status(404).json({ error: 'Client package not found.' });
      }
    }

    const result = await pool.query(
      `INSERT INTO client_payments
         (tenant_id, client_id, client_package_id,
          amount, currency, payment_date, payment_method, status, note)
       VALUES ($1, $2, $3, $4, 'EUR', $5, $6, $7, $8)
       RETURNING *`,
      [
        tenantId, clientId, clientPackageId || null,
        Number(amount), paymentDate, paymentMethod, status, note || null,
      ]
    );

    return res.status(201).json({ success: true, payment: result.rows[0] });
  } catch (err) {
    console.error('createPayment error:', err);
    return res.status(500).json({ error: 'Failed to log payment.' });
  }
};

// ── PUT /api/clients/:clientId/payments/:id ───────────────────────────────────
/**
 * Edit an existing payment (amount, date, method, status, note).
 */
const updatePayment = async (req, res) => {
  const tenantId  = req.user.tenantId;
  const { clientId, id } = req.params;
  const {
    amount, paymentDate, paymentMethod, status, note, clientPackageId,
  } = req.body;

  if (paymentMethod && !ALLOWED_METHODS.includes(paymentMethod)) {
    return res.status(400).json({
      error: `payment_method must be one of: ${ALLOWED_METHODS.join(', ')}.`,
    });
  }
  if (status && !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `status must be one of: ${ALLOWED_STATUSES.join(', ')}.`,
    });
  }

  try {
    const result = await pool.query(
      `UPDATE client_payments SET
         amount            = COALESCE($1, amount),
         payment_date      = COALESCE($2, payment_date),
         payment_method    = COALESCE($3, payment_method),
         status            = COALESCE($4, status),
         note              = COALESCE($5, note),
         client_package_id = COALESCE($6, client_package_id),
         updated_at        = NOW()
       WHERE id = $7 AND client_id = $8 AND tenant_id = $9
       RETURNING *`,
      [
        amount != null ? Number(amount) : null,
        paymentDate    || null,
        paymentMethod  || null,
        status         || null,
        note           !== undefined ? note : null,
        clientPackageId !== undefined ? clientPackageId : null,
        id, clientId, tenantId,
      ]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Payment not found.' });
    }
    return res.json({ success: true, payment: result.rows[0] });
  } catch (err) {
    console.error('updatePayment error:', err);
    return res.status(500).json({ error: 'Failed to update payment.' });
  }
};

// ── DELETE /api/clients/:clientId/payments/:id ────────────────────────────────
const deletePayment = async (req, res) => {
  const tenantId  = req.user.tenantId;
  const { clientId, id } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM client_payments
       WHERE id = $1 AND client_id = $2 AND tenant_id = $3
       RETURNING id`,
      [id, clientId, tenantId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Payment not found.' });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('deletePayment error:', err);
    return res.status(500).json({ error: 'Failed to delete payment.' });
  }
};

// ── GET /api/billing/summary ──────────────────────────────────────────────────
/**
 * Revenue overview for the trainer dashboard.
 * Returns:
 *  - monthly totals for the last 6 months (for a chart)
 *  - current month totals
 *  - top clients by revenue this month
 *  - pending payments list
 */
const getBillingSummary = async (req, res) => {
  const tenantId = req.user.tenantId;

  try {
    // Monthly totals — last 6 months
    const monthly = await pool.query(
      `SELECT
         TO_CHAR(DATE_TRUNC('month', payment_date), 'YYYY-MM') AS month,
         SUM(amount) FILTER (WHERE status = 'paid')    AS paid,
         SUM(amount) FILTER (WHERE status = 'pending') AS pending,
         COUNT(*)    FILTER (WHERE status = 'paid')    AS count_paid,
         COUNT(*)    FILTER (WHERE status = 'pending') AS count_pending
       FROM client_payments
       WHERE tenant_id   = $1
         AND payment_date >= DATE_TRUNC('month', NOW()) - INTERVAL '5 months'
       GROUP BY DATE_TRUNC('month', payment_date)
       ORDER BY DATE_TRUNC('month', payment_date)`,
      [tenantId]
    );

    // Current month totals
    const currentMonth = await pool.query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE status = 'paid'),    0) AS total_paid,
         COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) AS total_pending
       FROM client_payments
       WHERE tenant_id   = $1
         AND DATE_TRUNC('month', payment_date) = DATE_TRUNC('month', NOW())`,
      [tenantId]
    );

    // Top 5 clients by paid revenue this month
    const topClients = await pool.query(
      `SELECT
         c.id,
         c.first_name,
         c.last_name,
         COALESCE(SUM(cp.amount), 0) AS total_paid
       FROM clients c
       JOIN client_payments cp ON cp.client_id = c.id
       WHERE cp.tenant_id = $1
         AND cp.status = 'paid'
         AND DATE_TRUNC('month', cp.payment_date) = DATE_TRUNC('month', NOW())
       GROUP BY c.id, c.first_name, c.last_name
       ORDER BY total_paid DESC
       LIMIT 5`,
      [tenantId]
    );

    // All pending payments (newest first)
    const pending = await pool.query(
      `SELECT
         cp.*,
         c.first_name,
         c.last_name
       FROM client_payments cp
       JOIN clients c ON cp.client_id = c.id
       WHERE cp.tenant_id = $1
         AND cp.status = 'pending'
       ORDER BY cp.payment_date DESC`,
      [tenantId]
    );

    return res.json({
      success:      true,
      monthlyData:  monthly.rows,
      currentMonth: currentMonth.rows[0],
      topClients:   topClients.rows,
      pending:      pending.rows,
    });
  } catch (err) {
    console.error('getBillingSummary error:', err);
    return res.status(500).json({ error: 'Failed to fetch billing summary.' });
  }
};

module.exports = {
  getClientPayments,
  createPayment,
  updatePayment,
  deletePayment,
  getBillingSummary,
};
