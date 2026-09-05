-- backend/migrations/038_beta_plan_limits.sql
--
-- ── Why ──────────────────────────────────────────────────────────────────────
-- The free plan allowed 5 clients and 20 sessions a month. TRENIKO is for
-- independent personal trainers, who have twenty to thirty clients — so the
-- plan every new account lands on made the product impossible to evaluate by
-- the only people it is for. They hit the wall on their sixth client, and there
-- is no checkout anywhere in the product, so there was no way past it.
--
-- The same plan also switched OFF `has_training_logs` and `has_export`, which
-- made two shipped features answer 403 "Upgrade to access it" — pointing at an
-- upgrade that cannot be bought. One of them, export, is also how a trainer
-- gets their own and their clients' data out, which is a GDPR obligation and
-- not something to gate at all. (The export routes are already mounted without
-- a feature gate; this aligns the plan data with that decision.)
--
-- ── What this changes ────────────────────────────────────────────────────────
-- The free plan becomes a real beta plan: 40 clients (above the top of the
-- target range), no monthly session ceiling, and every shipped feature on.
-- Nothing is charged for, because nothing can be — that stays true until a
-- checkout exists.
--
-- Pro and Enterprise are left exactly as they are. They are unreachable without
-- a checkout, and inventing prices for a product with no billing is how a
-- landing page starts lying.
--
-- ── Safety ───────────────────────────────────────────────────────────────────
-- Data-only, idempotent, no schema change. Raising a limit cannot invalidate
-- existing rows: every tenant currently within 5 clients is also within 40.

UPDATE subscription_plans
   SET max_clients            = 40,
       max_sessions_per_month = NULL,   -- NULL means unlimited, per the plan view
       has_training_logs      = true,
       has_export             = true,
       has_analytics          = true,
       max_storage_mb         = 2000,
       updated_at             = NOW()
 WHERE name = 'free';

-- `display_name` is what the trainer sees in the app and in limit messages.
-- "Free" reads like a tier below a paid one they could choose; there is no such
-- choice yet, and calling it Beta is both true and a better frame for the
-- feedback we are asking these trainers for.
UPDATE subscription_plans
   SET display_name = 'Beta',
       updated_at   = NOW()
 WHERE name = 'free';
