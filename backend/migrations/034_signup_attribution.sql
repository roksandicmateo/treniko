-- Migration 034 — signup attribution
--
-- ============================================================================
-- WHAT THIS IS FOR
-- ============================================================================
-- TRENIKO can currently prove interest and cannot prove conversion. Instagram
-- Insights ends at "someone tapped the link"; `users.created_at` begins at
-- "someone has an account". Nothing joins the two, so the question that decides
-- where the next month of unpaid effort goes — *which Reel actually produced a
-- trainer?* — has no answer at all.
--
--     REACH → PROFILE VISIT → WEBSITE CLICK → ??? → REGISTRATION → ACTIVATION
--     └──────── Instagram Insights ────────┘       └── this migration ──┘
--
-- The UTM parameters that carry that answer exist only in the URL of the
-- landing page. By the time a visitor reaches /register they are gone.
-- frontend/src/utils/attribution.js already captures them into sessionStorage
-- on first touch; this table is where that value finally lands.
--
-- ============================================================================
-- WHY A SEPARATE TABLE AND NOT COLUMNS ON tenants
-- ============================================================================
-- `tenants` is read by effectively every tenant-scoped query in the product.
-- Marketing metadata has no business widening that row, and a separate table
-- can gain a column later without touching a hot path.
--
-- `tenant_id` is the PRIMARY KEY, not merely a foreign key. That is what
-- enforces **first touch** at the schema level rather than in application code:
-- a second attribution insert for the same tenant cannot succeed, so a later
-- direct visit can never overwrite the Reel that actually did the work.
--
-- ============================================================================
-- EVERY COLUMN IS NULLABLE, AND THAT IS THE POINT
-- ============================================================================
-- Most signups will carry no UTMs whatsoever — someone types the domain, or
-- arrives from a link with no tags. A registration must NEVER fail because
-- attribution was missing, malformed or hostile. The account is the thing that
-- matters; attribution is strictly best-effort.
--
-- The controller enforces the other half of that contract: the insert is
-- wrapped so a failure can never fail a registration, exactly as
-- recordAdminAction is in the admin controller.
--
-- ============================================================================
-- COLUMN WIDTHS ARE A SECURITY CONTROL, NOT A GUESS
-- ============================================================================
-- Every value here arrives from the browser and is therefore attacker
-- controlled. The controller whitelists the eight known keys and truncates each
-- to the width below before binding it. These are parameterised inserts so
-- there is no injection path, but an unbounded string is still an unbounded
-- string, and a VARCHAR(n) is a second, independent backstop if the application
-- guard is ever refactored away.
--
-- ============================================================================
-- ROW-LEVEL SECURITY: DELIBERATELY NOT ENABLED
-- ============================================================================
-- This table carries `tenant_id`, so migration 029's inventory test will demand
-- a decision in writing. The decision is the same one already recorded for
-- `tenants`, `tenant_subscriptions` and `subscription_usage`:
--
--   **It is written during registration, before any tenant context can exist.**
--
-- At the moment the row is inserted the tenant is milliseconds old and no
-- request has ever established a context for it. A policy here would make
-- signing up impossible — it would fail closed on the single flow that must
-- never fail closed.
--
-- Nothing in the authenticated application ever reads this table. It is written
-- once at registration and read afterwards only by operational reporting run as
-- the owner/migrator role, and by the platform-admin aggregate in
-- adminController.js, which reads counts and never a tenant's business data.
--
-- The exclusion is recorded, with this reason, in
-- tests/security/rlsPolicyInventory.test.js. That test asserts the list
-- EXACTLY, so this table could not have been added silently.
--
-- ============================================================================
-- PRIVACY
-- ============================================================================
-- UTM values are campaign labels, not personal data: `reel-p05` identifies a
-- Reel, not a person. Nothing identifying is ever placed in a URL parameter.
--
-- The trimming is deliberate and happens in the browser, so the untrimmed value
-- is never transmitted at all:
--   * `referrer_host` — the host only. A full referrer can carry someone
--     else's query string.
--   * `landing_path`  — the path only. The query string is where the UTMs
--     already are; storing it as well would store them twice.
--
-- Rows are covered by the existing erasure path through ON DELETE CASCADE from
-- `tenants`, and are included in the GDPR export in exportController.js — this
-- is data about how that trainer arrived, it contains no third-party personal
-- data, and including it is the more defensible Article 15 answer.
--
-- No Meta Pixel, no cross-site identifier, no fingerprint, no cookie.
--
-- ============================================================================
-- SAFETY
-- ============================================================================
-- Purely additive and idempotent. Creates one new table and one index. Reads
-- nothing, modifies nothing, deletes nothing, and changes no existing policy,
-- role, grant or table. Existing behaviour for trainers is unchanged.
--
-- Grants are not stated explicitly because they do not need to be: the default
-- ACLs for `treniko_migrator` and `postgres` already award INSERT/SELECT/
-- UPDATE/DELETE on new tables to `treniko_app`, which is how every table since
-- migration 029 has acquired them.

CREATE TABLE IF NOT EXISTS signup_attribution (
  -- PRIMARY KEY, not just a reference: this is what makes first-touch a
  -- schema-level guarantee rather than a convention.
  tenant_id      UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,

  -- SET NULL rather than CASCADE. If a trainer row is ever removed while the
  -- tenant survives, the fact that the tenant arrived from a given campaign is
  -- still true and still worth keeping.
  user_id        UUID REFERENCES users(id) ON DELETE SET NULL,

  utm_source     VARCHAR(64),
  utm_medium     VARCHAR(64),
  utm_campaign   VARCHAR(64),
  utm_content    VARCHAR(128),
  utm_term       VARCHAR(128),

  -- Host only — see PRIVACY above.
  referrer_host  VARCHAR(255),

  -- Path only, no query string.
  landing_path   VARCHAR(255),

  -- When the visitor first hit the landing page, as reported by the browser.
  -- Distinct from created_at, which is when they actually registered: the gap
  -- between the two is how long the decision took.
  first_seen_at  TIMESTAMPTZ,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The reporting query this exists to serve groups by source and campaign
-- ("which Reel produced trainers?"), so that is what is indexed.
CREATE INDEX IF NOT EXISTS signup_attribution_source_idx
  ON signup_attribution (utm_source, utm_content);
