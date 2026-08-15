'use strict';

/**
 * Registration / login / email-verification regression tests.
 *
 * These exist because `authController` referenced three columns
 * (email_verified, verification_token, verification_token_expires) that no
 * schema or migration ever created, which made LOGIN FAIL outright with
 * Postgres 42703. Migration 025_email_verification.sql adds them; this suite
 * proves a database built from the migration chain supports the normal
 * registration and login flow end to end.
 *
 * Outbound email is a no-op unless BREVO_API_KEY is set, so nothing is sent.
 */

const request = require('supertest');
const app = require('../../server');
const { destroyTenant, pool } = require('../helpers/fixtures');

jest.setTimeout(30000);

const unique = () => `sec2a-authflow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// Tenants created via the real registration endpoint, cleaned up afterwards.
const createdTenants = [];

const registerTrainer = async (overrides = {}) => {
  const email = `${unique()}@example.test`;
  const res = await request(app).post('/api/auth/register').send({
    email,
    password: 'RegisterPassw0rd!',
    firstName: 'Reg',
    lastName: 'Tester',
    ...overrides,
  });
  if (res.body?.user?.tenantId) createdTenants.push(res.body.user.tenantId);
  return { res, email };
};

/**
 * Newly registered trainers have not accepted the DPA, so requireDpa correctly
 * blocks the client-facing routes with 403 until they do. Real sign-up flows
 * through this step, so tests that exercise tenant-scoped endpoints do too.
 */
const acceptDpa = (token) =>
  request(app).post('/api/auth/accept-dpa').set('Authorization', `Bearer ${token}`);

afterAll(async () => {
  for (const tenantId of createdTenants) {
    await destroyTenant(tenantId);
  }
  await pool.end();
});

describe('schema prerequisites (migration 025)', () => {
  test('users table has the email-verification columns', async () => {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'users'
          AND column_name IN ('email_verified','verification_token','verification_token_expires')`
    );
    const found = rows.map((r) => r.column_name).sort();
    expect(found).toEqual([
      'email_verified', 'verification_token', 'verification_token_expires',
    ]);
  });

  test('users table has the token-invalidation column (migration 024)', async () => {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'password_changed_at'`
    );
    expect(rows).toHaveLength(1);
  });
});

describe('registration', () => {
  test('a new trainer can register', async () => {
    const { res, email } = await registerTrainer();

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user.email).toBe(email.toLowerCase());
    // New accounts start unverified — PrivateRoute routes them to /check-email.
    expect(res.body.user.emailVerified).toBe(false);
  });

  test('registration stores an unconsumed verification token', async () => {
    const { email } = await registerTrainer();

    const { rows } = await pool.query(
      'SELECT email_verified, verification_token, verification_token_expires FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].email_verified).toBe(false);
    expect(rows[0].verification_token).toMatch(/^[0-9a-f]{64}$/);
    expect(new Date(rows[0].verification_token_expires).getTime()).toBeGreaterThan(Date.now());
  });

  test('duplicate email is rejected', async () => {
    const { email } = await registerTrainer();

    const dup = await request(app).post('/api/auth/register').send({
      email,
      password: 'AnotherPassw0rd!',
      firstName: 'Dupe',
      lastName: 'Tester',
    });
    expect(dup.status).toBe(409);
  });

  test('missing fields are rejected', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'x@example.test' });
    expect(res.status).toBe(400);
  });
});

describe('login', () => {
  test('login succeeds with correct credentials and returns a usable JWT', async () => {
    const { email } = await registerTrainer();

    const login = await request(app).post('/api/auth/login').send({
      email,
      password: 'RegisterPassw0rd!',
    });

    expect(login.status).toBe(200);
    expect(login.body.success).toBe(true);
    expect(typeof login.body.token).toBe('string');
    expect(login.body.user.email).toBe(email.toLowerCase());
    expect(login.body.user).toHaveProperty('emailVerified');

    // The token from login must work against an authenticated endpoint.
    const authed = await request(app)
      .get('/api/auth/validate')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(authed.status).toBe(200);
    expect(authed.body.user.email).toBe(email.toLowerCase());
  });

  test('login is case-insensitive on email', async () => {
    const { email } = await registerTrainer();

    const login = await request(app).post('/api/auth/login').send({
      email: email.toUpperCase(),
      password: 'RegisterPassw0rd!',
    });
    expect(login.status).toBe(200);
  });

  test('login fails with a wrong password', async () => {
    const { email } = await registerTrainer();

    const login = await request(app).post('/api/auth/login').send({
      email,
      password: 'WrongPassw0rd!',
    });
    expect(login.status).toBe(401);
    expect(login.body.token).toBeUndefined();
  });

  test('login fails for an unknown email without revealing that it is unknown', async () => {
    const known = await registerTrainer();
    const wrongPass = await request(app).post('/api/auth/login').send({
      email: known.email, password: 'WrongPassw0rd!',
    });
    const unknown = await request(app).post('/api/auth/login').send({
      email: `${unique()}@example.test`, password: 'WrongPassw0rd!',
    });

    expect(unknown.status).toBe(wrongPass.status);
    expect(unknown.body.message).toBe(wrongPass.body.message);
  });

  test('a JWT from login passes tenant-scoped requests', async () => {
    const { res } = await registerTrainer();
    const token = res.body.token;

    // Client routes are DPA-gated; accept it as the real sign-up flow does.
    const dpa = await acceptDpa(token);
    expect(dpa.status).toBe(200);

    const clients = await request(app)
      .get('/api/clients')
      .set('Authorization', `Bearer ${token}`);
    expect(clients.status).toBe(200);
    expect(Array.isArray(clients.body.clients)).toBe(true);
  });

  test('a tenant-scoped route is refused before the DPA is accepted', async () => {
    const { res } = await registerTrainer();

    const clients = await request(app)
      .get('/api/clients')
      .set('Authorization', `Bearer ${res.body.token}`);
    expect(clients.status).toBe(403);
    expect(clients.body.error).toBe('dpa_required');
  });
});

describe('email verification', () => {
  test('a valid token verifies the account and is consumed', async () => {
    const { email } = await registerTrainer();

    const { rows: [before] } = await pool.query(
      'SELECT verification_token FROM users WHERE email = $1', [email.toLowerCase()]
    );

    const verify = await request(app)
      .get('/api/auth/verify-email')
      .query({ token: before.verification_token });

    expect(verify.status).toBe(200);
    expect(verify.body.success).toBe(true);

    const { rows: [after] } = await pool.query(
      'SELECT email_verified, verification_token FROM users WHERE email = $1', [email.toLowerCase()]
    );
    expect(after.email_verified).toBe(true);
    expect(after.verification_token).toBeNull();

    // Once verified, login reports the account as verified.
    const login = await request(app).post('/api/auth/login').send({
      email, password: 'RegisterPassw0rd!',
    });
    expect(login.body.user.emailVerified).toBe(true);
  });

  test('an unknown verification token is rejected', async () => {
    const res = await request(app)
      .get('/api/auth/verify-email')
      .query({ token: 'a'.repeat(64) });
    expect(res.status).toBe(400);
  });

  test('a missing token is rejected', async () => {
    const res = await request(app).get('/api/auth/verify-email');
    expect(res.status).toBe(400);
  });
});

describe('password reset integrates with token invalidation', () => {
  test('resetting the password stamps password_changed_at and kills old tokens', async () => {
    const { res, email } = await registerTrainer();
    const oldToken = res.body.token;
    await acceptDpa(oldToken);

    // Old token works to begin with.
    const before = await request(app)
      .get('/api/clients').set('Authorization', `Bearer ${oldToken}`);
    expect(before.status).toBe(200);

    const { rows: [user] } = await pool.query(
      'SELECT id FROM users WHERE email = $1', [email.toLowerCase()]
    );

    // forgot-password must actually persist a reset token. It swallows errors
    // to avoid email enumeration, so a broken INSERT here would otherwise be
    // invisible — assert the row really exists.
    const forgot = await request(app).post('/api/auth/forgot-password').send({ email });
    expect(forgot.status).toBe(200);

    const { rows: issued } = await pool.query(
      'SELECT id FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL',
      [user.id]
    );
    expect(issued.length).toBeGreaterThan(0);

    // The raw token is only ever emailed, so mint an equivalent one the same
    // way the controller does in order to exercise the redemption endpoint.
    const crypto = require('crypto');
    const raw = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
      [user.id, hash]
    );

    const reset = await request(app).post('/api/auth/reset-password').send({
      token: raw, newPassword: 'ResetPassw0rd!',
    });
    expect(reset.status).toBe(200);

    const { rows: [stamped] } = await pool.query(
      'SELECT password_changed_at FROM users WHERE id = $1', [user.id]
    );
    expect(stamped.password_changed_at).not.toBeNull();

    // The pre-reset token must no longer be accepted.
    const after = await request(app)
      .get('/api/clients').set('Authorization', `Bearer ${oldToken}`);
    expect(after.status).toBe(401);

    // The new password works.
    const login = await request(app).post('/api/auth/login').send({
      email, password: 'ResetPassw0rd!',
    });
    expect(login.status).toBe(200);
  });
});
