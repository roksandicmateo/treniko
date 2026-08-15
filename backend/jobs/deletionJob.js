// backend/jobs/deletionJob.js
// Runs daily — permanently erases accounts and clients whose 30-day window has
// passed. This file is loaded by backend/cron.js.

const { pool } = require('../config/database');
const { runWithTenantContext } = require('../config/tenantContext');

/**
 * ── Why this job needed reworking for row-level security (Phase 4) ───────────
 *
 * The job is inherently cross-tenant: it scans `deletion_requests` for every
 * tenant and then deletes rows belonging to each. It runs from a timer, so
 * there is no request and therefore no ambient tenant context.
 *
 * Under RLS that combination was silently destructive rather than merely
 * broken. `DELETE FROM clients WHERE id = $1` with no tenant context matches no
 * rows — and `DELETE` reports success having deleted nothing. The job would then
 * mark the request `completed`. The result: a GDPR erasure request recorded as
 * fulfilled while the personal data remained in the database, with nothing in
 * the logs to say so.
 *
 * ── The design ───────────────────────────────────────────────────────────────
 * Rather than exempting the job from RLS, it establishes the correct tenant
 * context for each unit of work:
 *
 *   1. Enumerate pending requests. `deletion_requests` is deliberately outside
 *      the enforced set (migration 029, section D) precisely so this scan is
 *      possible; the same is true of `users`, which is how a request is
 *      resolved to a tenant.
 *   2. Resolve each request to the tenant that owns it — from the database,
 *      via the requesting trainer, never from anything caller-supplied.
 *   3. Do that request's work inside that tenant's context, so every delete is
 *      still checked by the same policies a request would be checked by.
 *
 * A tenant boundary crossing is therefore impossible here for the same reason
 * it is impossible in a controller: both controls apply. Each delete carries an
 * explicit `AND tenant_id = $n` — the primary control, which holds even where
 * policies are skipped — and runs under the tenant's context, which is the
 * backstop. What the job gains is the ability to act as each tenant in turn,
 * one at a time; not the ability to act outside all of them.
 *
 * The alternatives were all rejected: granting the runtime role BYPASSRLS, or
 * making it a table owner, or introducing a "maintenance mode" that disables
 * policies, would each have removed the boundary for the whole process rather
 * than scoping it.
 *
 * ── Verification ─────────────────────────────────────────────────────────────
 * A delete that affects zero rows is now treated as a failure and the request
 * is NOT marked completed, so the silent-success mode above cannot recur.
 */

/** Resolve the tenant that owns a deletion request, via its trainer. */
const tenantForTrainer = async (trainerId) => {
  const { rows } = await pool.query(
    'SELECT tenant_id FROM users WHERE id = $1',
    [trainerId]
  );
  return rows[0] ? rows[0].tenant_id : null;
};

const executePendingDeletions = async () => {
  console.log('[deletionJob] Checking for scheduled deletions...');

  let processed = 0;
  let failed = 0;

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
        const tenantId = await tenantForTrainer(req.trainer_id);
        if (!tenantId) {
          // The trainer is already gone — most likely erased by an account
          // deletion, which cascades the clients too. Nothing to do, and
          // nothing to mark completed against.
          console.warn(
            `[deletionJob] Skipping client request ${req.id}: trainer no longer exists.`
          );
          failed += 1;
          continue;
        }

        // Two independent controls, in the order the rest of the codebase uses
        // them: the explicit tenant_id predicate is the primary one and holds
        // even where policies are skipped (an owner connection, a deployment
        // that has not switched DB_USER yet); the tenant context is the
        // backstop underneath it. Relying on the context alone would have made
        // this job's isolation disappear the moment RLS was not in force.
        const deleted = await runWithTenantContext(
          { tenantId, userId: req.trainer_id },
          async () => {
            const result = await pool.query(
              'DELETE FROM clients WHERE id = $1 AND tenant_id = $2',
              [req.target_id, tenantId]
            );
            return result.rowCount;
          }
        );

        if (deleted === 0) {
          // Either the client was already removed, or the row belongs to a
          // different tenant than the request claims. Both are anomalies, and
          // neither may be recorded as a completed erasure.
          console.error(
            `[deletionJob] Client ${req.target_id} matched no row under its own ` +
            'tenant context; request left pending for investigation.'
          );
          failed += 1;
          continue;
        }

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

        processed += 1;
        console.log(`[deletionJob] Client ${req.target_id} permanently deleted.`);
      } catch (err) {
        failed += 1;
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
        const tenantId = await tenantForTrainer(req.trainer_id);
        if (!tenantId) {
          console.warn(
            `[deletionJob] Skipping account request ${req.id}: trainer no longer exists.`
          );
          failed += 1;
          continue;
        }

        // Clients are RLS-protected, so this must run as the tenant. Deleting
        // zero clients is legitimate here — an account may simply have none —
        // so it is not treated as a failure, unlike the client case above.
        await runWithTenantContext({ tenantId, userId: req.trainer_id }, () =>
          pool.query('DELETE FROM clients WHERE tenant_id = $1', [tenantId])
        );

        // users is outside the enforced set. Deleting the trainer cascades the
        // remaining tenant-owned data. Referential CASCADE is performed by
        // PostgreSQL itself and is not filtered by policies, so the cascade
        // reaches protected child rows correctly.
        const removed = await pool.query('DELETE FROM users WHERE id = $1', [req.trainer_id]);
        if (removed.rowCount === 0) {
          console.error(
            `[deletionJob] Account ${req.trainer_id} matched no user row; ` +
            'request left pending for investigation.'
          );
          failed += 1;
          continue;
        }

        await pool.query(
          `UPDATE deletion_requests SET status = 'completed', completed_at = NOW()
           WHERE id = $1`,
          [req.id]
        );

        processed += 1;
        console.log(`[deletionJob] Account ${req.trainer_id} permanently deleted.`);
      } catch (err) {
        failed += 1;
        console.error(`[deletionJob] Failed to delete account ${req.trainer_id}:`, err.message);
      }
    }

    const total = clientDeletions.rows.length + accountDeletions.rows.length;
    if (total === 0) {
      console.log('[deletionJob] No pending deletions.');
    } else {
      console.log(
        `[deletionJob] Processed ${processed} deletion(s)` +
        (failed ? `, ${failed} left pending after failure.` : '.')
      );
    }

    return { processed, failed, considered: total };
  } catch (error) {
    console.error('[deletionJob] Fatal error:', error);
    return { processed, failed, considered: 0, fatal: true };
  }
};

module.exports = { executePendingDeletions };
