'use strict';

/**
 * Signup attribution — migration 034, utils/signupAttribution.js.
 *
 * Two properties matter here, and they pull in opposite directions:
 *
 *   1. **Attribution must be recorded** when it is present, or the whole
 *      exercise is pointless and marketing goes on guessing.
 *   2. **Attribution must never break registration.** /register is public and
 *      unauthenticated, so every value below arrives from a caller who may be
 *      hostile, and the account is worth infinitely more than the metadata.
 *
 * Property 2 is the one that needs defending hardest, so most of this file is
 * about it: unknown keys, over-long values, wrong types, and a database that
 * refuses the insert outright.
 */

const request = require('supertest');
const app = require('../../server');
const { destroyTenant, pool } = require('../helpers/fixtures');
const { sanitizeAttribution } = require('../../utils/signupAttribution');

jest.setTimeout(30000);

const unique = () => `attrib-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createdTenants = [];

const registerWith = async (attribution) => {
  const email = `${unique()}@example.test`;
  const body = {
    email,
    password: 'AttributionPassw0rd!',
    firstName: 'Attrib',
    lastName: 'Tester',
  };
  if (attribution !== undefined) body.attribution = attribution;

  const res = await request(app).post('/api/auth/register').send(body);
  if (res.body?.user?.tenantId) createdTenants.push(res.body.user.tenantId);
  return res;
};

const attributionRow = async (tenantId) => {
  const { rows } = await pool.query(
    'SELECT * FROM signup_attribution WHERE tenant_id = $1',
    [tenantId]
  );
  return rows[0] || null;
};

afterAll(async () => {
  for (const tenantId of createdTenants) {
    await destroyTenant(tenantId);
  }
  await pool.end();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('sanitizeAttribution — the whitelist, without a database', () => {
  test('keeps the eight known fields', () => {
    const out = sanitizeAttribution({
      utm_source: 'instagram',
      utm_medium: 'social',
      utm_campaign: 'organic',
      utm_content: 'reel-p05',
      utm_term: 'pt-software',
      referrer_host: 'l.instagram.com',
      landing_path: '/',
      first_seen_at: new Date().toISOString(),
    });

    expect(out.utm_source).toBe('instagram');
    expect(out.utm_medium).toBe('social');
    expect(out.utm_campaign).toBe('organic');
    expect(out.utm_content).toBe('reel-p05');
    expect(out.utm_term).toBe('pt-software');
    expect(out.referrer_host).toBe('l.instagram.com');
    expect(out.landing_path).toBe('/');
    expect(out.first_seen_at).toBeTruthy();
  });

  test('drops every key it does not know, including dangerous ones', () => {
    const out = sanitizeAttribution({
      utm_source: 'instagram',
      isAdmin: true,
      role: 'owner',
      tenant_id: '00000000-0000-0000-0000-000000000000',
      user_id: '00000000-0000-0000-0000-000000000000',
      created_at: '1999-01-01T00:00:00Z',
      password_hash: 'nope',
    });

    expect(Object.keys(out)).toEqual(['utm_source']);
  });

  test('truncates rather than rejects an over-long value', () => {
    const out = sanitizeAttribution({ utm_content: 'x'.repeat(500) });
    // Rejecting would let a hostile caller suppress attribution at will.
    expect(out.utm_content).toHaveLength(128);
  });

  test('ignores non-string values instead of coercing them', () => {
    const out = sanitizeAttribution({
      utm_source: { toString: () => 'evil' },
      utm_medium: 12345,
      utm_campaign: ['a'],
      utm_content: 'reel-p05',
    });
    expect(out).toEqual({ utm_content: 'reel-p05' });
  });

  test('returns null when there is no signal worth recording', () => {
    // An empty row would make "arrived direct" indistinguishable from "never
    // captured", which is worse than no row at all.
    expect(sanitizeAttribution({})).toBeNull();
    expect(sanitizeAttribution({ first_seen_at: new Date().toISOString() })).toBeNull();
    expect(sanitizeAttribution({ utm_source: '   ' })).toBeNull();
  });

  test('returns null for values that are not objects', () => {
    expect(sanitizeAttribution(null)).toBeNull();
    expect(sanitizeAttribution(undefined)).toBeNull();
    expect(sanitizeAttribution('utm_source=instagram')).toBeNull();
    expect(sanitizeAttribution(['utm_source'])).toBeNull();
  });

  test('discards an implausible or unparseable first_seen_at', () => {
    const far = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    expect(sanitizeAttribution({ utm_source: 'x', first_seen_at: far }).first_seen_at)
      .toBeUndefined();
    expect(sanitizeAttribution({ utm_source: 'x', first_seen_at: 'not a date' }).first_seen_at)
      .toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('registration persists attribution', () => {
  test('a tagged signup is recorded against the new tenant', async () => {
    const res = await registerWith({
      utm_source: 'instagram',
      utm_medium: 'social',
      utm_campaign: 'organic',
      utm_content: 'reel-p05',
      referrer_host: 'l.instagram.com',
      landing_path: '/',
      first_seen_at: new Date().toISOString(),
    });

    expect(res.status).toBe(201);
    const row = await attributionRow(res.body.user.tenantId);
    expect(row).not.toBeNull();
    expect(row.utm_source).toBe('instagram');
    expect(row.utm_campaign).toBe('organic');
    expect(row.utm_content).toBe('reel-p05');
    expect(row.landing_path).toBe('/');
    expect(row.user_id).toBe(res.body.user.id);
  });

  test('an over-long value is stored truncated, and the signup still succeeds', async () => {
    const res = await registerWith({ utm_content: 'y'.repeat(300) });
    expect(res.status).toBe(201);

    const row = await attributionRow(res.body.user.tenantId);
    expect(row.utm_content).toHaveLength(128);
  });

  test('unknown fields set no column', async () => {
    const res = await registerWith({
      utm_source: 'instagram',
      isAdmin: true,
      user_id: '00000000-0000-0000-0000-000000000000',
    });
    expect(res.status).toBe(201);

    const row = await attributionRow(res.body.user.tenantId);
    // user_id is set by the server from the account it just created, never
    // from the payload.
    expect(row.user_id).toBe(res.body.user.id);
    expect(row.utm_source).toBe('instagram');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('attribution can never cost someone an account', () => {
  test('registration succeeds with no attribution at all, and writes no row', async () => {
    const res = await registerWith(undefined);

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(await attributionRow(res.body.user.tenantId)).toBeNull();
  });

  test('registration succeeds when attribution is hostile rubbish', async () => {
    const res = await registerWith('DROP TABLE users;--');

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    // The users table is, in fact, still there.
    const { rows } = await pool.query('SELECT 1 FROM users LIMIT 1');
    expect(rows.length).toBe(1);
  });

  test('a failing insert is swallowed, not thrown', async () => {
    // The failure mode this defends against is real: application code deployed
    // against a database that does not have migration 034 yet — which is
    // exactly what a deploy looks like between `git pull` and `db:migrate`.
    //
    // Asserted against the module directly, with its database dependency
    // replaced. Spying on config/database after the fact does not work:
    // signupAttribution.js destructures `query` at import time, so it holds its
    // own reference and never sees the spy. That mistake produces a test that
    // passes while proving nothing — it did here first — so the module is
    // re-imported with the dependency mocked before it loads.
    let called = false;

    await jest.isolateModulesAsync(async () => {
      jest.doMock('../../config/database', () => ({
        query: jest.fn(() => {
          called = true;
          return Promise.reject(new Error('relation "signup_attribution" does not exist'));
        }),
        pool: { query: jest.fn() },
      }));

      const { recordSignupAttribution } = require('../../utils/signupAttribution');

      // The contract is: resolves false, never rejects.
      await expect(
        recordSignupAttribution({
          tenantId: '00000000-0000-0000-0000-000000000000',
          userId: '00000000-0000-0000-0000-000000000001',
          raw: { utm_source: 'instagram' },
        })
      ).resolves.toBe(false);
    });

    expect(called).toBe(true);
    jest.dontMock('../../config/database');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('first touch is enforced by the schema', () => {
  test('a second insert for the same tenant cannot overwrite the first', async () => {
    const res = await registerWith({ utm_source: 'instagram', utm_content: 'reel-p05' });
    expect(res.status).toBe(201);
    const tenantId = res.body.user.tenantId;

    // Whatever the application does later, the primary key refuses.
    await pool.query(
      `INSERT INTO signup_attribution (tenant_id, utm_source, utm_content)
       VALUES ($1, $2, $3) ON CONFLICT (tenant_id) DO NOTHING`,
      [tenantId, 'direct', 'later-visit']
    );

    const row = await attributionRow(tenantId);
    expect(row.utm_source).toBe('instagram');
    expect(row.utm_content).toBe('reel-p05');
  });
});
