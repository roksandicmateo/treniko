'use strict';

/**
 * Background jobs under row-level security (Phase 4, Step 4).
 *
 * Cron work is the one place in this codebase that legitimately spans tenants,
 * and it runs from a timer, so there is no request and no ambient tenant
 * context. That combination is what makes it dangerous under RLS — not because
 * it errors, but because it does not:
 *
 *     DELETE FROM clients WHERE id = $1     -- no context
 *     -> rowCount 0, no error
 *
 * The deletion job then marked the request `completed`. A GDPR erasure recorded
 * as fulfilled, with the personal data still present, and nothing in the logs.
 *
 * jobs/deletionJob.js now resolves each request to its owning tenant and does
 * that request's work inside that tenant's context, so the deletes are subject
 * to the same policies as a controller's. These tests assert both halves: the
 * erasure really happens, and it cannot reach past the tenant it belongs to.
 *
 * This suite runs in BOTH modes. The job's correctness does not depend on
 * policies being enforced, and the "does the row actually go away" assertions
 * are exactly as meaningful against an owner connection.
 */

const { createTenant, destroyTenant, pool, asTenant, queryAs } = require('../helpers/fixtures');
const { executePendingDeletions } = require('../../jobs/deletionJob');

let A;
let B;

beforeAll(async () => {
  A = await createTenant('rlsjob-a');
  B = await createTenant('rlsjob-b');
}, 30000);

afterAll(async () => {
  await destroyTenant(A?.tenantId);
  await destroyTenant(B?.tenantId);
  await pool.end();
});

/** Seed a due deletion request. deletion_requests is outside the enforced set. */
const requestClientDeletion = async (tenant, clientId, { due = true } = {}) => {
  const { rows } = await pool.query(
    `INSERT INTO deletion_requests
       (trainer_id, target_type, target_id, status, scheduled_delete_at)
     VALUES ($1, 'client', $2, 'pending', NOW() ${due ? "- INTERVAL '1 day'" : "+ INTERVAL '30 days'"})
     RETURNING id`,
    [tenant.userId, clientId]
  );
  return rows[0].id;
};

const clientExists = async (tenant, clientId) => {
  const { rows } = await queryAs(tenant, 'SELECT id FROM clients WHERE id = $1', [clientId]);
  return rows.length === 1;
};

const requestStatus = async (id) => {
  const { rows } = await pool.query('SELECT status FROM deletion_requests WHERE id = $1', [id]);
  return rows[0] && rows[0].status;
};

/** A throwaway client inside a tenant, so the fixture's own client survives. */
const makeClient = async (tenant, name) => {
  const { rows } = await asTenant(tenant, () =>
    pool.query(
      `INSERT INTO clients (tenant_id, first_name, last_name)
       VALUES ($1, $2, 'Doomed') RETURNING id`,
      [tenant.tenantId, name]
    )
  );
  return rows[0].id;
};

describe('deletionJob: erasure actually happens under RLS', () => {
  test('a due client deletion removes the row and completes the request', async () => {
    const clientId = await makeClient(A, 'Erase');
    const requestId = await requestClientDeletion(A, clientId);

    const result = await executePendingDeletions();

    expect(await clientExists(A, clientId)).toBe(false);
    expect(await requestStatus(requestId)).toBe('completed');
    expect(result.processed).toBeGreaterThanOrEqual(1);
  });

  test('the job works for each of several tenants in the same run', async () => {
    // The job holds no single context; it adopts each tenant's in turn. If it
    // established one context for the whole run, the second tenant's delete
    // would silently do nothing.
    const clientA = await makeClient(A, 'MultiA');
    const clientB = await makeClient(B, 'MultiB');
    const reqA = await requestClientDeletion(A, clientA);
    const reqB = await requestClientDeletion(B, clientB);

    await executePendingDeletions();

    expect(await clientExists(A, clientA)).toBe(false);
    expect(await clientExists(B, clientB)).toBe(false);
    expect(await requestStatus(reqA)).toBe('completed');
    expect(await requestStatus(reqB)).toBe('completed');
  });

  test('a request that is not yet due is left alone', async () => {
    const clientId = await makeClient(A, 'NotYet');
    const requestId = await requestClientDeletion(A, clientId, { due: false });

    await executePendingDeletions();

    expect(await clientExists(A, clientId)).toBe(true);
    expect(await requestStatus(requestId)).toBe('pending');

    await pool.query('DELETE FROM deletion_requests WHERE id = $1', [requestId]);
    await asTenant(A, () => pool.query('DELETE FROM clients WHERE id = $1', [clientId]));
  });

  test('an erasure is recorded in the audit log', async () => {
    const clientId = await makeClient(A, 'Audited');
    await requestClientDeletion(A, clientId);

    await executePendingDeletions();

    const { rows } = await pool.query(
      `SELECT id FROM audit_log
        WHERE action = 'client_permanently_deleted' AND entity_id = $1`,
      [clientId]
    );
    expect(rows).toHaveLength(1);
  });
});

