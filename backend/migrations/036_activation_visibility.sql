-- Migration 036 — let the admin panel see activation without breaking RLS
--
-- ============================================================================
-- THE BUG THIS FIXES
-- ============================================================================
-- The admin dashboard reports how many accounts have added a client, created a
-- package or booked a session. Those numbers were **always zero, and always
-- would have been**, no matter how many trainers used the product.
--
-- `tenants` and `users` are outside row-level security — deliberately, because
-- registration legitimately runs before any tenant context exists — so counts
-- drawn from them were correct. `clients`, `packages`, `training_sessions` and
-- `group_sessions` are inside it. The application connects as `treniko_app`,
-- a non-owner, so every one of those tables is filtered by
-- `app_current_tenant_id()`. An admin request carries no tenant context, the
-- accessor returns NULL, NULL matches no row, and the count comes back 0.
--
-- That is RLS working exactly as designed. It is also a metric that reads as
-- "nobody has ever used TRENIKO" while a trainer is using it, which is the
-- single number the whole acquisition effort is steering by. Verified against
-- the real schema before writing this: a client inserted under tenant context
-- is visible as 1 with context and 0 without.
--
-- ============================================================================
-- WHY A SECURITY DEFINER FUNCTION AND NOT THE ALTERNATIVES
-- ============================================================================
-- **Not a policy exception for `treniko_app`.** A policy wide enough to let the
-- admin panel count clients is wide enough to let any authenticated request
-- read another tenant's clients. That trades a reporting problem for a data
-- breach.
--
-- **Not connecting as the owner.** `treniko_migrator` bypasses RLS entirely
-- (migration 029 enables rather than forces). Pointing the running application
-- at it to fix a dashboard would disable tenant isolation for the whole API.
--
-- **Not `subscription_usage.clients_count`.** It is outside RLS and already
-- summed on the dashboard, but it is a per-billing-period counter. It cannot
-- answer "has this account EVER added a client", which is what activation means.
--
-- A SECURITY DEFINER function owned by the table owner runs with the owner's
-- rights, so it sees every row — and it is the narrowest possible hole: it is
-- the only thing that gets that privilege, its body is fixed here, and it
-- returns three booleans per tenant.
--
-- ============================================================================
-- WHAT IT DISCLOSES, STATED PRECISELY
-- ============================================================================
-- For each tenant: whether it has at least one client, at least one package,
-- and at least one scheduled session. That is all.
--
-- No name. No email. No client row. Not even a count — five clients and one
-- client are both `true`, because the funnel counts an account once per stage
-- and a count would disclose more while answering nothing extra.
--
-- The tenant ids it returns are ones the admin panel can already list from
-- `tenants`, which is outside RLS. So the marginal disclosure is three booleans
-- about business activity, and no personal data of any kind.
--
-- ============================================================================
-- HARDENING
-- ============================================================================
-- * `SET search_path = pg_catalog, public` — pinned, so the definer's rights
--   cannot be redirected at objects a caller planted in a schema earlier on the
--   search path. This is the standard SECURITY DEFINER failure mode.
-- * `REVOKE ALL ... FROM PUBLIC` then an explicit grant, so execution is not
--   granted by default to every role in the database.
-- * `STABLE` and `RETURNS TABLE` of booleans — it cannot write anything.
--
-- ============================================================================
-- SAFETY
-- ============================================================================
-- Additive and idempotent. Creates one function. Reads nothing, writes nothing,
-- deletes nothing, alters no table, no policy, no role and no existing grant.
-- Re-running replaces the function with an identical body. Nothing depends on
-- it until the application is deployed, so it can be applied ahead of code.
--
-- Rollback is `DROP FUNCTION app_activation_by_tenant();` — after which the
-- dashboard returns to reporting zeros, which is where it started.

CREATE OR REPLACE FUNCTION app_activation_by_tenant()
RETURNS TABLE (
  tenant_id   UUID,
  has_client  BOOLEAN,
  has_package BOOLEAN,
  has_booking BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
STABLE
AS $$
  SELECT
    t.id,
    EXISTS (SELECT 1 FROM public.clients  c WHERE c.tenant_id = t.id),
    EXISTS (SELECT 1 FROM public.packages p WHERE p.tenant_id = t.id),
    -- A booking is a scheduled session of either kind, matching what the
    -- in-product onboarding checklist checks, so the funnel and the checklist
    -- cannot disagree about what "done" means.
    EXISTS (SELECT 1 FROM public.training_sessions s WHERE s.tenant_id = t.id)
      OR EXISTS (SELECT 1 FROM public.group_sessions g WHERE g.tenant_id = t.id)
  FROM public.tenants t;
$$;

COMMENT ON FUNCTION app_activation_by_tenant() IS
  'Per-tenant activation booleans for the admin acquisition funnel. SECURITY '
  'DEFINER because clients/packages/sessions are under RLS and an admin request '
  'carries no tenant context. Returns three booleans per tenant and nothing '
  'else: no names, no emails, no rows, not even counts.';

REVOKE ALL ON FUNCTION app_activation_by_tenant() FROM PUBLIC;

-- Granted to the runtime role because the admin controller runs as it. The
-- role name is the one migration 029 and least-privilege.sql establish; the
-- DO block keeps this migration runnable on a deployment that has not yet
-- switched roles, where the owner is still the connecting user.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'treniko_app') THEN
    GRANT EXECUTE ON FUNCTION app_activation_by_tenant() TO treniko_app;
  END IF;
END
$$;
