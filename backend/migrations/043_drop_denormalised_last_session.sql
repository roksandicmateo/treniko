-- Migration 043 — one definition of "last session", not two
--
-- ============================================================================
-- WHAT THIS FINISHES
-- ============================================================================
-- Migration 042 corrected both answers to "when did this client last train":
-- the `client_statistics` view, and the denormalised `clients.last_session_date`
-- column that a trigger keeps in step with it. Correct, but still two
-- definitions of one fact, and the column is the weaker of the two:
--
--   * it is only as fresh as the last write to that client's sessions. The
--     definition contains CURRENT_DATE, so a session marked completed with a
--     future date is excluded today and belongs tomorrow — and nothing
--     recomputes the column when a date simply passes;
--   * it is a second place for the rule to drift out of agreement with the
--     view, which is how the two ended up disagreeing in the first place;
--   * it earns nothing. Both readers — the clients list and the dashboard's
--     "gone quiet" panel — already join `client_statistics` for their other
--     numbers, so reading `last_session_date` from it costs no extra join.
--
-- So the column, its trigger and its function go, and the view is the only
-- definition left. Both callers were switched to `cs.last_session_date` in the
-- same commit as this migration; nothing else in the codebase referenced it
-- (checked with a repository-wide search).
--
-- ============================================================================
-- DEPLOY ORDER — THIS MATTERS
-- ============================================================================
-- Application code that still selects `c.last_session_date` will fail once this
-- runs. Deploy the code FIRST and run this AFTER the API restarts:
--
--     git pull → npm ci → build → pm2 restart treniko-api → npm run db:migrate
--
-- The new code works against the old schema (it reads the view, which exists
-- either way), so that order has no broken window. The reverse order does.
--
-- Rolling back means restoring the column, the function and the trigger from
-- migration 002 and backfilling with the SELECT in step 4 below, which is why
-- that SELECT is written out in full rather than folded away.
--
-- ============================================================================
-- SAFETY
-- ============================================================================
-- Dropping a derived column. No session, client, package or payment row is read
-- or written; every value in the column can be recomputed from
-- `training_sessions`, which is where it came from. Row-level security is
-- untouched: no policy references this column, and the view resolves against
-- the same tables under the same policies as before.

-- ─── 1. The trigger ─────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trigger_update_last_session ON training_sessions;

-- ─── 2. The function it called ──────────────────────────────────────────────
DROP FUNCTION IF EXISTS update_client_last_session();

-- ─── 3. The column ──────────────────────────────────────────────────────────
ALTER TABLE clients DROP COLUMN IF EXISTS last_session_date;

-- ─── 4. For rollback ────────────────────────────────────────────────────────
-- The value this column held, should it ever need to come back:
--
--   ALTER TABLE clients ADD COLUMN last_session_date DATE;
--   UPDATE clients c SET last_session_date = (
--     SELECT MAX(ts.session_date)
--       FROM training_sessions ts
--      WHERE ts.client_id = c.id
--        AND ts.status = 'completed'
--        AND ts.session_date <= CURRENT_DATE
--   );
--   -- then re-create update_client_last_session() and its trigger from
--   -- migration 042.

SELECT 'Migration 043 complete ✓' AS status;
