'use strict';

/**
 * Platform administration API.
 *
 * ── What this can and cannot see ────────────────────────────────────────────
 * Everything here reads tables that migration 029 section D deliberately
 * leaves outside row-level security: tenants, users, tenant_subscriptions,
 * subscription_usage, audit_log, deletion_requests, and the
 * tenant_subscription_status view over them.
 *
 * Per-tenant BUSINESS data — clients, sessions, payments, training logs,
 * progress entries — is RLS-protected, and admin requests deliberately
 * establish no tenant context (they are mounted before the tenant-context
 * middleware in server.js). Under the `treniko_app` runtime role those tables
 * therefore return zero rows to this API. Nothing here tries to work around
 * that, and nothing should: a trainer's clients carry health notes and dates of
 * birth, and there is no support task that needs staff to read them.
 *
 * Aggregate client and session counts come from `subscription_usage`, which is
 * maintained by database triggers and contains counts only — no personal data.
 *
 * ── Every write is audited ──────────────────────────────────────────────────
 * A panel that can change another company's subscription without leaving a
 * trace is an unattributable back door. `recordAdminAction` writes the before
 * and after of each change, and the fields it records are whitelisted so a
 * secret can never be logged by accident.
 */

const bcrypt = require('bcryptjs');
const {
  FUNNEL_BY_SOURCE_SQL,
  FUNNEL_BY_CAMPAIGN_SQL,
  MINIMUM_FOR_RATE,
} = require('../utils/acquisitionFunnel');
const { pool } = require('../config/database');
const { sendDbClientError } = require('../utils/dbErrors');
const {
  isUuid, isEmail, normalizeEmail, validatePassword, parseBoundedInt,
} = require('../utils/validation');
const { signAdminToken } = require('../middleware/adminAuth');

// Mirrors the trainer lockout in middleware/security.js.
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

// bcrypt cost for administrator passwords. Higher than the trainer cost of 10:
// there are a handful of these accounts, they are the highest-value credential
// in the system, and nobody notices 150 ms on a staff login.
const ADMIN_BCRYPT_COST = 12;

/**
 * A valid cost-12 bcrypt hash used only to equalise login timing for addresses
 * that do not exist. See the comment at its use site in login().
 */
const DECOY_HASH = '$2a$12$r5D2aHQ3umMXDRHtAL5lZerwtDwAV3sDN3mySaLgzYx5gdjiQHbiS';

// ── helpers ─────────────────────────────────────────────────────────────────

/** Columns of platform_admins that may ever leave the server. Never the hash. */
const ADMIN_PUBLIC_COLUMNS = `
  id, email, first_name, last_name, role, is_active,
  locked_until, last_login_at, created_at, updated_at`;

/**
 * Columns of users that may leave the server through THIS api.
 *
 * Deliberately excludes password_hash, verification_token and
 * verification_token_expires. A support tool has no use for a password hash,
 * and a verification token is a live account-takeover primitive — anyone
 * holding it can confirm an address they do not control.
 */
const TRAINER_PUBLIC_COLUMNS = `
  u.id, u.tenant_id, u.email, u.first_name, u.last_name, u.phone,
  u.city, u.country, u.website, u.bio, u.language,
  u.email_verified, u.dpa_accepted, u.dpa_accepted_at,
  u.failed_login_attempts, u.locked_until,
  u.created_at, u.updated_at, u.profile_updated_at`;

const clientIp = (req) => req.ip || (req.connection && req.connection.remoteAddress) || null;

/** Read `page` and `pageSize` with hard bounds, so a caller cannot ask for everything. */
const readPaging = (req) => {
  const page = parseBoundedInt(req.query.page, { min: 1, max: 10000, fallback: 1 });
  const pageSize = parseBoundedInt(req.query.pageSize, { min: 1, max: 100, fallback: 25 });
  return { page, pageSize, offset: (page - 1) * pageSize };
};

/**
 * Append one row to admin_audit_log.
 *
 * Never throws into the request: a failure to write the log is reported loudly
 * in the server log, but the operation that succeeded is still reported as
 * succeeded. Losing the audit row is bad; lying to the operator about whether
 * the change landed is worse.
 */
