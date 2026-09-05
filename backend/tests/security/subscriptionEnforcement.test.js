'use strict';

/**
 * Subscription / plan enforcement (Phase 2A).
 *
 * TR-HIGH-1: the enforcement middlewares were mounted on '/api' ahead of any
 * authenticateToken, so req.user was always undefined and each one returned
 * next() unconditionally. These tests pin the corrected behaviour: the
 * middleware runs with an authenticated user, actually blocks, and cannot be
 * skipped by simply omitting a token.
 *
 * TR-HIGH-2: change-plan granted paid plans with no payment verification.
 */

const request = require('supertest');
const app = require('../../server');
const { createTenant, destroyTenant, applyPlanLimits, pool, queryAs } = require('../helpers/fixtures');

jest.setTimeout(30000);

let T;

beforeAll(async () => {
  T = await createTenant('sub');
  // Pinned to a plan with a feature switched off and a small client cap. The
  // beta plan has neither (migration 038); the middleware's job is to enforce
  // whatever plan the tenant is on, which is what these tests exercise.
  await applyPlanLimits(T.tenantId, { maxClients: 5, hasTrainingLogs: false });
});

afterAll(async () => {
  await destroyTenant(T?.tenantId);
  await pool.end();
});

const auth = (req) => req.set('Authorization', `Bearer ${T.token}`);

/** Force the tenant's subscription into an expired (read-only) state. */
const expireSubscription = async () => {
  await pool.query(
    `UPDATE tenant_subscriptions
        SET status = 'expired',
            current_period_end = CURRENT_DATE - INTERVAL '5 days',
            is_trial = false,
            trial_end = CURRENT_DATE - INTERVAL '10 days'
      WHERE tenant_id = $1`,
    [T.tenantId]
  );
};

const restoreSubscription = async () => {
  await pool.query(
    `UPDATE tenant_subscriptions
        SET status = 'active',
            current_period_end = CURRENT_DATE + INTERVAL '30 days'
      WHERE tenant_id = $1`,
    [T.tenantId]
  );
};

describe('TR-HIGH-1: enforcement middleware runs with an authenticated user', () => {
  test('req.user is populated by the time subscription middleware executes', async () => {
    // If the middleware still ran before authentication it would either see no
    // user (and, with the new fail-closed guard, 401) or wave the request
    // through. A 200 here proves it ran *and* saw the authenticated tenant.
    const res = await auth(request(app).get('/api/subscriptions/status'));
    expect(res.status).toBe(200);
    expect(res.body.subscription.tenant_id).toBe(T.tenantId);
  });

  test('an unauthenticated caller cannot bypass plan enforcement', async () => {
    // No Authorization header at all: must be rejected before reaching any
    // controller, not silently allowed through the plan checks.
    const res = await request(app).post('/api/clients').send({
      firstName: 'NoAuth',
      lastName: 'Bypass',
    });
    expect([401, 403]).toContain(res.status);

    const leaked = await queryAs(T,
      "SELECT id FROM clients WHERE first_name = 'NoAuth' AND last_name = 'Bypass'"
    );
    expect(leaked.rows).toHaveLength(0);
  });

  test('a forged/garbage token cannot bypass plan enforcement', async () => {
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', 'Bearer not.a.real.token')
      .send({ firstName: 'Forged', lastName: 'Token' });
    expect([401, 403]).toContain(res.status);
  });

  test('read-only mode blocks writes once the subscription is expired', async () => {
    await expireSubscription();
    try {
      const res = await auth(request(app).post('/api/clients')).send({
        firstName: 'ReadOnly',
        lastName: 'Blocked',
      });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Subscription expired');

      const created = await queryAs(T,
        "SELECT id FROM clients WHERE first_name = 'ReadOnly' AND last_name = 'Blocked'"
      );
      expect(created.rows).toHaveLength(0);
    } finally {
      await restoreSubscription();
    }
  });

  test('reads are still permitted while in read-only mode', async () => {
    await expireSubscription();
    try {
      const res = await auth(request(app).get('/api/clients'));
      expect(res.status).toBe(200);
    } finally {
      await restoreSubscription();
    }
  });

  test('an eligible active tenant is allowed to write', async () => {
    const res = await auth(request(app).post('/api/clients')).send({
      firstName: 'Allowed',
      lastName: 'Write',
    });
    expect(res.status).toBe(201);

    await queryAs(T, 'DELETE FROM clients WHERE id = $1', [res.body.client.id]);
  });

  test('data export is exempt from the feature gate, deliberately', async () => {
    // The free plan has has_export = false, and this route used to answer 403
    // because of it. It no longer does, and that is a decision rather than a
    // regression: /api/export is the trainer's route to their own data under
    // GDPR Art. 20, and everyone starts on the free plan, so the gate locked
    // every new account out of data portability from day one.
    //
    // The gate itself is unchanged and still enforced — the training-logs case
    // immediately below is the regression test for it.
    const res = await auth(request(app).get('/api/export'));
    expect(res.status).toBe(200);
  });

  test('checkFeatureAccess blocks a tenant whose plan lacks the feature', async () => {
    const res = await auth(
      request(app).get(`/api/training-logs/client/${T.clientId}/completion-stats`)
    );
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Feature not available');
  });

  test('checkClientLimit blocks creation past the plan limit', async () => {
    // The pinned plan allows 5 clients; the fixture already created 1.
    const created = [];
    try {
      for (let i = 0; i < 4; i += 1) {
        const res = await auth(request(app).post('/api/clients')).send({
          firstName: 'Limit',
          lastName: `Filler${i}`,
        });
        expect(res.status).toBe(201);
        created.push(res.body.client.id);
      }

      // The 6th client must be refused by the plan limit.
      const overflow = await auth(request(app).post('/api/clients')).send({
        firstName: 'Over',
        lastName: 'Limit',
      });
      expect(overflow.status).toBe(403);
      expect(overflow.body.upgradeRequired).toBe(true);

      const leaked = await queryAs(T,
        "SELECT id FROM clients WHERE first_name = 'Over' AND last_name = 'Limit'"
      );
      expect(leaked.rows).toHaveLength(0);
    } finally {
      for (const id of created) {
        await queryAs(T, 'DELETE FROM clients WHERE id = $1', [id]);
      }
    }
  });
});

