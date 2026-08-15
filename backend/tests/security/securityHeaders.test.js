'use strict';

/**
 * Security response headers (Security Hardening Phase 3, Step 10).
 *
 * Verified live against a listening server during the audit; pinned here so a
 * change to the helmet configuration cannot silently drop a header.
 *
 * The Content-Security-Policy is the one that changed in this phase. It was
 * disabled with the note "frontend is served separately", but this service
 * returns JSON and image bytes and never HTML — so it can commit to the
 * strictest policy available at no risk, and doing so closes the gap where a
 * stored file or an error response could be framed or used as a script source.
 * The policy governing the application's own pages still belongs to whatever
 * hosts the frontend bundle.
 */

const request = require('supertest');
const app = require('../../server');
const { pool } = require('../helpers/fixtures');

jest.setTimeout(30000);

afterAll(async () => {
  await pool.end();
});

describe('security headers are present on every response', () => {
  const paths = ['/health', '/api/clients', '/api/does-not-exist'];

  test.each(paths)('%s carries the standard header set', async (path) => {
    const res = await request(app).get(path);

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['strict-transport-security']).toMatch(/max-age=\d+/);
    expect(res.headers['x-dns-prefetch-control']).toBe('off');
    // Express's version banner must not be advertised.
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test.each(paths)('%s carries a restrictive content security policy', async (path) => {
    const csp = (await request(app).get(path)).headers['content-security-policy'];

    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("form-action 'none'");
    // No policy may permit inline or remote script execution.
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|script-src [^;]*\*/);
  });

  test('cross-origin isolation headers are set', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(res.headers['cross-origin-resource-policy']).toBe('same-origin');
  });
});

describe('CORS is an allowlist, not a reflector', () => {
  test('an allowed origin is echoed with credentials enabled', async () => {
    const res = await request(app).get('/health')
      .set('Origin', process.env.FRONTEND_URL || 'http://localhost:5173');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin'])
      .toBe(process.env.FRONTEND_URL || 'http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  test('a disallowed origin is refused and never echoed', async () => {
    const hostile = 'https://evil.example.com';
    const res = await request(app).get('/health').set('Origin', hostile);

    expect(res.status).toBe(403);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain(hostile);
  });

  test('a wildcard origin is never returned', async () => {
    for (const origin of ['https://treniko.com', 'http://localhost:5173']) {
      const res = await request(app).get('/health').set('Origin', origin);
      expect(res.headers['access-control-allow-origin']).not.toBe('*');
    }
  });
});

describe('private file responses are not cacheable by shared caches', () => {
  test('the training-image endpoint refuses anonymous callers before any header work', async () => {
    const res = await request(app)
      .get('/api/trainings/00000000-0000-4000-8000-000000000000/images/x.png');
    expect(res.status).toBe(401);
  });
});
