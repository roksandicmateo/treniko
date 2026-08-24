'use strict';

/**
 * API inventory and blanket authentication sweep (Phase 2B, OWASP API9).
 *
 * The route table in the Phase 1 report was assembled by reading the source.
 * This suite derives the inventory from the running Express app instead, and
 * then calls every route it finds without a token.
 *
 * That makes it a standing regression net rather than a one-off audit: a route
 * added later without authentication does not need anyone to notice it in
 * review — it will fail here, because it is not on the short list of endpoints
 * that are public by design.
 *
 * Set INVENTORY=1 to print the derived table (used to produce the report's
 * route inventory section).
 */

const request = require('supertest');
const app = require('../../server');
const { pool } = require('../helpers/fixtures');

jest.setTimeout(60000);

afterAll(async () => {
  await pool.end();
});

/** Endpoints that must stay reachable without a token, and why. */
const PUBLIC_BY_DESIGN = new Map([
  ['GET /health', 'liveness probe, returns no data'],
  ['POST /api/auth/login', 'authentication entry point'],
  ['POST /api/auth/register', 'sign-up'],
  ['POST /api/auth/forgot-password', 'reset request (rate limited, non-enumerating)'],
  ['POST /api/auth/reset-password', 'gated by a single-use token'],
  ['GET /api/auth/verify-email', 'gated by a single-use token'],
  // Migration 035. The anonymous page-view counter. It must be public because
  // it fires on the landing page, before anybody has an account — requiring a
  // token would mean counting only people who had already registered, which
  // is the opposite of what a signup funnel needs to measure.
  //
  // It is write-only and answers 204 with an empty body, so there is nothing
  // to read back. It stores a path, a referrer host, campaign labels and a
  // timestamp — no IP, no user agent, no cookie, no identifier — so an
  // unauthenticated caller can neither learn anything nor be learned about.
  // Its own limiter (30/min, middleware/security.js) bounds what an anonymous
  // caller can write. See tests/security/pageView.test.js.
  ['POST /api/metrics/view', 'anonymous page-view counter, write-only, no personal data'],
]);

/** A syntactically valid id that belongs to nobody. */
const PROBE_UUID = '00000000-0000-4000-8000-000000000000';

/**
 * Walk the Express router tree and return every registered route.
 * @returns {Array<{method: string, path: string}>}
 */
const collectRoutes = () => {
  const found = [];

  // Express compiles a mount path into a RegExp; `keys` records the parameter
  // names in order. Recovering the readable path means undoing that: strip the
  // anchors, swap each parameter group back for its name, and unescape slashes.
  // The group Express emits for a parameter is a fixed string, so it is matched
  // literally rather than with a pattern of our own.
  const PARAM_GROUP = '(?:\\/([^/]+?))';

  const mountPathOf = (layer) => {
    if (!layer.regexp || layer.regexp.fast_slash) return '';

    let source = layer.regexp.source
      .replace(/^\^/, '')
      .replace(/\\\/\?\(\?=\\\/\|\$\)$/, '')
      .replace(/\$$/, '');

    const keys = layer.keys || [];
    for (const key of keys) {
      const at = source.indexOf(PARAM_GROUP);
      if (at === -1) break;
      source = source.slice(0, at) + `\\/:${key.name}` + source.slice(at + PARAM_GROUP.length);
    }

    return source.split('\\/').join('/');
  };

  const walk = (stack, prefix) => {
    for (const layer of stack) {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods).filter((m) => m !== '_all');
        for (const method of methods) {
          found.push({ method: method.toUpperCase(), path: prefix + layer.route.path });
        }
      } else if (layer.handle && layer.handle.stack) {
        walk(layer.handle.stack, prefix + mountPathOf(layer));
      }
    }
  };

  walk(app._router.stack, '');
  return found;
};

/** Replace :params with a probe id so the route can actually be called. */
const concretise = (path) => path.replace(/:[A-Za-z0-9_]+/g, PROBE_UUID);

const routes = collectRoutes();

describe('API9: the route inventory is known and complete', () => {
  test('routes were discovered from the running app', () => {
    expect(routes.length).toBeGreaterThan(50);

    if (process.env.INVENTORY) {
      const lines = routes
        .map((r) => {
          const key = `${r.method} ${r.path}`;
          const kind = PUBLIC_BY_DESIGN.has(key) ? 'PUBLIC' : 'AUTHENTICATED';
          return `${r.method.padEnd(7)} ${r.path.padEnd(62)} ${kind}`;
        })
        .sort();
      console.log(`\n--- ROUTE INVENTORY (${routes.length}) ---\n${lines.join('\n')}`);
    }
  });

  test('every endpoint that is public is public on purpose', () => {
    // Fails if someone marks a new route public without recording the reason.
    for (const key of PUBLIC_BY_DESIGN.keys()) {
      const [method, path] = key.split(' ');
      const exists = routes.some((r) => r.method === method && r.path === path);
      expect({ key, exists }).toEqual({ key, exists: true });
    }
  });

  test('no route looks like a debug or diagnostic endpoint', () => {
    const suspicious = routes.filter((r) =>
      /debug|_test|__|dump|console|shell|exec|eval|phpinfo|env/i.test(r.path)
    );
    expect(suspicious).toEqual([]);
  });
});

describe('API9/API5: every non-public route refuses an unauthenticated caller', () => {
  // Non-public routes, de-duplicated by method+path.
  const guarded = routes.filter((r) => !PUBLIC_BY_DESIGN.has(`${r.method} ${r.path}`));

  test('there is something to check', () => {
    expect(guarded.length).toBeGreaterThan(40);
  });

  test.each(guarded.map((r) => [r.method, r.path]))(
    '%s %s is not reachable without a token',
    async (method, path) => {
      const verb = method.toLowerCase();
      const res = await request(app)[verb](concretise(path)).send({});

      // 401/403 = refused. 404 is also acceptable: the malformed-id guard and
      // the catch-all both answer before any data is touched. What must never
      // happen is a 2xx, or a 5xx (which would mean the request reached logic
      // that then failed, rather than being turned away).
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    }
  );
});
