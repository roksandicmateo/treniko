-- ============================================================================
-- TRENIKO — least-privilege database roles
-- Security Hardening Phase 3 (Step 8), finalised in Phase 4 (Step 13).
-- ============================================================================
--
-- WHY
-- The application historically connected as `postgres`: a superuser that also
-- carries BYPASSRLS and owns every table. Three consequences followed:
--   - a SQL-injection defect anywhere would run with unrestricted rights,
--     including DROP, and including reading pg_authid;
--   - the row-level security policies could never engage, because PostgreSQL
--     skips policies for a table's owner and for BYPASSRLS roles;
--   - the runtime could perform DDL, so a bug could silently alter the schema.
--
-- This script grants the running application exactly the privileges it needs
-- and nothing more. Every grant below is exercised by the security test suite
-- running under this role against a disposable database; nothing is speculative.
--
-- ============================================================================
-- THIS IS NOW SAFE TO APPLY (changed in Phase 4)
-- ============================================================================
-- The Phase 3 version of this file carried a prominent warning that moving the
-- runtime to a non-owner role would break the application, because policies
-- would stop being skipped and six of them raised rather than denied:
--
--     SELECT id FROM clients;
--     ERROR:  unrecognized configuration parameter "app.current_tenant_id"
--
-- Migration 029 replaced those policies with ones built on
-- app_current_tenant_id(), which returns NULL — never an error — for a missing,
-- empty or malformed context, and config/tenantContext.js now establishes that
-- context for every authenticated request. The warning no longer applies.
--
-- Order of operations for an existing deployment:
--   1. apply migrations up to and including 029 (as the owner, or as the
--      migration role once ownership has been reassigned)
--   2. run this script
--   3. switch the application's DB_USER to the runtime role and restart
--
-- Step 3 is what turns enforcement on. Until then RLS is present but skipped,
-- and config/rlsStatus.js says so loudly at startup.
--
-- ============================================================================
-- ROLES
-- ============================================================================
-- Two roles, created out of band so that no credential is ever written into a
-- file that lives in version control:
--
--   treniko_migrator  owns the schema. Used by `npm run db:migrate`, and by
--                     nothing else. Not a superuser; cannot bypass RLS.
--   treniko_app       used by the running application. No DDL, no ownership,
--                     no BYPASSRLS.
--
-- Create them once, as a superuser, substituting real secrets:
--
--   CREATE ROLE treniko_migrator LOGIN PASSWORD '...';
--   CREATE ROLE treniko_app      LOGIN PASSWORD '...';
--   ALTER ROLE treniko_migrator NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
--   ALTER ROLE treniko_app      NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
--
-- If the schema was originally created by `postgres`, hand the TRENIKO objects
-- over once, as postgres. Ownership is what lets the migration role ALTER and
-- DROP them; the grants below are not enough on their own.
--
--   DO $$
--   DECLARE r record;
--   BEGIN
--     FOR r IN
--       SELECT c.oid::regclass AS obj,
--              CASE c.relkind WHEN 'S' THEN 'SEQUENCE'
--                             WHEN 'v' THEN 'VIEW'
--                             WHEN 'm' THEN 'MATERIALIZED VIEW'
--                             ELSE 'TABLE' END AS kind
--         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--        WHERE n.nspname = 'public' AND c.relkind IN ('r','p','S','v','m')
--          AND NOT EXISTS (SELECT 1 FROM pg_depend d
--                           WHERE d.objid = c.oid AND d.deptype = 'e')
--     LOOP
--       EXECUTE format('ALTER %s %s OWNER TO treniko_migrator', r.kind, r.obj);
--     END LOOP;
--     FOR r IN
--       SELECT p.oid::regprocedure AS obj
--         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--        WHERE n.nspname = 'public'
--          AND NOT EXISTS (SELECT 1 FROM pg_depend d
--                           WHERE d.objid = p.oid AND d.deptype = 'e')
--     LOOP
--       EXECUTE format('ALTER FUNCTION %s OWNER TO treniko_migrator', r.obj);
--     END LOOP;
--   END $$;
--
-- Deliberately NOT `REASSIGN OWNED BY postgres TO treniko_migrator`. That would
-- also hand over things which must not move: the installed extensions and their
-- member functions (which belong to the extension mechanism, not to TRENIKO),
-- and the database itself — and owning a database carries the right to drop it.
-- The `deptype = 'e'` exclusions above are what skip extension members.
--
-- The migration role does NOT need to own the database or the schema; the
-- GRANT USAGE, CREATE ON SCHEMA public below is enough for it to add objects.
--
-- ============================================================================
-- RUNNING THIS SCRIPT
-- ============================================================================
--   psql -d treniko_db -f backend/scripts/least-privilege.sql
--
-- Run it as the schema owner (treniko_migrator) or as a superuser. It is
-- idempotent, it grants only, and it never touches data. Role names may be
-- overridden:
--
--   psql -d treniko_db -v app_role=my_app -v migrator_role=my_migrator \
--        -f backend/scripts/least-privilege.sql
--
-- backend/scripts/provision-restricted-db.js runs exactly this file when it
-- builds a disposable database, so the test suite proves this script rather
-- than a parallel copy of it.
-- ============================================================================

\if :{?app_role}
\else
  \set app_role treniko_app
\endif

\if :{?migrator_role}
\else
  \set migrator_role treniko_migrator
\endif

\set ON_ERROR_STOP on

