'use strict';

/**
 * JWT revocation on password change (Phase 2A — TR-HIGH-3).
 *
 * Before this change, resetting a password did not invalidate tokens that had
 * already been issued, so a stolen JWT kept working for the rest of its 24h
 * lifetime — the standard response to an account compromise did not actually
 * lock the attacker out.
 */

const request = require('supertest');
const app = require('../../server');
const { createTenant, destroyTenant, signToken, pool } = require('../helpers/fixtures');

jest.setTimeout(30000);

let T;

beforeAll(async () => {
  T = await createTenant('rev');
});

afterAll(async () => {
  await destroyTenant(T?.tenantId);
  await pool.end();
});

describe('TR-HIGH-3: tokens issued before a password change are rejected', () => {
  test('a valid token works before any password change', async () => {
    const res = await request(app)
      .get('/api/clients')
      .set('Authorization', `Bearer ${T.token}`);
    expect(res.status).toBe(200);
  });

  test('the stolen token stops working once the password is reset', async () => {
    // Simulate the victim resetting their password (what resetPassword does).
    await pool.query(
      'UPDATE users SET password_changed_at = NOW() WHERE id = $1',
      [T.userId]
    );

    const res = await request(app)
      .get('/api/clients')
      .set('Authorization', `Bearer ${T.token}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/sign in again/i);
  });

  test('a token issued after the password change is accepted', async () => {
    // Put the change a few seconds in the past so the comparison is
    // unambiguous. (The cutoff is rounded up to the next whole second, so a
    // token minted in the very same second as the change is deliberately
    // treated as pre-change — see isTokenStillValid.)
    await pool.query(
      "UPDATE users SET password_changed_at = NOW() - INTERVAL '5 seconds' WHERE id = $1",
      [T.userId]
    );

    const fresh = signToken({
      userId: T.userId,
      tenantId: T.tenantId,
      email: T.email,
    });

    const res = await request(app)
      .get('/api/clients')
      .set('Authorization', `Bearer ${fresh}`);

    expect(res.status).toBe(200);
  });

  test('a token backdated to before the password change is rejected', async () => {
    const backdated = signToken(
      { userId: T.userId, tenantId: T.tenantId, email: T.email },
      { noTimestamp: false }
    );
    // Re-sign with an explicit old iat.
    const jwt = require('jsonwebtoken');
    const stale = jwt.sign(
      {
        userId: T.userId,
        tenantId: T.tenantId,
        email: T.email,
        iat: Math.floor(Date.now() / 1000) - 3600,
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    expect(typeof backdated).toBe('string');

    const res = await request(app)
      .get('/api/clients')
      .set('Authorization', `Bearer ${stale}`);

    expect(res.status).toBe(401);
  });

  test('a token for a deleted user is rejected', async () => {
    const ghost = signToken({
      userId: '00000000-0000-4000-8000-000000000000',
      tenantId: T.tenantId,
      email: 'ghost@example.test',
    });

    const res = await request(app)
      .get('/api/clients')
      .set('Authorization', `Bearer ${ghost}`);

    expect(res.status).toBe(401);
  });

  test('changing the password via the API returns a usable replacement token', async () => {
    // Give the account a known password and a fresh session.
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('CurrentPassw0rd!', 4);
    await pool.query(
      'UPDATE users SET password_hash = $1, password_changed_at = NULL WHERE id = $2',
      [hash, T.userId]
    );

    const session = signToken({
      userId: T.userId,
      tenantId: T.tenantId,
      email: T.email,
    });

    const change = await request(app)
      .put('/api/profile/password')
      .set('Authorization', `Bearer ${session}`)
      .send({ currentPassword: 'CurrentPassw0rd!', newPassword: 'BrandNewPassw0rd!' });

    expect(change.status).toBe(200);
    expect(typeof change.body.token).toBe('string');

    // The replacement token keeps the user signed in...
    const withNew = await request(app)
      .get('/api/clients')
      .set('Authorization', `Bearer ${change.body.token}`);
    expect(withNew.status).toBe(200);

    // ...and any token issued before the change is now dead.
    const withOld = await request(app)
      .get('/api/clients')
      .set('Authorization', `Bearer ${session}`);
    expect(withOld.status).toBe(401);
  });
});
