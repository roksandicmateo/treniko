'use strict';

/**
 * Platform administration (migration 033).
 *
 * The admin API is the only surface in TRENIKO that reads across tenants, so it
 * is the one place where a mistake exposes every customer at once. These tests
 * pin the properties that make it safe:
 *
 *   1. The two authentication realms cannot be crossed, in either direction.
 *   2. An admin request establishes NO tenant context, so RLS-protected
 *      business data returns nothing — enforced by PostgreSQL, not by care.
 *   3. Secrets never appear in a response.
 *   4. Roles are enforced, and read-only really is read-only.
 *   5. Every write lands in admin_audit_log.
 */

const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../../server');
const { createTenant, destroyTenant, pool, queryAs } = require('../helpers/fixtures');
const { describeWhenRlsEnforced, assertReallyEnforced } = require('../helpers/rlsEnvironment');

// Factory: returns `describe` under the restricted runtime role and
// `describe.skip` otherwise.
const describeRls = describeWhenRlsEnforced('platformAdmin');

jest.setTimeout(30000);

const MARKER = `admintest-${Date.now()}`;
const PASSWORD = 'AdminTestPassw0rd!';

let T;                    // a tenant with a trainer and a client
let owner, writer, reader, disabled;

/** Create a platform admin directly, the way the bootstrap script would. */
const makeAdmin = async (label, role, { isActive = true } = {}) => {
  const email = `${MARKER}-${label}@example.test`;
  const hash = await bcrypt.hash(PASSWORD, 4); // low cost: tests only
  const { rows } = await pool.query(
    `INSERT INTO platform_admins (email, password_hash, first_name, last_name, role, is_active)
     VALUES ($1, $2, 'Test', $3, $4, $5) RETURNING id, email, role`,
    [email, hash, label, role, isActive]
  );
  return rows[0];
};

/** Sign in through the real endpoint, so the token is one the API actually issues. */
const tokenFor = async (adminRow) => {
  const res = await request(app).post('/api/admin/auth/login')
    .send({ email: adminRow.email, password: PASSWORD });
  expect(res.status).toBe(200);
  return res.body.token;
};

const asAdmin = (token) => (req) => req.set('Authorization', `Bearer ${token}`);

let ownerTok, writerTok, readerTok;

beforeAll(async () => {
  T = await createTenant('admin');
  owner    = await makeAdmin('owner',  'owner');
  writer   = await makeAdmin('writer', 'admin');
  reader   = await makeAdmin('reader', 'viewer');
  disabled = await makeAdmin('off',    'admin', { isActive: false });

  ownerTok  = await tokenFor(owner);
  writerTok = await tokenFor(writer);
  readerTok = await tokenFor(reader);
});