describe('deletionJob: a cross-tenant request cannot delete across the boundary', () => {
  test("a request naming another tenant's client deletes nothing and is not completed", async () => {
    // The forged request: trainer A asking for one of B's clients. The job
    // resolves the tenant from the TRAINER, not from the target, so the delete
    // runs under A's context and matches nothing.
    const victimId = await makeClient(B, 'Victim');
    const requestId = await requestClientDeletion(A, victimId);

    await executePendingDeletions();

    expect(await clientExists(B, victimId)).toBe(true);

    // Crucially, the request is NOT marked completed. Recording an erasure that
    // did not happen is the failure mode this whole rework exists to remove.
    expect(await requestStatus(requestId)).toBe('pending');

    await pool.query('DELETE FROM deletion_requests WHERE id = $1', [requestId]);
    await asTenant(B, () => pool.query('DELETE FROM clients WHERE id = $1', [victimId]));
  });

  test('a request for an already-deleted client is not recorded as completed', async () => {
    const clientId = await makeClient(A, 'Gone');
    await asTenant(A, () => pool.query('DELETE FROM clients WHERE id = $1', [clientId]));
    const requestId = await requestClientDeletion(A, clientId);

    await executePendingDeletions();

    expect(await requestStatus(requestId)).toBe('pending');
    await pool.query('DELETE FROM deletion_requests WHERE id = $1', [requestId]);
  });

  test('the job leaves other tenants untouched while working', async () => {
    const clientId = await makeClient(A, 'Scoped');
    await requestClientDeletion(A, clientId);

    // Scoped with an explicit tenant_id, not left to the policy to scope. This
    // suite runs in both modes, and under an owner connection an unfiltered
    // count would tally every tenant's rows — so the assertion would be about
    // the whole database rather than about tenant B. That is the same mistake
    // the policies exist to catch, and a test is not exempt from it.
    const countB = () =>
      queryAs(B, 'SELECT count(*)::int AS c FROM clients WHERE tenant_id = $1', [B.tenantId]);

    const before = await countB();
    await executePendingDeletions();
    const after = await countB();

    expect(after.rows[0].c).toBe(before.rows[0].c);
  });
});

describe('deletionJob: the job establishes no ambient context of its own', () => {
  test('no tenant context survives the job', async () => {
    // The job must not leave a context bound for whatever runs next in the
    // process — the cron file calls it on startup, before any request.
    const clientId = await makeClient(A, 'Residue');
    await requestClientDeletion(A, clientId);

    await executePendingDeletions();

    const { rows } = await pool.query('SELECT app_current_tenant_id() AS t');
    expect(rows[0].t).toBeNull();
  });

  test('the job reports what it did rather than reporting success blindly', async () => {
    const result = await executePendingDeletions();
    expect(result).toMatchObject({
      processed: expect.any(Number),
      failed: expect.any(Number),
      considered: expect.any(Number),
    });
  });
});

