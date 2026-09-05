-- Migration 042 — "last session" must mean a session that actually happened
--
-- ============================================================================
-- WHAT WAS WRONG
-- ============================================================================
-- Two places answer the question "when did this client last train", and both
-- answered it with the most recent session on record, whatever its status and
-- whatever its date:
--
--   clients.last_session_date   maintained by update_client_last_session()
--                               (migration 002): MAX(session_date) over every
--                               session, with no status filter at all.
--
--   client_statistics           the view (migration 031):
--     .last_session_date          MAX(session_date) FILTER (status <> 'cancelled')
--
-- So a client with a session booked for next Thursday had next Thursday shown
-- to the trainer under a column headed **Last session**, and a client whose only
-- recent session was cancelled or a no-show read as recently trained.
--
-- That is not only a wrong label. `clients.last_session_date` is what the
-- dashboard's "needs your attention" panel uses to find clients who have gone
-- quiet (see controllers/dashboardController.js): a single future booking made a
-- dormant client look active, which is exactly the client the panel exists to
-- surface. The bug hid the thing it was built to show.
--
-- ============================================================================
-- WHAT THIS CHANGES
-- ============================================================================
-- Both definitions become the same rule:
--
--     the most recent session with status 'completed', dated today or earlier
--
-- Two conditions, each doing separate work:
--
--   status = 'completed'      — the state machine's own word for a session that
--                               was held (migration 013: scheduled | completed |
--                               cancelled | no_show). 'scheduled' has not
--                               happened yet; 'cancelled' did not happen;
--                               'no_show' means the client did not attend, and
--                               counting it here would suppress precisely the
--                               dormant-client alert that matters. It still
--                               counts toward total_sessions, as migration 031
--                               established, because the slot was spent.
--
--   session_date <= CURRENT_DATE — a trainer can mark a session completed ahead
--                               of its date; migration 031 documents that
--                               happening. Without this guard "last session"
--                               could still print a future date, which is the
--                               defect this migration exists to make impossible.
--
-- Nothing else about the view changes: same columns, same order, same types, so
-- every caller keeps working.
--
-- The trigger is also fixed in a second respect. It fired
-- `AFTER INSERT OR UPDATE OF session_date`, so *marking a session completed or
-- cancelled never refreshed the column* — the one event that can change the
-- answer was the one event it ignored — and deleting a session left the old
-- value behind forever. It now fires on INSERT, UPDATE and DELETE.
--
-- ============================================================================
-- SAFETY
-- ============================================================================
-- A view definition, a function body, a trigger definition, and one UPDATE that
-- recomputes an existing derived column from rows that are already there. No
-- table is created or dropped, no session row is read into or written out of
-- another tenant, and the backfill is idempotent — re-running the migration
-- recomputes the same values.
--
-- Row-level security is untouched. The view has no policies of its own and
-- resolves against the underlying tables; the trigger function stays SECURITY
-- INVOKER, so it sees exactly the rows its caller may see, which is what keeps
-- one tenant's sessions out of another tenant's statistics.

-- ─── 1. The view ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW client_statistics AS
SELECT
    c.id        AS client_id,
    c.tenant_id,
    COUNT(ts.id) FILTER (WHERE ts.status <> 'cancelled')            AS total_sessions,
    COUNT(ts.id) FILTER (WHERE ts.status = 'scheduled'
                           AND ts.session_date >= CURRENT_DATE)     AS upcoming_sessions,
    COUNT(ts.id) FILTER (WHERE ts.status = 'completed')             AS completed_sessions,
    MAX(ts.session_date) FILTER (WHERE ts.status = 'completed'
                                   AND ts.session_date <= CURRENT_DATE) AS last_session_date,
    MIN(ts.session_date) FILTER (WHERE ts.status = 'scheduled'
                                   AND ts.session_date >= CURRENT_DATE) AS next_session_date
FROM clients c
LEFT JOIN training_sessions ts ON c.id = ts.client_id
GROUP BY c.id, c.tenant_id;

COMMENT ON VIEW client_statistics IS
  'Per-client session counts classified by training_sessions.status (migrations 031, 042). Cancelled sessions are excluded from every count; last_session_date is the most recent COMPLETED session dated today or earlier, never a future booking.';

-- ─── 2. The trigger function ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_client_last_session()
RETURNS TRIGGER AS $$
DECLARE
    affected_client UUID;
BEGIN
    -- On DELETE there is no NEW row; the client to recompute is on OLD.
    affected_client := COALESCE(NEW.client_id, OLD.client_id);

    IF affected_client IS NOT NULL THEN
        UPDATE clients
        SET last_session_date = (
            SELECT MAX(session_date)
            FROM training_sessions
            WHERE client_id = affected_client
              AND status = 'completed'
              AND session_date <= CURRENT_DATE
        )
        WHERE id = affected_client;
    END IF;

    -- AFTER triggers ignore the return value; returning the row that exists
    -- keeps the function usable from any of the three events.
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_client_last_session() IS
  'Recomputes clients.last_session_date as the most recent COMPLETED session dated today or earlier (migration 042). Matches client_statistics.last_session_date.';

-- ─── 3. The trigger ─────────────────────────────────────────────────────────
-- Was: AFTER INSERT OR UPDATE OF session_date — which never fired on the status
-- change that decides the answer, and never fired on DELETE.
DROP TRIGGER IF EXISTS trigger_update_last_session ON training_sessions;
CREATE TRIGGER trigger_update_last_session
    AFTER INSERT OR UPDATE OR DELETE ON training_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_client_last_session();

-- ─── 4. Backfill ────────────────────────────────────────────────────────────
-- Existing rows still hold the old, status-blind value; the trigger only
-- corrects a client on their next session write. Recompute every client once.
UPDATE clients c
SET last_session_date = sub.last_completed
FROM (
    SELECT cl.id,
           MAX(ts.session_date) FILTER (WHERE ts.status = 'completed'
                                          AND ts.session_date <= CURRENT_DATE) AS last_completed
    FROM clients cl
    LEFT JOIN training_sessions ts ON ts.client_id = cl.id
    GROUP BY cl.id
) sub
WHERE c.id = sub.id
  AND c.last_session_date IS DISTINCT FROM sub.last_completed;

SELECT 'Migration 042 complete ✓' AS status;
