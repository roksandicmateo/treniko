'use strict';

/**
 * Direct SQL attacks against the database boundary (Phase 4, Step 7).
 *
 * Every other suite in this project attacks through the HTTP API, and so tests
 * the application's authorization. This one skips the application entirely: it
 * issues the SQL an attacker would issue if they had already achieved arbitrary
 * query execution — through an injection defect, or a controller that simply
 * forgot its `WHERE tenant_id = $n`.
 *
 * That is the scenario row-level security exists for. If these tests pass, a
 * missing tenant filter returns nothing instead of returning somebody else's
 * records; TR-CRIT-2 was exactly a missing tenant filter.
 *
 * Restricted-runtime only, for the reason in helpers/rlsEnvironment.js: as the
 * table owner every one of these statements legitimately succeeds.
 */

const { createTenant, destroyTenant, pool, asTenant } = require('../helpers/fixtures');
const { createExercise, createSession, createPackageWithPayment } = require('../helpers/phase2bFixtures');
const { describeWhenRlsEnforced, assertReallyEnforced } = require('../helpers/rlsEnvironment');

const describeRls = describeWhenRlsEnforced('rlsAttackMatrix');

let A;
let B;
let sessionB;
let exerciseB;
let packagesB;

beforeAll(async () => {
  A = await createTenant('rlsatk-a');
  B = await createTenant('rlsatk-b');
  sessionB = await createSession(B.tenantId, B.clientId);
  exerciseB = await createExercise(B.tenantId, 'Victim Lift');
  packagesB = await createPackageWithPayment(B.tenantId, B.clientId);
}, 30000);

afterAll(async () => {
  await destroyTenant(A?.tenantId);
  await destroyTenant(B?.tenantId);
  await pool.end();
});

/** Run raw SQL under A's tenant context — the attacker's own, legitimate identity. */
const asAttacker = (text, params) => asTenant(A, () => pool.query(text, params));

/** Run raw SQL with no tenant context at all, as a background job would. */
const withNoContext = (text, params) => pool.query(text, params);

