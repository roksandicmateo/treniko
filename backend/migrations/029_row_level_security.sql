-- Migration 029 — row-level security as a second tenant boundary
-- Security Hardening Phase 4
--
-- ============================================================================
-- WHAT THIS CHANGES, AND WHAT IT DOES NOT
-- ============================================================================
-- Tenant isolation is enforced today by an explicit `WHERE tenant_id = $n` in
-- application code. That remains the primary control and is unchanged. This
-- migration adds a second, independent boundary inside PostgreSQL, so that a
-- query written without that clause returns nothing instead of returning
-- another tenant's rows. TR-CRIT-2 was exactly that mistake.
--
-- ============================================================================
-- WHY THE EXISTING POLICIES COULD NOT SIMPLY BE LEFT IN PLACE
-- ============================================================================
-- Fifteen tables already had RLS enabled. Measured under a non-owner role in
-- Phase 3, six of those policies did not deny — they RAISED:
--
--     SELECT id FROM clients;
--     ERROR:  unrecognized configuration parameter "app.current_tenant_id"
--
-- They call current_setting() without its `missing_ok` argument, so with no
-- tenant context set the policy expression itself errors. `missing_ok` alone is
-- still not enough: a transaction-local setting does not vanish when the
-- transaction ends, it reverts to the EMPTY STRING, and ''::uuid raises 22P02.
-- Both cases are handled by app_current_tenant_id() below, which was verified
-- against every state a pooled connection can be in.
--
-- ============================================================================
-- ENABLE, NOT FORCE
-- ============================================================================
-- PostgreSQL skips policies for a table's OWNER. That is deliberate and it is
-- what makes this migration safe to apply: migrations, admin tooling and any
-- existing deployment that still connects as the owner keep working exactly as
-- before. Enforcement arrives when the application connects as the dedicated
-- non-owner runtime role (backend/scripts/least-privilege.sql).
--
-- FORCE ROW LEVEL SECURITY is deliberately NOT set. Forcing would also subject
-- the migration role to these policies, which would break future data
-- migrations and any operational query, while adding nothing for the runtime
-- role — a non-owner is already subject to them.
--
-- Because of that, an operator who deploys the code without switching the
-- database role gets no enforcement. That is not left silent: the application
-- checks at startup and logs prominently whether RLS is actually effective for
-- the role it is connected as (see config/rlsStatus.js).
--
-- ============================================================================
-- SAFETY
-- ============================================================================
-- Additive and idempotent: no data is read, written or deleted. Policies are
-- dropped and recreated by name so re-running is a no-op. No table is locked
-- for longer than a catalogue update.

-- ────────────────────────────────────────────────────────────────────────────
-- The tenant context accessor.
-- ────────────────────────────────────────────────────────────────────────────
-- Returns NULL — never an error — when the context is missing, empty, or not a
-- valid UUID. NULL never equals a tenant_id, so every failure mode denies.
-- Written in plpgsql rather than SQL specifically for the EXCEPTION block:
-- a malformed value must deny rather than abort the statement.
CREATE OR REPLACE FUNCTION app_current_tenant_id() RETURNS uuid
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION app_current_tenant_id() IS
  'Tenant for the current transaction, or NULL. Set by config/tenantContext.js with SET LOCAL semantics; NULL denies every tenant-scoped policy.';

CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_user_id', true), '')::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION app_current_user_id() IS
  'Authenticated user for the current transaction, or NULL. Used by trainer-scoped policies.';

