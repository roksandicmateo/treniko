-- backend/migrations/037_package_usage_ledger.sql
--
-- ── Why ──────────────────────────────────────────────────────────────────────
-- `package_session_usage` was a link table: one row per completed individual
-- session, one session per package, quantity implicitly 1. Three things the
-- product actually needs could not be expressed in it:
--
--   1. Group attendance. Completing a group session for five members is five
--      charges against five different packages, and there is no
--      `training_sessions` row to hang them on — group sessions live in their
--      own table. Attendance therefore consumed nothing at all, and a trainer
--      running small groups watched every package balance stand still.
--   2. Manual correction. "Give him one back, he was ill" had no
--      representation, so the only way to correct a balance was to invent a
--      session in the calendar.
--   3. An auditable answer to "why is this balance what it is". The counter
--      `client_packages.sessions_used` was incremented directly with `+ 1`,
--      which made it a second source of truth that could — and under a partial
--      failure did — drift away from the rows that were supposed to explain it.
--
-- ── What this changes ────────────────────────────────────────────────────────
-- The table becomes a signed ledger. Every row says how much was charged
-- (`quantity`, negative for a credit), what caused it (`kind`), and — for a
-- manual adjustment — why and by whom. `sessions_used` stays, but is no longer
-- written by hand anywhere: `sync_client_package_usage()` recomputes it as
-- SUM(quantity) over the ledger, so the counter is a cache of the ledger and
-- can always be rebuilt from it (scripts/reconcile-package-usage.js).
--
-- ── Safety ───────────────────────────────────────────────────────────────────
-- Additive. Existing rows get kind='session', quantity=1 from the column
-- defaults, which is exactly what they already meant. The old UNIQUE(session_id)
-- becomes a partial unique index over the same column, so the idempotency
-- guarantee that "one session cannot be charged twice" survives unchanged.

-- ── 1. Ledger columns ────────────────────────────────────────────────────────
ALTER TABLE package_session_usage
  ADD COLUMN IF NOT EXISTS group_session_id UUID REFERENCES group_sessions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS client_id        UUID REFERENCES clients(id)        ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS quantity         INT  NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS kind             VARCHAR(20) NOT NULL DEFAULT 'session',
  ADD COLUMN IF NOT EXISTS reason           TEXT,
  ADD COLUMN IF NOT EXISTS created_by       UUID REFERENCES users(id) ON DELETE SET NULL;

-- A group-attendance charge and an adjustment have no individual session.
ALTER TABLE package_session_usage ALTER COLUMN session_id DROP NOT NULL;

-- ── 2. Idempotency, one index per charge source ──────────────────────────────
-- The table-level UNIQUE(session_id) cannot express "unique when present", and
-- would reject the second group-attendance row (both NULL) on some future
-- Postgres semantics change. Partial unique indexes say exactly what is meant:
-- a session can be charged once; a client can be charged once per group session.
ALTER TABLE package_session_usage DROP CONSTRAINT IF EXISTS package_session_usage_session_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pkg_usage_session
  ON package_session_usage(session_id)
  WHERE session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pkg_usage_group_attendance
  ON package_session_usage(group_session_id, client_id)
  WHERE group_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pkg_usage_tenant ON package_session_usage(tenant_id);

-- ── 2b. Classify the rows that predate `kind` ────────────────────────────────
-- `session_id` was already nullable before this migration, and the legacy
-- `POST /use-session` endpoint accepted a call without one — so the table holds
-- charges with nothing to point at. They are exactly what an adjustment is: a
-- unit taken off a package by hand, with no session to explain it. Labelling
-- them as such preserves every balance while making the shape constraint below
-- true of every row.
UPDATE package_session_usage
   SET kind = 'adjustment',
       reason = COALESCE(reason, 'Recorded before the usage ledger existed; no linked session')
 WHERE session_id IS NULL
   AND group_session_id IS NULL
   AND kind = 'session';

-- ── 3. Shape constraints ─────────────────────────────────────────────────────
-- Every row must be one of the three kinds, fully formed. Without this a row
-- with neither a session nor a group session nor a reason is a charge nobody
-- can explain.
ALTER TABLE package_session_usage DROP CONSTRAINT IF EXISTS chk_pkg_usage_shape;
ALTER TABLE package_session_usage ADD CONSTRAINT chk_pkg_usage_shape CHECK (
     (kind = 'session'       AND session_id IS NOT NULL AND group_session_id IS NULL)
  OR (kind = 'group_session' AND group_session_id IS NOT NULL AND client_id IS NOT NULL AND session_id IS NULL)
  OR (kind = 'adjustment'    AND session_id IS NULL AND group_session_id IS NULL)
);

