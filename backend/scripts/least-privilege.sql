-- ============================================================================
-- TRENIKO — least-privilege database roles
-- Security Hardening Phase 3, Step 8. REFERENCE SCRIPT — NOT RUN AUTOMATICALLY.
-- ============================================================================
--
-- WHY
-- The application currently connects as `postgres`: a superuser that also
-- carries BYPASSRLS and owns every table. Three consequences follow:
--   - a SQL-injection defect anywhere would run with unrestricted rights,
--     including DROP, and including reading pg_authid;
--   - the row-level security policies on 15 tables can never engage, because
--     PostgreSQL skips policies for a table's owner and for BYPASSRLS roles;
--   - the runtime can perform DDL, so a bug can silently alter the schema.
--
-- This script defines the two roles the application should use instead, with
-- the privileges it actually needs — every grant below was verified against a
-- disposable database by running the full migration chain and the security test
-- suite under these roles.
--
-- ============================================================================
-- READ THIS BEFORE APPLYING
-- ============================================================================
-- Moving the runtime to a non-owner role ALSO turns row-level security on for
-- the first time, because policies stop being skipped. Measured on a disposable
-- database, the application does not survive that today:
--
--     SELECT id FROM clients;
--     ERROR:  unrecognized configuration parameter "app.current_tenant_id"
--
-- Six of the fifteen policies call current_setting() without its `missing_ok`
-- argument, so they raise an error rather than simply matching no rows, and
-- 156 of the application's query sites do not set any tenant context at all.
--
-- So this script is a Phase 4 prerequisite, not a Phase 3 change. Apply it only
-- together with the policy repair and the query-path migration described in
-- SECURITY_AUDIT_PHASE3.md, and verify on a disposable database first.
--
-- ============================================================================
-- ROLES
-- ============================================================================
-- Replace the passwords before use; they are placeholders, not credentials.

-- Owns the schema. Used by `npm run db:migrate` and by nothing else.
CREATE ROLE treniko_migrator LOGIN PASSWORD 'CHANGE_ME_MIGRATOR';

-- Used by the running application. No DDL, no ownership, no BYPASSRLS.
CREATE ROLE treniko_app LOGIN PASSWORD 'CHANGE_ME_APP';

-- Neither role may be a superuser and neither may bypass row-level security;
-- these are the defaults, stated so the intent is explicit and reviewable.
ALTER ROLE treniko_migrator NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
ALTER ROLE treniko_app      NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;

-- ============================================================================
-- PRIVILEGES REQUIRED BY THE APPLICATION ROLE
-- ============================================================================
-- Each of these was exercised by the test suite; nothing here is speculative.

GRANT CONNECT ON DATABASE treniko_db TO treniko_app;

-- Needed to resolve any object in the schema at all.
GRANT USAGE ON SCHEMA public TO treniko_app;

-- Ordinary CRUD. Deliberately NOT granted: TRUNCATE, REFERENCES, TRIGGER.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO treniko_app;

-- Sequences back the integer identity columns.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO treniko_app;

-- The application calls schema functions directly (expire_client_packages),
-- and triggers that maintain client_statistics and subscription_usage execute
-- as the invoking role.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO treniko_app;

-- Objects created by future migrations must inherit the same grants, otherwise
-- the application breaks the first time a migration adds a table.
ALTER DEFAULT PRIVILEGES FOR ROLE treniko_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO treniko_app;
ALTER DEFAULT PRIVILEGES FOR ROLE treniko_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO treniko_app;
ALTER DEFAULT PRIVILEGES FOR ROLE treniko_migrator IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO treniko_app;

-- ============================================================================
-- WHAT THE APPLICATION ROLE MUST NOT BE ABLE TO DO
-- ============================================================================
-- Verified denied on a disposable database under exactly the grants above:
--   DROP TABLE / CREATE TABLE / ALTER TABLE   -> 42501 insufficient_privilege
--   TRUNCATE                                   -> 42501
--   CREATE ROLE                                -> 42501
--   SELECT FROM pg_authid                      -> 42501
--
-- ============================================================================
-- DEPLOYMENT
-- ============================================================================
--   migrations : DB_USER=treniko_migrator  npm run db:migrate
--   runtime    : DB_USER=treniko_app       npm start
--
-- The migration role needs ownership of the objects it alters; if the schema
-- was originally created by `postgres`, reassign it first:
--
--   REASSIGN OWNED BY postgres TO treniko_migrator;   -- run as postgres
--
-- Verify afterwards that neither role is privileged:
--
--   SELECT rolname, rolsuper, rolbypassrls FROM pg_roles
--    WHERE rolname IN ('treniko_migrator', 'treniko_app');
