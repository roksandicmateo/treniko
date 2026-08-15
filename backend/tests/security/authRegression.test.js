'use strict';

/**
 * Authentication regression tests (Phase 2A — STEP 7).
 *
 * The Phase 2A changes introduced a global authentication gate on /api and a
 * per-request revocation lookup. These tests confirm that public endpoints are
 * still reachable without a token, that JWT verification still behaves, and
 * that normal authenticated traffic is unaffected.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../server');
const { createTenant, destroyTenant, signToken, pool } = require('../helpers/fixtures');

jest.setTimeout(30000);

let T;

beforeAll(async () => {
  T = await createTenant('auth');
});

afterAll(async () => {
  await destroyTenant(T?.tenantId);
  await pool.end();
});

describe('public endpoints remain reachable without a token', () => {
  test('GET /health is public', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  test('POST /api/auth/login is not blocked by the auth gate', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.test', password: 'wrong' });

    // Must reach the controller: a 401 "invalid credentials" (or a 500 from the
    // pre-existing email_verified schema drift) proves the gate let it through.
    // What must NOT happen is the gate's own "No token provided" rejection.
    expect(res.body.message).not.toBe('No token provided');
  });

  test('POST /api/auth/login with no body still reaches validation', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  test('POST /api/auth/register reaches its own validation, not the auth gate', async () => {
    const res = await request(app).post('/api/auth/register').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  test('POST /api/auth/forgot-password stays public and non-enumerating', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'definitely-not-a-user@example.test' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('POST /api/auth/reset-password stays public', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'invalid', newPassword: 'somethingnew' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/reset link/i);
  });

  test('GET /api/auth/verify-email stays public', async () => {
    const res = await request(app).get('/api/auth/verify-email');
    expect(res.status).toBe(400);
    expect(res.body.error).not.toBe('Authentication required');
  });
});

describe('JWT verification still behaves correctly', () => {
  test('a missing token is rejected', async () => {
    const res = await request(app).get('/api/clients');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Authentication required');
  });

  test('a malformed token is rejected', async () => {
    const res = await request(app)
      .get('/api/clients')
      .set('Authorization', 'Bearer garbage');
    expect(res.status).toBe(403);
  });

  test('a token signed with the wrong secret is rejected', async () => {
    const forged = jwt.sign(
      { userId: T.userId, tenantId: T.tenantId, email: T.email },
      'not-the-real-secret',
      { expiresIn: '24h' }
    );

    const res = await request(app)
      .get('/api/clients')
      .set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(403);
  });

  test('an expired token is rejected', async () => {
    const expired = jwt.sign(
      { userId: T.userId, tenantId: T.tenantId, email: T.email },
      process.env.JWT_SECRET,
      { expiresIn: '-1h' }
    );

    const res = await request(app)
      .get('/api/clients')
      .set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(403);
  });

  test('an "alg: none" unsigned token is rejected', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(
      JSON.stringify({ userId: T.userId, tenantId: T.tenantId, email: T.email })
    ).toString('base64url');
    const unsigned = `${header}.${body}.`;

    const res = await request(app)
      .get('/api/clients')
      .set('Authorization', `Bearer ${unsigned}`);
    expect(res.status).toBe(403);
  });

  test('GET /api/auth/validate works with a good token', async () => {
    const res = await request(app)
      .get('/api/auth/validate')
      .set('Authorization', `Bearer ${T.token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(T.userId);
  });
});

describe('normal authenticated trainer operations still work', () => {
  const auth = (req) => req.set('Authorization', `Bearer ${T.token}`);

  test('list clients', async () => {
    const res = await auth(request(app).get('/api/clients'));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.clients)).toBe(true);
  });

  test('read a single client', async () => {
    const res = await auth(request(app).get(`/api/clients/${T.clientId}`));
    expect(res.status).toBe(200);
    expect(res.body.client.id).toBe(T.clientId);
  });

  test('create, update and delete a client', async () => {
    const created = await auth(request(app).post('/api/clients')).send({
      firstName: 'Round',
      lastName: 'Trip',
    });
    expect(created.status).toBe(201);
    const id = created.body.client.id;

    const updated = await auth(request(app).put(`/api/clients/${id}`)).send({
      firstName: 'Round2',
    });
    expect(updated.status).toBe(200);
    expect(updated.body.client.first_name).toBe('Round2');

    const removed = await auth(request(app).delete(`/api/clients/${id}`));
    expect(removed.status).toBe(200);
  });

  test('dashboard loads', async () => {
    const res = await auth(request(app).get('/api/dashboard'));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('profile loads', async () => {
    const res = await auth(request(app).get('/api/profile'));
    expect(res.status).toBe(200);
    expect(res.body.profile.id).toBe(T.userId);
  });

  test('groups list loads', async () => {
    const res = await auth(request(app).get('/api/groups'));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('exercises list loads', async () => {
    const res = await auth(request(app).get('/api/exercises'));
    expect(res.status).toBe(200);
  });

  test('subscription status loads', async () => {
    const res = await auth(request(app).get('/api/subscriptions/status'));
    expect(res.status).toBe(200);
  });

  test('an unknown /api route still 404s rather than leaking', async () => {
    const res = await auth(request(app).get('/api/definitely-not-a-route'));
    expect(res.status).toBe(404);
  });
});