-- A zero-quantity row is a charge that charges nothing: always a mistake.
ALTER TABLE package_session_usage DROP CONSTRAINT IF EXISTS chk_pkg_usage_quantity;
ALTER TABLE package_session_usage ADD CONSTRAINT chk_pkg_usage_quantity CHECK (quantity <> 0);

-- ── 4. Status vocabulary for client_packages ─────────────────────────────────
-- `PUT /clients/:id/packages/:id` accepted any string as a status, so a typo
-- (or a crafted request) could park a package in a state no query looks for,
-- making it invisible to every screen while still holding the client's sessions.
ALTER TABLE client_packages DROP CONSTRAINT IF EXISTS chk_client_package_status;
ALTER TABLE client_packages ADD CONSTRAINT chk_client_package_status
  CHECK (status IN ('active', 'completed', 'expired', 'cancelled'));

-- ── 4b. Was this no-show charged? ────────────────────────────────────────────
-- Whether a no-show costs the client a session is the trainer's policy, not
-- ours, and both answers are common in the trade. The trainer is asked when
-- they mark it, and the answer is stored: without it, editing that session
-- again would refund a session the trainer had decided to keep. FALSE for every
-- existing row, which matches the behaviour those rows were created under.
ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS no_show_charged BOOLEAN NOT NULL DEFAULT false;

-- Group attendance answers the same question and must answer it the same way.
ALTER TABLE group_session_attendance
  ADD COLUMN IF NOT EXISTS no_show_charged BOOLEAN NOT NULL DEFAULT false;

-- ── 5. The counter is derived, in one place ──────────────────────────────────
-- SECURITY INVOKER (the default): the function is subject to the caller's RLS
-- policies, so it can only touch a package the caller could already touch.
CREATE OR REPLACE FUNCTION sync_client_package_usage(p_client_package_id UUID)
RETURNS client_packages AS $$
DECLARE
  cp    client_packages;
  total INT;
BEGIN
  SELECT COALESCE(SUM(quantity), 0) INTO total
    FROM package_session_usage
   WHERE client_package_id = p_client_package_id;

  -- A ledger that sums below zero means more was credited than charged. Clamp
  -- the cache rather than store a negative balance; the ledger keeps the truth.
  IF total < 0 THEN
    total := 0;
  END IF;

  UPDATE client_packages SET
    sessions_used = total,
    status = CASE
               -- An expired or cancelled package is a decision about the
               -- package, not about its balance. Charging or crediting it must
               -- never bring it back to life.
               WHEN status IN ('expired', 'cancelled') THEN status
               WHEN package_type = 'session_based'
                AND total_sessions IS NOT NULL
                AND total >= total_sessions THEN 'completed'
               WHEN status = 'completed'
                AND (package_type <> 'session_based'
                     OR total_sessions IS NULL
                     OR total < total_sessions) THEN 'active'
               ELSE status
             END,
    updated_at = NOW()
  WHERE id = p_client_package_id
  RETURNING * INTO cp;

  RETURN cp;
END;
$$ LANGUAGE plpgsql;

-- ── 6. Reconcile existing data onto the ledger ───────────────────────────────
-- Some packages may carry a `sessions_used` higher than their ledger explains:
-- the pre-transaction `+ 1` path could increment without leaving a row, and
-- balances predating the usage table have no rows at all. Zeroing those would
-- silently hand clients back sessions they already used, so the difference is
-- written INTO the ledger as an opening-balance adjustment instead. After this
-- migration every counter equals SUM(quantity) with a row for every unit of it.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT cp.id,
           cp.tenant_id,
           cp.sessions_used,
           COALESCE(u.total, 0) AS ledger_total
      FROM client_packages cp
      LEFT JOIN (
        SELECT client_package_id, COALESCE(SUM(quantity), 0) AS total
          FROM package_session_usage
         GROUP BY client_package_id
      ) u ON u.client_package_id = cp.id
     WHERE cp.sessions_used IS DISTINCT FROM COALESCE(u.total, 0)
  LOOP
    IF r.sessions_used > r.ledger_total THEN
      INSERT INTO package_session_usage
        (tenant_id, client_package_id, kind, quantity, reason)
      VALUES
        (r.tenant_id, r.id, 'adjustment', r.sessions_used - r.ledger_total,
         'Opening balance recorded when the usage ledger was introduced (migration 037)');
    END IF;

    PERFORM sync_client_package_usage(r.id);
  END LOOP;
END $$;
