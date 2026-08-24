-- Migration 035 — anonymous page views
--
-- ============================================================================
-- WHAT THIS IS FOR: the missing denominator
-- ============================================================================
-- Migration 034 made it possible to answer "which Reel produced a trainer?".
-- It cannot answer "and how many people did that Reel send who did NOT sign
-- up?", because registrations are the numerator and nothing counts the
-- visitors. A source with 2 signups from 10 visits and one with 2 signups from
-- 900 visits look identical today, and they are not remotely the same thing.
--
--     CONTENT → PROFILE VISIT → WEBSITE VISIT → REGISTRATION → ACTIVE TRAINER
--     └──── Instagram Insights ────┘ └ this ┘   └ migration 034 ┘
--
-- ============================================================================
-- WHY NOT UMAMI OR PLAUSIBLE
-- ============================================================================
-- Both were considered against the actual server rather than in the abstract.
--
-- **Plausible** needs Docker plus ClickHouse. Docker is not installed, and this
-- droplet is 1 vCPU with 961 MB of RAM and roughly 589 MB free. ClickHouse
-- alone wants more than the box has. It is not a preference, it does not fit.
--
-- **Umami** would fit, but poorly, and it answers the wrong shape of question.
-- It is a second Node process (~150-250 MB) on a single-core box that is
-- already running the product, with its own authentication, its own admin UI,
-- its own migration and update cadence, and its own attack surface. Decisively:
-- **its page views live in its own schema**, so the single number this whole
-- exercise exists to produce — landing visits joined to registrations — becomes
-- a cross-system reconciliation instead of one query.
--
-- One table in the database that already holds the registrations costs no extra
-- memory, no new service, no new credentials, and makes the join trivial. The
-- brief asked not to overbuild; this is the smallest thing that answers the
-- question.
--
-- ============================================================================
-- WHAT IS DELIBERATELY NOT STORED
-- ============================================================================
-- No IP address. No user agent. No cookie. No visitor id, session id, device
-- fingerprint or hash of any of them. There is no column here that could be
-- used to single anyone out, join two visits together, or follow a person
-- across pages — and none can be added without a new migration and this comment
-- having to be rewritten to explain why.
--
-- The consequence is honest and must be stated wherever these numbers are
-- shown: **this counts page VIEWS, not unique visitors.** One person reloading
-- twice is two rows. Deduplicating would require exactly the identifier that is
-- refused above, and an inflated denominator understating conversion is a safer
-- error than tracking people to correct it.
--
-- ============================================================================
-- CONSENT: WHY THIS IS NOT GATED, WHEN ATTRIBUTION IS
-- ============================================================================
-- utils/attribution.js writes to sessionStorage, which is storing information
-- on the visitor's device — ePrivacy Article 5(3) — so it is gated behind the
-- analytics consent category and writes nothing until the banner is accepted.
--
-- This is a different act. The browser sends one fire-and-forget request; the
-- server increments a count. Nothing is stored on or read from the device, and
-- nothing identifying is recorded at either end. Article 5(3) is about device
-- storage and access, and there is none here.
--
-- There is also a correctness reason, and it is not a convenience argument.
-- Registrations are counted from `tenants`, unconditionally. If views were
-- gated on consent and registrations were not, the denominator would be a
-- subset of the numerator's population and every conversion rate on the admin
-- panel would be overstated by whatever share of visitors decline cookies. A
-- consented sample compared against an unconsented total is not a rate, it is a
-- number that looks like one.
--
-- ============================================================================
-- ROW-LEVEL SECURITY: TENANT-NEUTRAL, NOT UNPROTECTED
-- ============================================================================
-- There is no tenant_id here and there cannot be one: a page view happens
-- before anybody has an account, and most views never lead to one. This is the
-- same category migration 029 section D calls tenant-neutral, alongside
-- `subscription_plans` and `schema_migrations` — it holds nothing belonging to
-- any tenant. It is recorded in TENANT_NEUTRAL_TABLES in
-- tests/security/rlsPolicyInventory.test.js, which asserts that list exactly.
--
-- ============================================================================
-- GROWTH
-- ============================================================================
-- One narrow row per view. The database is currently 11 MB with 18 GB free, so
-- at present traffic this is decades of headroom. It is still unbounded, and if
-- traffic ever makes that untrue the fix is a retention job that deletes rows
-- older than N months — the admin panel only ever reads recent windows and
-- aggregates. Not built now, because building it now would be inventing a
-- problem.
--
-- ============================================================================
-- SAFETY
-- ============================================================================
-- Purely additive and idempotent. One new table and two indexes. Reads nothing,
-- modifies nothing, deletes nothing, changes no existing policy, role, grant or
-- table. Grants arrive through the same default ACLs every table since
-- migration 029 has used.

CREATE TABLE IF NOT EXISTS page_view (
  id             BIGSERIAL PRIMARY KEY,

  -- Path only, never the query string: the UTM parameters are already parsed
  -- into their own columns below, and the query string is the one part of a URL
  -- that can carry something personal.
  path           VARCHAR(255) NOT NULL,

  -- Host only. A full referrer can carry someone else's query string, and
  -- Instagram rewrites outbound links through l.instagram.com, so the host is
  -- both the safe part and the useful part.
  referrer_host  VARCHAR(255),

  -- Widths mirror signup_attribution exactly, so a source string is the same
  -- length on both sides of the join that produces the conversion rate.
  utm_source     VARCHAR(64),
  utm_medium     VARCHAR(64),
  utm_campaign   VARCHAR(64),
  utm_content    VARCHAR(128),

  viewed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Every admin query is "the last N days", newest first.
CREATE INDEX IF NOT EXISTS page_view_viewed_at_idx
  ON page_view (viewed_at DESC);

-- And every breakdown groups by channel, matching signup_attribution's index.
CREATE INDEX IF NOT EXISTS page_view_source_idx
  ON page_view (utm_source, utm_campaign, utm_content);
