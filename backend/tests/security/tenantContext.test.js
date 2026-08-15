'use strict';

/**
 * Tenant context for Row Level Security (Phase 2B, TR-MED-8).
 *
 * `queryWithTenant` set `app.current_tenant_id` with SET LOCAL semantics in its
 * own standalone statement. Outside an explicit transaction PostgreSQL wraps
 * each statement in an implicit one, so the setting was discarded before the
 * query it was meant for ever ran — the tenant context never arrived.
 *
 * These tests pin the corrected behaviour, and equally importantly pin what it
 * does NOT claim: RLS is still not an enforcement layer here (the application
 * connects as the tables' owner and no table declares FORCE ROW LEVEL
 * SECURITY), so the last test documents the real enforcement layer — the
 * explicit `WHERE tenant_id = $n` in application code — still holding.
 */

const request = require('supertest');
const app = require('../../server');
const { queryWithTenant, pool } = require('../../config/database');
const { createTenant, destroyTenant } = require('../helpers/fixtures');

jest.setTimeout(30000);

let A;
let B;

beforeAll(async () => {
  A = await createTenant('a');
  B = await createTenant('b');
});

afterAll(async () => {
  await destroyTenant(A?.tenantId);
  await destroyTenant(B?.tenantId);
  await pool.end();
});

describe('TR-MED-8: the tenant setting actually reaches the query', () => {
  test('the query can read back the tenant id it was given', async () => {
    const { rows } = await queryWithTenant(
      "SELECT current_setting('app.current_tenant_id', true) AS tenant",
      [],
      A.tenantId
    );
    // Before the fix this was an empty string on every call.
    expect(rows[0].tenant).toBe(A.tenantId);
  });

  test('two calls do not see each other tenant context', async () => {
    const a = await queryWithTenant(
      "SELECT current_setting('app.current_tenant_id', true) AS tenant", [], A.tenantId);
    const b = await queryWithTenant(
      "SELECT current_setting('app.current_tenant_id', true) AS tenant", [], B.tenantId);

    expect(a.rows[0].tenant).toBe(A.tenantId);
    expect(b.rows[0].tenant).toBe(B.tenantId);
  });

  test('the context does not leak onto a later query on the same pooled connection', async () => {
    await queryWithTenant('SELECT 1', [], A.tenantId);
    const { rows } = await pool.query(
      "SELECT current_setting('app.current_tenant_id', true) AS tenant"
    );
    // SET LOCAL is released with the transaction, so the next borrower of this
    // connection starts with no tenant context rather than inheriting A's.
    expect(rows[0].tenant === '' || rows[0].tenant === null).toBe(true);
  });

  test('a failing query rolls back and still propagates the error', async () => {
    await expect(
      queryWithTenant('SELECT * FROM a_table_that_does_not_exist', [], A.tenantId)
    ).rejects.toThrow();

    // The connection must be usable immediately afterwards — i.e. it was
    // rolled back and released, not left inside an aborted transaction.
    const { rows } = await queryWithTenant('SELECT 1 AS ok', [], A.tenantId);
    expect(rows[0].ok).toBe(1);
  });

  test('calls without a tenant id still work (unchanged behaviour)', async () => {
    const { rows } = await queryWithTenant('SELECT 1 AS ok', [], null);
    expect(rows[0].ok).toBe(1);
  });

  test('rows and row counts are returned exactly as before', async () => {
    const { rows, rowCount } = await queryWithTenant(
      'SELECT id FROM clients WHERE tenant_id = $1', [A.tenantId], A.tenantId
    );
    expect(rowCount).toBe(1);
    expect(rows[0].id).toBe(A.clientId);
  });
});

describe('the application-layer tenant filter is what actually isolates tenants', () => {
  test('controllers that use queryWithTenant still refuse cross-tenant reads', async () => {
    const res = await request(app)
      .get(`/api/clients/${B.clientId}`)
      .set('Authorization', `Bearer ${A.token}`);

    expect(res.status).toBe(404);
  });

  test('and still return the caller own records', async () => {
    const res = await request(app)
      .get(`/api/clients/${A.clientId}`)
      .set('Authorization', `Bearer ${A.token}`);

    expect(res.status).toBe(200);
    expect(res.body.client.id).toBe(A.clientId);
  });

  test('RLS is documented as inert rather than assumed protective', async () => {
    // This test exists to fail loudly if someone enables FORCE ROW LEVEL
    // SECURITY without also routing every query through a tenant-aware helper —
    // most of the codebase still calls pool.query directly, and those queries
    // would start being denied in production.
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS forced
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relforcerowsecurity`
    );
    expect(rows[0].forced).toBe(0);
  });
});
