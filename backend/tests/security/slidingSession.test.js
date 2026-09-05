'use strict';

/**
 * The sliding session.
 *
 * A trainer using the app daily was signed out every 24 hours because the token
 * has that lifetime and there is no refresh token. An active session now renews
 * itself: past the halfway point, a request comes back with a fresh token in
 * `X-Refreshed-Token`.
 *
 * That is a change to how long access lasts, so the properties that keep it
 * safe are pinned here:
 *
 *   - a fresh token is NOT renewed (no pointless churn, and no signal about
 *     token age to anyone watching);
 *   - a renewed token is a real, usable token for the SAME user and tenant —
 *     never a wider one;
 *   - a token invalidated by a password change is rejected before renewal, so
 *     the chain cannot be extended past a reset. This is the property that
 *     makes the whole mechanism acceptable;
 *   - an expired token is not renewed either: renewal is for an active
 *     session, not a resurrection.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../server');
const { createTenant, destroyTenant, signToken, pool } = require('../helpers/fixtures');
const { SLIDING_RENEWAL_AFTER_SECONDS } = require('../../middleware/auth');

jest.setTimeout(30000);

let T;

/** A token issued `ageSeconds` ago, exactly as authController would have. */
const tokenAged = (ageSeconds) => {
  const iat = Math.floor(Date.now() / 1000) - ageSeconds;
  // `iat` belongs in the payload: jsonwebtoken refuses it as an option, and a
  // payload `iat` is exactly what a token issued that long ago carries.
  return signToken({ userId: T.userId, tenantId: T.tenantId, email: T.email, iat });
};

const probe = (token) =>
  request(app).get('/api/clients').set('Authorization', `Bearer ${token}`);

beforeAll(async () => { T = await createTenant('slide'); });
afterAll(async () => { await destroyTenant(T?.tenantId); await pool.end(); });

describe('when a token is renewed', () => {
  test('a fresh token is not renewed', async () => {
    const res = await probe(tokenAged(60));
    expect(res.status).toBe(200);
    expect(res.headers['x-refreshed-token']).toBeUndefined();
  });

  test('a token past the halfway point is renewed', async () => {
    const res = await probe(tokenAged(SLIDING_RENEWAL_AFTER_SECONDS + 60));
    expect(res.status).toBe(200);
    expect(res.headers['x-refreshed-token']).toBeDefined();
  });

  test('the renewed token carries the same identity, and no more', async () => {
    const res = await probe(tokenAged(SLIDING_RENEWAL_AFTER_SECONDS + 60));
    const renewed = jwt.verify(res.headers['x-refreshed-token'], process.env.JWT_SECRET);

    expect(renewed.userId).toBe(T.userId);
    expect(renewed.tenantId).toBe(T.tenantId);
    expect(renewed.email).toBe(T.email);
    // Nothing else may ride along — a renewal must not be a privilege upgrade.
    expect(Object.keys(renewed).sort()).toEqual(['email', 'exp', 'iat', 'tenantId', 'userId']);
  });

  test('the renewed token works', async () => {
    const first = await probe(tokenAged(SLIDING_RENEWAL_AFTER_SECONDS + 60));
    const renewed = first.headers['x-refreshed-token'];

    const second = await probe(renewed);
    expect(second.status).toBe(200);
    // And it is fresh, so it does not immediately renew again.
    expect(second.headers['x-refreshed-token']).toBeUndefined();
  });
});

describe('what renewal must never do', () => {
  test('an expired token is refused, not renewed', async () => {
    const expired = signToken({
      userId: T.userId, tenantId: T.tenantId, email: T.email,
      iat: Math.floor(Date.now() / 1000) - 60 * 60 * 48,
    });

    const res = await probe(expired);
    expect(res.status).toBe(403);
    expect(res.headers['x-refreshed-token']).toBeUndefined();
  });

  test('a token invalidated by a password change is refused, not renewed', async () => {
    // The scenario the whole mechanism has to survive: a stolen token, a
    // password reset, and an attacker trying to ride the renewal chain past it.
    const stolen = tokenAged(SLIDING_RENEWAL_AFTER_SECONDS + 60);

    await pool.query('UPDATE users SET password_changed_at = NOW() WHERE id = $1', [T.userId]);

    const res = await probe(stolen);
    expect(res.status).toBe(401);
    expect(res.headers['x-refreshed-token']).toBeUndefined();

    await pool.query('UPDATE users SET password_changed_at = NULL WHERE id = $1', [T.userId]);
  });

  test('a forged token is refused, not renewed', async () => {
    const forged = jwt.sign(
      { userId: T.userId, tenantId: T.tenantId, email: T.email },
      'not-the-real-secret',
      { expiresIn: '24h' }
    );

    const res = await probe(forged);
    expect(res.status).toBe(403);
    expect(res.headers['x-refreshed-token']).toBeUndefined();
  });
});