const recordAdminAction = async (req, { action, entityType, entityId, tenantId, changes }) => {
  try {
    await pool.query(
      `INSERT INTO admin_audit_log
         (admin_id, admin_email, action, entity_type, entity_id, tenant_id, changes, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        req.admin.id, req.admin.email, action, entityType,
        entityId || null, tenantId || null,
        changes ? JSON.stringify(changes) : null,
        clientIp(req),
      ]
    );
  } catch (e) {
    console.error('[adminAudit] FAILED to record admin action', { action, entityType, entityId }, e.message);
  }
};

/**
 * Build a partial UPDATE from a whitelist.
 *
 * Returns the SQL fragment, the values, and a `changes` object holding only the
 * fields the caller actually supplied — which is what gets audited. Anything
 * not on the whitelist is ignored silently rather than rejected, so an
 * over-eager client sending a whole object back cannot smuggle in a column.
 *
 * @returns {{sql: string, values: any[], changes: object}|null} null if nothing to do
 */
const buildUpdate = (body, allowed, startIndex = 1) => {
  const sets = [];
  const values = [];
  const changes = {};
  let i = startIndex;

  for (const [field, column] of Object.entries(allowed)) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
    let value = body[field];
    if (typeof value === 'string') {
      value = value.trim();
      if (value === '') value = null;
    }
    sets.push(`${column} = $${i}`);
    values.push(value);
    changes[field] = value;
    i += 1;
  }

  if (!sets.length) return null;
  return { sql: sets.join(', '), values, changes };
};

// ── authentication ──────────────────────────────────────────────────────────

/**
 * POST /api/admin/auth/login
 *
 * Deliberately identical in shape to the trainer login, including the generic
 * failure message: a different response for "no such administrator" than for
 * "wrong password" tells an attacker which staff addresses exist.
 */
const login = async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Validation error', message: 'Email and password are required' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, email, password_hash, first_name, last_name, role,
              is_active, failed_login_attempts, locked_until
         FROM platform_admins
        WHERE email = $1`,
      [normalizeEmail(email)]
    );

    const admin = rows[0];
    const generic = { error: 'Authentication failed', message: 'Invalid credentials' };

    // Compare against a decoy hash when the account does not exist, so the
    // response time does not reveal whether the address is registered.
    //
    // The decoy must be a SYNTACTICALLY VALID cost-12 hash. An earlier version
    // used a filler string of the wrong length; bcrypt rejected it on sight and
    // returned false in ~0 ms, while a real account spent ~240 ms doing the
    // work. That is a trivially measurable oracle, and it defeated the exact
    // mitigation this line exists to provide. Verified in
    // tests/security/platformAdmin.test.js.
    //
    // This is the hash of a random 32-byte value that was never recorded, at
    // the same cost as a real administrator password. It is not a secret and
    // it authenticates nobody: no input can produce a match.
    const ok = await bcrypt.compare(String(password), admin ? admin.password_hash : DECOY_HASH);

    if (!admin || !ok) {
      if (admin) {
        await pool.query(
          `UPDATE platform_admins
              SET failed_login_attempts = failed_login_attempts + 1,
                  locked_until = CASE WHEN failed_login_attempts + 1 >= $1
                                      THEN NOW() + ($2 || ' minutes')::interval
                                      ELSE locked_until END
            WHERE id = $3`,
          [MAX_FAILED_ATTEMPTS, String(LOCK_MINUTES), admin.id]
        );
      }
      return res.status(401).json(generic);
    }

    if (!admin.is_active) {
      return res.status(403).json({ error: 'Forbidden', message: 'This administrator account is disabled' });
    }

    if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
      const minutes = Math.ceil((new Date(admin.locked_until) - new Date()) / 60000);
      return res.status(423).json({
        error: 'Account locked',
        message: `Too many failed attempts. Try again in ${minutes} minute(s).`,
      });
    }

    await pool.query(
      `UPDATE platform_admins
          SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW()
        WHERE id = $1`,
      [admin.id]
    );

    await recordAdminAction(
      { admin: { id: admin.id, email: admin.email }, ip: clientIp(req) },
      { action: 'admin_login', entityType: 'platform_admin', entityId: admin.id }
    );

    return res.json({
      success: true,
      token: signAdminToken(admin),
      admin: {
        id: admin.id,
        email: admin.email,
        firstName: admin.first_name,
        lastName: admin.last_name,
        role: admin.role,
      },
    });
  } catch (error) {
    if (sendDbClientError(res, error)) return;
    console.error('admin login error:', error);
    return res.status(500).json({ error: 'Server error', message: 'Login failed' });
  }
};

/** GET /api/admin/auth/me */
const me = async (req, res) => res.json({ success: true, admin: req.admin });

// ── platform overview ───────────────────────────────────────────────────────

/**
 * GET /api/admin/overview
 *
 * Everything on one screen, counted live. No figure here is estimated or
 * cached — if a number cannot be derived from the database it is not shown.
 */
