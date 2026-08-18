-- Migration 033 — platform administration
--
-- ============================================================================
-- WHAT THIS IS FOR
-- ============================================================================
-- TRENIKO's own staff need to see the platform: which tenants exist, which
-- trainers are on them, what plan each is on, who is locked out, who signed up
-- and never came back. Until now there was no such thing — every account in the
-- system is a trainer belonging to exactly one tenant, and there was no way to
-- look across tenants at all.
--
-- ============================================================================
-- WHY A SEPARATE TABLE AND NOT A FLAG ON users
-- ============================================================================
-- `users.tenant_id` is NOT NULL: every row in that table is a trainer who
-- belongs to one tenant. A platform administrator belongs to no tenant, so the
-- obvious `users.is_admin` shortcut would mean either inventing a fake tenant
-- to hang staff accounts off, or making tenant_id nullable — which would
-- weaken the single most important invariant in the schema and put a NULL
-- through every tenant-scoped query that reads users.
--
-- A separate table also keeps the two authentication realms genuinely separate.
-- A trainer's JWT carries `userId` and resolves against `users`; an
-- administrator's carries `adminId` and resolves against `platform_admins`.
-- Neither token can be presented to the other's middleware and be accepted,
-- because neither lookup can succeed for the other's subject. That property is
-- asserted in tests/security/platformAdmin.test.js, in both directions.
--
-- Consequence, and it is deliberate: **there is no self-service registration
-- for administrators.** The first one is created by
-- scripts/create-platform-admin.js, run by an operator on the server. After
-- that, an `owner` can create the rest through the API.
--
-- ============================================================================
-- ROW-LEVEL SECURITY: DELIBERATELY NOT ENABLED, AND WHY THAT IS NOT A HOLE
-- ============================================================================
-- Both tables below are tenant-neutral in exactly the sense migration 029
-- section D describes. `platform_admins` has no tenant_id and cannot have one:
-- a staff account that could only see one tenant would defeat its own purpose.
-- `admin_audit_log` records actions that frequently span tenants, and is an
-- append-only security log rather than tenant business data — the same
-- reasoning that leaves `audit_log` unprotected.
--
-- Both are therefore added to TENANT_NEUTRAL_TABLES in
-- tests/security/rlsPolicyInventory.test.js. That test asserts the exclusion
-- list EXACTLY, so these tables could not be added silently: the suite fails
-- until someone writes down why they are excluded. That is the intended
-- process and it was followed rather than worked around.
--
-- ============================================================================
-- WHAT THIS MIGRATION DOES *NOT* DO
-- ============================================================================
-- It does not touch a single existing policy, role, grant or table. No RLS is
-- disabled, relaxed or bypassed anywhere, and no role gains BYPASSRLS.
--
-- The admin API reads the tables that migration 029 section D already leaves
-- outside RLS — tenants, users, tenant_subscriptions, subscription_usage,
-- audit_log, deletion_requests — and reads them through the ordinary
-- `treniko_app` role.
--
-- It follows that per-tenant *business* data (clients, sessions, payments,
-- training logs, progress) stays invisible to platform staff: those tables are
-- RLS-protected, admin requests deliberately establish no tenant context, and
-- so they return zero rows. Aggregate counts come from `subscription_usage`,
-- which is maintained by triggers and carries no personal data.
--
-- That is a feature. A trainer's clients include health notes and dates of
-- birth; there is no support reason for TRENIKO staff to browse them, and
-- under GDPR every avoidable path to that data is a liability. If a genuine
-- need ever appears, it should arrive as its own migration with its own
-- justification, not as a side effect of an admin panel.
--
-- ============================================================================
-- SAFETY
-- ============================================================================
-- Purely additive and idempotent. Creates two new tables and their indexes.
-- Reads nothing, modifies nothing, deletes nothing. Existing behaviour for
-- trainers is completely unchanged.