-- ────────────────────────────────────────────────────────────────────────────
-- A. DIRECT TENANT TABLES — the row carries tenant_id.
-- ────────────────────────────────────────────────────────────────────────────
-- Policies are written as `(SELECT app_current_tenant_id())` rather than a bare
-- call: the scalar subquery is evaluated once per statement as an InitPlan
-- instead of once per row, which keeps sequential scans at their previous cost.
DO $$
DECLARE
  t text;
  direct_tables text[] := ARRAY[
    'clients',
    'trainings',
    'training_sessions',
    'training_logs',
    'training_images',
    'progress_entries',
    'exercises',
    'training_templates',
    'groups',
    'group_sessions',
    'session_attendees',
    'packages',
    'client_packages',
    'client_payments',
    'package_session_usage',
    -- Plan-change history. It carries tenant_id and is written only by
    -- subscriptionsController.changePlan, which always runs inside an
    -- authenticated request; unlike the other subscription_* tables it is
    -- never read across tenants by the daily checker and never written during
    -- registration, so nothing about it belongs in section D.
    'subscription_history'
  ];
BEGIN
  FOREACH t IN ARRAY direct_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    -- Drop every policy this project has ever created on the table, by name,
    -- so the end state does not depend on which of them happened to exist.
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_%s ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_sessions ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_clients ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_training_logs ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_packages ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_client_packages ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_client_payments ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_pkg_usage ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS rls_tenant_%s ON public.%I', t, t);

    -- USING governs which existing rows are visible to SELECT/UPDATE/DELETE.
    -- WITH CHECK governs which rows may be written by INSERT/UPDATE — without
    -- it, a caller could insert a row stamped with another tenant's id.
    EXECUTE format($p$
      CREATE POLICY rls_tenant_%s ON public.%I
        FOR ALL
        USING      (tenant_id = (SELECT app_current_tenant_id()))
        WITH CHECK (tenant_id = (SELECT app_current_tenant_id()))
    $p$, t, t);
  END LOOP;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- B. INDIRECT TENANT TABLES — ownership derives through a parent row.
-- ────────────────────────────────────────────────────────────────────────────
-- Each policy re-checks the parent rather than trusting that the child was
-- inserted correctly. The parent lookup is by primary key, so it is an index
-- scan per statement, not a table scan.

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_tenant_group_members ON public.group_members;
CREATE POLICY rls_tenant_group_members ON public.group_members
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = group_members.group_id
      AND g.tenant_id = (SELECT app_current_tenant_id())))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = group_members.group_id
      AND g.tenant_id = (SELECT app_current_tenant_id())));

ALTER TABLE public.group_session_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_tenant_group_session_attendance ON public.group_session_attendance;
CREATE POLICY rls_tenant_group_session_attendance ON public.group_session_attendance
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.group_sessions gs
    WHERE gs.id = group_session_attendance.group_session_id
      AND gs.tenant_id = (SELECT app_current_tenant_id())))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.group_sessions gs
    WHERE gs.id = group_session_attendance.group_session_id
      AND gs.tenant_id = (SELECT app_current_tenant_id())));

ALTER TABLE public.template_exercises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_tenant_template_exercises ON public.template_exercises;
CREATE POLICY rls_tenant_template_exercises ON public.template_exercises
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.training_templates tt
    WHERE tt.id = template_exercises.template_id
      AND tt.tenant_id = (SELECT app_current_tenant_id())))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.training_templates tt
    WHERE tt.id = template_exercises.template_id
      AND tt.tenant_id = (SELECT app_current_tenant_id())));

ALTER TABLE public.template_sets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_tenant_template_sets ON public.template_sets;
CREATE POLICY rls_tenant_template_sets ON public.template_sets
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.template_exercises te
    JOIN public.training_templates tt ON tt.id = te.template_id
    WHERE te.id = template_sets.template_exercise_id
      AND tt.tenant_id = (SELECT app_current_tenant_id())))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.template_exercises te
    JOIN public.training_templates tt ON tt.id = te.template_id
    WHERE te.id = template_sets.template_exercise_id
      AND tt.tenant_id = (SELECT app_current_tenant_id())));