const getOverview = async (req, res) => {
  try {
    const [tenants, trainers, plans, usage, deletions, recent, attribution, attributionSources, views, viewsBySource, viewsByPath, viewsByReferrer, activation, funnelBySource, funnelByCampaign] = await Promise.all([
      pool.query(`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int  AS last_7_days,
               COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS last_30_days
          FROM tenants`),
      pool.query(`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE email_verified)::int AS verified,
               COUNT(*) FILTER (WHERE locked_until IS NOT NULL AND locked_until > NOW())::int AS locked,
               COUNT(*) FILTER (WHERE dpa_accepted)::int AS dpa_accepted
          FROM users`),
      pool.query(`
        SELECT sp.name AS plan, ts.status,
               COUNT(*)::int AS count,
               COUNT(*) FILTER (WHERE ts.is_trial)::int AS trials
          FROM tenant_subscriptions ts
          JOIN subscription_plans sp ON sp.id = ts.plan_id
         GROUP BY sp.name, ts.status
         ORDER BY sp.name, ts.status`),
      pool.query(`
        SELECT COALESCE(SUM(clients_count), 0)::int  AS clients_total,
               COALESCE(SUM(sessions_count), 0)::int AS sessions_this_period
          FROM subscription_usage`),
      pool.query(`
        SELECT COUNT(*) FILTER (WHERE status = 'pending')::int AS pending
          FROM deletion_requests`),
      pool.query(`
        SELECT t.id, t.name, t.created_at,
               (SELECT COUNT(*)::int FROM users u WHERE u.tenant_id = t.id) AS trainer_count,
               -- Migration 034. Campaign labels only; signup_attribution holds
               -- no personal data and is not RLS-protected, so this join adds
               -- no exposure beyond the tenant name already listed here.
               a.utm_source, a.utm_campaign, a.utm_content
          FROM tenants t
          LEFT JOIN signup_attribution a ON a.tenant_id = t.id
         ORDER BY t.created_at DESC
         LIMIT 10`),

      // How many signups carry attribution at all. `direct_or_unknown` is the
      // honest residual: no UTMs and no external referrer, OR the visitor
      // declined the analytics cookie category. Those two are deliberately not
      // separated, because nothing distinguishes them server-side and guessing
      // would be worse than the ambiguity.
      pool.query(`
        SELECT COUNT(*)::int AS tenants_total,
               COUNT(a.tenant_id)::int AS attributed,
               (COUNT(*) - COUNT(a.tenant_id))::int AS direct_or_unknown
          FROM tenants t
          LEFT JOIN signup_attribution a ON a.tenant_id = t.id`),

      // Which channel actually produced accounts. This is the question the
      // whole attribution exercise exists to answer.
      pool.query(`
        SELECT COALESCE(utm_source, '(none)')   AS utm_source,
               COALESCE(utm_campaign, '(none)') AS utm_campaign,
               COALESCE(utm_content, '(none)')  AS utm_content,
               COUNT(*)::int AS signups,
               MAX(created_at) AS most_recent
          FROM signup_attribution
         GROUP BY 1, 2, 3
         ORDER BY signups DESC, most_recent DESC
         LIMIT 25`),

      // Migration 035. The denominator. Counts page VIEWS, not unique
      // visitors — there is no identifier to deduplicate by, deliberately.
      pool.query(`
        SELECT COUNT(*)::int AS views_total,
               COUNT(*) FILTER (WHERE viewed_at >= NOW() - INTERVAL '7 days')::int  AS last_7_days,
               COUNT(*) FILTER (WHERE viewed_at >= NOW() - INTERVAL '30 days')::int AS last_30_days,
               MIN(viewed_at) AS measuring_since
          FROM page_view`),

      // Views and signups per channel, joined so a conversion rate can be
      // computed per source rather than only in aggregate.
      //
      // FULL OUTER JOIN on purpose: a channel can have views and no signups
      // (the common case, and the one worth seeing), or signups and no views —
      // which happens for every account created before this table existed, and
      // for anyone whose browser blocked the beacon. Either side dropping rows
      // would quietly flatter or hide a channel.
      pool.query(`
        WITH v AS (
          SELECT COALESCE(utm_source, '(direct)')   AS source,
                 COALESCE(utm_campaign, '(none)')   AS campaign,
                 COUNT(*)::int AS views
            FROM page_view
           GROUP BY 1, 2
        ),
        s AS (
          SELECT COALESCE(utm_source, '(direct)')   AS source,
                 COALESCE(utm_campaign, '(none)')   AS campaign,
                 COUNT(*)::int AS signups
            FROM signup_attribution
           GROUP BY 1, 2
        )
        SELECT COALESCE(v.source, s.source)     AS utm_source,
               COALESCE(v.campaign, s.campaign) AS utm_campaign,
               COALESCE(v.views, 0)             AS views,
               COALESCE(s.signups, 0)           AS signups
          FROM v FULL OUTER JOIN s
            ON v.source = s.source AND v.campaign = s.campaign
         ORDER BY views DESC, signups DESC
         LIMIT 25`),

      // Which page. The channel breakdown above answers "where did they come
      // from"; this answers "what did they read", and since the content cluster
      // grew to eleven pages that is the question that decides what gets
      // written next. Without it the roadmap is chosen by taste.
      //
      // Windowed to 30 days for two reasons: it is the horizon a content
      // decision is actually made on, and the filter uses page_view_viewed_at_idx
      // rather than scanning the table — there is no index on `path`, and
      // adding one for a query nobody runs hourly would be premature.
      //
      // Paths are normalised at write time (trailing slash stripped by the
      // beacon), so `/guides` and `/guides/` are already one row.
      pool.query(`
        SELECT path,
               COUNT(*)::int AS views,
               COUNT(*) FILTER (WHERE viewed_at >= NOW() - INTERVAL '7 days')::int AS last_7_days,
               MAX(viewed_at) AS most_recent
          FROM page_view
         WHERE viewed_at >= NOW() - INTERVAL '30 days'
         GROUP BY path
         ORDER BY views DESC, most_recent DESC
         LIMIT 30`),

      // Where the visit came from when nothing tagged it.
      //
      // This is the gap that mattered most for an SEO programme. A visitor
      // arriving from a Google search carries no UTM parameters — nobody tags
      // an organic result — so every one of them was being counted under
      // `(direct)` alongside people who typed the address in. The two are not
      // the same thing, and the first is the entire point of the content work.
      //
      // referrer_host has been collected since migration 035 and nothing read
      // it. Host only, never the full referrer: a full URL can carry someone
      // else's query string.
      //
      // Rows WITH a utm_source are excluded rather than shown twice — those are
      // already attributed by campaign in the table above, and counting them in
      // both places makes the totals disagree with each other.
      pool.query(`
        SELECT COALESCE(referrer_host, '(none)') AS referrer_host,
               COUNT(*)::int AS views,
               COUNT(*) FILTER (WHERE viewed_at >= NOW() - INTERVAL '7 days')::int AS last_7_days,
               MAX(viewed_at) AS most_recent
          FROM page_view
         WHERE utm_source IS NULL
         GROUP BY referrer_host
         ORDER BY views DESC, most_recent DESC
         LIMIT 25`),

      // The activation funnel — the only part of this dashboard that answers
      // "do we have a real user yet".
      //
      // Two things it corrects.
      //
      // First, `tenants` is not the signup count. A tenant row can outlive the
      // account it belonged to: account deletion before the fix in
      // jobs/deletionJob.js removed the trainer and left the shell, and there
      // are five such shells in production against four real accounts. Counting
      // rows therefore overstates signups by 125% today, and any figure derived
      // from it — conversion rate above all — is wrong by the same margin. An
      // account is a tenant that still has a user.
      //
      // Second, a signup is not a user. Someone who registers, verifies their
      // email and never adds a client has not adopted anything; the product has
      // not been used. `with_client` is the real activation event, because
      // adding a client is the first action that only a working trainer takes,
      // and it is the number that has never once been above zero.
      //
      // Counts of rows only. No names, no emails, nothing tenant-scoped is read.
      pool.query(`
        WITH account AS (
          SELECT t.id
            FROM tenants t
           WHERE EXISTS (SELECT 1 FROM users u WHERE u.tenant_id = t.id)
        )
        SELECT
          (SELECT COUNT(*)::int FROM tenants) AS tenant_rows,
          (SELECT COUNT(*)::int FROM account) AS accounts,
          (SELECT COUNT(*)::int FROM account a
            WHERE EXISTS (SELECT 1 FROM users u WHERE u.tenant_id = a.id AND u.email_verified)) AS verified,
          -- Migration 036. These three read through app_activation_by_tenant()
          -- because clients, packages and the session tables are under RLS and
          -- an admin request has no tenant context: querying them directly
          -- returned 0 for every account no matter how many trainers were
          -- using the product, which made the one number this panel exists for
          -- permanently and silently wrong.
          (SELECT COUNT(*)::int FROM account a
             JOIN app_activation_by_tenant() v ON v.tenant_id = a.id
            WHERE v.has_client) AS with_client,
          (SELECT COUNT(*)::int FROM account a
             JOIN app_activation_by_tenant() v ON v.tenant_id = a.id
            WHERE v.has_booking) AS with_training,
          (SELECT COUNT(*)::int FROM account a
             JOIN app_activation_by_tenant() v ON v.tenant_id = a.id
            WHERE v.has_package) AS with_package`),

      // Visit -> Registration -> Verified -> First client -> First package ->
      // First booking, by acquisition source. The SQL lives in
      // utils/acquisitionFunnel.js so the test suite runs the query that ships
      // rather than a retyped copy of it; the reasoning behind the source key,
      // the (unattributed) label and the count-once semantics is there too.
      pool.query(FUNNEL_BY_SOURCE_SQL),

      // The same funnel one level deeper, for accounts carrying a campaign.
      pool.query(FUNNEL_BY_CAMPAIGN_SQL),
    ]);

    return res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      overview: {
        tenants: tenants.rows[0],
        trainers: trainers.rows[0],
        subscriptions: plans.rows,
        // Counts only. This API cannot read the client rows themselves.
        usage: usage.rows[0],
        deletionRequests: deletions.rows[0],
        newestTenants: recent.rows,

        // ── Acquisition ──────────────────────────────────────────────────
        // Both halves of the funnel: page views (migration 035) as the
        // denominator, signups (migration 034) as the numerator, joined per
        // channel so a conversion rate can be read per source rather than only
        // in aggregate.
        //
        // What still cannot be produced is listed in `notMeasured` with the
        // reason for each, rather than omitted — an absent metric reads as a
        // zero, and a zero here would be a lie.
        // Registration → verification → first client → first session → first
        // package. Placed alongside acquisition rather than inside it because
        // acquisition ends at the signup; this is what happens afterwards, and
        // it is the half that decides whether any of the acquisition mattered.
        activation: activation.rows[0],

        // Visit -> Registration -> Verified -> First client -> First package ->
        // First booking, by source. `minimumForRate` is the denominator below
        // which the UI prints "Not enough data yet" instead of a percentage:
        // two signups out of forty visits is not a 5% conversion rate, it is
        // two signups, and a rate computed from it is a number somebody quotes
        // back six months later as though it meant something.
        funnel: {
          bySource: funnelBySource.rows,
          byCampaign: funnelByCampaign.rows,
          minimumForRate: MINIMUM_FOR_RATE,
        },

        acquisition: {
          ...attribution.rows[0],
          bySource: attributionSources.rows,

          // Migration 035. `measuringSince` is the honest qualifier on every
          // rate below it: views only exist from the moment the counter
          // shipped, while signups go back to the first account ever created.
          // Dividing all-time signups by since-035 views would invent a
          // conversion rate well above reality, so the UI shows the date and
          // suppresses the aggregate rate until the periods are comparable.
          views: {
            ...views.rows[0],
            byChannel: viewsBySource.rows,

            // Last 30 days only, unlike every other figure here. Labelled as
            // such in the UI, because a 30-day count sitting next to all-time
            // counts is otherwise read as all-time and quietly understates
            // every page.
            byPath: viewsByPath.rows,

            // Untagged traffic only — see the query. `(none)` is a direct
            // visit or a referrer the browser withheld; a search engine host
            // here is organic search, which no UTM will ever mark.
            byReferrer: viewsByReferrer.rows,
          },

          notMeasured: {
            uniqueVisitors:
              'Views are counted without any cookie or identifier, so repeat views by one person cannot be collapsed.',
            registrationStarts:
              'The /register page view is counted, but starting to type in the form is not.',
            trialToPaidConversion:
              'There is no payment processor in the product, so no paid conversion can occur.',
          },
        },
      },
    });
  } catch (error) {
    if (sendDbClientError(res, error)) return;
    console.error('admin overview error:', error);
    return res.status(500).json({ error: 'Server error', message: 'Failed to build overview' });
  }
};