describeRls('direct SQL: a query missing its tenant filter returns nothing', () => {
  test('the guard is honest: policies really are in force', async () => {
    expect((await assertReallyEnforced()).enforced).toBe(true);
  });

  // ── SELECT ────────────────────────────────────────────────────────────────
  test('SELECT of a foreign row by primary key returns no rows', async () => {
    const { rows } = await asAttacker('SELECT id, first_name FROM clients WHERE id = $1', [
      B.clientId,
    ]);
    expect(rows).toEqual([]);
  });

  test('an unfiltered SELECT over the whole table never includes a foreign row', async () => {
    // The exact shape of the TR-CRIT-2 defect: no WHERE clause at all.
    const { rows } = await asAttacker('SELECT tenant_id FROM clients');
    expect(rows.length).toBeGreaterThan(0); // the attacker's own rows are visible
    for (const row of rows) expect(row.tenant_id).toBe(A.tenantId);
  });

  test('a JOIN cannot be used to reach a foreign row indirectly', async () => {
    const { rows } = await asAttacker(
      `SELECT c.id FROM clients c
         JOIN training_sessions s ON s.client_id = c.id
        WHERE c.id = $1`,
      [B.clientId]
    );
    expect(rows).toEqual([]);
  });

  test('an aggregate cannot count rows it cannot see', async () => {
    // Aggregates are a classic side channel: no row is returned, but a count
    // would still disclose that the tenant exists and how large it is.
    const { rows } = await asAttacker(
      'SELECT count(*)::int AS c FROM clients WHERE tenant_id = $1',
      [B.tenantId]
    );
    expect(rows[0].c).toBe(0);
  });

  // ── UPDATE ────────────────────────────────────────────────────────────────
  test('UPDATE of a foreign row affects no rows', async () => {
    const res = await asAttacker(
      "UPDATE clients SET first_name = 'Owned' WHERE id = $1",
      [B.clientId]
    );
    expect(res.rowCount).toBe(0);

    const { rows } = await asTenant(B, () =>
      pool.query('SELECT first_name FROM clients WHERE id = $1', [B.clientId])
    );
    expect(rows[0].first_name).toBe('Client');
  });

  test('an unfiltered UPDATE cannot reach beyond the caller\'s own rows', async () => {
    const res = await asAttacker("UPDATE clients SET notes = 'mass-update'");
    const { rows } = await asAttacker(
      'SELECT count(*)::int AS c FROM clients WHERE tenant_id = $1',
      [A.tenantId]
    );
    expect(res.rowCount).toBe(rows[0].c);

    const victim = await asTenant(B, () =>
      pool.query('SELECT notes FROM clients WHERE id = $1', [B.clientId])
    );
    expect(victim.rows[0].notes).not.toBe('mass-update');
  });

  // ── DELETE ────────────────────────────────────────────────────────────────
  test('DELETE of a foreign row affects no rows', async () => {
    const res = await asAttacker('DELETE FROM clients WHERE id = $1', [B.clientId]);
    expect(res.rowCount).toBe(0);

    const { rows } = await asTenant(B, () =>
      pool.query('SELECT id FROM clients WHERE id = $1', [B.clientId])
    );
    expect(rows).toHaveLength(1);
  });

  test('an unfiltered DELETE cannot empty another tenant', async () => {
    await asAttacker('DELETE FROM training_sessions');
    const { rows } = await asTenant(B, () =>
      pool.query('SELECT id FROM training_sessions WHERE id = $1', [sessionB.id])
    );
    expect(rows).toHaveLength(1);
  });

  // ── INSERT ────────────────────────────────────────────────────────────────
  test('INSERT stamped with a foreign tenant_id is refused', async () => {
    // WITH CHECK is what stops this. Without it, an attacker could plant rows
    // inside a victim's tenant — visible to the victim, written by the attacker.
    await expect(
      asAttacker(
        `INSERT INTO clients (tenant_id, first_name, last_name)
         VALUES ($1, 'Planted', 'Row')`,
        [B.tenantId]
      )
    ).rejects.toMatchObject({ code: '42501' });
  });

  test('INSERT with the caller\'s own tenant_id is allowed', async () => {
    // The control case. Without it, the test above could be passing because
    // inserts are broken rather than because the policy works.
    const { rows } = await asAttacker(
      `INSERT INTO clients (tenant_id, first_name, last_name)
       VALUES ($1, 'Legit', 'Row') RETURNING id`,
      [A.tenantId]
    );
    expect(rows).toHaveLength(1);
    await asAttacker('DELETE FROM clients WHERE id = $1', [rows[0].id]);
  });

  // ── Ownership transfer ────────────────────────────────────────────────────
  test('an existing row cannot be moved into another tenant', async () => {
    await expect(
      asAttacker('UPDATE clients SET tenant_id = $1 WHERE id = $2', [B.tenantId, A.clientId])
    ).rejects.toMatchObject({ code: '42501' });

    const { rows } = await asAttacker('SELECT tenant_id FROM clients WHERE id = $1', [A.clientId]);
    expect(rows[0].tenant_id).toBe(A.tenantId);
  });

  test('a foreign row cannot be pulled into the caller\'s tenant', async () => {
    // The mirror image: rewrite somebody else's row to claim it. USING hides
    // the row, so there is nothing to update.
    const res = await asAttacker('UPDATE clients SET tenant_id = $1 WHERE id = $2', [
      A.tenantId,
      B.clientId,
    ]);
    expect(res.rowCount).toBe(0);
  });
});

