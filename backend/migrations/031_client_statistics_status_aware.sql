-- Migration 031 — make client_statistics agree with session status
--
-- ============================================================================
-- WHAT WAS WRONG
-- ============================================================================
-- client_statistics (migration 002) predates the `status` column that
-- migration 013 added to training_sessions. It classifies a session purely by
-- its date:
--
--     upcoming_sessions  = COUNT(session_date >= CURRENT_DATE)
--     completed_sessions = COUNT(session_date <  CURRENT_DATE)
--
-- So, measured against a real trainer's data:
--
--   * a session the trainer marked COMPLETED today or tomorrow counted as
--     "upcoming" and NOT as "completed" — the client list showed "0 completed"
--     for a client whose sessions were all done;
--   * a CANCELLED session counted in both `total_sessions` and, once its date
--     passed, in `completed_sessions`;
--   * a NO_SHOW counted as completed.
--
-- Meanwhile the dashboard counts completions with `is_completed = true`. Two
-- screens, two answers, from the same rows — which is what made the numbers
-- untrustworthy rather than merely wrong.
--
-- ============================================================================
-- WHAT THIS CHANGES
-- ============================================================================
-- The view is redefined so status is the classifier and the date only breaks
-- ties for what is still ahead:
--
--     total_sessions     — everything except cancelled
--     completed_sessions — status = 'completed'
--     upcoming_sessions  — status = 'scheduled' and dated today or later
--     last_session_date  — most recent non-cancelled session
--     next_session_date  — earliest scheduled session dated today or later
--
-- `no_show` counts toward the total (it happened, and the slot was spent) but
-- is neither completed nor upcoming.
--
-- ============================================================================
-- SAFETY
-- ============================================================================
-- A view definition only. No table is read, written or locked; no data is
-- altered. CREATE OR REPLACE VIEW keeps the column list identical — same names,
-- same order, same types — so nothing that selects from it needs to change, and
-- re-running the migration is a no-op.
--
-- Row-level security is unaffected: the view has no policies of its own and
-- resolves against the underlying tables, whose policies apply to the caller as
-- before.

CREATE OR REPLACE VIEW client_statistics AS
SELECT
    c.id        AS client_id,
    c.tenant_id,
    COUNT(ts.id) FILTER (WHERE ts.status <> 'cancelled')            AS total_sessions,
    COUNT(ts.id) FILTER (WHERE ts.status = 'scheduled'
                           AND ts.session_date >= CURRENT_DATE)     AS upcoming_sessions,
    COUNT(ts.id) FILTER (WHERE ts.status = 'completed')             AS completed_sessions,
    MAX(ts.session_date) FILTER (WHERE ts.status <> 'cancelled')    AS last_session_date,
    MIN(ts.session_date) FILTER (WHERE ts.status = 'scheduled'
                                   AND ts.session_date >= CURRENT_DATE) AS next_session_date
FROM clients c
LEFT JOIN training_sessions ts ON c.id = ts.client_id
GROUP BY c.id, c.tenant_id;

COMMENT ON VIEW client_statistics IS
  'Per-client session counts classified by training_sessions.status (see migration 031). Cancelled sessions are excluded from every count.';
