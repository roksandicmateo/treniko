-- backend/migrations/040_trainer_timezone.sql
--
-- ── Why ──────────────────────────────────────────────────────────────────────
-- "Today" had three different definitions in the product, and none of them was
-- the trainer's:
--
--   the dashboard   computed it from the SERVER's clock (`toLocaleDateString`),
--                   so it depended on the host's TZ setting — which
--                   ecosystem.config.js never sets;
--   client detail   used PostgreSQL's CURRENT_DATE, i.e. the DATABASE's zone;
--   the browser     compared against `new Date()`, i.e. the viewer's zone.
--
-- They agree only while every one of those happens to be the same zone. The
-- first trainer in another country, or one move to a UTC host, and "today's
-- sessions" shows the wrong day for part of every day — on the screen a trainer
-- opens first thing in the morning.
--
-- A time zone is a property of the trainer, not of the machine, so it is stored
-- with the trainer and every "today" is derived from it.
--
-- ── Safety ───────────────────────────────────────────────────────────────────
-- Additive with a default. Europe/Zagreb is where the product is being tested;
-- it is also exactly what the previous behaviour produced on a correctly
-- configured host, so no existing account changes behaviour.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) NOT NULL DEFAULT 'Europe/Zagreb';

-- A zone name PostgreSQL does not know would make every date function using it
-- raise, turning a profile typo into a broken dashboard. The check consults the
-- database's own zone table, so it stays correct as that table is updated.
CREATE OR REPLACE FUNCTION is_known_timezone(tz TEXT) RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = tz);
$$ LANGUAGE sql STABLE;

ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_timezone;
ALTER TABLE users ADD CONSTRAINT chk_users_timezone CHECK (is_known_timezone(timezone));
