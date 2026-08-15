'use strict';

/**
 * Function-level authorization, sensitive business flows and error handling
 * (Phase 2B).
 *
 * Covers OWASP API5 (privileged functions reachable without the right
 * authorization), API6 (business flows that can be automated or abused) and
 * API8 (misconfiguration — what an error response is allowed to say).
 *
 * The point of the API5 block is that the check must live in the backend. Every
 * route below is hidden or disabled somewhere in the React app; none of that is
 * evidence of anything, so each is called directly.
 */

const request = require('supertest');
const app = require('../../server');
const { createTenant, destroyTenant, signToken, pool } = require('../helpers/fixtures');
const { setPlan } = require('../helpers/phase2bFixtures');

jest.setTimeout(30000);

let A;
let B;

beforeAll(async () => {
  A = await createTenant('a');
  B = await createTenant('b');
});

afterAll(async () => {
  await destroyTenant(A?.tenantId);
  await destroyTenant(B?.tenantId);
  await pool.end();
});

const asA = (req) => req.set('Authorization', `Bearer ${A.token}`);

// ── API5 ────────────────────────────────────────────────────────────────────
describe('API5: privileged and sensitive functions are gated server-side', () => {
  // [method, path, description]
  const privileged = [
    ['post', '/api/subscriptions/change-plan', 'change subscription plan'],
    ['post', '/api/subscriptions/cancel', 'cancel subscription'],
    ['get', '/api/subscriptions/status', 'read subscription status'],
    ['post', '/api/account/request-deletion', 'schedule account deletion'],
    ['post', '/api/account/cancel-deletion', 'cancel account deletion'],
    ['get', '/api/account/deletion-status', 'read deletion status'],
    ['get', '/api/export', 'full data export'],
    ['get', '/api/profile', 'read trainer profile'],
    ['put', '/api/profile', 'update trainer profile'],
    ['put', '/api/profile/password', 'change password'],
    ['get', '/api/dashboard', 'dashboard'],
    ['get', '/api/billing/summary', 'billing summary'],
    ['get', '/api/clients', 'client list'],
  ];

  test.each(privileged)('%s %s (%s) refuses an unauthenticated caller', async (method, path) => {
    const res = await request(app)[method](path).send({});
    expect([401, 403]).toContain(res.status);
  });

  test.each(privileged)('%s %s (%s) refuses a forged token', async (method, path) => {
    const forged = require('jsonwebtoken').sign(
      { userId: A.userId, tenantId: A.tenantId, email: A.email },
      'not-the-real-signing-secret',
      { expiresIn: '1h' }
    );
    const res = await request(app)[method](path).set('Authorization', `Bearer ${forged}`).send({});
    expect([401, 403]).toContain(res.status);
  });

  test('a token for a user that no longer exists is refused', async () => {
    const ghost = signToken({
      userId: '00000000-0000-4000-8000-000000000000',
      tenantId: A.tenantId,
      email: 'ghost@example.test',
    });
    const res = await request(app).get('/api/profile').set('Authorization', `Bearer ${ghost}`);
    expect(res.status).toBe(401);
  });

  test('deletion of another tenant client is refused and nothing is scheduled', async () => {
    const res = await asA(request(app).post(`/api/clients/${B.clientId}/request-deletion`));
    expect(res.status).toBe(404);

    const rows = await pool.query(
      "SELECT id FROM deletion_requests WHERE target_id = $1 AND target_type = 'client'",
      [B.clientId]
    );
    expect(rows.rows).toHaveLength(0);
  });

  test('exporting another tenant client is refused', async () => {
    await setPlan(A.tenantId, 'pro'); // export is a paid feature; open the gate
    const res = await asA(request(app).get(`/api/export/clients/${B.clientId}`));
    expect(res.status).toBe(404);
    await setPlan(A.tenantId, 'free');
  });

  test('a free-plan tenant cannot reach a paid feature by calling it directly', async () => {
    const res = await asA(request(app).get('/api/export'));
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Feature not available');
  });
});

