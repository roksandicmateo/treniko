'use strict';

/**
 * The whole acquisition funnel, end to end, through the real endpoints.
 *
 * The unit tests either side of this prove that a page view is recorded and
 * that a registration carries attribution. Neither proves the thing the two
 * were built for: that a view and a signup from the SAME campaign can be
 * joined afterwards to produce a conversion rate. That join is the deliverable,
 * and it is the part that silently breaks — a column renamed on one side, a
 * COALESCE label that differs by a character, and the panel shows two
 * unrelated rows instead of one channel converting.
 *
 *     landing view (?utm_content=reel-qa) → register → 1 view, 1 signup, joined
 */

const request = require('supertest');
const app = require('../../server');
const { destroyTenant, pool } = require('../helpers/fixtures');
const { asTenant } = require('../helpers/asTenant');
const {
  FUNNEL_BY_SOURCE_SQL,
  MINIMUM_FOR_RATE,
  conversionRate,
} = require('../../utils/acquisitionFunnel');

jest.setTimeout(40000);

// Unique per run so a rerun cannot read the previous run's rows.
const CAMPAIGN = `qa-funnel-${Date.now()}`;
const createdTenants = [];

afterAll(async () => {
  for (const id of createdTenants) await destroyTenant(id);
  await pool.query('DELETE FROM page_view WHERE utm_campaign = $1', [CAMPAIGN]);
  await pool.end();
});

/** The campaign-level join the admin panel runs, narrowed to this test. */
const funnelFor = async (campaign) => {
  const { rows } = await pool.query(
    `WITH v AS (
       SELECT utm_source AS source, COUNT(*)::int AS views
         FROM page_view WHERE utm_campaign = $1 GROUP BY 1
     ),
     s AS (
       SELECT utm_source AS source, COUNT(*)::int AS signups
         FROM signup_attribution WHERE utm_campaign = $1 GROUP BY 1
     )
     SELECT COALESCE(v.source, s.source) AS source,
            COALESCE(v.views, 0)   AS views,
            COALESCE(s.signups, 0) AS signups
       FROM v FULL OUTER JOIN s ON v.source = s.source`,
    [campaign]
  );
  return rows;
};