// ── tenants ─────────────────────────────────────────────────────────────────

/** GET /api/admin/tenants?search=&plan=&status=&page=&pageSize= */
const listTenants = async (req, res) => {
  const { page, pageSize, offset } = readPaging(req);
  const search = (req.query.search || '').trim();
  const plan = (req.query.plan || '').trim();
  const status = (req.query.status || '').trim();

  const where = [];
  const params = [];

  if (search) { params.push(`%${search}%`); where.push(`s.tenant_name ILIKE $${params.length}`); }
  if (plan)   { params.push(plan);          where.push(`s.plan_name = $${params.length}`); }
  if (status) { params.push(status);        where.push(`s.subscription_status = $${params.length}`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const total = await pool.query(
      `SELECT COUNT(*)::int AS n FROM tenant_subscription_status s ${whereSql}`, params);

    params.push(pageSize, offset);
    const { rows } = await pool.query(
      `SELECT s.tenant_id, s.tenant_name, s.plan_name, s.plan_display_name,
              s.subscription_status, s.is_trial, s.trial_end,
              s.current_period_end, s.days_until_expiry, s.is_read_only,
              s.max_clients, s.clients_count, s.clients_limit_reached,
              s.max_sessions_per_month, s.sessions_count,
              t.created_at, t.phone, t.website,
              (SELECT COUNT(*)::int FROM users u WHERE u.tenant_id = s.tenant_id) AS trainer_count
         FROM tenant_subscription_status s
         JOIN tenants t ON t.id = s.tenant_id
         ${whereSql}
        ORDER BY t.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.json({
      success: true,
      page, pageSize, total: total.rows[0].n,
      tenants: rows,
    });
  } catch (error) {
    if (sendDbClientError(res, error)) return;
    console.error('admin listTenants error:', error);
    return res.status(500).json({ error: 'Server error', message: 'Failed to list tenants' });
  }
};

/** GET /api/admin/tenants/:id */
const getTenant = async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return res.status(404).json({ error: 'Not found', message: 'Tenant not found' });

  try {
    const [tenant, trainers, subscription, history] = await Promise.all([
      pool.query(
        `SELECT t.*, (SELECT COUNT(*)::int FROM users u WHERE u.tenant_id = t.id) AS trainer_count
           FROM tenants t WHERE t.id = $1`, [id]),
      pool.query(`SELECT ${TRAINER_PUBLIC_COLUMNS} FROM users u WHERE u.tenant_id = $1 ORDER BY u.created_at`, [id]),
      pool.query('SELECT * FROM tenant_subscription_status WHERE tenant_id = $1', [id]),
      pool.query(
        `SELECT id, action, entity_type, entity_id, changes, admin_email, created_at
           FROM admin_audit_log WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 20`, [id]),
    ]);

    if (!tenant.rows.length) {
      return res.status(404).json({ error: 'Not found', message: 'Tenant not found' });
    }

    return res.json({
      success: true,
      tenant: tenant.rows[0],
      trainers: trainers.rows,
      subscription: subscription.rows[0] || null,
      adminHistory: history.rows,
      // Stated in the payload, not just in the docs, so a UI built against this
      // API cannot quietly assume the data is merely missing.
      businessDataAccess: 'none — client, session and payment records are tenant-scoped and not readable by platform administrators',
    });
  } catch (error) {
    if (sendDbClientError(res, error)) return;
    console.error('admin getTenant error:', error);
    return res.status(500).json({ error: 'Server error', message: 'Failed to load tenant' });
  }
};

const TENANT_UPDATABLE = { name: 'name', phone: 'phone', website: 'website' };

/** PATCH /api/admin/tenants/:id */
const updateTenant = async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return res.status(404).json({ error: 'Not found', message: 'Tenant not found' });

  const update = buildUpdate(req.body || {}, TENANT_UPDATABLE, 2);
  if (!update) {
    return res.status(400).json({
      error: 'Validation error',
      message: `Nothing to update. Updatable fields: ${Object.keys(TENANT_UPDATABLE).join(', ')}`,
    });
  }

  // A tenant with no name is unusable in every list in the product.
  if (Object.prototype.hasOwnProperty.call(update.changes, 'name') && !update.changes.name) {
    return res.status(400).json({ error: 'Validation error', message: 'Tenant name cannot be empty' });
  }

  try {
    const before = await pool.query('SELECT name, phone, website FROM tenants WHERE id = $1', [id]);
    if (!before.rows.length) return res.status(404).json({ error: 'Not found', message: 'Tenant not found' });

    const { rows } = await pool.query(
      `UPDATE tenants SET ${update.sql}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...update.values]
    );

    await recordAdminAction(req, {
      action: 'tenant_updated', entityType: 'tenant', entityId: id, tenantId: id,
      changes: { before: before.rows[0], after: update.changes },
    });

    return res.json({ success: true, tenant: rows[0] });
  } catch (error) {
    if (sendDbClientError(res, error)) return;
    console.error('admin updateTenant error:', error);
    return res.status(500).json({ error: 'Server error', message: 'Failed to update tenant' });
  }
};