describe('TR-HIGH-2: paid plan upgrades require payment', () => {
  const planId = async (name) => {
    const { rows } = await pool.query('SELECT id FROM subscription_plans WHERE name = $1', [name]);
    return rows[0].id;
  };

  test('a paid plan outside the old name ranking is still refused', async () => {
    // The guard used to rank plans with a hardcoded map of names,
    // `{ free: 0, pro: 1, enterprise: 2 }`. Any plan whose name was missing
    // from it ranked as `undefined`, which is never greater than a number, so
    // the move was classified as a downgrade and allowed — a free trainer
    // could promote themselves onto it. Ranking is by price now; this pins it.
    const { rows: [premium] } = await pool.query(
      `INSERT INTO subscription_plans
         (name, display_name, price_monthly, price_yearly, max_clients,
          max_sessions_per_month, max_storage_mb, max_trainer_seats,
          has_training_logs, has_analytics, has_export)
       VALUES ('sec2a-test-premium', 'Premium (test)', 79, 790, NULL, NULL, 9000, 5,
               true, true, true)
       ON CONFLICT (name) DO UPDATE SET price_monthly = EXCLUDED.price_monthly
       RETURNING id, name`
    );

    const res = await auth(request(app).post('/api/subscriptions/change-plan'))
      .send({ planId: premium.id, billingPeriod: 'monthly' });

    expect(res.status).toBe(402);
    expect(res.body.paymentRequired).toBe(true);

    const after = await pool.query(
      `SELECT sp.name FROM tenant_subscriptions ts
         JOIN subscription_plans sp ON sp.id = ts.plan_id
        WHERE ts.tenant_id = $1`,
      [T.tenantId]
    );
    expect(after.rows[0].name).not.toBe('sec2a-test-premium');
  });

  test('a free tenant cannot self-upgrade to a paid plan', async () => {
    const enterprise = await planId('enterprise');

    const res = await auth(request(app).post('/api/subscriptions/change-plan')).send({
      planId: enterprise,
      billingPeriod: 'monthly',
    });

    expect(res.status).toBe(402);
    expect(res.body.paymentRequired).toBe(true);

    // The subscription must be untouched.
    const after = await pool.query(
      `SELECT sp.name FROM tenant_subscriptions ts
         JOIN subscription_plans sp ON sp.id = ts.plan_id
        WHERE ts.tenant_id = $1`,
      [T.tenantId]
    );
    // Unchanged: the guard's job is that a self-service call cannot grant a
    // paid plan, not that the tenant sits on any particular free tier. The
    // suite pins a capped test plan in beforeAll.
    expect(after.rows[0].name).not.toBe('pro');
    expect(after.rows[0].name).not.toBe('enterprise');
  });

  test('a free tenant cannot self-upgrade to pro either', async () => {
    const pro = await planId('pro');

    const res = await auth(request(app).post('/api/subscriptions/change-plan')).send({
      planId: pro,
      billingPeriod: 'yearly',
    });

    expect(res.status).toBe(402);

    const after = await pool.query(
      `SELECT sp.name FROM tenant_subscriptions ts
         JOIN subscription_plans sp ON sp.id = ts.plan_id
        WHERE ts.tenant_id = $1`,
      [T.tenantId]
    );
    // Unchanged: the guard's job is that a self-service call cannot grant a
    // paid plan, not that the tenant sits on any particular free tier. The
    // suite pins a capped test plan in beforeAll.
    expect(after.rows[0].name).not.toBe('pro');
    expect(after.rows[0].name).not.toBe('enterprise');
  });

  test('cancelling a subscription is still allowed', async () => {
    const res = await auth(request(app).post('/api/subscriptions/cancel')).send({
      cancelAtPeriodEnd: true,
    });
    expect(res.status).toBe(200);

    await pool.query(
      `UPDATE tenant_subscriptions
          SET cancel_at_period_end = false, cancelled_at = NULL, status = 'active'
        WHERE tenant_id = $1`,
      [T.tenantId]
    );
  });
});
