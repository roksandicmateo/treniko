-- 024_token_invalidation.sql
-- Security Hardening Phase 2A — TR-HIGH-3
--
-- Adds the server-side state needed to revoke already-issued JWTs when a
-- password changes. Without this, a stolen token stayed valid for its full 24h
-- lifetime even after the victim reset their password, so the standard
-- incident-response action did not actually cut off the attacker.
--
-- authenticateToken compares the token's `iat` (issued-at) claim against this
-- column and rejects any token minted before the most recent password change.
--
-- Additive and idempotent: no data is modified or removed. Existing rows keep
-- NULL, which means "no password change recorded" and leaves current tokens
-- valid, so applying this migration does not log anybody out.
--
-- DEPLOY ORDER: apply this migration BEFORE (or together with) the code that
-- reads the column. The application fails closed if the column is missing.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

COMMENT ON COLUMN users.password_changed_at IS
  'Set to NOW() whenever the password changes. JWTs with iat older than this are rejected.';