-- psql interpolates :'var' in ordinary SQL but NOT inside a dollar-quoted body,
-- so the two role names are handed to the PL/pgSQL blocks below through
-- session settings rather than by textual substitution. That is also the safer
-- direction: the names arrive as values, never as SQL text.
SELECT set_config('treniko.app_role', :'app_role', false),
       set_config('treniko.migrator_role', :'migrator_role', false);

DO $grants$
DECLARE
  app_role      text := current_setting('treniko.app_role');
  migrator_role text := current_setting('treniko.migrator_role');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
    RAISE EXCEPTION 'Role % does not exist. Create the roles first - see the header of this file.', app_role;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = migrator_role) THEN
    RAISE EXCEPTION 'Role % does not exist. Create the roles first - see the header of this file.', migrator_role;
  END IF;

  -- ── Privileges the application actually needs ────────────────────────────

  -- Reach the database at all.
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), app_role);

  -- Resolve any object in the schema. USAGE only, never CREATE, so the runtime
  -- cannot add tables, functions or types of its own.
  EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', app_role);

  -- Ordinary CRUD. Deliberately NOT granted: TRUNCATE (which row-level
  -- security does not filter - it is all-or-nothing per table), REFERENCES,
  -- TRIGGER.
  EXECUTE format(
    'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I',
    app_role);

  -- Sequences back the integer identity columns.
  EXECUTE format(
    'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %I', app_role);

  -- The application calls schema functions directly (expire_client_packages),
  -- the RLS policies call app_current_tenant_id(), and the triggers that
  -- maintain client_statistics and subscription_usage execute as the invoking
  -- role.
  EXECUTE format(
    'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO %I', app_role);

  -- Objects created by future migrations must inherit the same grants,
  -- otherwise the application breaks the first time a migration adds a table.
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public '
    'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I',
    migrator_role, app_role);
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public '
    'GRANT USAGE, SELECT ON SEQUENCES TO %I',
    migrator_role, app_role);
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public '
    'GRANT EXECUTE ON FUNCTIONS TO %I',
    migrator_role, app_role);

  -- ── Privileges nobody should hold implicitly ─────────────────────────────
  -- A grant to PUBLIC reaches the runtime role no matter what it was granted
  -- directly, so removing these is what actually bounds the role. PostgreSQL 15
  -- and later already revoke CREATE on public; doing it here keeps the result
  -- identical on 13 and 14.
  EXECUTE 'REVOKE CREATE ON SCHEMA public FROM PUBLIC';
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database());

  -- The revoke above also removed the migration role's implicit CONNECT.
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), migrator_role);

  -- ── What the MIGRATION role needs ────────────────────────────────────────
  -- Creating objects in the schema. This is not implied by anything above:
  -- from PostgreSQL 15 the public schema is owned by pg_database_owner and no
  -- longer grants CREATE to PUBLIC, so a migration role that does not happen to
  -- own the database has no way to add a table. Granting it explicitly is what
  -- makes the two-role model work on a database owned by somebody else --
  -- which is the normal case when an existing deployment adopts these roles.
  --
  -- Deliberately a GRANT rather than handing over the schema or the database:
  -- ownership of either would also carry the right to drop it.
  EXECUTE format('GRANT USAGE, CREATE ON SCHEMA public TO %I', migrator_role);
END;
$grants$;

-- ============================================================================
-- VERIFICATION - fails loudly rather than reporting success it cannot show
-- ============================================================================
-- These are the properties the runtime's security actually rests on.
-- backend/tests/security/rlsRoleSecurity.test.js asserts the same set against a
-- live restricted connection, so this cannot drift silently.
DO $verify$
DECLARE
  app_role      text := current_setting('treniko.app_role');
  migrator_role text := current_setting('treniko.migrator_role');
  r             record;
  m             record;
  offending     text;
BEGIN
  SELECT * INTO r FROM pg_roles WHERE rolname = app_role;

  IF r.rolsuper      THEN RAISE EXCEPTION '% is a superuser', app_role; END IF;
  IF r.rolbypassrls  THEN RAISE EXCEPTION '% carries BYPASSRLS', app_role; END IF;
  IF r.rolcreaterole THEN RAISE EXCEPTION '% carries CREATEROLE', app_role; END IF;
  IF r.rolcreatedb   THEN RAISE EXCEPTION '% carries CREATEDB', app_role; END IF;

  -- Ownership is what makes PostgreSQL skip policies for a table, so this is
  -- the single most important property in the file.
  SELECT string_agg(c.relname, ', ') INTO offending
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND pg_get_userbyid(c.relowner) = app_role;

  IF offending IS NOT NULL THEN
    RAISE EXCEPTION '% owns tables, so row-level security would be skipped for them: %',
      app_role, offending;
  END IF;

  RAISE NOTICE 'least-privilege: % verified - not a superuser, no BYPASSRLS, owns no tables', app_role;

  -- The migration role is privileged relative to the runtime role, but it is
  -- NOT meant to be privileged relative to the server. A deployment that leaves
  -- `postgres` as its migration role still works, and still bypasses every
  -- policy the moment anyone runs a query through it -- so say so rather than
  -- let it pass silently.
  SELECT * INTO m FROM pg_roles WHERE rolname = migrator_role;

  IF m.rolsuper THEN
    RAISE WARNING 'migration role % is a SUPERUSER. Migrations work, but this role bypasses every row-level security policy. Create a dedicated non-superuser migration role and reassign ownership to it - see the header of this file.', migrator_role;
  ELSIF m.rolbypassrls THEN
    RAISE WARNING 'migration role % carries BYPASSRLS.', migrator_role;
  ELSE
    RAISE NOTICE 'least-privilege: % verified - not a superuser, no BYPASSRLS', migrator_role;
  END IF;
END;
$verify$;
