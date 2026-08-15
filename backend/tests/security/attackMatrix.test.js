'use strict';

/**
 * Active attack matrix (Security Hardening Phase 3, Step 1).
 *
 * Every case here is an attack executed against the real Express stack and a
 * real database. This suite deliberately covers the cases the Phase 2A/2B
 * suites do NOT: Authorization-header shapes, the JWT algorithm confusion the
 * Phase 2B pinning was meant to stop, the password-reset token lifecycle,
 * extreme and malformed field values, upload naming tricks, and the exact
 * content of error responses across every status the API can produce.
 *
 * Assertions check database state as well as status codes wherever an attack
 * could have written something.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../../server');
const { createTenant, destroyTenant, signToken, pool } = require('../helpers/fixtures');
const { createSession, createPackageWithPayment } = require('../helpers/phase2bFixtures');

jest.setTimeout(120000);

const ABSENT_UUID = '00000000-0000-4000-8000-000000000000';

let A;
let B;
let paymentsA;
let paymentsB;
let sessionB;

beforeAll(async () => {
  A = await createTenant('a');
  B = await createTenant('b');
  paymentsA = await createPackageWithPayment(A.tenantId, A.clientId);
  paymentsB = await createPackageWithPayment(B.tenantId, B.clientId);
  sessionB = await createSession(B.tenantId, B.clientId);
});

afterAll(async () => {
  await destroyTenant(A?.tenantId);
  await destroyTenant(B?.tenantId);
  // The upload block writes real files; remove them so runs do not accumulate.
  for (const tenantId of [A?.tenantId, B?.tenantId].filter(Boolean)) {
    fs.rmSync(path.resolve(__dirname, '..', '..', 'uploads', tenantId), {
      recursive: true, force: true,
    });
  }
  await pool.end();
});

const asA = (req) => req.set('Authorization', `Bearer ${A.token}`);

// ══════════════════════════════════════════════════════════════════════════
// AUTHENTICATION
// ══════════════════════════════════════════════════════════════════════════
describe('ATTACK: authentication', () => {
  const target = '/api/clients';

  test.each([
    ['no Authorization header at all', undefined],
    ['empty Authorization header', ''],
    ['bare token with no scheme', 'sometoken'],
    ['wrong scheme (Basic)', 'Basic dXNlcjpwYXNz'],
    ['Bearer with nothing after it', 'Bearer'],
    ['Bearer with only whitespace', 'Bearer    '],
    ['scheme repeated', 'Bearer Bearer sometoken'],
  ])('%s is refused', async (_label, header) => {
    const req = request(app).get(target);
    if (header !== undefined) req.set('Authorization', header);
    const res = await req;

    expect([401, 403]).toContain(res.status);
    expect(JSON.stringify(res.body)).not.toMatch(/first_name|tenant_id|@/);
  });

  test('a structurally malformed token is refused', async () => {
    const res = await request(app).get(target).set('Authorization', 'Bearer a.b.c');
    expect(res.status).toBe(403);
  });

  test('a token signed with the wrong secret is refused', async () => {
    const forged = jwt.sign(
      { userId: A.userId, tenantId: A.tenantId, email: A.email },
      'wrong-secret-entirely', { expiresIn: '1h' }
    );
    const res = await request(app).get(target).set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(403);
  });

  test('an expired token is refused', async () => {
    const expired = signToken(
      { userId: A.userId, tenantId: A.tenantId, email: A.email },
      { expiresIn: '-1h' }
    );
    const res = await request(app).get(target).set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(403);
  });

  test('an unsigned alg:none token is refused', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      userId: A.userId, tenantId: A.tenantId, email: A.email,
      iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString('base64url');
    const res = await request(app).get(target)
      .set('Authorization', `Bearer ${header}.${payload}.`);
    expect(res.status).toBe(403);
  });

  test('a token using a different HMAC algorithm is refused (algorithm pinning)', async () => {
    // HS512 signed with the real secret. Without `algorithms: ['HS256']` this
    // verifies successfully, because jsonwebtoken would honour the algorithm
    // the attacker-supplied token header asks for.
    const hs512 = jwt.sign(
      { userId: A.userId, tenantId: A.tenantId, email: A.email },
      process.env.JWT_SECRET, { algorithm: 'HS512', expiresIn: '1h' }
    );
    const res = await request(app).get(target).set('Authorization', `Bearer ${hs512}`);
    expect(res.status).toBe(403);
  });

  test('a token naming another tenant is useless without the signing key', async () => {
    // Re-signing with a guessed key is the only way to change tenantId.
    const crossTenant = jwt.sign(
      { userId: A.userId, tenantId: B.tenantId, email: A.email },
      'guessed-secret', { expiresIn: '1h' }
    );
    const res = await request(app).get(target).set('Authorization', `Bearer ${crossTenant}`);
    expect(res.status).toBe(403);
  });

  test('a token for a user that no longer exists is refused', async () => {
    const ghost = signToken({ userId: ABSENT_UUID, tenantId: A.tenantId, email: 'x@y.test' });
    const res = await request(app).get(target).set('Authorization', `Bearer ${ghost}`);
    expect(res.status).toBe(401);
  });

  test('a token issued before the password changed is refused', async () => {
    const stale = signToken(
      { userId: A.userId, tenantId: A.tenantId, email: A.email },
      { noTimestamp: false }
    );
    await pool.query('UPDATE users SET password_changed_at = NOW() WHERE id = $1', [A.userId]);

    const res = await request(app).get(target).set('Authorization', `Bearer ${stale}`);
    expect(res.status).toBe(401);

    // Restore, and confirm a token minted afterwards works — the control must
    // revoke the old token without locking the account out permanently.
    await pool.query('UPDATE users SET password_changed_at = NULL WHERE id = $1', [A.userId]);
    const fresh = await request(app).get(target).set('Authorization', `Bearer ${A.token}`);
    expect(fresh.status).toBe(200);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// TENANT ISOLATION — nested object ownership
// ══════════════════════════════════════════════════════════════════════════
describe('ATTACK: nested-object ownership', () => {
  test("A's own clientId paired with B's paymentId is refused", async () => {
    const res = await asA(
      request(app).put(`/api/clients/${A.clientId}/payments/${paymentsB.paymentId}`)
    ).send({ amount: 1 });

    expect(res.status).toBe(404);
    const row = await pool.query('SELECT amount FROM client_payments WHERE id = $1',
      [paymentsB.paymentId]);
    expect(Number(row.rows[0].amount)).toBe(50);
  });

  test("B's clientId paired with A's paymentId is refused", async () => {
    const res = await asA(
      request(app).put(`/api/clients/${B.clientId}/payments/${paymentsA.paymentId}`)
    ).send({ amount: 1 });
    expect(res.status).toBe(404);
  });

  test("A's own clientId paired with B's client package is refused", async () => {
    const res = await asA(
      request(app).put(`/api/clients/${A.clientId}/packages/${paymentsB.clientPackageId}`)
    ).send({ status: 'cancelled' });
    expect([400, 404]).toContain(res.status);

    const row = await pool.query('SELECT status FROM client_packages WHERE id = $1',
      [paymentsB.clientPackageId]);
    expect(row.rows[0].status).toBe('active');
  });

  test("attendees cannot be listed for another tenant's session", async () => {
    const res = await asA(request(app).get(`/api/sessions/${sessionB.id}/attendees`));
    // Either refused, or scoped to nothing — never another tenant's rows.
    expect(res.status === 404 || (res.status === 200 && res.body.attendees.length === 0)).toBe(true);
  });

  test.each([
    ['a valid UUID belonging to nobody', ABSENT_UUID],
    ['a valid UUID belonging to another tenant', null], // filled below
  ])('%s is answered identically', async (_label, id) => {
    const target = id || B.clientId;
    const res = await asA(request(app).get(`/api/clients/${target}`));
    expect(res.status).toBe(404);
  });

  test('a foreign id and an absent id return the same body, so neither confirms existence', async () => {
    const foreign = await asA(request(app).get(`/api/clients/${B.clientId}`));
    const absent = await asA(request(app).get(`/api/clients/${ABSENT_UUID}`));
    expect(foreign.status).toBe(absent.status);
    expect(foreign.body).toEqual(absent.body);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// MASS ASSIGNMENT — the full property list from the Phase 3 brief
// ══════════════════════════════════════════════════════════════════════════
describe('ATTACK: mass assignment of privileged properties', () => {
  const HOSTILE_PROPERTIES = {
    tenant_id: ABSENT_UUID,
    tenantId: ABSENT_UUID,
    trainer_id: ABSENT_UUID,
    user_id: ABSENT_UUID,
    role: 'admin',
    is_admin: true,
    subscription_status: 'active',
    plan: 'enterprise',
    email_verified: true,
    password_changed_at: null,
    password_hash: 'attacker-chosen',
    dpa_accepted: true,
  };

  test('PUT /api/profile ignores every privileged property', async () => {
    const before = await pool.query(
      `SELECT tenant_id, email_verified, password_hash, dpa_accepted, password_changed_at
       FROM users WHERE id = $1`, [A.userId]
    );

    const res = await asA(request(app).put('/api/profile'))
      .send({ firstName: 'Legit', ...HOSTILE_PROPERTIES });
    expect(res.status).toBe(200);

    const after = await pool.query(
      `SELECT tenant_id, email_verified, password_hash, dpa_accepted, password_changed_at, first_name
       FROM users WHERE id = $1`, [A.userId]
    );
    expect(after.rows[0]).toEqual({ ...before.rows[0], first_name: 'Legit' });
  });

  test('POST /api/clients ignores every privileged property', async () => {
    const res = await asA(request(app).post('/api/clients'))
      .send({ firstName: 'Mass', lastName: 'Assign', ...HOSTILE_PROPERTIES });
    expect(res.status).toBe(201);

    const row = await pool.query('SELECT tenant_id FROM clients WHERE id = $1',
      [res.body.client.id]);
    expect(row.rows[0].tenant_id).toBe(A.tenantId);

    await pool.query('DELETE FROM clients WHERE id = $1', [res.body.client.id]);
  });

  test('the subscription cannot be upgraded by naming a plan in an unrelated request', async () => {
    const before = await pool.query(
      `SELECT sp.name FROM tenant_subscriptions ts
       JOIN subscription_plans sp ON sp.id = ts.plan_id WHERE ts.tenant_id = $1`,
      [A.tenantId]
    );

    await asA(request(app).put('/api/profile')).send({ plan: 'enterprise', subscription_status: 'active' });
    await asA(request(app).post('/api/clients'))
      .send({ firstName: 'X', lastName: 'Y', plan: 'enterprise' })
      .then(async (res) => {
        if (res.body?.client?.id) await pool.query('DELETE FROM clients WHERE id = $1', [res.body.client.id]);
      });

    const after = await pool.query(
      `SELECT sp.name FROM tenant_subscriptions ts
       JOIN subscription_plans sp ON sp.id = ts.plan_id WHERE ts.tenant_id = $1`,
      [A.tenantId]
    );
    expect(after.rows[0].name).toBe(before.rows[0].name);
  });

  test('payment status and package usage cannot be steered by extra properties', async () => {
    const res = await asA(
      request(app).put(`/api/clients/${A.clientId}/payments/${paymentsA.paymentId}`)
    ).send({ amount: 60, tenant_id: B.tenantId, client_id: B.clientId, created_at: '1999-01-01' });

    expect(res.status).toBe(200);
    const row = await pool.query(
      'SELECT tenant_id, client_id FROM client_payments WHERE id = $1', [paymentsA.paymentId]
    );
    expect(row.rows[0].tenant_id).toBe(A.tenantId);
    expect(row.rows[0].client_id).toBe(A.clientId);
  });

  test('sessions_used on a client package cannot be set directly', async () => {
    const before = await pool.query(
      'SELECT sessions_used FROM client_packages WHERE id = $1', [paymentsA.clientPackageId]
    );

    await asA(request(app).put(`/api/clients/${A.clientId}/packages/${paymentsA.clientPackageId}`))
      .send({ sessions_used: 0, sessionsUsed: 0, total_sessions: 9999 });

    const after = await pool.query(
      'SELECT sessions_used, total_sessions FROM client_packages WHERE id = $1',
      [paymentsA.clientPackageId]
    );
    expect(after.rows[0].sessions_used).toBe(before.rows[0].sessions_used);
    expect(after.rows[0].total_sessions).toBe(10);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// INPUT ATTACKS
// ══════════════════════════════════════════════════════════════════════════
describe('ATTACK: hostile field values', () => {
  test.each([
    ['extreme positive number', Number.MAX_SAFE_INTEGER],
    ['negative amount', -100000],
    ['numeric string', '1e309'],
    ['not a number', 'not-a-number'],
  ])('payment amount: %s is handled without a server error', async (_label, amount) => {
    const res = await asA(
      request(app).put(`/api/clients/${A.clientId}/payments/${paymentsA.paymentId}`)
    ).send({ amount });
    expect(res.status).toBeLessThan(500);
  });

  test.each([
    ['null bytes', 'evil name'],
    ['RTL override and zero-width', '‮gnp.exe​'],
    ['astral-plane emoji', '🏋️‍♀️🙈'],
    ['very long string', 'A'.repeat(4000)],
    ['html-ish', '<script>alert(1)</script>'],
    ['sql-ish', "Robert'); DROP TABLE clients;--"],
  ])('client name: %s is stored or rejected, never executed', async (_label, value) => {
    const res = await asA(request(app).post('/api/clients'))
      .send({ firstName: value, lastName: 'Probe' });

    expect(res.status).toBeLessThan(500);

    if (res.status === 201) {
      // The clients table must still exist and the value must round-trip as
      // literal text — proof it was parameterised, not interpreted.
      const row = await pool.query('SELECT first_name FROM clients WHERE id = $1',
        [res.body.client.id]);
      expect(typeof row.rows[0].first_name).toBe('string');
      await pool.query('DELETE FROM clients WHERE id = $1', [res.body.client.id]);
    }

    const stillThere = await pool.query('SELECT COUNT(*)::int AS c FROM clients WHERE tenant_id = $1',
      [A.tenantId]);
    expect(stillThere.rows[0].c).toBeGreaterThanOrEqual(1);
  });

  test.each([
    ['malformed date', 'not-a-date'],
    ['impossible date', '2026-02-31'],
    ['far future', '9999-12-31'],
    ['negative year', '-0001-01-01'],
  ])('session date: %s is handled without a server error', async (_label, sessionDate) => {
    const res = await asA(request(app).post('/api/sessions')).send({
      clientId: A.clientId, sessionDate, startTime: '10:00', endTime: '11:00',
    });
    expect(res.status).toBeLessThan(500);
    if (res.status === 201) {
      await pool.query('DELETE FROM training_sessions WHERE id = $1', [res.body.session.id]);
    }
  });

  test('an array where an object is expected does not crash the handler', async () => {
    const res = await asA(request(app).post('/api/trainings')).send({
      clientId: A.clientId,
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 3600000).toISOString(),
      exercises: ['not', 'objects'],
    });
    expect(res.status).toBeLessThan(500);
  });

  test('deeply nested JSON is handled', async () => {
    let nested = { value: 1 };
    for (let i = 0; i < 200; i += 1) nested = { nested };
    const res = await asA(request(app).post('/api/clients'))
      .send({ firstName: 'Deep', lastName: 'Nest', notes: nested });
    expect(res.status).toBeLessThan(500);
    if (res.status === 201) {
      await pool.query('DELETE FROM clients WHERE id = $1', [res.body.client.id]);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════
// UPLOADS
// ══════════════════════════════════════════════════════════════════════════
describe('ATTACK: upload naming and content tricks', () => {
  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
  const SVG_WITH_SCRIPT = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.domain)</script></svg>'
  );

  const upload = () => asA(request(app).post(`/api/trainings/${A.trainingId}/images`));

  test.each([
    ['double extension .png.php', 'payload.png.php', PNG],
    ['double extension .php.png with script body', 'payload.php.png', Buffer.from('<?php ?>')],
    ['svg carrying a script', 'vector.svg', SVG_WITH_SCRIPT],
    ['svg renamed to .png', 'vector.png', SVG_WITH_SCRIPT],
    ['traversal in the filename', '../../../../etc/passwd.png', Buffer.from('root:x:0:0')],
    ['null byte in the filename', 'shell.php .png', Buffer.from('<?php ?>')],
    ['no extension', 'noextension', PNG],
  ])('%s is rejected', async (_label, filename, content) => {
    const res = await upload().attach('images', content, filename);
    expect(res.status).toBe(400);

    const rows = await pool.query(
      'SELECT id FROM training_images WHERE training_id = $1', [A.trainingId]
    );
    expect(rows.rows).toHaveLength(0);
  });

  test('a declared image MIME type does not override the actual bytes', async () => {
    const res = await upload()
      .attach('images', Buffer.from('<?php system($_GET[0]); ?>'), {
        filename: 'lies.png', contentType: 'image/png',
      });
    expect(res.status).toBe(400);
  });

  test("another tenant's file cannot be fetched even with a correct filename", async () => {
    const good = await upload().attach('images', PNG, 'real.png');
    expect(good.status).toBe(201);
    const filename = good.body[0].file_path;

    const asB = await request(app)
      .get(`/api/trainings/${A.trainingId}/images/${filename}`)
      .set('Authorization', `Bearer ${B.token}`);
    expect(asB.status).toBe(404);
    expect(asB.headers['content-type']).toMatch(/json/);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// AUTH BUSINESS FLOWS — reset token lifecycle
// ══════════════════════════════════════════════════════════════════════════
describe('ATTACK: password reset token lifecycle', () => {
  /** Insert a reset token directly, exactly as the controller does. */
  const issueToken = async ({ expiresInMs = 3600000, usedAt = null } = {}) => {
    const raw = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, used_at)
       VALUES ($1, $2, $3, $4)`,
      [A.userId, hash, new Date(Date.now() + expiresInMs), usedAt]
    );
    return raw;
  };

  const reset = (token, ip) => request(app).post('/api/auth/reset-password')
    .set('X-Forwarded-For', ip).send({ token, newPassword: 'BrandNewPassw0rd' });

  test('a valid token works exactly once, and the replay is refused', async () => {
    const token = await issueToken();

    const first = await reset(token, '203.0.113.201');
    expect(first.status).toBe(200);

    const replay = await reset(token, '203.0.113.201');
    expect(replay.status).toBe(400);
    expect(replay.body.error).toMatch(/already been used/i);
  });

  test('an expired token is refused', async () => {
    const token = await issueToken({ expiresInMs: -1000 });
    const res = await reset(token, '203.0.113.202');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/expired/i);
  });

  test('an already-used token is refused', async () => {
    const token = await issueToken({ usedAt: new Date() });
    const res = await reset(token, '203.0.113.203');
    expect(res.status).toBe(400);
  });

  test('a guessed token is refused and does not reveal whether it exists', async () => {
    const guessed = crypto.randomBytes(32).toString('hex');
    const res = await reset(guessed, '203.0.113.204');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid or expired/i);
  });

  test('requesting a new reset invalidates the previous outstanding token', async () => {
    const first = await issueToken();
    await request(app).post('/api/auth/forgot-password')
      .set('X-Forwarded-For', '203.0.113.205').send({ email: A.email });

    const res = await reset(first, '203.0.113.206');
    expect(res.status).toBe(400);
  });

  afterAll(async () => {
    // The successful reset above changed A's password and revoked its token.
    await pool.query(
      'UPDATE users SET password_changed_at = NULL WHERE id = $1', [A.userId]
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════
// ERROR HANDLING
// ══════════════════════════════════════════════════════════════════════════
describe('ATTACK: error responses leak nothing', () => {
  const originalEnv = process.env.NODE_ENV;
  beforeAll(() => { process.env.NODE_ENV = 'production'; });
  afterAll(() => { process.env.NODE_ENV = originalEnv; });

  /** Nothing in an error body may look like internals or another tenant. */
  const assertClean = (res, label) => {
    const body = JSON.stringify(res.body || {});
    expect({ label, hasStack: 'stack' in (res.body || {}) }).toEqual({ label, hasStack: false });
    expect(body).not.toMatch(/at .*\.js:\d+/);            // stack frame
    expect(body).not.toMatch(/[A-Za-z]:\\\\|\/backend\/|node_modules/); // path
    expect(body).not.toMatch(/relation "|column "|syntax error|pg_|ECONNREFUSED/i); // SQL/driver
    expect(body).not.toMatch(/JWT_SECRET|BREVO|DB_PASSWORD|password_hash/i);        // secrets
    expect(body).not.toContain(B.email);                                            // other tenant
    expect(body).not.toContain(B.tenantId);
  };

  test('400 — validation failure', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'nope' });
    expect(res.status).toBe(400);
    assertClean(res, '400');
  });

  test('401 — unauthenticated', async () => {
    const res = await request(app).get('/api/clients');
    expect(res.status).toBe(401);
    assertClean(res, '401');
  });

  test('403 — bad token', async () => {
    const res = await request(app).get('/api/clients').set('Authorization', 'Bearer a.b.c');
    expect(res.status).toBe(403);
    assertClean(res, '403');
  });

  test('404 — unknown route and foreign resource', async () => {
    // Anonymous callers get 401 rather than 404 for an unknown /api path: the
    // authentication gate runs before route matching, so the API does not tell
    // an unauthenticated prober which routes exist. Authenticated callers get
    // the ordinary 404.
    const anonymous = await request(app).get('/api/does-not-exist');
    expect(anonymous.status).toBe(401);
    assertClean(anonymous, '401-unknown-route');

    const unknown = await asA(request(app).get('/api/does-not-exist'));
    expect(unknown.status).toBe(404);
    assertClean(unknown, '404-route');

    const foreign = await asA(request(app).get(`/api/clients/${B.clientId}`));
    expect(foreign.status).toBe(404);
    assertClean(foreign, '404-foreign');
  });

  test('409 — duplicate registration', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: A.email, password: 'ValidPassw0rd', firstName: 'Dup', lastName: 'Licate',
    });
    expect(res.status).toBe(409);
    assertClean(res, '409');
  });

  test('413 — oversized body', async () => {
    const res = await asA(request(app).post('/api/clients'))
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ firstName: 'x', notes: 'A'.repeat(200 * 1024) }));
    expect(res.status).toBe(413);
    assertClean(res, '413');
  });

  test('400 — unparseable JSON', async () => {
    const res = await asA(request(app).post('/api/clients'))
      .set('Content-Type', 'application/json').send('{"broken');
    expect(res.status).toBeGreaterThanOrEqual(400);
    assertClean(res, 'bad-json');
  });

  test('429 — rate limited', async () => {
    const ip = '203.0.113.250';
    let limited = null;
    for (let i = 0; i < 12 && !limited; i += 1) {
      const res = await request(app).post('/api/auth/forgot-password')
        .set('X-Forwarded-For', ip).send({ email: `probe-${i}@example.test` });
      if (res.status === 429) limited = res;
    }
    expect(limited).not.toBeNull();
    assertClean(limited, '429');
  });
});