describe('content → visit → registration, joined', () => {
  test('three views and one signup from one campaign produce one joined row', async () => {
    // 1. Three people arrive from the same Reel. Two of them bounce.
    for (let i = 0; i < 3; i += 1) {
      const res = await request(app).post('/api/metrics/view').send({
        path: '/',
        utm_source: 'instagram',
        utm_medium: 'social',
        utm_campaign: CAMPAIGN,
        utm_content: 'reel-qa',
        referrer_host: 'l.instagram.com',
      });
      expect(res.status).toBe(204);
    }

    // 2. One of them registers, carrying the attribution the landing page
    //    captured. This is the real endpoint, not a stub.
    const reg = await request(app).post('/api/auth/register').send({
      email: `funnel-${Date.now()}@example.test`,
      password: 'FunnelPassw0rd!',
      firstName: 'Funnel',
      lastName: 'Tester',
      attribution: {
        utm_source: 'instagram',
        utm_medium: 'social',
        utm_campaign: CAMPAIGN,
        utm_content: 'reel-qa',
        referrer_host: 'l.instagram.com',
        landing_path: '/',
        first_seen_at: new Date().toISOString(),
      },
    });
    expect(reg.status).toBe(201);
    createdTenants.push(reg.body.user.tenantId);

    // 3. The two sides join into a single channel with a real rate.
    const rows = await funnelFor(CAMPAIGN);
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe('instagram');
    expect(rows[0].views).toBe(3);
    expect(rows[0].signups).toBe(1);

    // 1 of 3. The number this entire exercise exists to produce.
    expect(Math.round((rows[0].signups / rows[0].views) * 100)).toBe(33);
  });

  test('a campaign that only ever bounced still appears, with zero signups', async () => {
    // The most decision-useful row on the panel: traffic that converts nobody.
    // If the join dropped it, a failing channel would look like no channel.
    const dud = `${CAMPAIGN}-dud`;
    await request(app).post('/api/metrics/view').send({
      path: '/', utm_source: 'facebook', utm_campaign: dud,
    });

    const rows = await funnelFor(dud);
    expect(rows).toHaveLength(1);
    expect(rows[0].views).toBe(1);
    expect(rows[0].signups).toBe(0);

    await pool.query('DELETE FROM page_view WHERE utm_campaign = $1', [dud]);
  });

  test('a registration with no view still counts as a signup', async () => {
    // Every account created before the counter shipped is this case, as is
    // anyone whose browser blocked the beacon. Dropping them would understate
    // signups, which are the number that actually matters.
    const noView = `${CAMPAIGN}-noview`;
    const reg = await request(app).post('/api/auth/register').send({
      email: `noview-${Date.now()}@example.test`,
      password: 'FunnelPassw0rd!',
      firstName: 'NoView',
      lastName: 'Tester',
      attribution: { utm_source: 'instagram', utm_campaign: noView },
    });
    expect(reg.status).toBe(201);
    createdTenants.push(reg.body.user.tenantId);

    const rows = await funnelFor(noView);
    expect(rows).toHaveLength(1);
    expect(rows[0].views).toBe(0);
    expect(rows[0].signups).toBe(1);
    // 1/0 is not a percentage. The UI prints "not measured" for exactly this.
  });

  test('the funnel never links a view to a person', async () => {
    // A conversion rate is the only thing these two tables may produce
    // together. If a join could ever tie one page view to one account, this
    // would be tracking rather than counting.
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'page_view'`
    );
    const cols = rows.map((r) => r.column_name);

    // No user, tenant, session or device column exists to join on.
    for (const forbidden of ['user_id', 'tenant_id', 'session_id', 'visitor_id', 'ip', 'ip_address', 'user_agent']) {
      expect(cols).not.toContain(forbidden);
    }
  });
});

/* ── The activation half of the funnel ─────────────────────────────────────────
 *
 * The block above proves a view and a signup from one campaign can be joined.
 * That was the whole deliverable until the funnel grew an activation half, and
 * the join it needs is a different one: attribution → tenant → the rows a
 * trainer creates while actually working.
 *
 * These run FUNNEL_BY_SOURCE_SQL itself — the string adminController executes —
 * rather than a query retyped here. That distinction is the reason this file is
 * worth running: the failure being guarded against is a column renamed on one
 * side or a COALESCE label differing by a character, and a retyped copy is
 * exactly where such a divergence would hide.
 */
describe('registration → verified → first client → first package → first booking', () => {
  const ACT = `qa-act-${Date.now()}`;
  const madeTenants = [];

  /** A bare account: tenant + user, nothing else. Not createTenant, which
   *  seeds a client, a group and a training and would arrive pre-activated. */
  const bareAccount = async ({ source = null, verified = false } = {}) => {
    const { rows: [t] } = await pool.query(
      'INSERT INTO tenants (name) VALUES ($1) RETURNING id',
      [`${ACT} tenant`]
    );
    const { rows: [u] } = await pool.query(
      `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, email_verified)
       VALUES ($1, $2, 'x', 'Act', 'Tester', $3) RETURNING id`,
      [t.id, `${ACT}-${Math.random().toString(36).slice(2, 9)}@example.test`, verified]
    );
    if (source) {
      await pool.query(
        `INSERT INTO signup_attribution (tenant_id, user_id, utm_source, utm_medium, utm_campaign, utm_content)
         VALUES ($1, $2, $3, 'social', $4, 'unit')`,
        [t.id, u.id, source, ACT]
      );
    }
    madeTenants.push(t.id);
    return { tenantId: t.id, userId: u.id };
  };

  const addClient = (acct, n = 1) =>
    asTenant(acct, async () => {
      for (let i = 0; i < n; i += 1) {
        await pool.query(
          `INSERT INTO clients (tenant_id, first_name, last_name, email)
           VALUES ($1, 'C', $2, $3)`,
          [acct.tenantId, String(i), `${ACT}-c${i}-${acct.tenantId.slice(0, 8)}@example.test`]
        );
      }
    });

  const addPackage = (acct, n = 1) =>
    asTenant(acct, async () => {
      for (let i = 0; i < n; i += 1) {
        await pool.query(
          `INSERT INTO packages (tenant_id, name, total_sessions, price)
           VALUES ($1, $2, 10, 300)`,
          [acct.tenantId, `${ACT} pack ${i}`]
        );
      }
    });

  const addBooking = (acct, n = 1) =>
    asTenant(acct, async () => {
      const { rows: [c] } = await pool.query(
        'SELECT id FROM clients WHERE tenant_id = $1 LIMIT 1', [acct.tenantId]
      );
      for (let i = 0; i < n; i += 1) {
        await pool.query(
          `INSERT INTO training_sessions (tenant_id, client_id, session_date, start_time, end_time, status)
           VALUES ($1, $2, CURRENT_DATE, '10:00', '11:00', 'scheduled')`,
          [acct.tenantId, c.id]
        );
      }
    });

  /** The shipped query, narrowed to one source label. */
  const rowFor = async (source) => {
    const { rows } = await pool.query(FUNNEL_BY_SOURCE_SQL);
    return rows.find((r) => r.source === source) || null;
  };

  afterAll(async () => {
    for (const id of madeTenants) {
      await pool.query('DELETE FROM signup_attribution WHERE tenant_id = $1', [id]);
      // packages is RLS-protected, so it needs the same tenant context the
      // seeding used or the delete matches nothing.
      await asTenant({ tenantId: id }, () =>
        pool.query('DELETE FROM packages WHERE tenant_id = $1', [id]));
      // destroyTenant handles the rest, including the usage-tracking triggers
      // that write back to subscription_usage while the tenant is being
      // removed — the ordering that trips the foreign key if done by hand.
      await destroyTenant(id);
    }
  });

  test('attribution reaches the funnel, attached to the right tenant', async () => {
    const src = `${ACT}-src-a`;
    const acct = await bareAccount({ source: src, verified: true });

    // The attribution row points at the tenant that was actually created —
    // the link every later stage is hung from.
    const { rows } = await pool.query(
      'SELECT tenant_id, user_id, utm_source FROM signup_attribution WHERE tenant_id = $1',
      [acct.tenantId]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe(acct.userId);
    expect(rows[0].utm_source).toBe(src);

    const row = await rowFor(src);
    expect(row).not.toBeNull();
    expect(row.registrations).toBe(1);
    expect(row.verified).toBe(1);
    expect(row.first_client).toBe(0);
  });

  test('an unverified account registers but does not count as verified', async () => {
    const src = `${ACT}-src-unverified`;
    await bareAccount({ source: src, verified: false });

    const row = await rowFor(src);
    expect(row.registrations).toBe(1);
    expect(row.verified).toBe(0);
  });

  test('first client counts once, and five clients still count once', async () => {
    // The distinction between an activation funnel and a usage total. Getting
    // this wrong makes one enthusiastic trainer look like five.
    const src = `${ACT}-src-many`;
    const acct = await bareAccount({ source: src, verified: true });

    await addClient(acct, 1);
    let row = await rowFor(src);
    expect(row.first_client).toBe(1);

    await addClient(acct, 4);
    row = await rowFor(src);
    expect(row.first_client).toBe(1);
    expect(row.registrations).toBe(1);

    // And the underlying rows really are there — otherwise this would pass
    // just as well against a query that counted nothing.
    //
    // Read inside tenant context deliberately. Counting `clients` from a bare
    // pool returns 0 no matter what exists, because the table is under RLS and
    // there is no tenant to match — which is the exact bug migration 036 was
    // written for, and the reason this assertion is worth having.
    const n = await asTenant(acct, async () => {
      const { rows } = await pool.query(
        'SELECT COUNT(*)::int AS n FROM clients WHERE tenant_id = $1', [acct.tenantId]
      );
      return rows[0].n;
    });
    expect(n).toBe(5);
  });

  test('first package and first booking each count once per account', async () => {
    const src = `${ACT}-src-full`;
    const acct = await bareAccount({ source: src, verified: true });
    await addClient(acct, 1);

    await addPackage(acct, 3);
    await addBooking(acct, 4);

    const row = await rowFor(src);
    expect(row.registrations).toBe(1);
    expect(row.first_client).toBe(1);
    expect(row.first_package).toBe(1);
    expect(row.first_booking).toBe(1);
  });

  test('two accounts on one source advance the stages independently', async () => {
    // Proves the stages are per-account rather than per-source booleans.
    const src = `${ACT}-src-pair`;
    const a = await bareAccount({ source: src, verified: true });
    const b = await bareAccount({ source: src, verified: false });
    await addClient(a, 1);
    await addPackage(a, 1);

    const row = await rowFor(src);
    expect(row.registrations).toBe(2);
    expect(row.verified).toBe(1);
    expect(row.first_client).toBe(1);
    expect(row.first_package).toBe(1);
    expect(row.first_booking).toBe(0);
    expect(b.tenantId).toBeTruthy();
  });

  test('an account with no attribution is still measured, as (unattributed)', async () => {
    // Every account created before migration 034 is this case. Dropping them
    // would understate registrations, which is the number that matters most.
    const before = await rowFor('(unattributed)');
    const baseline = before ? before.registrations : 0;

    await bareAccount({ source: null, verified: true });

    const after = await rowFor('(unattributed)');
    expect(after).not.toBeNull();
    expect(after.registrations).toBe(baseline + 1);
  });

  test('(unattributed) and (direct) are not the same bucket', async () => {
    // One means "we were not measuring", the other means "we measured and
    // there was no source". Collapsing them turns development accounts into
    // measured direct signups.
    const src = '(direct)';
    const beforeDirect = await rowFor(src);
    const baseline = beforeDirect ? beforeDirect.registrations : 0;

    // An attribution row that exists but carries no source at all.
    const { rows: [t] } = await pool.query(
      'INSERT INTO tenants (name) VALUES ($1) RETURNING id', [`${ACT} direct`]
    );
    const { rows: [u] } = await pool.query(
      `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, email_verified)
       VALUES ($1, $2, 'x', 'D', 'T', true) RETURNING id`,
      [t.id, `${ACT}-direct-${Math.random().toString(36).slice(2, 8)}@example.test`]
    );
    await pool.query(
      'INSERT INTO signup_attribution (tenant_id, user_id) VALUES ($1, $2)', [t.id, u.id]
    );
    madeTenants.push(t.id);

    const afterDirect = await rowFor(src);
    expect(afterDirect.registrations).toBe(baseline + 1);
  });

  test('a tenant shell with no user is not an account and never reaches a denominator', async () => {
    // Account deletion before the fix in jobs/deletionJob.js left these behind;
    // five exist in production. Counting them would overstate registrations and
    // deflate every rate derived from them.
    const src = `${ACT}-src-shell`;
    const { rows: [t] } = await pool.query(
      'INSERT INTO tenants (name) VALUES ($1) RETURNING id', [`${ACT} shell`]
    );
    // Attribution pointing at a tenant whose user is gone.
    await pool.query(
      'INSERT INTO signup_attribution (tenant_id, utm_source) VALUES ($1, $2)', [t.id, src]
    );

    const row = await rowFor(src);
    expect(row).toBeNull();

    await pool.query('DELETE FROM signup_attribution WHERE tenant_id = $1', [t.id]);
    await pool.query('DELETE FROM tenants WHERE id = $1', [t.id]);
  });

  test('activation belongs to the account that earned it, not to a neighbour', async () => {
    // Two accounts, two sources, one of them active. If the join leaked across
    // tenants, both rows would show a client.
    const active = `${ACT}-src-active`;
    const idle = `${ACT}-src-idle`;
    const a = await bareAccount({ source: active, verified: true });
    await bareAccount({ source: idle, verified: true });
    await addClient(a, 2);

    expect((await rowFor(active)).first_client).toBe(1);
    expect((await rowFor(idle)).first_client).toBe(0);
  });

  test('a rate is withheld until the denominator can support one', () => {
    // The panel must not print a percentage off four accounts. Below the
    // threshold the answer is null, and the UI renders "Not enough data yet".
    expect(conversionRate(2, 29)).toBeNull();
    expect(conversionRate(0, 0)).toBeNull();
    expect(conversionRate(1, 1)).toBeNull();
    expect(conversionRate(NaN, 100)).toBeNull();
    expect(conversionRate(5, MINIMUM_FOR_RATE)).toBe(17);
    expect(conversionRate(30, 60)).toBe(50);
  });
});