describe('deletionJob: account deletion erases the tenant, not just its contents', () => {
  // Live QA ran the supported account-deletion flow in production and then went
  // looking for what was left. The personal data was gone — and the `tenants`
  // row was still there, with its tenant_subscriptions and subscription_usage
  // rows attached. An account that had been deleted still existed as an account.
  //
  // These tests use their own throwaway tenants, because they assert that a
  // tenant row is GONE afterwards, and they check A and B in the same breath:
  // erasing one account must not disturb another.

  const requestAccountDeletion = async (trainerId) => {
    const { rows } = await pool.query(
      `INSERT INTO deletion_requests
         (trainer_id, target_type, target_id, status, scheduled_delete_at)
       VALUES ($1, 'account', NULL, 'pending', NOW() - INTERVAL '1 day')
       RETURNING id`,
      [trainerId]
    );
    return rows[0].id;
  };

  const countRows = async (table, tenantId) => {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS c FROM ${table} WHERE tenant_id = $1`, [tenantId]);
    return rows[0].c;
  };

  test('the tenant row and its subscription rows go with the account', async () => {
    const doomed = await createTenant('erase-me');

    // A session, so the usage triggers are actually exercised on the way out —
    // that ordering hazard is the one thing that can make this fail in
    // production and not in a fixture with no sessions.
    await asTenant(doomed, () => pool.query(
      `INSERT INTO training_sessions (tenant_id, client_id, session_date, start_time, end_time)
       VALUES ($1, $2, CURRENT_DATE, '08:00', '09:00')`,
      [doomed.tenantId, doomed.clientId]
    ));

    // The residue QA found: all three exist before the job runs.
    expect(await countRows('users', doomed.tenantId)).toBe(1);
    expect(await countRows('tenant_subscriptions', doomed.tenantId)).toBe(1);
    expect(await countRows('subscription_usage', doomed.tenantId)).toBe(1);

    await requestAccountDeletion(doomed.userId);
    const result = await executePendingDeletions();
    expect(result.processed).toBeGreaterThanOrEqual(1);

    const { rows: tenantRows } = await pool.query(
      'SELECT id FROM tenants WHERE id = $1', [doomed.tenantId]);
    expect(tenantRows).toHaveLength(0);

    // Everything that hangs off the tenant went with it.
    for (const table of [
      'users', 'clients', 'training_sessions', 'trainings',
      'groups', 'group_sessions', 'tenant_subscriptions', 'subscription_usage',
    ]) {
      expect(await countRows(table, doomed.tenantId)).toBe(0);
    }

    // The audit row survives the tenant by design (it is the record that the
    // erasure happened); remove this test's own so repeated runs do not
    // accumulate rows in a development database.
    await pool.query(
      "DELETE FROM audit_log WHERE action = 'account_permanently_deleted' AND entity_id = $1",
      [doomed.tenantId]
    );
  });

  test('the erasure is recorded in the audit log without an erased identity', async () => {
    const doomed = await createTenant('erase-audited');
    await requestAccountDeletion(doomed.userId);
    await executePendingDeletions();

    const { rows } = await pool.query(
      `SELECT trainer_id, entity_type FROM audit_log
        WHERE action = 'account_permanently_deleted' AND entity_id = $1`,
      [doomed.tenantId]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].entity_type).toBe('tenant');
    // The subject is gone; the log records what was removed, not who they were.
    expect(rows[0].trainer_id).toBeNull();

    await pool.query(
      "DELETE FROM audit_log WHERE action = 'account_permanently_deleted' AND entity_id = $1",
      [doomed.tenantId]
    );
  });

  test('no other tenant is touched by an account erasure', async () => {
    const doomed = await createTenant('erase-neighbour');

    const survivors = async () => {
      const { rows } = await pool.query(
        'SELECT id FROM tenants WHERE id = ANY($1::uuid[]) ORDER BY id',
        [[A.tenantId, B.tenantId]]);
      return rows.map((r) => r.id);
    };
    const before = await survivors();
    const clientsBefore = await countRows('clients', B.tenantId);

    await requestAccountDeletion(doomed.userId);
    await executePendingDeletions();

    expect(await survivors()).toEqual(before);
    expect(await countRows('clients', B.tenantId)).toBe(clientsBefore);
    expect(await countRows('tenant_subscriptions', A.tenantId)).toBe(1);

    await pool.query(
      "DELETE FROM audit_log WHERE action = 'account_permanently_deleted' AND entity_id = $1",
      [doomed.tenantId]
    );
  });

  test('a tenant with another user left is kept, and only the leaving trainer goes', async () => {
    // Erasure is per account. A tenant that still has a user still belongs to
    // that user, so the tenant row must survive — this is the guard that stops
    // "delete the tenant" from becoming "delete everyone who shares it".
    const shared = await createTenant('shared-tenant');
    const { rows: [second] } = await pool.query(
      `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, dpa_accepted)
       VALUES ($1, $2, 'x', 'Second', 'Trainer', TRUE) RETURNING id`,
      [shared.tenantId, `second-${Date.now()}@example.test`]
    );

    await requestAccountDeletion(shared.userId);
    await executePendingDeletions();

    const { rows: tenantRows } = await pool.query(
      'SELECT id FROM tenants WHERE id = $1', [shared.tenantId]);
    expect(tenantRows).toHaveLength(1);

    const { rows: userRows } = await pool.query(
      'SELECT id FROM users WHERE tenant_id = $1', [shared.tenantId]);
    expect(userRows.map((r) => r.id)).toEqual([second.id]);

    await pool.query(
      "DELETE FROM audit_log WHERE action = 'account_permanently_deleted' AND entity_id = $1",
      [shared.tenantId]
    );
    await destroyTenant(shared.tenantId);
  });
});

describe('subscriptionChecker touches only tables outside the enforced set', () => {
  // The other scheduled job. It is cross-tenant by design and was reviewed
  // alongside the deletion job; it needs no context because every table it
  // reads or writes is deliberately unprotected (migration 029, section D).
  // This test pins that: if one of those tables were ever brought under RLS,
  // the job would start silently doing nothing, exactly like the deletion job
  // did — so the dependency is asserted rather than assumed.
  const TABLES = [
    'tenant_subscriptions',
    'subscription_plans',
    'subscription_notifications',
    'users',
  ];

  test.each(TABLES)('%s is readable without a tenant context', async (table) => {
    const { rows } = await pool.query(
      `SELECT c.relrowsecurity AS rls
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = $1`,
      [table]
    );
    expect(rows[0].rls).toBe(false);
  });

  test('the checker can enumerate subscriptions across tenants with no context', async () => {
    const { rows } = await pool.query(`
      SELECT ts.tenant_id
        FROM tenant_subscriptions ts
        JOIN subscription_plans sp ON ts.plan_id = sp.id
       LIMIT 5`);
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
  });
});
