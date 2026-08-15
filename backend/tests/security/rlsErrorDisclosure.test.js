'use strict';

/**
 * An RLS failure must not describe the database to the caller (Phase 4, Step 9).
 *
 * Row-level security introduces two new error shapes that did not exist before:
 *
 *   42501  insufficient_privilege — a policy refused a write. The driver's
 *          message names the table and the operation.
 *   22P02  invalid_text_representation — historically raised by the OLD
 *          policies when the tenant setting was empty or malformed, because
 *          they cast it straight to uuid. Migration 029 removed that path, and
 *          this suite pins it closed.
 *
 * Either one reaching a caller verbatim would disclose schema, and the 42501
 * would additionally confirm that a row exists and belongs to someone else —
 * turning a denial into an existence oracle.
 *
 * The tests below check the two layers that decide what a caller sees: the
 * SQLSTATE classifier in utils/dbErrors.js, and the API's actual responses.
 *
 * This suite runs in both modes. What a caller is told must not depend on
 * whether policies happen to be enforced.
 */

const request = require('supertest');
const app = require('../../server');
const { createTenant, destroyTenant, pool } = require('../helpers/fixtures');
const { classifyDbError, sendDbClientError } = require('../../utils/dbErrors');

let A;
let B;

beforeAll(async () => {
  A = await createTenant('rlserr-a');
  B = await createTenant('rlserr-b');
}, 30000);

afterAll(async () => {
  await destroyTenant(A?.tenantId);
  await destroyTenant(B?.tenantId);
  await pool.end();
});

const asA = (req) => req.set('Authorization', `Bearer ${A.token}`);

