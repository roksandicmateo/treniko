'use strict';

/**
 * Tenant context must not survive a pooled connection (Phase 4, Step 8).
 *
 * ── The failure this guards against ──────────────────────────────────────────
 * The application holds a pool of up to 20 connections and hands them to
 * whichever request needs one. If a tenant context set for request 1 were still
 * set when request 2 borrowed the same connection, request 2 would read request
 * 1's tenant's data — and it would do so intermittently, depending on pool
 * scheduling, which is the hardest class of bug to find and the worst class to
 * ship.
 *
 * The design avoids it structurally rather than by cleanup: the context is set
 * with SET LOCAL semantics inside the transaction that runs the query, so
 * PostgreSQL discards it at COMMIT or ROLLBACK. There is no reset step that an
 * early return, a thrown exception or a forgotten branch could skip.
 *
 * These tests exist to prove that claim rather than to restate it, so they
 * deliberately include the paths where a manual cleanup would be missed: an
 * exception thrown mid-callback, a rolled-back transaction, and interleaved
 * work across more requests than there are connections.
 */

const { createTenant, destroyTenant, pool, asTenant } = require('../helpers/fixtures');
const { describeWhenRlsEnforced, assertReallyEnforced } = require('../helpers/rlsEnvironment');
const { getClient } = require('../../config/database');

const describeRls = describeWhenRlsEnforced('rlsPoolIsolation');

let A;
let B;

beforeAll(async () => {
  A = await createTenant('rlspool-a');
  B = await createTenant('rlspool-b');
}, 30000);

afterAll(async () => {
  await destroyTenant(A?.tenantId);
  await destroyTenant(B?.tenantId);
  await pool.end();
});

/** What the current context can see: the tenant ids of every visible client row. */
const visibleTenants = async () => {
  const { rows } = await pool.query('SELECT DISTINCT tenant_id FROM clients');
  return rows.map((r) => r.tenant_id).sort();
};

describeRls('a tenant context never outlives the request that set it', () => {
  test('the guard is honest: policies really are in force', async () => {
    expect((await assertReallyEnforced()).enforced).toBe(true);
  });

  test('A then B then A each see only their own rows', async () => {
    expect(await asTenant(A, visibleTenants)).toEqual([A.tenantId]);
    expect(await asTenant(B, visibleTenants)).toEqual([B.tenantId]);
    expect(await asTenant(A, visibleTenants)).toEqual([A.tenantId]);
  });

  test('a query with no context sees nothing, immediately after one that did', async () => {
    await asTenant(A, visibleTenants);
    // The connection A just used is back in the pool. If its setting survived,
    // this would return A's rows.
    expect(await visibleTenants()).toEqual([]);
  });

  test('context does not leak across many reuses of a small number of connections', async () => {
    // More alternating requests than the pool has connections, so connections
    // are certainly reused, and reused across a tenant change.
    const seen = [];
    for (let i = 0; i < 24; i += 1) {
      const tenant = i % 2 === 0 ? A : B;
      seen.push(await asTenant(tenant, visibleTenants));
    }
    seen.forEach((result, i) => {
      expect(result).toEqual([i % 2 === 0 ? A.tenantId : B.tenantId]);
    });
  });

  test('parallel requests interleaved on the pool do not cross over', async () => {
    // AsyncLocalStorage is what keeps these apart: they overlap in time on the
    // same event loop and each must keep its own context across every await.
    const results = await Promise.all(
      Array.from({ length: 16 }, (_, i) => {
        const tenant = i % 2 === 0 ? A : B;
        return asTenant(tenant, async () => {
          const before = await visibleTenants();
          const after = await visibleTenants();
          return { expected: tenant.tenantId, before, after };
        });
      })
    );

    for (const r of results) {
      expect(r.before).toEqual([r.expected]);
      expect(r.after).toEqual([r.expected]);
    }
  });
});

describeRls('a failed request leaves no context behind', () => {
  test('an exception thrown inside the context does not leak it onward', async () => {
    await expect(
      asTenant(A, async () => {
        await visibleTenants();
        throw new Error('handler blew up');
      })
    ).rejects.toThrow('handler blew up');

    // The connection used before the throw is back in the pool.
    expect(await visibleTenants()).toEqual([]);
    expect(await asTenant(B, visibleTenants)).toEqual([B.tenantId]);
  });

  test('a failing SQL statement does not leak the context onward', async () => {
    await expect(
      asTenant(A, () => pool.query('SELECT * FROM no_such_table'))
    ).rejects.toBeDefined();

    expect(await visibleTenants()).toEqual([]);
  });

  test('a policy denial does not leak the context onward', async () => {
    await expect(
      asTenant(A, () =>
        pool.query(
          `INSERT INTO clients (tenant_id, first_name, last_name) VALUES ($1, 'x', 'y')`,
          [B.tenantId]
        )
      )
    ).rejects.toBeDefined();

    expect(await visibleTenants()).toEqual([]);
    expect(await asTenant(B, visibleTenants)).toEqual([B.tenantId]);
  });

  test('the pool does not leak connections across repeated failures', async () => {
    // A client that is not released in a `finally` would be lost from the pool
    // on every failure; 30 of them would exhaust a pool of 20 and this test
    // would hang rather than fail. The count check makes the reason explicit.
    for (let i = 0; i < 30; i += 1) {
      await expect(
        asTenant(A, () => pool.query('SELECT * FROM no_such_table'))
      ).rejects.toBeDefined();
    }
    expect(pool.idleCount).toBeGreaterThan(0);
    expect(pool.totalCount).toBeLessThanOrEqual(20);

    // And the pool still works afterwards.
    expect(await asTenant(A, visibleTenants)).toEqual([A.tenantId]);
  });
});

describeRls('explicit transactions carry the context and release it', () => {
  test('a committed transaction sees only its own tenant', async () => {
    const seen = await asTenant(A, async () => {
      const client = await getClient();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query('SELECT DISTINCT tenant_id FROM clients');
        await client.query('COMMIT');
        return rows.map((r) => r.tenant_id);
      } finally {
        client.release();
      }
    });
    expect(seen).toEqual([A.tenantId]);
  });

  test('a rolled-back transaction leaves no context on the connection', async () => {
    await asTenant(A, async () => {
      const client = await getClient();
      try {
        await client.query('BEGIN');
        await client.query('SELECT DISTINCT tenant_id FROM clients');
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });

    expect(await visibleTenants()).toEqual([]);
  });

  test('a transaction that throws still releases its connection and its context', async () => {
    await expect(
      asTenant(A, async () => {
        const client = await getClient();
        try {
          await client.query('BEGIN');
          await client.query('SELECT 1 FROM no_such_table');
        } finally {
          await client.query('ROLLBACK').catch(() => {});
          client.release();
        }
      })
    ).rejects.toBeDefined();

    expect(await visibleTenants()).toEqual([]);
    expect(pool.idleCount).toBeGreaterThan(0);
  });

  test('a transaction cannot write into another tenant', async () => {
    await expect(
      asTenant(A, async () => {
        const client = await getClient();
        try {
          await client.query('BEGIN');
          await client.query(
            `INSERT INTO clients (tenant_id, first_name, last_name) VALUES ($1, 'x', 'y')`,
            [B.tenantId]
          );
          await client.query('COMMIT');
        } finally {
          await client.query('ROLLBACK').catch(() => {});
          client.release();
        }
      })
    ).rejects.toMatchObject({ code: '42501' });

    const { rows } = await asTenant(B, () =>
      pool.query("SELECT id FROM clients WHERE first_name = 'x'")
    );
    expect(rows).toEqual([]);
  });
});