ALTER TABLE public.training_exercises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_tenant_training_exercises ON public.training_exercises;
CREATE POLICY rls_tenant_training_exercises ON public.training_exercises
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.trainings t
    WHERE t.id = training_exercises.training_id
      AND t.tenant_id = (SELECT app_current_tenant_id())))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.trainings t
    WHERE t.id = training_exercises.training_id
      AND t.tenant_id = (SELECT app_current_tenant_id())));

ALTER TABLE public.training_sets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_tenant_training_sets ON public.training_sets;
CREATE POLICY rls_tenant_training_sets ON public.training_sets
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.training_exercises te
    JOIN public.trainings t ON t.id = te.training_id
    WHERE te.id = training_sets.training_exercise_id
      AND t.tenant_id = (SELECT app_current_tenant_id())))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.training_exercises te
    JOIN public.trainings t ON t.id = te.training_id
    WHERE te.id = training_sets.training_exercise_id
      AND t.tenant_id = (SELECT app_current_tenant_id())));

ALTER TABLE public.exercise_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_tenant_exercise_entries ON public.exercise_entries;
CREATE POLICY rls_tenant_exercise_entries ON public.exercise_entries
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.training_logs tl
    WHERE tl.id = exercise_entries.training_log_id
      AND tl.tenant_id = (SELECT app_current_tenant_id())))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.training_logs tl
    WHERE tl.id = exercise_entries.training_log_id
      AND tl.tenant_id = (SELECT app_current_tenant_id())));

-- ────────────────────────────────────────────────────────────────────────────
-- C. TRAINER-SCOPED TABLES — ownership is the user, not the tenant.
-- ────────────────────────────────────────────────────────────────────────────
-- These already had policies referencing app.current_user_id, a setting the
-- application had never set anywhere — so they would have matched nothing.
-- config/tenantContext.js now sets it alongside the tenant id.
DO $$
DECLARE
  t text;
  user_tables text[] := ARRAY['client_consents', 'trainer_consents', 'data_export_requests'];
BEGIN
  FOREACH t IN ARRAY user_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %s_isolation ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS rls_user_%s ON public.%I', t, t);
    EXECUTE format($p$
      CREATE POLICY rls_user_%s ON public.%I
        FOR ALL
        USING      (trainer_id = (SELECT app_current_user_id()))
        WITH CHECK (trainer_id = (SELECT app_current_user_id()))
    $p$, t, t);
  END LOOP;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- D. TABLES DELIBERATELY LEFT OUTSIDE THE ENFORCED SET.
-- ────────────────────────────────────────────────────────────────────────────
-- Each of these is reached by a code path that legitimately has no tenant
-- context, so a tenant policy would break the application rather than protect
-- it. They previously had RLS enabled with policies that could never match
-- (and in three cases would raise), which is worse than not having it: it
-- reads as protection that is not there. Enabling is therefore reversed
-- explicitly, and the reason recorded per table.
--
--   users, tenants, password_reset_tokens
--       login, registration, password reset and email verification all run
--       BEFORE any tenant is known. RLS here would make authentication
--       impossible. (These never had RLS enabled.)
--
--   tenant_subscriptions, subscription_usage, subscription_notifications
--       written during registration, before the tenant context exists, and
--       read across all tenants by the daily subscription checker.
--
--   audit_log
--       written by the deletion job with no request context, and it is an
--       append-only security log rather than tenant business data.
--
--   deletion_requests
--       the deletion job must read pending requests across every tenant to do
--       its work at all.
--
-- Application-level authorization remains the control on all of these, exactly
-- as before this migration.
DO $$
DECLARE
  t text;
  unenforced text[] := ARRAY[
    'tenant_subscriptions',
    'subscription_usage',
    'subscription_notifications',
    'audit_log',
    'deletion_requests'
  ];
BEGIN
  FOREACH t IN ARRAY unenforced LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_subscriptions ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_usage ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_notifications ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS audit_log_isolation ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS deletion_requests_isolation ON public.%I', t);
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END;
$$;
