-- Migration 032: repair password_reset_tokens to the shape the application uses
--
-- ── The production failure this fixes ────────────────────────────────────────
-- Live QA proved that /api/auth/forgot-password was broken in production and
-- broken *silently*:
--
--     null value in column "tenant_id" of relation "password_reset_tokens"
--     violates not-null constraint                                     (23502)
--
-- forgotPassword deliberately swallows every error so that a failure cannot be
-- used to tell a registered address from an unregistered one. The trainer
-- therefore saw the neutral "check your email" screen while no reset mail was
-- ever generated. No trainer could recover a forgotten password.
--
-- ── Why it only happened in production ───────────────────────────────────────
-- Migration 021 creates the table with CREATE TABLE IF NOT EXISTS. Production
-- already had an OLDER table of the same name, from before migration tracking
-- existed:
--
--     id, tenant_id uuid NOT NULL, token varchar, expires_at, used bool,
--     created_at, user_id, token_hash varchar, used_at
--
-- so 021 created nothing, and `db:baseline` recorded it as applied because its
-- probe only asked whether a table of that name existed. The columns the
-- current controller inserts (user_id, token_hash, expires_at) were all there,
-- which is why nothing looked wrong — but so was the legacy `tenant_id NOT
-- NULL`, which the controller has no reason to populate. A freshly migrated
-- database never had the legacy column and so never reproduced the fault.
--
-- ── What this migration does ─────────────────────────────────────────────────
-- It converges BOTH shapes on the canonical one, and is a no-op on a database
-- that is already canonical (every step is guarded, so re-running is safe):
--
--   * creates the table if it is missing entirely;
--   * adds any canonical column that is absent;
--   * discards rows that the current code could never consume anyway (no
--     token_hash or no user_id) — reset tokens are short-lived credentials, not
--     records, and a token nobody can present is not data anyone can lose;
--   * drops the legacy columns tenant_id / token / used;
--   * restores the NOT NULLs, the unique token hash, the foreign key and the
--     indexes that 021 defines.
--
-- The final shape is exactly what migration 021 produces on an empty database,
-- so the fresh and upgraded paths converge — which is the property
-- `npm run db:verify` exists to check.

-- ── 1. The table, when there is none at all ─────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL UNIQUE,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 hour',
  used_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. Canonical columns that a historical table may be missing ─────────────
ALTER TABLE password_reset_tokens
  ADD COLUMN IF NOT EXISTS user_id    UUID,
  ADD COLUMN IF NOT EXISTS token_hash TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS used_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- ── 3. Rows the current application could not use ───────────────────────────
-- A row with no token_hash cannot be matched by resetPassword (which looks a
-- token up by its SHA-256 hash), and a row with no user_id cannot identify an
-- account. Both are unusable by definition; leaving them would only block the
-- NOT NULL constraints below.
DELETE FROM password_reset_tokens WHERE token_hash IS NULL OR user_id IS NULL;

-- A duplicate hash would block the unique constraint. Keep the newest row per
-- hash — deterministically, so this is reproducible rather than arbitrary.
DELETE FROM password_reset_tokens a
 USING password_reset_tokens b
 WHERE a.token_hash = b.token_hash
   AND (a.created_at, a.id) < (b.created_at, b.id);

UPDATE password_reset_tokens SET created_at = NOW() WHERE created_at IS NULL;
UPDATE password_reset_tokens SET expires_at = NOW() WHERE expires_at IS NULL;

-- ── 4. The legacy columns ───────────────────────────────────────────────────
-- tenant_id is the one that caused the outage; the tenant is already determined
-- by user_id, so the column carried no information the application needed.
-- `token` held the raw reset token in plaintext, which is precisely what
-- token_hash replaced, and `used` was superseded by the used_at timestamp.
ALTER TABLE password_reset_tokens DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE password_reset_tokens DROP COLUMN IF EXISTS token;
ALTER TABLE password_reset_tokens DROP COLUMN IF EXISTS used;

-- ── 5. Column types ─────────────────────────────────────────────────────────
-- The historical table typed token_hash as VARCHAR and the timestamps without
-- a time zone. Both are converted so that an upgraded database ends up with the
-- same catalogue shape as a freshly migrated one — otherwise "it works" would
-- depend on which path a given environment took. VARCHAR → TEXT is binary
-- coercible, so it costs no table rewrite; the timestamps are reinterpreted in
-- the server's time zone, which is correct for values written by that server
-- and harmless for rows that are, by design, discarded within the hour.
DO $$
DECLARE
  col text;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'password_reset_tokens'
                AND column_name = 'token_hash' AND data_type <> 'text') THEN
    ALTER TABLE password_reset_tokens ALTER COLUMN token_hash TYPE TEXT;
  END IF;

  FOREACH col IN ARRAY ARRAY['expires_at', 'used_at', 'created_at'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'password_reset_tokens'
                  AND column_name = col
                  AND data_type <> 'timestamp with time zone') THEN
      EXECUTE format(
        'ALTER TABLE password_reset_tokens ALTER COLUMN %I TYPE TIMESTAMPTZ', col);
    END IF;
  END LOOP;
END $$;

-- ── 6. Constraints, defaults and indexes ────────────────────────────────────
ALTER TABLE password_reset_tokens
  ALTER COLUMN user_id    SET NOT NULL,
  ALTER COLUMN token_hash SET NOT NULL,
  ALTER COLUMN expires_at SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE password_reset_tokens
  ALTER COLUMN expires_at SET DEFAULT NOW() + INTERVAL '1 hour',
  ALTER COLUMN created_at SET DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attrdef d
      JOIN pg_class c     ON c.oid = d.adrelid
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.adnum
     WHERE c.relname = 'password_reset_tokens' AND a.attname = 'id'
  ) THEN
    ALTER TABLE password_reset_tokens ALTER COLUMN id SET DEFAULT gen_random_uuid();
  END IF;

  -- Foreign key: a token must not outlive the account it resets.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'password_reset_tokens'::regclass AND contype = 'f'
  ) THEN
    ALTER TABLE password_reset_tokens
      ADD CONSTRAINT password_reset_tokens_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  -- Uniqueness of the hash is what stops one stored token from being usable
  -- through two rows with different expiry or used_at state.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'password_reset_tokens'::regclass AND contype = 'u'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_index i
      JOIN pg_class c ON c.oid = i.indrelid
     WHERE c.relname = 'password_reset_tokens' AND i.indisunique AND NOT i.indisprimary
  ) THEN
    ALTER TABLE password_reset_tokens
      ADD CONSTRAINT password_reset_tokens_token_hash_key UNIQUE (token_hash);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_prt_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_prt_user_id    ON password_reset_tokens(user_id);

COMMENT ON TABLE password_reset_tokens IS
  'Short-lived password reset tokens, stored as SHA-256 hashes. Keyed by user_id only: the tenant is determined by the user, and password reset runs before any tenant context exists. Repaired to this shape by migration 032.';