/**
 * PATCH /api/admin/tenants/:id/subscription
 *
 * This is the endpoint that makes "free for early adopters" operable. Trainers
 * cannot upgrade themselves — TR-HIGH-2 made self-service plan changes require
 * payment — so granting a plan is deliberately a staff action, and one that is
 * always audited with its before state.
 */
const updateTenantSubscription = async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return res.status(404).json({ error: 'Not found', message: 'Tenant not found' });

  const { planName, status, currentPeriodEnd, isTrial, trialEnd, cancelAtPeriodEnd } = req.body || {};

  const VALID_STATUS = ['active', 'expired', 'suspended', 'cancelled'];
  if (status !== undefined && !VALID_STATUS.includes(status)) {
    return res.status(400).json({
      error: 'Validation error',
      message: `status must be one of: ${VALID_STATUS.join(', ')}`,
    });
  }

  try {
    const before = await pool.query(
      `SELECT ts.status, ts.current_period_end, ts.is_trial, ts.trial_end,
              ts.cancel_at_period_end, sp.name AS plan_name
         FROM tenant_subscriptions ts
         JOIN subscription_plans sp ON sp.id = ts.plan_id
        WHERE ts.tenant_id = $1`,
      [id]
    );
    if (!before.rows.length) {
      return res.status(404).json({ error: 'Not found', message: 'No subscription for this tenant' });
    }

    let planId = null;
    if (planName !== undefined) {
      const plan = await pool.query('SELECT id FROM subscription_plans WHERE name = $1 AND is_active', [planName]);
      if (!plan.rows.length) {
        return res.status(400).json({ error: 'Validation error', message: `Unknown or inactive plan: ${planName}` });
      }
      planId = plan.rows[0].id;
    }

    const sets = [];
    const values = [];
    const changes = {};
    const add = (col, val, label) => { values.push(val); sets.push(`${col} = $${values.length + 1}`); changes[label] = val; };

    if (planId)                        add('plan_id', planId, 'planName');
    if (status !== undefined)          add('status', status, 'status');
    if (currentPeriodEnd !== undefined) add('current_period_end', currentPeriodEnd, 'currentPeriodEnd');
    if (isTrial !== undefined)         add('is_trial', !!isTrial, 'isTrial');
    if (trialEnd !== undefined)        add('trial_end', trialEnd, 'trialEnd');
    if (cancelAtPeriodEnd !== undefined) add('cancel_at_period_end', !!cancelAtPeriodEnd, 'cancelAtPeriodEnd');

    if (!sets.length) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Nothing to update. Updatable: planName, status, currentPeriodEnd, isTrial, trialEnd, cancelAtPeriodEnd',
      });
    }
    if (planId) changes.planName = planName;

    await pool.query(
      `UPDATE tenant_subscriptions SET ${sets.join(', ')}, updated_at = NOW() WHERE tenant_id = $1`,
      [id, ...values]
    );

    await recordAdminAction(req, {
      action: 'subscription_updated', entityType: 'tenant_subscription', entityId: id, tenantId: id,
      changes: { before: before.rows[0], after: changes },
    });

    const after = await pool.query('SELECT * FROM tenant_subscription_status WHERE tenant_id = $1', [id]);
    return res.json({ success: true, subscription: after.rows[0] });
  } catch (error) {
    if (sendDbClientError(res, error)) return;
    console.error('admin updateTenantSubscription error:', error);
    return res.status(500).json({ error: 'Server error', message: 'Failed to update subscription' });
  }
};