describeRls('direct SQL: indirect ownership is enforced through the parent', () => {
  test('a child row of a foreign parent is invisible', async () => {
    const { rows } = await asAttacker(
      'SELECT id FROM group_members WHERE group_id = $1',
      [B.groupId]
    );
    expect(rows).toEqual([]);
  });

  test('a child row cannot be attached to a foreign parent', async () => {
    await expect(
      asAttacker('INSERT INTO group_members (group_id, client_id) VALUES ($1, $2)', [
        B.groupId,
        A.clientId,
      ])
    ).rejects.toMatchObject({ code: '42501' });
  });

  test('a child row cannot be reassigned to a foreign parent', async () => {
    // Parent reassignment: the row is the caller's own, but the new parent is
    // not. WITH CHECK re-evaluates against the NEW row, so this is refused.
    const { rows: [own] } = await asAttacker(
      'SELECT id FROM group_members WHERE group_id = $1 LIMIT 1',
      [A.groupId]
    );
    expect(own).toBeDefined();

    await expect(
      asAttacker('UPDATE group_members SET group_id = $1 WHERE id = $2', [B.groupId, own.id])
    ).rejects.toMatchObject({ code: '42501' });
  });

  test('a two-level nested relationship is enforced at the top', async () => {
    // template_sets -> template_exercises -> training_templates.tenant_id.
    // Nothing on template_sets itself identifies a tenant; the policy has to
    // walk two joins to find out, and it must not be fooled by the intermediate
    // row belonging to the attacker.
    const { rows } = await asAttacker(
      `SELECT ts.id FROM template_sets ts
         JOIN template_exercises te ON te.id = ts.template_exercise_id
         JOIN training_templates tt ON tt.id = te.template_id
        WHERE tt.tenant_id = $1`,
      [B.tenantId]
    );
    expect(rows).toEqual([]);
  });

  test('a foreign exercise cannot be referenced from the caller\'s own training', async () => {
    const { rows } = await asAttacker('SELECT id FROM exercises WHERE id = $1', [exerciseB.id]);
    expect(rows).toEqual([]);
  });

  test('a foreign payment and its package are both invisible', async () => {
    const payment = await asAttacker('SELECT id FROM client_payments WHERE id = $1', [
      packagesB.paymentId,
    ]);
    expect(payment.rows).toEqual([]);

    const pkg = await asAttacker('SELECT id FROM client_packages WHERE id = $1', [
      packagesB.clientPackageId,
    ]);
    expect(pkg.rows).toEqual([]);
  });
});

describeRls('direct SQL: a broken or absent context denies rather than leaks', () => {
  test('no tenant context at all returns no rows', async () => {
    const { rows } = await withNoContext('SELECT id FROM clients');
    expect(rows).toEqual([]);
  });

  test('no tenant context cannot write either', async () => {
    await expect(
      withNoContext(
        `INSERT INTO clients (tenant_id, first_name, last_name)
         VALUES ($1, 'NoContext', 'Write')`,
        [A.tenantId]
      )
    ).rejects.toMatchObject({ code: '42501' });
  });

  test('an empty tenant context returns no rows', async () => {
    // The state a pooled connection reverts to after a transaction that set the
    // value ends: not "unset", but the empty string.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.current_tenant_id', '', true)");
      const { rows } = await client.query('SELECT id FROM clients');
      expect(rows).toEqual([]);
    } finally {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
    }
  });

  test('a malformed tenant context returns no rows instead of raising', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.current_tenant_id', 'not-a-uuid', true)");
      const { rows } = await client.query('SELECT id FROM clients');
      expect(rows).toEqual([]);
    } finally {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
    }
  });

  test('a nonexistent but well-formed tenant returns no rows', async () => {
    const { rows } = await asTenant(
      { tenantId: '00000000-0000-4000-8000-000000000000' },
      () => pool.query('SELECT id FROM clients')
    );
    expect(rows).toEqual([]);
  });

  test('the application layer refuses to build a context from a non-UUID', async () => {
    // Defence one step earlier: a malformed tenant id never reaches the
    // database, because tenantContext.js will not interpolate it.
    expect(() => asTenant({ tenantId: "' OR 1=1 --" }, async () => {})).toThrow(
      /non-UUID tenant id/
    );
  });

  test('a denial does not disclose PostgreSQL internals to the caller', async () => {
    // The message a denied write produces is seen by the application, not the
    // end user (utils/dbErrors.js decides what reaches the client), but it must
    // still not name the policy or the role.
    const err = await asAttacker(
      `INSERT INTO clients (tenant_id, first_name, last_name) VALUES ($1, 'x', 'y')`,
      [B.tenantId]
    ).catch((e) => e);

    expect(err).toBeDefined();
    expect(err.message).not.toContain(process.env.DB_USER);
    expect(err.message).not.toContain('rls_tenant_');
    expect(err.message).not.toContain(B.tenantId);
  });
});
