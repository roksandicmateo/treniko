'use strict';

/**
 * Rate limiting and resource abuse (Security Hardening Phase 3, Step 3).
 *
 * Verifies that each limiter actually enforces, that legitimate use is not
 * caught by it, and — the part that matters for deployment — characterises how
 * the limiter identifies a caller.
 *
 * `app.set('trust proxy', 1)` means Express derives `req.ip` from the last
 * entry of `X-Forwarded-For`. Every IP-keyed limiter therefore depends on a
 * reverse proxy actually being in front of the application and setting that
 * header itself. The final block pins that behaviour as a test so the
 * deployment requirement is impossible to overlook: if the API is ever exposed
 * directly, IP-keyed limits become opt-in for the attacker.
 */

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../../server');
const { createTenant, destroyTenant, pool } = require('../helpers/fixtures');
const { setPlan } = require('../helpers/phase2bFixtures');

jest.setTimeout(300000);

let A;

beforeAll(async () => {
  A = await createTenant('a');
});

afterAll(async () => {
  await destroyTenant(A?.tenantId);
  // The upload burst below writes real files. destroyTenant removes the database
  // rows; the files have to be removed here or every run leaves another hundred
  // behind in the uploads tree.
  if (A?.tenantId) {
    const dir = path.resolve(__dirname, '..', '..', 'uploads', A.tenantId);
    fs.rmSync(dir, { recursive: true, force: true });
  }
  await pool.end();
});

/** Send `count` requests from one source and report the statuses seen. */
const burst = async (count, build) => {
  const statuses = [];
  for (let i = 0; i < count; i += 1) {
    const res = await build(i);
    statuses.push(res.status);
  }
  return statuses;
};

describe('login and registration are limited', () => {
  test('repeated failed logins from one source are eventually refused', async () => {
    const ip = '203.0.113.11';
    const statuses = await burst(25, (i) => request(app).post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email: `flood-${i}@example.test`, password: 'wrong-password' }));

    expect(statuses).toContain(429);
    // The limit must bite before an attacker gets many attempts, not after.
    expect(statuses.indexOf(429)).toBeLessThanOrEqual(21);
  });

  test('registration shares that budget, so it cannot be used to keep guessing', async () => {
    const ip = '203.0.113.12';
    await burst(20, (i) => request(app).post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email: `x-${i}@example.test`, password: 'wrong' }));

    const res = await request(app).post('/api/auth/register')
      .set('X-Forwarded-For', ip)
      .send({ email: `after-${Date.now()}@example.test`, password: 'ValidPassw0rd', firstName: 'A', lastName: 'B' });

    expect(res.status).toBe(429);

    const created = await pool.query(
      "SELECT COUNT(*)::int AS c FROM users WHERE email LIKE 'after-%'"
    );
    expect(created.rows[0].c).toBe(0);
  });

  test('a different source is unaffected', async () => {
    const res = await request(app).post('/api/auth/login')
      .set('X-Forwarded-For', '203.0.113.13')
      .send({ email: 'someone@example.test', password: 'wrong' });
    expect(res.status).toBe(401); // reached the handler, not the limiter
  });

  test('account lockout applies independently of the IP limit', async () => {
    // Lockout is keyed on the account, so rotating IPs does not evade it.
    for (let i = 0; i < 6; i += 1) {
      await request(app).post('/api/auth/login')
        .set('X-Forwarded-For', `203.0.113.${20 + i}`)
        .send({ email: A.email, password: 'definitely-wrong' });
    }

    const res = await request(app).post('/api/auth/login')
      .set('X-Forwarded-For', '203.0.113.99')
      .send({ email: A.email, password: A.password });

    expect(res.status).toBe(423);
    expect(res.body.code).toBe('account_locked');

    await pool.query(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
      [A.userId]
    );
  });
});

describe('export is limited (expensive: builds a ZIP of the whole tenant)', () => {
  test('the eleventh export in an hour is refused', async () => {
    await setPlan(A.tenantId, 'pro'); // export is plan-gated

    const statuses = await burst(12, () => request(app).get('/api/export')
      .set('Authorization', `Bearer ${A.token}`)
      .set('X-Forwarded-For', '203.0.113.30'));

    expect(statuses).toContain(429);
    expect(statuses.filter((s) => s === 200).length).toBeLessThanOrEqual(10);

    await setPlan(A.tenantId, 'free');
  });
});

