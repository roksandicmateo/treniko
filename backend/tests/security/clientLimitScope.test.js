'use strict';

/**
 * Scope of the plan's client limit.
 *
 * The limit exists to cap how many clients a plan may hold. It was mounted as
 * `app.use('/api', checkClientLimit)` and matched on `req.path.includes('/clients')`,
 * so it fired on EVERY POST whose path happened to contain that segment —
 * recording a payment, assigning a package, using a package session, giving
 * consent. A free trainer sitting exactly on the cap therefore lost the ability
 * to record revenue or manage the clients they already had.
 *
 * These tests pin the intended scope: the limit blocks creating an ADDITIONAL
 * client and nothing else, while still being enforced for real client creation,
 * still per-tenant, and still absent on plans with a higher/unlimited cap.
 */

const request = require('supertest');
const app = require('../../server');
const { createTenant, destroyTenant, pool, queryAs } = require('../helpers/fixtures');

jest.setTimeout(30000);

let T;   // the tenant driven to its client cap
let U;   // a second tenant, used for the isolation checks
let packageTemplateId;
const fillerClientIds = [];

const asT = (req) => req.set('Authorization', `Bearer ${T.token}`);
const asU = (req) => req.set('Authorization', `Bearer ${U.token}`);

const usage = async (tenantId) => {
  const { rows } = await pool.query(
    `SELECT clients_count, max_clients, clients_limit_reached
       FROM tenant_subscription_status WHERE tenant_id = $1`,
    [tenantId]
  );
  return rows[0];
};

/** Create real clients through the API until the plan's cap is reached. */
const fillToClientLimit = async () => {
  for (let guard = 0; guard < 20; guard += 1) {
    const state = await usage(T.tenantId);
    if (state.clients_limit_reached) return state;

    const res = await asT(request(app).post('/api/clients')).send({
      firstName: 'Filler',
      lastName: `Cap${fillerClientIds.length}`,
    });
    expect(res.status).toBe(201);
    fillerClientIds.push(res.body.client.id);
  }
  throw new Error('tenant never reached its client limit');
};

beforeAll(async () => {
  T = await createTenant('climit');
  U = await createTenant('cliso');

  // A package template to assign later. Its own route is /api/packages, which
  // has nothing to do with the client cap.
  const pkg = await asT(request(app).post('/api/packages')).send({
    name: 'Cap regression pack',
    packageType: 'session_based',
    totalSessions: 10,
    price: 100,
  });
  expect(pkg.status).toBe(201);
  packageTemplateId = pkg.body.package.id;
});

afterAll(async () => {
  await destroyTenant(T?.tenantId);
  await destroyTenant(U?.tenantId);
  await pool.end();
});

describe('below the plan limit', () => {
  test('a free trainer under the cap can still create a client', async () => {
    const before = await usage(T.tenantId);
    expect(before.clients_limit_reached).toBe(false);

    const res = await asT(request(app).post('/api/clients')).send({
      firstName: 'Under',
      lastName: 'Cap',
    });
    expect(res.status).toBe(201);
    fillerClientIds.push(res.body.client.id);
  });
});

