-- backend/migrations/039_usage_ledger_per_client.sql
--
-- ── Why ──────────────────────────────────────────────────────────────────────
-- Migration 037 made the usage ledger able to describe a charge caused by an
-- individual session or by group attendance. It keyed the individual case on
-- `session_id` alone, which assumed one session charges exactly one client.
--
-- Ad-hoc group sessions break that assumption, and they are a real part of the
-- product: two or three clients who train together without being a named group
-- (`training_sessions.is_group`, `session_attendees`, migration 023). One
-- session, three clients, three packages to charge.
--
-- ── What this changes ────────────────────────────────────────────────────────
-- Every charge becomes (client, event) rather than (event): the client is
-- recorded on every row, and uniqueness is per client per event. That is what
-- the ledger always meant — "this client's package paid for this" — and it now
-- says so for both kinds of session.
--
-- ── Safety ───────────────────────────────────────────────────────────────────
-- Existing individual rows get their client from the session they point at, so
-- no balance changes. The idempotency guarantee is preserved and tightened: a
-- given client can still be charged only once for a given session.

-- ── 1. Every charge names its client ─────────────────────────────────────────
UPDATE package_session_usage psu
   SET client_id = ts.client_id
  FROM training_sessions ts
 WHERE psu.session_id = ts.id
   AND psu.client_id IS NULL;

-- An adjustment belongs to a package, not to an event, and the package already
-- names the client. Fill it in anyway so every row can answer "for whom".
UPDATE package_session_usage psu
   SET client_id = cp.client_id
  FROM client_packages cp
 WHERE psu.client_package_id = cp.id
   AND psu.client_id IS NULL;

-- ── 2. One charge per client per event ───────────────────────────────────────
DROP INDEX IF EXISTS uq_pkg_usage_session;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pkg_usage_session_client
  ON package_session_usage(session_id, client_id)
  WHERE session_id IS NOT NULL;

-- ── 3. The shape constraint follows ──────────────────────────────────────────
ALTER TABLE package_session_usage DROP CONSTRAINT IF EXISTS chk_pkg_usage_shape;
ALTER TABLE package_session_usage ADD CONSTRAINT chk_pkg_usage_shape CHECK (
     (kind = 'session'       AND session_id IS NOT NULL AND client_id IS NOT NULL AND group_session_id IS NULL)
  OR (kind = 'group_session' AND group_session_id IS NOT NULL AND client_id IS NOT NULL AND session_id IS NULL)
  OR (kind = 'adjustment'    AND session_id IS NULL AND group_session_id IS NULL)
);

-- ── 4. Ad-hoc attendance answers the no-show question too ────────────────────
-- Same reasoning as `training_sessions.no_show_charged` in migration 037: the
-- trainer's decision has to survive the next edit of the session.
ALTER TABLE session_attendees
  ADD COLUMN IF NOT EXISTS no_show_charged BOOLEAN NOT NULL DEFAULT false;
