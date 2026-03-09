// backend/controllers/deletionController.js  (NEW FILE)

const { pool } = require('../config/database');

/**
 * POST /api/account/request-deletion
 * Schedule full account erasure in 30 days.
 */
const requestAccountDeletion = async (req, res) => {
  const trainerId = req.user.userId;
  const ip = req.ip || req.connection.remoteAddress;

  try {
    // Check if there's already a pending request
    const existing = await pool.query(
      `SELECT id, scheduled_delete_at FROM deletion_requests
       WHERE trainer_id = $1 AND target_type = 'account' AND status = 'pending'`,
      [trainerId]
    );

    if (existing.rows.length) {
      return res.status(200).json({
        success: true,
        already_pending: true,
        scheduled_delete_at: existing.rows[0].scheduled_delete_at,
        message: 'A deletion request is already pending.'
      });
    }

    const result = await pool.query(
      `INSERT INTO deletion_requests (trainer_id, target_type, target_id, status, scheduled_delete_at)
       VALUES ($1, 'account', $1, 'pending', NOW() + INTERVAL '30 days')
       RETURNING *`,
      [trainerId]
    );

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (trainer_id, action, entity_type, entity_id, ip_address)
       VALUES ($1, 'account_deletion_requested', 'trainer', $1, $2)`,
      [trainerId, ip]
    );

    return res.status(200).json({
      success: true,
      scheduled_delete_at: result.rows[0].scheduled_delete_at,
      message: 'Account deletion scheduled in 30 days. You can cancel this at any time before then.'
    });
  } catch (error) {
    console.error('requestAccountDeletion error:', error);
    return res.status(500).json({ error: 'Failed to schedule account deletion.' });
  }
};

/**
 * POST /api/account/cancel-deletion
 * Cancel a pending account deletion request.
 */
const cancelAccountDeletion = async (req, res) => {
  const trainerId = req.user.userId;

  try {
    const result = await pool.query(
      `UPDATE deletion_requests
       SET status = 'cancelled'
       WHERE trainer_id = $1 AND target_type = 'account' AND status = 'pending'
       RETURNING *`,
      [trainerId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'No pending deletion request found.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Account deletion cancelled successfully.'
    });
  } catch (error) {
    console.error('cancelAccountDeletion error:', error);
    return res.status(500).json({ error: 'Failed to cancel deletion request.' });
  }
};

/**
 * GET /api/account/deletion-status
 * Check if account deletion is pending.
 */
const getAccountDeletionStatus = async (req, res) => {
  const trainerId = req.user.userId;

  try {
    const result = await pool.query(
      `SELECT id, status, scheduled_delete_at, created_at
       FROM deletion_requests
       WHERE trainer_id = $1 AND target_type = 'account' AND status = 'pending'
       ORDER BY created_at DESC
       LIMIT 1`,
      [trainerId]
    );

    if (!result.rows.length) {
      return res.status(200).json({ pending: false });
    }

    return res.status(200).json({
      pending: true,
      scheduled_delete_at: result.rows[0].scheduled_delete_at,
      created_at: result.rows[0].created_at
    });
  } catch (error) {
    console.error('getAccountDeletionStatus error:', error);
    return res.status(500).json({ error: 'Failed to fetch deletion status.' });
  }
};

/**
 * POST /api/clients/:id/request-deletion
 * Schedule a single client's permanent erasure in 30 days.
 */
const requestClientDeletion = async (req, res) => {
  const trainerId = req.user.userId;
  const tenantId = req.user.tenantId;
  const clientId = req.params.id;
  const ip = req.ip || req.connection.remoteAddress;

  try {
    // Verify client belongs to this trainer
    const clientCheck = await pool.query(
      `SELECT id, first_name, last_name FROM clients WHERE id = $1 AND tenant_id = $2`,
      [clientId, tenantId]
    );
    if (!clientCheck.rows.length) {
      return res.status(404).json({ error: 'Client not found.' });
    }

    // Check if already pending
    const existing = await pool.query(
      `SELECT id, scheduled_delete_at FROM deletion_requests
       WHERE trainer_id = $1 AND target_type = 'client' AND target_id = $2 AND status = 'pending'`,
      [trainerId, clientId]
    );

    if (existing.rows.length) {
      return res.status(200).json({
        success: true,
        already_pending: true,
        scheduled_delete_at: existing.rows[0].scheduled_delete_at,
        message: 'A deletion request for this client is already pending.'
      });
    }

    const result = await pool.query(
      `INSERT INTO deletion_requests (trainer_id, target_type, target_id, status, scheduled_delete_at)
       VALUES ($1, 'client', $2, 'pending', NOW() + INTERVAL '30 days')
       RETURNING *`,
      [trainerId, clientId]
    );

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (trainer_id, action, entity_type, entity_id, ip_address)
       VALUES ($1, 'client_deletion_requested', 'client', $2, $3)`,
      [trainerId, clientId, ip]
    );

    const client = clientCheck.rows[0];
    return res.status(200).json({
      success: true,
      scheduled_delete_at: result.rows[0].scheduled_delete_at,
      message: `Permanent deletion of ${client.first_name} ${client.last_name} scheduled in 30 days.`
    });
  } catch (error) {
    console.error('requestClientDeletion error:', error);
    return res.status(500).json({ error: 'Failed to schedule client deletion.' });
  }
};

/**
 * POST /api/clients/:id/cancel-deletion
 * Cancel a pending client deletion request.
 */
const cancelClientDeletion = async (req, res) => {
  const trainerId = req.user.userId;
  const clientId = req.params.id;

  try {
    const result = await pool.query(
      `UPDATE deletion_requests
       SET status = 'cancelled'
       WHERE trainer_id = $1 AND target_type = 'client' AND target_id = $2 AND status = 'pending'
       RETURNING *`,
      [trainerId, clientId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'No pending deletion request found for this client.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Client deletion cancelled successfully.'
    });
  } catch (error) {
    console.error('cancelClientDeletion error:', error);
    return res.status(500).json({ error: 'Failed to cancel client deletion.' });
  }
};

module.exports = {
  requestAccountDeletion,
  cancelAccountDeletion,
  getAccountDeletionStatus,
  requestClientDeletion,
  cancelClientDeletion
};
