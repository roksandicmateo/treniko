'use strict';

/**
 * Anonymous page views — migration 035, routes/metrics.js.
 *
 * /api/metrics/view is the only endpoint on the platform where an
 * unauthenticated stranger can cause a row to be written. That earns it more
 * scrutiny than its three columns suggest, so this suite is mostly about what
 * it refuses:
 *
 *   * it must not accept anything but the six whitelisted fields
 *   * it must not store an identifier, because the whole privacy argument for
 *     running it without a consent banner rests on there being none
 *   * it must not become a place to write arbitrary strings that an admin
 *     panel later renders
 *   * it must never affect authentication, and must never be able to break a
 *     registration
 */

const request = require('supertest');
const app = require('../../server');
const { pool } = require('../helpers/fixtures');
const { sanitizePageView } = require('../../utils/pageView');

jest.setTimeout(30000);

const MARKER = `/qa-pv-${Date.now()}`;

const post = (body) => request(app).post('/api/metrics/view').send(body);

const rowsFor = async (path) => {
  const { rows } = await pool.query('SELECT * FROM page_view WHERE path = $1', [path]);
  return rows;
};

afterAll(async () => {
  await pool.query('DELETE FROM page_view WHERE path LIKE $1', ['/qa-pv-%']);
  await pool.end();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('sanitizePageView — the whitelist, without a database', () => {
  test('keeps the six known fields', () => {
    const out = sanitizePageView({
      path: '/',
      referrer_host: 'l.instagram.com',
      utm_source: 'instagram',
      utm_medium: 'social',
      utm_campaign: 'organic',
      utm_content: 'reel-p05',
    });
    expect(out).toEqual({
      path: '/',
      referrer_host: 'l.instagram.com',
      utm_source: 'instagram',
      utm_medium: 'social',
      utm_campaign: 'organic',
      utm_content: 'reel-p05',
    });
  });

  test('drops everything it does not know', () => {
    const out = sanitizePageView({
      path: '/',
      ip: '1.2.3.4',
      user_agent: 'Mozilla/5.0',
      visitor_id: 'abc123',
      id: 99,
      viewed_at: '1999-01-01',
    });
    // The privacy claim is only true if these can never be stored.
    expect(Object.keys(out)).toEqual(['path']);
  });

  test('rejects a view with no path — it is a view of nothing', () => {
    expect(sanitizePageView({ utm_source: 'instagram' })).toBeNull();
    expect(sanitizePageView({})).toBeNull();
    expect(sanitizePageView(null)).toBeNull();
    expect(sanitizePageView('/')).toBeNull();
    expect(sanitizePageView(['/'])).toBeNull();
  });

  test('rejects anything that is not shaped like a path', () => {
    // Otherwise this is a public endpoint for writing arbitrary strings into a
    // table that the admin panel renders.
    for (const bad of [
      'https://evil.example.com/',
      '//evil.example.com',
      '/../../etc/passwd',
      '/<script>alert(1)</script>',
      'javascript:alert(1)',
      '/path?a=b',
      'no-leading-slash',
    ]) {
      // Jest's expect takes one argument, so the offending value goes into the
      // assertion itself rather than into a message.
      expect({ input: bad, result: sanitizePageView({ path: bad }) })
        .toEqual({ input: bad, result: null });
    }
  });

  test('truncates over-long values rather than rejecting them', () => {
    const out = sanitizePageView({ path: '/', utm_content: 'x'.repeat(400) });
    expect(out.utm_content).toHaveLength(128);
  });

  test('ignores non-string values instead of coercing them', () => {
    const out = sanitizePageView({ path: '/', utm_source: 12345, utm_medium: { a: 1 } });
    expect(out).toEqual({ path: '/' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/metrics/view', () => {
  test('records a view without any authentication', async () => {
    const path = `${MARKER}-basic`;
    const res = await post({
      path,
      utm_source: 'instagram',
      utm_campaign: 'organic',
      utm_content: 'reel-p05',
      referrer_host: 'l.instagram.com',
    });

    expect(res.status).toBe(204);
    const rows = await rowsFor(path);
    expect(rows).toHaveLength(1);
    expect(rows[0].utm_source).toBe('instagram');
    expect(rows[0].utm_content).toBe('reel-p05');
    expect(rows[0].referrer_host).toBe('l.instagram.com');
  });

  test('stores no identifying column at all', async () => {
    const path = `${MARKER}-columns`;
    await post({ path });

    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'page_view'`
    );
    const columns = rows.map((r) => r.column_name).sort();

    // The consent argument for this endpoint depends entirely on this list.
    // If a future migration adds an identifier, this test must fail loudly.
    expect(columns).toEqual([
      'id', 'path', 'referrer_host', 'utm_campaign', 'utm_content',
      'utm_medium', 'utm_source', 'viewed_at',
    ].sort());
  });

  test('answers 204 for rubbish, and writes nothing', async () => {
    for (const body of [{}, { path: 'https://evil.example.com' }, null]) {
      const res = await post(body);
      // The browser is never told; there is nothing it could do about it.
      expect(res.status).toBe(204);
    }
    expect(await rowsFor('https://evil.example.com')).toHaveLength(0);
  });

  test('the endpoint cannot be used to read anything back', async () => {
    // It is write-only by design. A public counter that can be queried is a
    // public analytics dashboard nobody asked for.
    // A GET finds no handler on the metrics router, falls through, and is then
    // caught by the trainer authentication gate — so it answers 401 rather
    // than 404. Either is fine; what matters is that it never returns data.
    const get = await request(app).get('/api/metrics/view');
    expect(get.status).not.toBe(200);
    expect(JSON.stringify(get.body || {})).not.toMatch(/utm_|referrer_host|viewed_at/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the counter is isolated from everything that matters', () => {
  test('it does not authenticate, and grants nothing', async () => {
    const res = await post({ path: `${MARKER}-auth` });
    expect(res.status).toBe(204);
    // No token, no cookie, no session — nothing is handed back.
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(res.text).toBe('');
  });

  test('protected routes are still protected after it runs', async () => {
    await post({ path: `${MARKER}-gate` });
    expect((await request(app).get('/api/clients')).status).toBe(401);
    expect((await request(app).get('/api/admin/overview')).status).toBe(401);
  });

  test('a broken page_view table cannot break registration', async () => {
    // Analytics failing must never cost somebody an account. Asserted against
    // the module with its database dependency replaced before import — spying
    // afterwards proves nothing, because utils/pageView.js destructures
    // `query` at import time and never sees the spy.
    let called = false;

    await jest.isolateModulesAsync(async () => {
      jest.doMock('../../config/database', () => ({
        query: jest.fn(() => {
          called = true;
          return Promise.reject(new Error('relation "page_view" does not exist'));
        }),
        pool: { query: jest.fn() },
      }));

      const { recordPageView } = require('../../utils/pageView');
      await expect(recordPageView({ path: '/' })).resolves.toBe(false);
    });

    expect(called).toBe(true);
    jest.dontMock('../../config/database');

    // And the real registration path is untouched by any of it.
    const reg = await request(app).post('/api/auth/register').send({
      email: `pv-${Date.now()}@example.test`,
      password: 'PageViewPassw0rd!',
      firstName: 'Pv',
      lastName: 'Tester',
    });
    expect(reg.status).toBe(201);
    await pool.query('DELETE FROM users WHERE tenant_id = $1', [reg.body.user.tenantId]);
    await pool.query('DELETE FROM tenants WHERE id = $1', [reg.body.user.tenantId]);
  });
});
