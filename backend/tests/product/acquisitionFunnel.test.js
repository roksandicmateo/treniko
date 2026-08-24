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
