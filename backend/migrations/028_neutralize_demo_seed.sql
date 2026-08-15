-- Migration 028 — neutralise the seeded demo credential
-- Security Hardening Phase 2B (TR-MED-11)
--
-- WHY THIS EXISTS
-- `schema.sql` ends with seed rows that create tenant
-- 00000000-0000-0000-0000-000000000001 ("Demo Fitness Studio") and the user
-- demo@treniko.com with a hard-coded bcrypt hash, above a comment naming the
-- password as 'password123'.
--
-- This mattered more after Phase 2A than before it: `schema.sql` is now the
-- BASELINE step of the migration runner, so `npm run db:migrate` — the
-- documented way to create a database — executes it. Every fresh installation,
-- production included, therefore starts with that account.
--
-- Two things were verified before writing this, and both shape the fix:
--   1. The committed hash does NOT verify against 'password123' (checked with
--      bcryptjs against that string and several variants). The documented
--      plaintext is wrong, so the "publicly known password" reading of the
--      original finding does not hold.
--   2. The account still exists (confirmed in the development database) with a
--      hash whose preimage is unknown to us but not necessarily to whoever
--      generated it, on an address at the application's own domain — which is
--      itself reachable through the password-reset flow.
--
-- So the account is neutralised rather than deleted. Replacing the hash removes
-- any value the unknown preimage might have, and stamping password_changed_at
-- revokes any JWT ever issued for it (see middleware/auth.js).
--
-- WHY NOT DELETE THE ROWS, AND WHY NOT EDIT schema.sql
-- Deleting would cascade into whatever a developer has since created under the
-- demo tenant — this migration must not destroy anyone's data. Editing
-- schema.sql would rewrite an already-applied migration, changing its recorded
-- checksum on every existing database; the runner treats migrations as
-- immutable and a new migration is the supported way to change history's
-- outcome. Running 028 after the baseline gives fresh databases the same end
-- state as existing ones.
--
-- SAFETY
-- Additive-only: no schema change, no DROP, no DELETE. Idempotent — it matches
-- on the exact seeded hash, so a second run updates zero rows, and it can never
-- touch an account whose password has since been set by a real person.

UPDATE users
   SET password_hash       = '$2a$12$SADyoNyTdI981q4J4RoghexaI5DA9hADuo2.z0HMzjcXxKeCT7iaq',
       password_changed_at = NOW(),
       updated_at          = NOW()
 WHERE email = 'demo@treniko.com'
   AND password_hash = '$2a$10$rH5aKxQs3xGKBVZKZ.KrXeDx4yYJqXZ5WYVBYxP8xKYX8.n7LGWHu';

-- The replacement is a real bcrypt hash (cost 12) of 32 random bytes that were
-- generated for this migration and never recorded anywhere. No one holds the
-- preimage, so the account cannot be logged into, while the row stays valid for
-- any foreign key that references it.
