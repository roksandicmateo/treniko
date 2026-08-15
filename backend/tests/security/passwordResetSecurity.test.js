'use strict';

/**
 * Password-reset abuse resistance (Phase 2B).
 *
 *   TR-MED-1   forgot-password had no effective rate limit: its only cover was
 *              the general limiter, which is configured with
 *              skipSuccessfulRequests, and the handler answers 200 on every
 *              path — so nothing was ever counted, on an unauthenticated
 *              endpoint that sends an email per call.
 *   TR-MED-10  the handler awaited the outbound email before responding, so a
 *              registered address took measurably longer to answer than an
 *              unregistered one.
 *
 * The email service is mocked with a promise that never settles. That is the
 * deterministic form of the timing assertion: if the response still arrives,
 * the handler cannot be waiting on the send. A wall-clock comparison would
 * measure the test machine rather than the code.
 *
 * Rate-limit state is keyed by IP, so each test uses its own X-Forwarded-For
 * value (the app runs with `trust proxy: 1`) and its own target address. Tests
 * therefore cannot exhaust each other's budgets, and no limiter had to be
 * weakened or disabled to make them pass.
 */

const emailService = require('../../services/emailService');

jest.mock('../../services/emailService', () => ({
  sendWelcomeEmail: jest.fn(() => Promise.resolve()),
  // Never settles: proves the handler does not await it.
  sendPasswordResetEmail: jest.fn(() => new Promise(() => {})),
  sendTrialExpiryWarning7Days: jest.fn(() => Promise.resolve()),
  sendTrialExpiryWarning3Days: jest.fn(() => Promise.resolve()),
  sendSubscriptionExpiredEmail: jest.fn(() => Promise.resolve()),
  sendFirstClientEmail: jest.fn(() => Promise.resolve()),
  sendDeletionScheduledEmail: jest.fn(() => Promise.resolve()),
  sendVerificationEmail: jest.fn(() => Promise.resolve()),
}));

const request = require('supertest');
const app = require('../../server');
const { createTenant, destroyTenant, pool } = require('../helpers/fixtures');

jest.setTimeout(30000);

// Per-test source addresses, so one test's limiter budget is never another's.
const IP = {
  perEmail: '203.0.113.10',
  perIp: '203.0.113.20',
  unknownEmail: '203.0.113.30',
  identical: '203.0.113.40',
  timing: '203.0.113.50',
  reset: '203.0.113.60',
  legit: '203.0.113.70',
};

let A;

const forgot = (ip, email) =>
  request(app).post('/api/auth/forgot-password')
    .set('X-Forwarded-For', ip)
    .send({ email });

beforeAll(async () => {
  A = await createTenant('a');
});

afterAll(async () => {
  await destroyTenant(A?.tenantId);
  await pool.end();
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('TR-MED-1: forgot-password is rate limited', () => {
  test('a single address cannot be mail-bombed indefinitely', async () => {
    const victim = `sec2b-victim-${Date.now()}@example.test`;

    // The per-address budget is 5 per hour.
    for (let i = 0; i < 5; i += 1) {
      const res = await forgot(IP.perEmail, victim);
      expect(res.status).toBe(200);
    }

    const blocked = await forgot(IP.perEmail, victim);
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('rate_limit_exceeded');
  });

  test('one source cannot cycle through many addresses either', async () => {
    // Per-IP budget is 10 per hour, counted regardless of the 200 responses.
    for (let i = 0; i < 10; i += 1) {
      const res = await forgot(IP.perIp, `sec2b-target-${i}-${Date.now()}@example.test`);
      expect(res.status).toBe(200);
    }

    const blocked = await forgot(IP.perIp, `sec2b-target-final-${Date.now()}@example.test`);
    expect(blocked.status).toBe(429);
  });

  test('the limit applies to unknown addresses too, so 429 reveals nothing', async () => {
    const unknown = `sec2b-nobody-${Date.now()}@example.test`;
    for (let i = 0; i < 5; i += 1) {
      expect((await forgot(IP.unknownEmail, unknown)).status).toBe(200);
    }
    // A registered address would behave identically here.
    expect((await forgot(IP.unknownEmail, unknown)).status).toBe(429);
  });

  test('a fresh source is unaffected by another source being limited', async () => {
    const res = await forgot(IP.legit, A.email);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  test('reset-password is rate limited as well', async () => {
    for (let i = 0; i < 10; i += 1) {
      const res = await request(app).post('/api/auth/reset-password')
        .set('X-Forwarded-For', IP.reset)
        .send({ token: `wrong-token-${i}`, newPassword: 'NewPassw0rd' });
      expect(res.status).toBe(400); // invalid token, but the attempt is counted
    }

    const blocked = await request(app).post('/api/auth/reset-password')
      .set('X-Forwarded-For', IP.reset)
      .send({ token: 'wrong-token-final', newPassword: 'NewPassw0rd' });
    expect(blocked.status).toBe(429);
  });
});

describe('TR-MED-10: no enumeration through response body or blocking send', () => {
  test('known and unknown addresses return byte-identical responses', async () => {
    const known = await forgot(IP.identical, A.email);
    const unknown = await forgot(IP.identical, `sec2b-absent-${Date.now()}@example.test`);

    expect(known.status).toBe(unknown.status);
    expect(known.body).toEqual(unknown.body);
    expect(known.body).toEqual({ success: true });
  });

  test('the response does not wait for the outbound email', async () => {
    // sendPasswordResetEmail returns a promise that never resolves. Before the
    // fix the handler awaited it, so this request could not have completed.
    const res = await forgot(IP.timing, A.email);

    expect(res.status).toBe(200);
    expect(emailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: A.email })
    );
  });

  test('a reset token is still issued and stored hashed', async () => {
    await forgot(IP.timing, A.email);

    const { rows } = await pool.query(
      `SELECT token_hash, expires_at, used_at FROM password_reset_tokens
       WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [A.userId]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].token_hash).toMatch(/^[a-f0-9]{64}$/); // sha-256, not the raw token
    expect(rows[0].used_at).toBeNull();
    expect(new Date(rows[0].expires_at).getTime()).toBeGreaterThan(Date.now());

    // The raw token is passed to the mailer and never returned to the caller.
    const { resetUrl } = emailService.sendPasswordResetEmail.mock.calls.at(-1)[0];
    expect(resetUrl).toContain('/reset-password?token=');
  });

  test('an unknown address creates no token at all', async () => {
    const before = await pool.query('SELECT COUNT(*)::int AS c FROM password_reset_tokens');
    await forgot(IP.identical, `sec2b-ghost-${Date.now()}@example.test`);
    const after = await pool.query('SELECT COUNT(*)::int AS c FROM password_reset_tokens');
    expect(after.rows[0].c).toBe(before.rows[0].c);
  });
});