describe('exactly at the plan limit', () => {
  let clientPackageId;

  beforeAll(async () => {
    const state = await fillToClientLimit();
    expect(state.clients_count).toBe(state.max_clients);
  });

  test('creating an additional client is blocked with the limit response', async () => {
    const res = await asT(request(app).post('/api/clients')).send({
      firstName: 'Over',
      lastName: 'Cap',
    });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Client limit reached');
    expect(res.body.upgradeRequired).toBe(true);

    const leaked = await queryAs(T,
      "SELECT id FROM clients WHERE first_name = 'Over' AND last_name = 'Cap'"
    );
    expect(leaked.rows).toHaveLength(0);
  });

  test('recording a payment for an existing client is allowed', async () => {
    const res = await asT(
      request(app).post(`/api/clients/${T.clientId}/payments`)
    ).send({ amount: 50, paymentMethod: 'cash', status: 'paid' });

    expect(res.status).toBe(201);
    expect(res.body.error).toBeUndefined();

    const { rows } = await queryAs(T,
      'SELECT id FROM client_payments WHERE client_id = $1', [T.clientId]
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  test('assigning a package to an existing client is allowed', async () => {
    const res = await asT(
      request(app).post(`/api/clients/${T.clientId}/packages`)
    ).send({ packageId: packageTemplateId });

    expect(res.status).toBe(201);
    expect(res.body.error).toBeUndefined();
    clientPackageId = res.body.package.id;
  });

  test('using a session off an assigned package is allowed', async () => {
    expect(clientPackageId).toBeDefined();

    // package_session_usage.session_id is NOT NULL, so this needs a real
    // session to spend. Creating it is itself an existing-client write the cap
    // must not touch.
    const session = await asT(request(app).post('/api/sessions')).send({
      clientId: T.clientId,
      sessionDate: '2099-01-05',
      startTime: '09:00',
      endTime: '10:00',
      force: true,
    });
    expect(session.status).toBe(201);

    const res = await asT(
      request(app).post(`/api/clients/${T.clientId}/packages/${clientPackageId}/use-session`)
    ).send({ sessionId: session.body.session.id });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('recording consent for an existing client is allowed', async () => {
    const res = await asT(
      request(app).post(`/api/clients/${T.clientId}/consent`)
    ).send({ consent_type: 'health_data' });

    expect([200, 201]).toContain(res.status);
  });

  test('no existing-client POST route answers with the client-limit error', async () => {
    // A sweep rather than a per-route assertion: whatever these individual
    // handlers decide (200, 201, 400, 404 …), none of them may be turned away
    // by the *client count* limit, because none of them creates a client.
    const routes = [
      `/api/clients/${T.clientId}/payments`,
      `/api/clients/${T.clientId}/packages`,
      `/api/clients/${T.clientId}/consent`,
      `/api/clients/${T.clientId}/request-deletion`,
      `/api/clients/${T.clientId}/cancel-deletion`,
    ];

    for (const path of routes) {
      const res = await asT(request(app).post(path)).send({ amount: 1, packageId: packageTemplateId });
      expect({ path, error: res.body.error }).not.toEqual({ path, error: 'Client limit reached' });
      expect({ path, upgrade: res.body.upgradeRequired }).not.toEqual({ path, upgrade: true });
    }
  });

  test('the cap does not leak into another tenant', async () => {
    const other = await usage(U.tenantId);
    expect(other.clients_limit_reached).toBe(false);

    const res = await asU(request(app).post('/api/clients')).send({
      firstName: 'Other',
      lastName: 'Tenant',
    });
    expect(res.status).toBe(201);
    await queryAs(U, 'DELETE FROM clients WHERE id = $1', [res.body.client.id]);
  });

  test('a capped tenant still cannot reach another tenant\'s client', async () => {
    const res = await asT(
      request(app).post(`/api/clients/${U.clientId}/payments`)
    ).send({ amount: 10, paymentMethod: 'cash', status: 'paid' });

    expect(res.status).toBe(404);

    const { rows } = await queryAs(U,
      'SELECT id FROM client_payments WHERE client_id = $1', [U.clientId]
    );
    expect(rows).toHaveLength(0);
  });
});

describe('plans with a higher cap', () => {
  const planId = async (name) => {
    const { rows } = await pool.query('SELECT id FROM subscription_plans WHERE name = $1', [name]);
    return rows[0].id;
  };

  test('a pro tenant past the free cap can still create clients', async () => {
    const pro = await planId('pro');
    const free = await planId('free');

    // Straight through the database: self-service upgrades are payment-gated
    // (TR-HIGH-2) and that gate is not what is under test here.
    await pool.query('UPDATE tenant_subscriptions SET plan_id = $1 WHERE tenant_id = $2',
      [pro, T.tenantId]);

    try {
      const state = await usage(T.tenantId);
      expect(state.max_clients).toBe(50);
      expect(state.clients_limit_reached).toBe(false);

      const res = await asT(request(app).post('/api/clients')).send({
        firstName: 'Pro',
        lastName: 'Headroom',
      });
      expect(res.status).toBe(201);
      await queryAs(T, 'DELETE FROM clients WHERE id = $1', [res.body.client.id]);
    } finally {
      await pool.query('UPDATE tenant_subscriptions SET plan_id = $1 WHERE tenant_id = $2',
        [free, T.tenantId]);
    }
  });

  test('an enterprise tenant has no client cap at all', async () => {
    const enterprise = await planId('enterprise');
    const free = await planId('free');

    await pool.query('UPDATE tenant_subscriptions SET plan_id = $1 WHERE tenant_id = $2',
      [enterprise, T.tenantId]);

    try {
      const state = await usage(T.tenantId);
      expect(state.max_clients).toBeNull();
      expect(state.clients_limit_reached).toBe(false);

      const res = await asT(request(app).post('/api/clients')).send({
        firstName: 'Unlimited',
        lastName: 'Plan',
      });
      expect(res.status).toBe(201);
      await queryAs(T, 'DELETE FROM clients WHERE id = $1', [res.body.client.id]);
    } finally {
      await pool.query('UPDATE tenant_subscriptions SET plan_id = $1 WHERE tenant_id = $2',
        [free, T.tenantId]);
    }
  });
});