// ── trainers ────────────────────────────────────────────────────────────────

/** GET /api/admin/trainers?search=&tenantId=&verified=&locked=&page=&pageSize= */
const listTrainers = async (req, res) => {
  const { page, pageSize, offset } = readPaging(req);
  const search = (req.query.search || '').trim();
  const { tenantId, verified, locked } = req.query;

  const where = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    where.push(`(u.email ILIKE $${params.length} OR u.first_name ILIKE $${params.length} OR u.last_name ILIKE $${params.length})`);
  }
  if (tenantId) {
    if (!isUuid(tenantId)) return res.status(400).json({ error: 'Validation error', message: 'tenantId must be a UUID' });
    params.push(tenantId); where.push(`u.tenant_id = $${params.length}`);
  }
  if (verified === 'true')  where.push('u.email_verified');
  if (verified === 'false') where.push('NOT u.email_verified');
  if (locked === 'true')    where.push('u.locked_until IS NOT NULL AND u.locked_until > NOW()');

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const total = await pool.query(`SELECT COUNT(*)::int AS n FROM users u ${whereSql}`, params);

    params.push(pageSize, offset);
    const { rows } = await pool.query(
      `SELECT ${TRAINER_PUBLIC_COLUMNS}, t.name AS tenant_name
         FROM users u
         JOIN tenants t ON t.id = u.tenant_id
         ${whereSql}
        ORDER BY u.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.json({ success: true, page, pageSize, total: total.rows[0].n, trainers: rows });
  } catch (error) {
    if (sendDbClientError(res, error)) return;
    console.error('admin listTrainers error:', error);
    return res.status(500).json({ error: 'Server error', message: 'Failed to list trainers' });
  }
};

/** GET /api/admin/trainers/:id */
const getTrainer = async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return res.status(404).json({ error: 'Not found', message: 'Trainer not found' });

  try {
    const { rows } = await pool.query(
      `SELECT ${TRAINER_PUBLIC_COLUMNS}, t.name AS tenant_name
         FROM users u JOIN tenants t ON t.id = u.tenant_id
        WHERE u.id = $1`, [id]);

    if (!rows.length) return res.status(404).json({ error: 'Not found', message: 'Trainer not found' });

    const history = await pool.query(
      `SELECT id, action, entity_type, changes, admin_email, created_at
         FROM admin_audit_log
        WHERE entity_type = 'trainer' AND entity_id = $1
        ORDER BY created_at DESC LIMIT 20`, [id]);

    return res.json({ success: true, trainer: rows[0], adminHistory: history.rows });
  } catch (error) {
    if (sendDbClientError(res, error)) return;
    console.error('admin getTrainer error:', error);
    return res.status(500).json({ error: 'Server error', message: 'Failed to load trainer' });
  }
};

/**
 * Fields staff may change on a trainer.
 *
 * `email` is deliberately absent. Changing the address on an account is an
 * account-takeover primitive: it redirects password resets. If a trainer needs
 * their address changed, they change it themselves through the product, from a
 * session they already control.
 *
 * `password_hash` is absent for the same reason, and because no support flow
 * should ever involve staff knowing a customer's password.
 */
const TRAINER_UPDATABLE = {
  firstName: 'first_name',
  lastName: 'last_name',
  phone: 'phone',
  city: 'city',
  country: 'country',
  website: 'website',
  bio: 'bio',
  language: 'language',
};

/** PATCH /api/admin/trainers/:id */
const updateTrainer = async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return res.status(404).json({ error: 'Not found', message: 'Trainer not found' });

  if (req.body && (req.body.email !== undefined || req.body.password !== undefined)) {
    return res.status(400).json({
      error: 'Validation error',
      message: 'Email and password cannot be changed by an administrator. The trainer changes these themselves.',
    });
  }

  const update = buildUpdate(req.body || {}, TRAINER_UPDATABLE, 2);
  if (!update) {
    return res.status(400).json({
      error: 'Validation error',
      message: `Nothing to update. Updatable fields: ${Object.keys(TRAINER_UPDATABLE).join(', ')}`,
    });
  }

  try {
    const before = await pool.query(
      `SELECT tenant_id, first_name, last_name, phone, city, country, website, bio, language
         FROM users WHERE id = $1`, [id]);
    if (!before.rows.length) return res.status(404).json({ error: 'Not found', message: 'Trainer not found' });

    const { rows } = await pool.query(
      `UPDATE users SET ${update.sql}, updated_at = NOW(), profile_updated_at = NOW()
        WHERE id = $1
        RETURNING id, tenant_id, email, first_name, last_name, phone, city, country, website, bio, language`,
      [id, ...update.values]
    );

    await recordAdminAction(req, {
      action: 'trainer_updated', entityType: 'trainer', entityId: id,
      tenantId: before.rows[0].tenant_id,
      changes: { before: before.rows[0], after: update.changes },
    });

    return res.json({ success: true, trainer: rows[0] });
  } catch (error) {
    if (sendDbClientError(res, error)) return;
    console.error('admin updateTrainer error:', error);
    return res.status(500).json({ error: 'Server error', message: 'Failed to update trainer' });
  }
};

/**
 * POST /api/admin/trainers/:id/unlock
 *
 * The one support request that genuinely needs staff: a trainer locked out by
 * five bad passwords, on a Saturday, with clients waiting.
 */
const unlockTrainer = async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return res.status(404).json({ error: 'Not found', message: 'Trainer not found' });

  try {
    const { rows } = await pool.query(
      `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = NOW()
        WHERE id = $1 RETURNING id, tenant_id, email, locked_until, failed_login_attempts`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found', message: 'Trainer not found' });

    await recordAdminAction(req, {
      action: 'trainer_unlocked', entityType: 'trainer', entityId: id,
      tenantId: rows[0].tenant_id, changes: { lockCleared: true },
    });

    return res.json({ success: true, trainer: rows[0] });
  } catch (error) {
    if (sendDbClientError(res, error)) return;
    console.error('admin unlockTrainer error:', error);
    return res.status(500).json({ error: 'Server error', message: 'Failed to unlock trainer' });
  }
};

/**
 * POST /api/admin/trainers/:id/verify-email
 *
 * For the case where verification mail genuinely cannot be delivered. It marks
 * the address verified and CLEARS the outstanding token, so this cannot be used
 * to leave a live token lying around.
 */
const verifyTrainerEmail = async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return res.status(404).json({ error: 'Not found', message: 'Trainer not found' });

  try {
    const { rows } = await pool.query(
      `UPDATE users
          SET email_verified = TRUE, verification_token = NULL,
              verification_token_expires = NULL, updated_at = NOW()
        WHERE id = $1
        RETURNING id, tenant_id, email, email_verified`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found', message: 'Trainer not found' });

    await recordAdminAction(req, {
      action: 'trainer_email_verified', entityType: 'trainer', entityId: id,
      tenantId: rows[0].tenant_id, changes: { emailVerified: true, manualOverride: true },
    });

    return res.json({ success: true, trainer: rows[0] });
  } catch (error) {
    if (sendDbClientError(res, error)) return;
    console.error('admin verifyTrainerEmail error:', error);
    return res.status(500).json({ error: 'Server error', message: 'Failed to verify email' });
  }
};

// ── audit log ───────────────────────────────────────────────────────────────

/** GET /api/admin/audit?adminId=&entityType=&tenantId=&page=&pageSize= */
const listAuditLog = async (req, res) => {
  const { page, pageSize, offset } = readPaging(req);
  const { adminId, entityType, tenantId } = req.query;

  const where = [];
  const params = [];
  if (adminId) {
    if (!isUuid(adminId)) return res.status(400).json({ error: 'Validation error', message: 'adminId must be a UUID' });
    params.push(adminId); where.push(`admin_id = $${params.length}`);
  }
  if (tenantId) {
    if (!isUuid(tenantId)) return res.status(400).json({ error: 'Validation error', message: 'tenantId must be a UUID' });
    params.push(tenantId); where.push(`tenant_id = $${params.length}`);
  }
  if (entityType) { params.push(entityType); where.push(`entity_type = $${params.length}`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const total = await pool.query(`SELECT COUNT(*)::int AS n FROM admin_audit_log ${whereSql}`, params);
    params.push(pageSize, offset);
    const { rows } = await pool.query(
      `SELECT id, admin_id, admin_email, action, entity_type, entity_id,
              tenant_id, changes, ip_address, created_at
         FROM admin_audit_log ${whereSql}
        ORDER BY created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return res.json({ success: true, page, pageSize, total: total.rows[0].n, entries: rows });
  } catch (error) {
    if (sendDbClientError(res, error)) return;
    console.error('admin listAuditLog error:', error);
    return res.status(500).json({ error: 'Server error', message: 'Failed to read audit log' });
  }
};