// ── API6 ────────────────────────────────────────────────────────────────────
describe('API6: sensitive business flows resist automation and abuse', () => {
  test('self-service upgrade to a paid plan is refused with 402, and no plan changes', async () => {
    const { rows: [pro] } = await pool.query(
      "SELECT id FROM subscription_plans WHERE name = 'pro'"
    );

    const res = await asA(request(app).post('/api/subscriptions/change-plan'))
      .send({ planId: pro.id, billingPeriod: 'monthly' });

    expect(res.status).toBe(402);

    const { rows } = await pool.query(
      `SELECT sp.name FROM tenant_subscriptions ts
       JOIN subscription_plans sp ON sp.id = ts.plan_id
       WHERE ts.tenant_id = $1`,
      [A.tenantId]
    );
    expect(rows[0].name).toBe('free');
  });

  test('repeating an account-deletion request is idempotent, not a queue of deletions', async () => {
    const first = await asA(request(app).post('/api/account/request-deletion'));
    expect(first.status).toBe(200);

    const second = await asA(request(app).post('/api/account/request-deletion'));
    expect(second.status).toBe(200);
    expect(second.body.already_pending).toBe(true);
    expect(second.body.scheduled_delete_at).toEqual(first.body.scheduled_delete_at);

    const rows = await pool.query(
      `SELECT id FROM deletion_requests
       WHERE trainer_id = $1 AND target_type = 'account' AND status = 'pending'`,
      [A.userId]
    );
    expect(rows.rows).toHaveLength(1);

    // Deletion is scheduled, never immediate — the account must still work.
    const stillAlive = await asA(request(app).get('/api/profile'));
    expect(stillAlive.status).toBe(200);

    await asA(request(app).post('/api/account/cancel-deletion'));
  });

  test('a client deletion request is scoped to the trainer who owns the client', async () => {
    const res = await asA(request(app).post(`/api/clients/${A.clientId}/request-deletion`));
    expect(res.status).toBe(200);

    // B must not be able to cancel A's request by guessing the client id.
    const cancel = await request(app)
      .post(`/api/clients/${A.clientId}/cancel-deletion`)
      .set('Authorization', `Bearer ${B.token}`);
    expect(cancel.status).toBe(404);

    const rows = await pool.query(
      `SELECT status FROM deletion_requests
       WHERE trainer_id = $1 AND target_id = $2`,
      [A.userId, A.clientId]
    );
    expect(rows.rows[0].status).toBe('pending');

    await asA(request(app).post(`/api/clients/${A.clientId}/cancel-deletion`));
  });

  test('the client limit of the plan is enforced on the API, not just in the UI', async () => {
    // The free plan allows 5 clients; the fixture tenant already has 1.
    const created = [];
    for (let i = 0; i < 4; i += 1) {
      const res = await asA(request(app).post('/api/clients'))
        .send({ firstName: `Limit${i}`, lastName: 'Test' });
      expect(res.status).toBe(201);
      created.push(res.body.client.id);
    }

    const overLimit = await asA(request(app).post('/api/clients'))
      .send({ firstName: 'One', lastName: 'TooMany' });

    expect(overLimit.status).toBe(403);
    expect(overLimit.body.upgradeRequired).toBe(true);

    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS c FROM clients WHERE tenant_id = $1', [A.tenantId]
    );
    expect(rows[0].c).toBe(5);

    for (const id of created) {
      await pool.query('DELETE FROM clients WHERE id = $1', [id]);
    }
  });
});

// ── API8 ────────────────────────────────────────────────────────────────────
describe('API8: error responses do not disclose internals', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeAll(() => { process.env.NODE_ENV = 'production'; });
  afterAll(() => { process.env.NODE_ENV = originalEnv; });

  test('a rejected CORS origin gets 403 and is not echoed back', async () => {
    const hostile = 'https://evil.example.com';
    const res = await request(app).get('/health').set('Origin', hostile);

    expect(res.status).toBe(403);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain(hostile);
    expect(body).not.toContain('evil');
    expect(res.body).not.toHaveProperty('stack');
  });

  test('an allowed origin still works', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://localhost:5173');
    expect(res.status).toBe(200);
  });

  test('no error response carries a stack trace or file path in production', async () => {
    const probes = [
      await request(app).get('/api/nonexistent-route'),
      await request(app).get('/api/profile'),
      await asA(request(app).post('/api/clients'))
        .set('Content-Type', 'application/json').send('{"broken'),
      await asA(request(app).get('/api/clients/00000000-0000-4000-8000-000000000000')),
    ];

    for (const res of probes) {
      const body = JSON.stringify(res.body);
      expect(res.body).not.toHaveProperty('stack');
      expect(body).not.toMatch(/[A-Za-z]:\\\\|\/backend\/|node_modules/);
      expect(body).not.toMatch(/at .*\.js:\d+/);
    }
  });

  test('security headers set by helmet are present', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('a malformed id in a request body is answered, not left to crash the process', async () => {
    // Regression test for the unhandled rejection found in Phase 2B: this exact
    // request used to leave the caller waiting and terminate the Node process,
    // because the lookup it triggers sat outside the handler's try/catch.
    const res = await asA(request(app).post('/api/trainings')).send({
      clientId: 'not-a-uuid',
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 3600000).toISOString(),
    });

    expect(res.status).toBe(400);
    expect(res.status).toBeLessThan(500);
  });
});