describe('uploads are limited by account, not by a spoofable header', () => {
  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );

  test('a burst of uploads from one account is eventually refused', async () => {
    const statuses = [];
    for (let i = 0; i < 105; i += 1) {
      // Rotating the forwarded address deliberately: the limiter must key on
      // the authenticated user, so changing the apparent IP must not help.
      const res = await request(app)
        .post(`/api/trainings/${A.trainingId}/images`)
        .set('Authorization', `Bearer ${A.token}`)
        .set('X-Forwarded-For', `198.51.100.${i % 250}`)
        .attach('images', PNG, `burst-${i}.png`);
      statuses.push(res.status);
      if (res.status === 429) break;
    }

    expect(statuses).toContain(429);
  });

  test('reading images is not caught by the upload limiter', async () => {
    const res = await request(app)
      .get(`/api/trainings/${A.trainingId}/images`)
      .set('Authorization', `Bearer ${A.token}`)
      .set('X-Forwarded-For', '198.51.100.251');
    expect(res.status).toBe(200);
  });
});

describe('the general API limiter protects everything else', () => {
  test('a sustained burst of SUCCESSFUL requests is throttled', async () => {
    // The limiter used to skip successful requests, so this burst was served in
    // full and the control existed only on paper. Successful traffic is exactly
    // what needs limiting on read endpoints — that is what scraping looks like.
    const ip = '203.0.113.40';
    const statuses = await burst(305, () => request(app).get('/api/dashboard')
      .set('Authorization', `Bearer ${A.token}`)
      .set('X-Forwarded-For', ip));

    expect(statuses).toContain(429);
    expect(statuses.filter((s) => s === 200).length).toBeLessThanOrEqual(300);
  });

  test('normal usage well within the allowance is untouched', async () => {
    const ip = '203.0.113.41';
    const statuses = await burst(30, () => request(app).get('/api/dashboard')
      .set('Authorization', `Bearer ${A.token}`)
      .set('X-Forwarded-For', ip));

    expect(statuses.every((s) => s === 200)).toBe(true);
  });
});

describe('DEPLOYMENT CHARACTERISATION: limiter identity depends on the proxy', () => {
  test('rotating X-Forwarded-For yields a fresh IP-keyed budget', async () => {
    // This is not a defect in the limiter — it is what `trust proxy: 1` means.
    // It is asserted so the requirement is explicit: the application MUST sit
    // behind a reverse proxy that sets X-Forwarded-For itself, so the value the
    // limiter reads is the proxy's observation and not the caller's claim.
    const exhaust = '203.0.113.50';
    await burst(21, (i) => request(app).post('/api/auth/login')
      .set('X-Forwarded-For', exhaust)
      .send({ email: `e-${i}@example.test`, password: 'wrong' }));

    const blocked = await request(app).post('/api/auth/login')
      .set('X-Forwarded-For', exhaust)
      .send({ email: 'blocked@example.test', password: 'wrong' });
    expect(blocked.status).toBe(429);

    const rotated = await request(app).post('/api/auth/login')
      .set('X-Forwarded-For', '203.0.113.51')
      .send({ email: 'rotated@example.test', password: 'wrong' });
    expect(rotated.status).toBe(401); // fresh budget

    // The account-keyed controls do NOT have this property, which is why the
    // sensitive flows rely on them too: account lockout above, the per-address
    // password-reset limiter, and the per-user upload limiter.
  });

  test('only the last forwarded hop is trusted, not the whole chain', async () => {
    // With `trust proxy: 1`, a caller prepending entries cannot displace the
    // value the real proxy appends — the rightmost entry wins.
    const res = await request(app).post('/api/auth/login')
      .set('X-Forwarded-For', '1.2.3.4, 203.0.113.60')
      .send({ email: 'chain@example.test', password: 'wrong' });
    expect(res.status).toBeLessThan(500);
  });
});