// ── administrator management (owner only) ───────────────────────────────────

/** GET /api/admin/admins */
const listAdmins = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${ADMIN_PUBLIC_COLUMNS} FROM platform_admins ORDER BY created_at`);
    return res.json({ success: true, admins: rows });
  } catch (error) {
    console.error('admin listAdmins error:', error);
    return res.status(500).json({ error: 'Server error', message: 'Failed to list administrators' });
  }
};

/** POST /api/admin/admins */
const createAdmin = async (req, res) => {
  const { email, password, firstName, lastName, role = 'viewer' } = req.body || {};

  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({
      error: 'Validation error',
      message: 'email, password, firstName and lastName are required',
    });
  }
  if (!isEmail(email)) {
    return res.status(400).json({ error: 'Validation error', message: 'A valid email address is required' });
  }
  const pw = validatePassword(password);
  if (!pw.ok) return res.status(400).json({ error: 'Validation error', message: pw.reason });
  if (!['viewer', 'admin', 'owner'].includes(role)) {
    return res.status(400).json({ error: 'Validation error', message: 'role must be viewer, admin or owner' });
  }

  try {
    const hash = await bcrypt.hash(String(password), ADMIN_BCRYPT_COST);
    const { rows } = await pool.query(
      `INSERT INTO platform_admins (email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${ADMIN_PUBLIC_COLUMNS}`,
      [normalizeEmail(email), hash, firstName, lastName, role]
    );

    await recordAdminAction(req, {
      action: 'admin_created', entityType: 'platform_admin', entityId: rows[0].id,
      changes: { email: rows[0].email, role },
    });

    return res.status(201).json({ success: true, admin: rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Conflict', message: 'An administrator with that email already exists' });
    }
    if (sendDbClientError(res, error)) return;
    console.error('admin createAdmin error:', error);
    return res.status(500).json({ error: 'Server error', message: 'Failed to create administrator' });
  }
};

/**
 * PATCH /api/admin/admins/:id — role and activation only.
 *
 * Refuses to let an owner change their own role or deactivate themselves. That
 * is not paternalism: with one owner, either action locks the entire
 * organisation out of administrator management with no way back through the API.
 */
const updateAdmin = async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return res.status(404).json({ error: 'Not found', message: 'Administrator not found' });

  const { role, isActive } = req.body || {};

  if (role === undefined && isActive === undefined) {
    return res.status(400).json({ error: 'Validation error', message: 'Nothing to update. Updatable: role, isActive' });
  }
  if (role !== undefined && !['viewer', 'admin', 'owner'].includes(role)) {
    return res.status(400).json({ error: 'Validation error', message: 'role must be viewer, admin or owner' });
  }
  if (id === req.admin.id) {
    return res.status(400).json({
      error: 'Validation error',
      message: 'You cannot change your own role or deactivate your own account',
    });
  }

  try {
    const before = await pool.query('SELECT email, role, is_active FROM platform_admins WHERE id = $1', [id]);
    if (!before.rows.length) return res.status(404).json({ error: 'Not found', message: 'Administrator not found' });

    const sets = [];
    const values = [];
    const changes = {};
    if (role !== undefined)     { values.push(role);       sets.push(`role = $${values.length + 1}`);      changes.role = role; }
    if (isActive !== undefined) { values.push(!!isActive); sets.push(`is_active = $${values.length + 1}`); changes.isActive = !!isActive; }

    const { rows } = await pool.query(
      `UPDATE platform_admins SET ${sets.join(', ')}, updated_at = NOW()
        WHERE id = $1 RETURNING ${ADMIN_PUBLIC_COLUMNS}`,
      [id, ...values]
    );

    await recordAdminAction(req, {
      action: 'admin_updated', entityType: 'platform_admin', entityId: id,
      changes: { before: before.rows[0], after: changes },
    });

    return res.json({ success: true, admin: rows[0] });
  } catch (error) {
    if (sendDbClientError(res, error)) return;
    console.error('admin updateAdmin error:', error);
    return res.status(500).json({ error: 'Server error', message: 'Failed to update administrator' });
  }
};

module.exports = {
  login, me, getOverview,
  listTenants, getTenant, updateTenant, updateTenantSubscription,
  listTrainers, getTrainer, updateTrainer, unlockTrainer, verifyTrainerEmail,
  listAuditLog,
  listAdmins, createAdmin, updateAdmin,
  // exported for tests
  TRAINER_PUBLIC_COLUMNS, TRAINER_UPDATABLE, TENANT_UPDATABLE, ADMIN_BCRYPT_COST,
};