afterAll(async () => {
  await pool.query('DELETE FROM admin_audit_log WHERE admin_email LIKE $1', [`${MARKER}%`]);
  await pool.query('DELETE FROM platform_admins WHERE email LIKE $1', [`${MARKER}%`]);
  await destroyTenant(T?.tenantId);
  await pool.end();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the two authentication realms cannot be crossed', () => {
  test('a trainer token is refused by the admin API', async () => {
    const res = await request(app).get('/api/admin/overview')
      .set('Authorization', `Bearer ${T.token}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/not valid for the administration API/i);
  });

  test('an admin token is refused by the trainer API', async () => {
    // The trainer gate resolves payload.userId against `users`. An admin token
    // carries adminId instead, so the lookup matches nothing and the request is
    // rejected rather than waved through with an undefined user.
    const res = await request(app).get('/api/clients')
      .set('Authorization', `Bearer ${ownerTok}`);

    expect([401, 403]).toContain(res.status);
  });

  test('an admin token cannot create a client in any tenant', async () => {
    const res = await request(app).post('/api/clients')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ firstName: 'Should', lastName: 'NotExist' });

    expect([401, 403]).toContain(res.status);

    const leaked = await queryAs(T,
      "SELECT id FROM clients WHERE first_name = 'Should' AND last_name = 'NotExist'");
    expect(leaked.rows).toHaveLength(0);
  });

  test('no token at all is refused', async () => {
    const res = await request(app).get('/api/admin/tenants');
    expect(res.status).toBe(401);
  });

  test('a garbage token is refused', async () => {
    const res = await request(app).get('/api/admin/tenants')
      .set('Authorization', 'Bearer not.a.real.token');
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('tenant business data stays out of reach', () => {
  test('the admin API exposes no route that returns client rows', async () => {
    // The tenant genuinely has a client — the fixture created one.
    const { rows } = await queryAs(T, 'SELECT id FROM clients WHERE tenant_id = $1', [T.tenantId]);
    expect(rows.length).toBeGreaterThan(0);

    const res = await asAdmin(ownerTok)(request(app).get(`/api/admin/tenants/${T.tenantId}`));
    expect(res.status).toBe(200);

    const body = JSON.stringify(res.body);
    // The client's id must not appear anywhere in the tenant detail payload.
    expect(body).not.toContain(rows[0].id);
    expect(res.body.businessDataAccess).toMatch(/none/i);
  });

  test('an admin request carries no tenant context', async () => {
    // Admin routes are mounted above the tenant-context middleware in
    // server.js, so app.current_tenant_id is never set for them.
    const { rows } = await pool.query(
      "SELECT current_setting('app.current_tenant_id', true) AS ctx");
    expect(rows[0].ctx === null || rows[0].ctx === '').toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The claim above — "platform staff cannot read tenant business data" — is only
// TRUE when policies are actually applied, which happens under the non-owner
// runtime role and not under the table owner. Asserting it in owner mode would
// assert something false, so this block runs only in the restricted suite
// (npm run test:restricted). See helpers/rlsEnvironment.js.
describeRls('with RLS in force, admin queries are denied tenant data', () => {
  test('the environment really is enforcing policies', async () => {
    await assertReallyEnforced();
  });

  test('reading a protected table without a tenant context returns nothing', async () => {
    // The rows exist: the fixture created a client, readable with context.
    const withContext = await queryAs(T,
      'SELECT COUNT(*)::int AS n FROM clients WHERE tenant_id = $1', [T.tenantId]);
    expect(withContext.rows[0].n).toBeGreaterThan(0);

    // The same read, in the state an admin request is in — no context at all.
    // PostgreSQL denies it. This is the mechanism the admin API relies on, and
    // it is the database enforcing it, not the application remembering to.
    const withoutContext = await pool.query('SELECT COUNT(*)::int AS n FROM clients');
    expect(withoutContext.rows[0].n).toBe(0);
  });

  test('every RLS-protected business table is empty without a context', async () => {
    for (const table of ['clients', 'training_sessions', 'client_payments', 'training_logs', 'progress_entries']) {
      const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM ${table}`);
      expect({ table, n: rows[0].n }).toEqual({ table, n: 0 });
    }
  });

  test('an administrator still reads the tenant-neutral tables they need', async () => {
    // The other half of the property: default-deny must not have taken away
    // the data the admin API legitimately exists to show.
    for (const table of ['tenants', 'users', 'tenant_subscriptions', 'subscription_usage']) {
      const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM ${table}`);
      expect({ table, hasRows: rows[0].n > 0 }).toEqual({ table, hasRows: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('secrets never leave the server', () => {
  const forbidden = /password_hash|verification_token|token_hash/i;

  test('tenant detail carries no trainer secrets', async () => {
    const res = await asAdmin(ownerTok)(request(app).get(`/api/admin/tenants/${T.tenantId}`));
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(forbidden);
  });

  test('trainer list and detail carry no secrets', async () => {
    const list = await asAdmin(ownerTok)(request(app).get('/api/admin/trainers'));
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toMatch(forbidden);

    const detail = await asAdmin(ownerTok)(request(app).get(`/api/admin/trainers/${T.userId}`));
    expect(detail.status).toBe(200);
    expect(JSON.stringify(detail.body)).not.toMatch(forbidden);
    expect(detail.body.trainer.password_hash).toBeUndefined();
  });

  test('the administrator list carries no password hashes', async () => {
    const res = await asAdmin(ownerTok)(request(app).get('/api/admin/admins'));
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(forbidden);
  });

  test('login never returns a hash', async () => {
    const res = await request(app).post('/api/admin/auth/login')
      .send({ email: owner.email, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(forbidden);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('roles are enforced', () => {
  test('a viewer can read', async () => {
    const res = await asAdmin(readerTok)(request(app).get('/api/admin/overview'));
    expect(res.status).toBe(200);
    expect(res.body.overview.tenants.total).toBeGreaterThan(0);
  });

  test('a viewer cannot update a tenant', async () => {
    const res = await asAdmin(readerTok)(request(app).patch(`/api/admin/tenants/${T.tenantId}`))
      .send({ name: 'viewer should not manage this' });

    expect(res.status).toBe(403);
    expect(res.body.requiredRole).toBe('admin');

    const { rows } = await pool.query('SELECT name FROM tenants WHERE id = $1', [T.tenantId]);
    expect(rows[0].name).not.toBe('viewer should not manage this');
  });

  test('a viewer cannot change a subscription', async () => {
    const res = await asAdmin(readerTok)(request(app).patch(`/api/admin/tenants/${T.tenantId}/subscription`))
      .send({ planName: 'enterprise' });
    expect(res.status).toBe(403);
  });

  test('an admin cannot manage administrators — owner only', async () => {
    const res = await asAdmin(writerTok)(request(app).get('/api/admin/admins'));
    expect(res.status).toBe(403);
    expect(res.body.requiredRole).toBe('owner');
  });

  test('a deactivated administrator cannot sign in', async () => {
    const res = await request(app).post('/api/admin/auth/login')
      .send({ email: disabled.email, password: PASSWORD });
    expect(res.status).toBe(403);
  });

  test('deactivating an administrator invalidates their existing session', async () => {
    const temp = await makeAdmin('temp', 'admin');
    const tok = await tokenFor(temp);

    expect((await asAdmin(tok)(request(app).get('/api/admin/overview'))).status).toBe(200);

    await asAdmin(ownerTok)(request(app).patch(`/api/admin/admins/${temp.id}`)).send({ isActive: false });

    // The role and activation are read from the database on every request, so
    // the still-unexpired token stops working immediately.
    const after = await asAdmin(tok)(request(app).get('/api/admin/overview'));
    expect(after.status).toBe(403);
  });

  test('an owner cannot deactivate or demote themselves', async () => {
    const res = await asAdmin(ownerTok)(request(app).patch(`/api/admin/admins/${owner.id}`))
      .send({ isActive: false });
    expect(res.status).toBe(400);

    const { rows } = await pool.query('SELECT is_active, role FROM platform_admins WHERE id = $1', [owner.id]);
    expect(rows[0].is_active).toBe(true);
    expect(rows[0].role).toBe('owner');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('reading the platform', () => {
  test('the overview counts real things', async () => {
    const res = await asAdmin(ownerTok)(request(app).get('/api/admin/overview'));
    expect(res.status).toBe(200);
    const o = res.body.overview;
    expect(o.tenants.total).toBeGreaterThan(0);
    expect(o.trainers.total).toBeGreaterThan(0);
    expect(Array.isArray(o.subscriptions)).toBe(true);
    expect(o.usage).toHaveProperty('clients_total');
  });

  test('the acquisition panel reports signups, and is honest about what it cannot', async () => {
    const res = await asAdmin(ownerTok)(request(app).get('/api/admin/overview'));
    expect(res.status).toBe(200);
    const a = res.body.overview.acquisition;

    // Counts of accounts, not of visits.
    expect(a.tenants_total).toBeGreaterThan(0);
    expect(a.attributed + a.direct_or_unknown).toBe(a.tenants_total);
    expect(Array.isArray(a.bySource)).toBe(true);

    // Migration 035 supplies the denominator.
    expect(typeof a.views.views_total).toBe('number');
    expect(Array.isArray(a.views.byChannel)).toBe(true);

    // What still genuinely cannot be produced is named, with a reason, rather
    // than omitted - an absent metric reads as a zero, and a zero here would
    // be a lie. Landing-page visits left this list when they became real; the
    // rest must not leave it by starting to emit a number from somewhere else.
    expect(a.notMeasured.landingPageVisits).toBeUndefined();
    expect(a.notMeasured.uniqueVisitors).toMatch(/identifier/i);
    expect(a.notMeasured.trialToPaidConversion).toMatch(/no payment processor/i);
  });

  test('the overview exposes no tenant business data, only campaign labels', async () => {
    const res = await asAdmin(ownerTok)(request(app).get('/api/admin/overview'));
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);

    // The admin API deliberately establishes no tenant context, so the
    // RLS-protected tables return nothing. This asserts the acquisition work
    // did not quietly open a path to them.
    for (const forbidden of [
      'password_hash', 'verification_token', 'date_of_birth',
      'health', 'medical', 'phone_number',
    ]) {
      expect(body.toLowerCase()).not.toContain(forbidden);
    }

    // Attribution fields are campaign labels and must be the only new strings.
    for (const row of res.body.overview.acquisition.bySource) {
      expect(Object.keys(row).sort()).toEqual(
        ['most_recent', 'signups', 'utm_campaign', 'utm_content', 'utm_source'].sort()
      );
    }
    // The page-view side carries campaign labels and counts, nothing else.
    for (const row of res.body.overview.acquisition.views.byChannel) {
      expect(Object.keys(row).sort()).toEqual(
        ['signups', 'utm_campaign', 'utm_source', 'views'].sort()
      );
    }
  });

  test('tenants can be listed, searched and paged', async () => {
    const res = await asAdmin(ownerTok)(request(app).get('/api/admin/tenants?pageSize=5'));
    expect(res.status).toBe(200);
    expect(res.body.tenants.length).toBeLessThanOrEqual(5);
    expect(res.body.total).toBeGreaterThan(0);

    const found = await asAdmin(ownerTok)(
      request(app).get(`/api/admin/tenants?search=${encodeURIComponent('sec2a-test')}`));
    expect(found.status).toBe(200);
    expect(found.body.tenants.length).toBeGreaterThan(0);
  });

  test('pageSize is bounded — a caller cannot ask for everything', async () => {
    const res = await asAdmin(ownerTok)(request(app).get('/api/admin/tenants?pageSize=100000'));
    expect(res.status).toBe(200);
    expect(res.body.pageSize).toBeLessThanOrEqual(100);
  });

  test('trainers can be filtered by tenant', async () => {
    const res = await asAdmin(ownerTok)(request(app).get(`/api/admin/trainers?tenantId=${T.tenantId}`));
    expect(res.status).toBe(200);
    expect(res.body.trainers.length).toBeGreaterThan(0);
    for (const t of res.body.trainers) expect(t.tenant_id).toBe(T.tenantId);
  });

  test('a malformed uuid answers 404, not 500', async () => {
    const res = await asAdmin(ownerTok)(request(app).get('/api/admin/tenants/not-a-uuid'));
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('injection cannot reach the query layer', () => {
  // An unauthenticated injection attempt is refused by the auth gate before any
  // SQL runs, which proves nothing about the queries themselves. These run as a
  // FULLY AUTHENTICATED administrator, so the payload genuinely reaches
  // listTrainers/listTenants/listAuditLog and is handled by the parameterised
  // query rather than by the middleware.
  const PAYLOADS = [
    "' OR 1=1--",
    "'; DROP TABLE users;--",
    "%' UNION SELECT NULL,NULL,NULL--",
    "\'; SELECT pg_sleep(5);--",
    "' OR ''='",
  ];

  test('a payload in ?search is treated as a literal string, not SQL', async () => {
    for (const payload of PAYLOADS) {
      const res = await asAdmin(ownerTok)(
        request(app).get('/api/admin/trainers').query({ search: payload }));

      // 200 with zero matches is the correct outcome: it was used as a search
      // term. A 500 would mean it reached the parser.
      expect({ payload, status: res.status }).toEqual({ payload, status: 200 });
      expect(Array.isArray(res.body.trainers)).toBe(true);
      // "' OR 1=1--" must NOT behave like a tautology and return everybody.
      expect(res.body.trainers.length).toBe(0);
    }
  });

  test('the same payloads are inert on the tenant search', async () => {
    for (const payload of PAYLOADS) {
      const res = await asAdmin(ownerTok)(
        request(app).get('/api/admin/tenants').query({ search: payload }));
      expect({ payload, status: res.status }).toEqual({ payload, status: 200 });
      expect(res.body.tenants.length).toBe(0);
    }
  });

  test('the tables are all still there afterwards', async () => {
    const { rows } = await pool.query(`
      SELECT to_regclass('public.users')            IS NOT NULL AS users,
             to_regclass('public.tenants')          IS NOT NULL AS tenants,
             to_regclass('public.platform_admins')  IS NOT NULL AS admins`);
    expect(rows[0]).toEqual({ users: true, tenants: true, admins: true });
  });

  test('a non-numeric page or pageSize falls back instead of reaching SQL', async () => {
    const res = await asAdmin(ownerTok)(
      request(app).get('/api/admin/trainers').query({ page: "1; DROP TABLE users", pageSize: "'; --" }));

    expect(res.status).toBe(200);
    // parseBoundedInt returns the fallback for anything unparseable.
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBeLessThanOrEqual(100);
  });

  test('a malformed uuid in a filter is rejected as validation, not passed to postgres', async () => {
    const res = await asAdmin(ownerTok)(
      request(app).get('/api/admin/trainers').query({ tenantId: "1' OR '1'='1" }));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  test('a payload in the audit filters is inert too', async () => {
    const res = await asAdmin(ownerTok)(
      request(app).get('/api/admin/audit').query({ entityType: "' OR 1=1--" }));
    expect(res.status).toBe(200);
    expect(res.body.entries.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('writing, and the audit trail', () => {
  const auditFor = async (action, entityId) => {
    const { rows } = await pool.query(
      `SELECT * FROM admin_audit_log
        WHERE action = $1 AND entity_id = $2 ORDER BY created_at DESC LIMIT 1`,
      [action, entityId]);
    return rows[0];
  };

  test('an admin can rename a tenant, and it is audited with the before state', async () => {
    const original = (await pool.query('SELECT name FROM tenants WHERE id = $1', [T.tenantId])).rows[0].name;
    const renamed = `${original} (renamed)`;

    const res = await asAdmin(writerTok)(request(app).patch(`/api/admin/tenants/${T.tenantId}`))
      .send({ name: renamed });

    expect(res.status).toBe(200);
    expect(res.body.tenant.name).toBe(renamed);

    const entry = await auditFor('tenant_updated', T.tenantId);
    expect(entry).toBeDefined();
    expect(entry.admin_email).toBe(writer.email);
    expect(entry.changes.before.name).toBe(original);
    expect(entry.changes.after.name).toBe(renamed);

    await pool.query('UPDATE tenants SET name = $1 WHERE id = $2', [original, T.tenantId]);
  });

  test('an empty tenant name is refused', async () => {
    const res = await asAdmin(writerTok)(request(app).patch(`/api/admin/tenants/${T.tenantId}`))
      .send({ name: '   ' });
    expect(res.status).toBe(400);
  });

  test('a trainer profile can be updated and is audited', async () => {
    const res = await asAdmin(writerTok)(request(app).patch(`/api/admin/trainers/${T.userId}`))
      .send({ city: 'Zagreb', country: 'Croatia' });

    expect(res.status).toBe(200);
    expect(res.body.trainer.city).toBe('Zagreb');

    const entry = await auditFor('trainer_updated', T.userId);
    expect(entry).toBeDefined();
    expect(entry.changes.after.city).toBe('Zagreb');
    expect(entry.tenant_id).toBe(T.tenantId);
  });

  test('an administrator cannot change a trainer email or password', async () => {
    const emailAttempt = await asAdmin(writerTok)(request(app).patch(`/api/admin/trainers/${T.userId}`))
      .send({ email: 'attacker@example.test' });
    expect(emailAttempt.status).toBe(400);

    const pwAttempt = await asAdmin(writerTok)(request(app).patch(`/api/admin/trainers/${T.userId}`))
      .send({ password: 'NewPassw0rd!' });
    expect(pwAttempt.status).toBe(400);

    const { rows } = await pool.query('SELECT email FROM users WHERE id = $1', [T.userId]);
    expect(rows[0].email).not.toBe('attacker@example.test');
  });

  test('fields outside the whitelist are ignored, not applied', async () => {
    const res = await asAdmin(writerTok)(request(app).patch(`/api/admin/trainers/${T.userId}`))
      .send({ city: 'Split', tenant_id: '00000000-0000-0000-0000-000000000000', email_verified: true });

    expect(res.status).toBe(200);
    const { rows } = await pool.query('SELECT tenant_id FROM users WHERE id = $1', [T.userId]);
    expect(rows[0].tenant_id).toBe(T.tenantId); // not moved to another tenant
  });

  test('a locked trainer can be unlocked, and it is audited', async () => {
    await pool.query(
      "UPDATE users SET failed_login_attempts = 5, locked_until = NOW() + INTERVAL '15 minutes' WHERE id = $1",
      [T.userId]);

    const res = await asAdmin(writerTok)(request(app).post(`/api/admin/trainers/${T.userId}/unlock`));
    expect(res.status).toBe(200);
    expect(res.body.trainer.locked_until).toBeNull();

    const entry = await auditFor('trainer_unlocked', T.userId);
    expect(entry).toBeDefined();
  });

  test('a subscription can be changed by staff, and it is audited with the before state', async () => {
    const before = await pool.query(
      `SELECT sp.name FROM tenant_subscriptions ts JOIN subscription_plans sp ON sp.id = ts.plan_id
        WHERE ts.tenant_id = $1`, [T.tenantId]);
    expect(before.rows[0].name).toBe('free');

    const res = await asAdmin(writerTok)(request(app).patch(`/api/admin/tenants/${T.tenantId}/subscription`))
      .send({ planName: 'pro' });

    expect(res.status).toBe(200);
    expect(res.body.subscription.plan_name).toBe('pro');

    const entry = await auditFor('subscription_updated', T.tenantId);
    expect(entry).toBeDefined();
    expect(entry.changes.before.plan_name).toBe('free');
    expect(entry.changes.after.planName).toBe('pro');

    await asAdmin(writerTok)(request(app).patch(`/api/admin/tenants/${T.tenantId}/subscription`))
      .send({ planName: 'free' });
  });

  test('an unknown plan is refused', async () => {
    const res = await asAdmin(writerTok)(request(app).patch(`/api/admin/tenants/${T.tenantId}/subscription`))
      .send({ planName: 'unlimited-free-forever' });
    expect(res.status).toBe(400);
  });

  test('an invalid subscription status is refused', async () => {
    const res = await asAdmin(writerTok)(request(app).patch(`/api/admin/tenants/${T.tenantId}/subscription`))
      .send({ status: 'whatever' });
    expect(res.status).toBe(400);
  });

  test('the audit log is readable and filterable', async () => {
    const res = await asAdmin(ownerTok)(request(app).get(`/api/admin/audit?tenantId=${T.tenantId}`));
    expect(res.status).toBe(200);
    expect(res.body.entries.length).toBeGreaterThan(0);
    for (const e of res.body.entries) expect(e.tenant_id).toBe(T.tenantId);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('administrator management', () => {
  test('an owner can create an administrator, and the password is not echoed', async () => {
    const email = `${MARKER}-created@example.test`;
    const res = await asAdmin(ownerTok)(request(app).post('/api/admin/admins'))
      .send({ email, password: 'CreatedAdm1n!', firstName: 'New', lastName: 'Admin', role: 'viewer' });

    expect(res.status).toBe(201);
    expect(res.body.admin.email).toBe(email);
    expect(res.body.admin.role).toBe('viewer');
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  test('a duplicate administrator email is refused', async () => {
    const res = await asAdmin(ownerTok)(request(app).post('/api/admin/admins'))
      .send({ email: owner.email, password: 'CreatedAdm1n!', firstName: 'Dup', lastName: 'Admin' });
    expect(res.status).toBe(409);
  });

  test('a weak administrator password is refused', async () => {
    const res = await asAdmin(ownerTok)(request(app).post('/api/admin/admins'))
      .send({ email: `${MARKER}-weak@example.test`, password: 'x', firstName: 'W', lastName: 'K' });
    expect(res.status).toBe(400);
  });

  test('an unknown role is refused', async () => {
    const res = await asAdmin(ownerTok)(request(app).post('/api/admin/admins'))
      .send({ email: `${MARKER}-role@example.test`, password: 'CreatedAdm1n!', firstName: 'R', lastName: 'K', role: 'superuser' });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('login hardening', () => {
  test('a wrong password is refused with a generic message', async () => {
    const res = await request(app).post('/api/admin/auth/login')
      .send({ email: owner.email, password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  test('an unknown address gets the same generic message', async () => {
    const res = await request(app).post('/api/admin/auth/login')
      .send({ email: 'nobody-here@example.test', password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  test('missing credentials are refused', async () => {
    const res = await request(app).post('/api/admin/auth/login').send({});
    expect(res.status).toBe(400);
  });

  test('an unknown address costs the same work as a known one', async () => {
    // The generic message above is worthless if the response TIME still says
    // whether the address exists. login() compares against a decoy hash when
    // there is no account, and the decoy has to be a syntactically valid
    // cost-12 bcrypt hash: an earlier version used filler of the wrong length,
    // which bcrypt rejected on sight, returning in ~0 ms against ~240 ms for a
    // real account. That is the oracle this test exists to catch.
    //
    // Asserted as a floor on the unknown-address path rather than as a ratio,
    // because wall-clock ratios are flaky under load while "did it do any
    // bcrypt work at all" is not: a malformed decoy returns in single-digit ms.
    const started = Date.now();
    const res = await request(app).post('/api/admin/auth/login')
      .send({ email: 'definitely-not-registered@example.test', password: 'whatever' });
    const elapsed = Date.now() - started;

    expect(res.status).toBe(401);
    expect(elapsed).toBeGreaterThan(50);
  });

  test('/auth/me reflects the database role, not the token', async () => {
    const res = await asAdmin(readerTok)(request(app).get('/api/admin/auth/me'));
    expect(res.status).toBe(200);
    expect(res.body.admin.role).toBe('viewer');
    expect(res.body.admin.id).toBe(reader.id);
  });
});
