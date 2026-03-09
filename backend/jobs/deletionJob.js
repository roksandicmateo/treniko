// backend/jobs/deletionJob.js  (NEW FILE)
// Runs daily — permanently erases accounts and clients whose 30-day window has passed.
// This file is loaded by backend/cron.js

const { pool } = require('../config/database');

const executePendingDeletions = async () => {
  console.log('[deletionJob] Checking for scheduled deletions...');

  try {
    // ── 1. Client deletions ──────────────────────────────────────────
    const clientDeletions = await pool.query(
      `SELECT id, trainer_id, target_id
       FROM deletion_requests
       WHERE target_type = 'client'
         AND status = 'pending'
         AND scheduled_delete_at <= NOW()`
    );

    for (const req of clientDeletions.rows) {
      try {
        // Hard delete — CASCADE handles related records
        await pool.query(`DELETE FROM clients WHERE id = $1`, [req.target_id]);

        await pool.query(
          `UPDATE deletion_requests SET status = 'completed', completed_at = NOW()
           WHERE id = $1`,
          [req.id]
        );

        await pool.query(
          `INSERT INTO audit_log (trainer_id, action, entity_type, entity_id)
           VALUES ($1, 'client_permanently_deleted', 'client', $2)`,
          [req.trainer_id, req.target_id]
        );

        console.log(`[deletionJob] Client ${req.target_id} permanently deleted.`);
      } catch (err) {
        console.error(`[deletionJob] Failed to delete client ${req.target_id}:`, err.message);
      }
    }

    // ── 2. Account deletions ─────────────────────────────────────────
    const accountDeletions = await pool.query(
      `SELECT id, trainer_id
       FROM deletion_requests
       WHERE target_type = 'account'
         AND status = 'pending'
         AND scheduled_delete_at <= NOW()`
    );

    for (const req of accountDeletions.rows) {
      try {
        // Delete all clients first (CASCADE will handle related data)
        await pool.query(
          `DELETE FROM clients WHERE tenant_id = (
            SELECT tenant_id FROM users WHERE id = $1
          )`,
          [req.trainer_id]
        );

        // Delete the user — CASCADE handles tenants, sessions, logs etc.
        await pool.query(`DELETE FROM users WHERE id = $1`, [req.trainer_id]);

        await pool.query(
          `UPDATE deletion_requests SET status = 'completed', completed_at = NOW()
           WHERE id = $1`,
          [req.id]
        );

        console.log(`[deletionJob] Account ${req.trainer_id} permanently deleted.`);
      } catch (err) {
        console.error(`[deletionJob] Failed to delete account ${req.trainer_id}:`, err.message);
      }
    }

    const total = clientDeletions.rows.length + accountDeletions.rows.length;
    if (total === 0) {
      console.log('[deletionJob] No pending deletions.');
    } else {
      console.log(`[deletionJob] Processed ${total} deletion(s).`);
    }
  } catch (error) {
    console.error('[deletionJob] Fatal error:', error);
  }
};

module.exports = { executePendingDeletions };