-- ────────────────────────────────────────────────────────────────────────────
-- Platform staff accounts.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_admins (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Stored lowercase. The application normalises before insert and before
  -- lookup, and the unique index below is on the plain column, so two
  -- differently-cased spellings of one address cannot both exist.
  email                 VARCHAR(255) NOT NULL,
  password_hash         VARCHAR(255) NOT NULL,
  first_name            VARCHAR(100) NOT NULL,
  last_name             VARCHAR(100) NOT NULL,

  -- viewer — read only, the safe default for anyone who just needs to look
  -- admin  — may update tenants, trainers and subscriptions
  -- owner  — may additionally create and manage other administrators
  role                  VARCHAR(20)  NOT NULL DEFAULT 'viewer',

  is_active             BOOLEAN      NOT NULL DEFAULT TRUE,

  -- Same lockout mechanism the trainer login uses, for the same reason.
  failed_login_attempts INTEGER      NOT NULL DEFAULT 0,
  locked_until          TIMESTAMPTZ,

  -- Mirrors users.password_changed_at so the identical token-revocation check
  -- can be applied to admin sessions (see middleware/adminAuth.js).
  --
  -- Truncated to the second, deliberately. A JWT's `iat` claim has one-second
  -- resolution, and the revocation check resolves the resulting ambiguity in
  -- the safe direction: a token whose `iat` falls in the same second as the
  -- recorded change is treated as having been issued BEFORE it.
  --
  -- With a sub-second DEFAULT NOW() that rule fires on the account's own first
  -- login: create an administrator at 12:00:00.4, sign in at 12:00:00.9, and
  -- the freshly issued token - `iat` 12:00:00 - is judged older than the
  -- 12:00:00.4 it was issued after, and rejected. The account is unusable until
  -- the next whole second.
  --
  -- Truncating removes the ambiguity at creation, where there is nothing to
  -- revoke and therefore nothing to be unsafe about: no token can predate an
  -- account that did not exist. A future administrator password-change endpoint
  -- must set this to a plain NOW() instead, so that genuine revocations keep
  -- the strict same-second-is-stale behaviour.
  password_changed_at   TIMESTAMPTZ  NOT NULL DEFAULT date_trunc('second', NOW()),
  last_login_at         TIMESTAMPTZ,

  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT platform_admins_role_valid
    CHECK (role IN ('viewer', 'admin', 'owner')),
  CONSTRAINT platform_admins_email_lowercase
    CHECK (email = lower(email))
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_admins_email_key
  ON platform_admins (email);

COMMENT ON TABLE platform_admins IS
  'TRENIKO staff accounts. Tenant-neutral by design: no tenant_id, no RLS. Separate authentication realm from users — see migration 033 and middleware/adminAuth.js.';
COMMENT ON COLUMN platform_admins.role IS
  'viewer = read only; admin = may update tenants/trainers/subscriptions; owner = may also manage administrators.';

-- ────────────────────────────────────────────────────────────────────────────
-- Every administrative write, recorded.
-- ────────────────────────────────────────────────────────────────────────────
-- A panel that can change another company's subscription without leaving a
-- trace is not an admin tool, it is an unattributable back door. Writes are
-- logged with the before and after state so a change can be explained months
-- later, and reversed by hand if it was wrong.
--
-- ON DELETE SET NULL rather than CASCADE: removing a staff account must not
-- erase the record of what that account did.
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id     UUID REFERENCES platform_admins(id) ON DELETE SET NULL,

  -- Kept alongside admin_id so the log still names the actor after the account
  -- is gone and admin_id has gone NULL.
  admin_email  VARCHAR(255),

  action       VARCHAR(80)  NOT NULL,
  entity_type  VARCHAR(40)  NOT NULL,
  entity_id    UUID,

  -- The tenant the change affected, where there is one. Not a foreign key:
  -- the log must survive the tenant being deleted.
  tenant_id    UUID,

  -- Only the fields that actually changed, and never a secret: the writer
  -- whitelists what it records (see controllers/adminController.js).
  changes      JSONB,

  ip_address   VARCHAR(64),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_admin_idx   ON admin_audit_log (admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_entity_idx  ON admin_audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS admin_audit_log_tenant_idx  ON admin_audit_log (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON admin_audit_log (created_at DESC);

COMMENT ON TABLE admin_audit_log IS
  'Append-only record of every platform-administrator write. Tenant-neutral: actions routinely span tenants, and the log must outlive both the admin and the tenant. No RLS, same reasoning as audit_log in migration 029 section D.';
