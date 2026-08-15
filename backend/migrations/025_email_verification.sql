-- 025_email_verification.sql
-- Pre-commit stabilization — resolves the email-verification schema drift.
--
-- backend/controllers/authController.js has always referenced three columns
-- that no schema.sql or migration ever created:
--   * login()       SELECTs users.email_verified
--   * register()    UPDATEs verification_token / verification_token_expires
--   * verifyEmail() reads all three
-- The result was that `SELECT ... email_verified FROM users` failed with
-- Postgres 42703 (undefined_column), so LOGIN WAS BROKEN outright. This
-- migration adds the columns the application code has always expected.
--
-- Additive and idempotent: safe to re-run, and it never drops or rewrites
-- anything.
--
-- PRESERVING EXISTING USERS — why the backfill matters:
-- frontend/src/components/PrivateRoute.jsx redirects any session whose
-- `emailVerified === false` to /check-email. Adding this column with the
-- natural DEFAULT FALSE would therefore lock every pre-existing user out of
-- the application on their next login. Accounts that predate email
-- verification are grandfathered in as verified instead.
--
-- The backfill is deliberately inside the "column did not exist" branch so it
-- runs exactly once, at first application. Re-running this migration will not
-- silently verify genuinely-unverified accounts created later.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'users' AND column_name = 'email_verified'
  ) THEN
    ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE;

    -- Grandfather in every account that existed before verification existed.
    UPDATE users SET email_verified = TRUE;
  END IF;
END $$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS verification_token         VARCHAR(255),
  ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMPTZ;

-- verifyEmail() looks users up by token, so support that lookup directly.
-- Partial index: only unconsumed tokens are ever queried.
CREATE INDEX IF NOT EXISTS idx_users_verification_token
  ON users (verification_token)
  WHERE verification_token IS NOT NULL;

COMMENT ON COLUMN users.email_verified IS
  'True once the address is confirmed. Accounts predating verification were backfilled to TRUE.';
COMMENT ON COLUMN users.verification_token IS
  'Single-use email-verification token; cleared on successful verification.';
