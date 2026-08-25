'use strict';

/**
 * The acquisition funnel queries.
 *
 * ── Why these live here and not in the controller ────────────────────────────
 * So the test suite can execute the SQL that actually ships. A test that
 * retypes the query proves the copy in the test file works, which is worth
 * nothing: the failure mode being guarded against is a column renamed on one
 * side, or a COALESCE label differing by a single character, and a retyped
 * query is exactly where that divergence hides.
 *
 * Read-only. Nothing here writes, and nothing reads a name, an email or any
 * tenant-scoped row — every column returned is a count or a campaign label.
 */

/**
 * Visit → Registration → Verified → First client → First package →
 * First booking, grouped by acquisition source.
 *
 * ── The join the dashboard was missing ───────────────────────────────────────
 * page_view knew where visitors came from. signup_attribution knew where each
 * account came from. The activation counts knew who had added a client. Nothing
 * connected the three, so the one question worth asking — which source produced
 * trainers who actually used TRENIKO — had no answer at all.
 *
 * ── The canonical source key ─────────────────────────────────────────────────
 * COALESCE(utm_source, referrer_host, '(direct)'), built identically on both
 * sides so visits and accounts are comparable on the same value. referrer_host
 * is the second choice rather than an afterthought: nobody tags an organic
 * search result, so without it every visitor Google sends is indistinguishable
 * from someone typing the address in.
 *
 * ── Why '(unattributed)' is not '(direct)' ───────────────────────────────────
 * An account with no signup_attribution row predates migration 034 and was
 * never measured. An account whose row carries no source WAS measured and
 * genuinely had none. Collapsing the two would let four development accounts
 * read as four measured direct signups — precisely the kind of quietly wrong
 * number this panel exists to stop producing.
 *
 * ── Why every stage counts a tenant at most once ─────────────────────────────
 * COUNT(*) FILTER (WHERE EXISTS ...) asks whether the account ever did the
 * thing, not how many times. A trainer with five clients advances first_client
 * by one. That is the difference between an activation funnel and a usage
 * total, and getting it wrong would make one enthusiastic user look like five.
 *
 * Tenant shells left by old deletions are excluded by the users EXISTS: a
 * tenant with no user is not an account and must never sit in a denominator.
 */
const FUNNEL_BY_SOURCE_SQL = `
        WITH account AS (
          SELECT t.id AS tenant_id,
                 COALESCE(
                   NULLIF(btrim(a.utm_source), ''),
                   NULLIF(btrim(a.referrer_host), ''),
                   CASE WHEN a.tenant_id IS NULL THEN '(unattributed)' ELSE '(direct)' END
                 ) AS source
            FROM tenants t
            LEFT JOIN signup_attribution a ON a.tenant_id = t.id
           WHERE EXISTS (SELECT 1 FROM users u WHERE u.tenant_id = t.id)
        ),
        visits AS (
          SELECT COALESCE(
                   NULLIF(btrim(utm_source), ''),
                   NULLIF(btrim(referrer_host), ''),
                   '(direct)'
                 ) AS source,
                 COUNT(*)::int AS visits
            FROM page_view
           GROUP BY 1
        ),
        -- Migration 036. clients, packages and the two session tables are
        -- under row-level security, and an admin request carries no tenant
        -- context -- so querying them directly here returned 0 for every
        -- account regardless of reality. This function is SECURITY DEFINER and
        -- returns three booleans per tenant, nothing more.
        act AS (
          SELECT tenant_id, has_client, has_package, has_booking
            FROM app_activation_by_tenant()
        ),
        funnel AS (
          SELECT ac.source,
                 COUNT(*)::int AS registrations,
                 COUNT(*) FILTER (WHERE EXISTS (
                   SELECT 1 FROM users u WHERE u.tenant_id = ac.tenant_id AND u.email_verified))::int AS verified,
                 COUNT(*) FILTER (WHERE act.has_client)::int  AS first_client,
                 COUNT(*) FILTER (WHERE act.has_package)::int AS first_package,
                 COUNT(*) FILTER (WHERE act.has_booking)::int AS first_booking
            FROM account ac
            LEFT JOIN act ON act.tenant_id = ac.tenant_id
           GROUP BY ac.source
        )
        SELECT COALESCE(f.source, v.source) AS source,
               COALESCE(v.visits, 0)::int         AS visits,
               COALESCE(f.registrations, 0)::int  AS registrations,
               COALESCE(f.verified, 0)::int       AS verified,
               COALESCE(f.first_client, 0)::int   AS first_client,
               COALESCE(f.first_package, 0)::int  AS first_package,
               COALESCE(f.first_booking, 0)::int  AS first_booking
          FROM funnel f
          FULL OUTER JOIN visits v ON v.source = f.source
         ORDER BY visits DESC, registrations DESC
         LIMIT 30`;

/**
 * The same funnel one level deeper, for accounts that carry a campaign.
 *
 * Kept separate rather than widening the table above: source is the question
 * asked every week, and medium/campaign/content only start to matter once a
 * channel is producing something worth splitting apart.
 */
const FUNNEL_BY_CAMPAIGN_SQL = `
        SELECT COALESCE(NULLIF(btrim(a.utm_source), ''), '(none)')   AS utm_source,
               COALESCE(NULLIF(btrim(a.utm_medium), ''), '(none)')   AS utm_medium,
               COALESCE(NULLIF(btrim(a.utm_campaign), ''), '(none)') AS utm_campaign,
               COALESCE(NULLIF(btrim(a.utm_content), ''), '(none)')  AS utm_content,
               COUNT(*)::int AS registrations,
               COUNT(*) FILTER (WHERE EXISTS (
                 SELECT 1 FROM users u WHERE u.tenant_id = t.id AND u.email_verified))::int AS verified,
               COUNT(*) FILTER (WHERE act.has_client)::int  AS first_client,
               COUNT(*) FILTER (WHERE act.has_package)::int AS first_package,
               COUNT(*) FILTER (WHERE act.has_booking)::int AS first_booking
          FROM signup_attribution a
          JOIN tenants t ON t.id = a.tenant_id
          -- Migration 036, same reason as above.
          LEFT JOIN app_activation_by_tenant() act ON act.tenant_id = t.id
         WHERE EXISTS (SELECT 1 FROM users u WHERE u.tenant_id = t.id)
         GROUP BY 1, 2, 3, 4
         ORDER BY registrations DESC
         LIMIT 25`;

/**
 * The denominator below which a percentage must not be shown.
 *
 * Two signups out of forty visits is not a 5% conversion rate, it is two
 * signups — and a rate computed from it is a number somebody quotes back six
 * months later as though it meant something. Below this the UI prints
 * "Not enough data yet" instead.
 */
const MINIMUM_FOR_RATE = 30;

/**
 * A conversion rate, or null when the denominator is too small to make one.
 *
 * Returning null rather than 0 is the point: the caller has to decide what to
 * render for "we do not know", and the honest answer is the words "Not enough
 * data yet" rather than a number. A percentage is a claim, and a claim built on
 * four accounts is a wrong one.
 *
 * @param {number} numerator
 * @param {number} denominator
 * @returns {number|null} whole-number percentage, or null
 */
function conversionRate(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (denominator < MINIMUM_FOR_RATE) return null;
  if (numerator < 0 || denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100);
}

module.exports = {
  FUNNEL_BY_SOURCE_SQL,
  FUNNEL_BY_CAMPAIGN_SQL,
  MINIMUM_FOR_RATE,
  conversionRate,
};