/** Everything a response must never contain, whatever else it says. */
const assertNoInternals = (res) => {
  const body = JSON.stringify(res.body);

  // SQL and SQLSTATE
  expect(body).not.toMatch(/SELECT |INSERT INTO|UPDATE .* SET|DELETE FROM/i);
  expect(body).not.toContain('42501');
  expect(body).not.toContain('22P02');
  expect(body).not.toContain('42704');
  expect(body).not.toMatch(/row-level security/i);
  expect(body).not.toMatch(/violates .* policy/i);

  // Schema and policy identifiers
  expect(body).not.toMatch(/rls_tenant_/);
  expect(body).not.toMatch(/rls_user_/);
  expect(body).not.toMatch(/app_current_tenant_id/);
  expect(body).not.toMatch(/pg_catalog|pg_policies|information_schema/);

  // Roles and credentials
  if (process.env.DB_USER) expect(body).not.toContain(process.env.DB_USER);
  if (process.env.DB_NAME) expect(body).not.toContain(process.env.DB_NAME);
  expect(body).not.toMatch(/password/i);

  // Filesystem and stack traces
  expect(body).not.toMatch(/[A-Za-z]:\\\\|\/home\/|\/var\/|node_modules/);
  expect(body).not.toMatch(/\bat [\w.]+ \(/);
};

describe('the SQLSTATE classifier treats a policy denial as a server fault', () => {
  test('42501 is deliberately not mapped to a client error', () => {
    // Mapping it to 403 would answer "this exists and is not yours", which is
    // precisely the distinction the boundary exists to hide. It is also, by
    // definition, a bug: the application-level filter should have refused the
    // request long before the policy had to.
    expect(classifyDbError({ code: '42501', message: 'new row violates row-level security policy for table "clients"' }))
      .toBeNull();
  });

  test('a policy denial therefore produces no client-facing body of its own', () => {
    const sent = [];
    const res = {
      headersSent: false,
      status(code) { sent.push(code); return this; },
      json(body) { sent.push(body); return this; },
    };
    const handled = sendDbClientError(res, {
      code: '42501',
      message: 'new row violates row-level security policy for table "clients"',
    });
    expect(handled).toBe(false);
    expect(sent).toEqual([]);
  });

  test('22P02 is answered generically, without the driver\'s text', () => {
    const classified = classifyDbError({
      code: '22P02',
      message: 'invalid input syntax for type uuid: ""',
    });
    expect(classified).toEqual({ status: 400, error: 'A submitted value has an invalid format.' });
    expect(JSON.stringify(classified)).not.toContain('uuid');
  });

  test('an unrecognised-parameter error is not silently downgraded either', () => {
    // 42704 is what the pre-029 policies raised with no tenant context set.
    // It must remain a 500-class fault rather than being explained to a caller.
    expect(classifyDbError({ code: '42704', message: 'unrecognized configuration parameter "app.current_tenant_id"' }))
      .toBeNull();
  });
});

describe('API responses disclose nothing about the database boundary', () => {
  const productionEnv = () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    return () => { process.env.NODE_ENV = original; };
  };

  test.each([
    ['a foreign client', () => asA(request(app).get(`/api/clients/${B.clientId}`))],
    ['a foreign group', () => asA(request(app).get(`/api/groups/${B.groupId}`))],
    ['a foreign training', () => asA(request(app).get(`/api/trainings/${B.trainingId}`))],
    ['an update to a foreign client', () =>
      asA(request(app).put(`/api/clients/${B.clientId}`)).send({ firstName: 'x' })],
    ['a delete of a foreign client', () =>
      asA(request(app).delete(`/api/clients/${B.clientId}`))],
  ])('reading %s leaks no internals', async (_label, call) => {
    const res = await call();
    expect([400, 403, 404]).toContain(res.status);
    assertNoInternals(res);
  });

  test('a foreign resource is indistinguishable from a missing one', async () => {
    // The existence oracle: if a foreign id answered differently from an id
    // that does not exist, the boundary would leak by status code alone.
    const foreign = await asA(request(app).get(`/api/clients/${B.clientId}`));
    const absent = await asA(
      request(app).get('/api/clients/00000000-0000-4000-8000-000000000000')
    );
    expect(foreign.status).toBe(absent.status);
    expect(foreign.body).toEqual(absent.body);
  });

  test('a malformed id is a client error carrying no driver text', async () => {
    const res = await asA(request(app).get('/api/clients/not-a-uuid'));
    expect([400, 404]).toContain(res.status);
    assertNoInternals(res);
  });

  test('an empty-string id does not surface the uuid cast error', async () => {
    // The exact input that made the old policies raise 22P02.
    const res = await asA(request(app).get('/api/clients/%20'));
    expect(res.status).toBeGreaterThanOrEqual(400);
    assertNoInternals(res);
  });

  test('production responses stay generic for server faults', async () => {
    const restore = productionEnv();
    try {
      const res = await asA(request(app).get('/api/clients/not-a-uuid'));
      assertNoInternals(res);
      expect(JSON.stringify(res.body)).not.toContain('stack');
    } finally {
      restore();
    }
  });

  test('a cross-tenant write attempt answers without naming the policy', async () => {
    const res = await asA(request(app).post('/api/sessions')).send({
      clientId: B.clientId,
      sessionDate: '2030-01-01',
      startTime: '10:00',
      endTime: '11:00',
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    assertNoInternals(res);
  });
});

describe('server-side logs keep detail without keeping secrets', () => {
  test('a rejected input is logged with its SQLSTATE but not with credentials', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      sendDbClientError(
        { headersSent: false, status() { return this; }, json() { return this; } },
        { code: '22001', message: 'value too long for type character varying(100)' }
      );

      expect(warn).toHaveBeenCalled();
      const logged = warn.mock.calls.map((c) => c.join(' ')).join('\n');

      // Diagnostic detail is retained deliberately — that is the point of
      // logging it rather than returning it.
      expect(logged).toContain('22001');
      expect(logged).toContain('value too long');

      // But never a credential.
      if (process.env.DB_PASSWORD) expect(logged).not.toContain(process.env.DB_PASSWORD);
      if (process.env.JWT_SECRET) expect(logged).not.toContain(process.env.JWT_SECRET);
    } finally {
      warn.mockRestore();
    }
  });
});
