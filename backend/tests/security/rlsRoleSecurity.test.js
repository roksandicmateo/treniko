'use strict';

/**
 * The runtime database role cannot escape its own boundary (Phase 4, Step 5).
 *
 * Row-level security is only as strong as the role it applies to. Every policy
 * in migration 029 is irrelevant if the connecting role can turn RLS off, drop
 * the policy, take ownership of the table, or simply read the data through a
 * privilege it should not hold. This suite asserts the negative space: the
 * things the application's own connection must NOT be able to do.
 *
 * It runs only under the restricted runtime role — see helpers/rlsEnvironment.js
 * for why, and for the guard that stops it passing vacuously.
 */

const { Client } = require('pg');
const { pool } = require('../helpers/fixtures');
const { describeWhenRlsEnforced, assertReallyEnforced } = require('../helpers/rlsEnvironment');

const describeRls = describeWhenRlsEnforced('rlsRoleSecurity');

/** A statement that must be refused, and the SQLSTATE we expect. */
const expectDenied = async (sql, params) => {
  await expect(pool.query(sql, params)).rejects.toMatchObject({
    // 42501 insufficient_privilege — the only acceptable refusal for a
    // privilege check. A different code would mean it failed for an unrelated
    // reason and the test proved nothing.
    code: '42501',
  });
};

afterAll(async () => {
  await pool.end();
});

describeRls('the runtime role holds no privilege that would neutralise RLS', () => {
  test('the guard itself is honest: policies really are in force', async () => {
    const status = await assertReallyEnforced();
    expect(status.enforced).toBe(true);
  });

  test('is not a superuser', async () => {
    const { rows } = await pool.query(
      'SELECT rolsuper FROM pg_roles WHERE rolname = current_user'
    );
    expect(rows[0].rolsuper).toBe(false);
  });

  test('does not carry BYPASSRLS', async () => {
    const { rows } = await pool.query(
      'SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user'
    );
    expect(rows[0].rolbypassrls).toBe(false);
  });

  test('cannot create roles or databases', async () => {
    const { rows } = await pool.query(
      'SELECT rolcreaterole, rolcreatedb FROM pg_roles WHERE rolname = current_user'
    );
    expect(rows[0].rolcreaterole).toBe(false);
    expect(rows[0].rolcreatedb).toBe(false);
  });

  test('owns none of the protected tables', async () => {
    // Ownership is the quietest way to lose RLS: nothing errors, policies are
    // simply skipped.
    const { rows } = await pool.query(`
      SELECT c.relname AS name
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
         AND pg_get_userbyid(c.relowner) = current_user`);
    expect(rows.map((r) => r.name)).toEqual([]);
  });

  test('owns no table in the schema at all', async () => {
    const { rows } = await pool.query(`
      SELECT c.relname AS name
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r'
         AND pg_get_userbyid(c.relowner) = current_user`);
    expect(rows.map((r) => r.name)).toEqual([]);
  });
});

describeRls('the runtime role cannot perform DDL', () => {
  test('cannot disable row-level security on a protected table', async () => {
    await expectDenied('ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY');
  });

  test('cannot drop the policy protecting it', async () => {
    await expectDenied('DROP POLICY rls_tenant_clients ON public.clients');
  });

  test('cannot create a permissive policy of its own', async () => {
    await expectDenied(
      'CREATE POLICY rls_attacker_policy ON public.clients FOR ALL USING (true)'
    );
  });

  test('cannot alter a protected table', async () => {
    await expectDenied('ALTER TABLE public.clients ADD COLUMN attacker_column text');
  });

  test('cannot drop a protected table', async () => {
    await expectDenied('DROP TABLE public.clients');
  });

  test('cannot take ownership of a protected table', async () => {
    await expect(
      pool.query('ALTER TABLE public.clients OWNER TO current_user')
    ).rejects.toBeDefined();
  });

  test('cannot TRUNCATE, which policies do not filter', async () => {
    // TRUNCATE is all-or-nothing: RLS does not restrict it to visible rows, so
    // the privilege is withheld rather than relied on being filtered.
    await expectDenied('TRUNCATE TABLE public.clients');
  });

  test('cannot create a new table in the schema', async () => {
    await expectDenied('CREATE TABLE public.attacker_table (id int)');
  });

  test('cannot redefine the tenant accessor function', async () => {
    // Redefining app_current_tenant_id() to return an arbitrary tenant would
    // defeat every policy at once, without touching a single policy.
    await expect(
      pool.query(
        `CREATE OR REPLACE FUNCTION app_current_tenant_id() RETURNS uuid
         LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$`
      )
    ).rejects.toBeDefined();
  });
});

describeRls('the runtime role cannot read privileged catalogues', () => {
  test('cannot read password hashes from pg_authid', async () => {
    await expectDenied('SELECT rolpassword FROM pg_authid');
  });

  test('cannot read other sessions\' query text from pg_stat_activity', async () => {
    // Not a privilege error — PostgreSQL nulls the columns instead — so this
    // asserts the redaction rather than a refusal.
    const { rows } = await pool.query(`
      SELECT count(*)::int AS visible
        FROM pg_stat_activity
       WHERE usename IS DISTINCT FROM current_user AND query IS NOT NULL
         AND query <> '<insufficient privilege>'`);
    expect(rows[0].visible).toBe(0);
  });

  test('cannot read the server\'s file system through pg_read_file', async () => {
    await expect(pool.query("SELECT pg_read_file('postgresql.conf')")).rejects.toBeDefined();
  });

  test('cannot read pg_shadow, the other route to password hashes', async () => {
    // pg_authid is covered above; pg_shadow is a view over it and is a
    // separate grant, so denying one does not imply denying the other.
    await expectDenied('SELECT passwd FROM pg_shadow');
  });

  test('cannot enumerate other roles\' login credentials by any catalogue', async () => {
    // pg_roles is readable by everyone, but it substitutes '********' for the
    // password column. Assert the substitution rather than assuming it.
    const { rows } = await pool.query(
      "SELECT count(*)::int AS c FROM pg_roles WHERE rolpassword IS NOT NULL AND rolpassword <> '********'"
    );
    expect(rows[0].c).toBe(0);
  });
});

describeRls('the migration role is separate and correctly scoped', () => {
  // The migration role is what owns the schema. It must be able to do the DDL
  // the runtime role cannot — otherwise the separation is theatre — while still
  // not being a superuser and still not carrying BYPASSRLS.
  const migratorConfig = () => ({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME,
    user: process.env.RLS_TEST_MIGRATOR_USER,
    password: process.env.RLS_TEST_MIGRATOR_PASSWORD,
  });

  const withMigrator = async (fn) => {
    const client = new Client(migratorConfig());
    await client.connect();
    try {
      return await fn(client);
    } finally {
      await client.end();
    }
  };

  test('the two roles are distinct', () => {
    expect(process.env.RLS_TEST_MIGRATOR_USER).toBeTruthy();
    expect(process.env.RLS_TEST_MIGRATOR_USER).not.toBe(process.env.DB_USER);
  });

  test('the migration role owns the protected tables', async () => {
    await withMigrator(async (client) => {
      const { rows } = await client.query(`
        SELECT count(*)::int AS owned
          FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
           AND pg_get_userbyid(c.relowner) = current_user`);
      expect(rows[0].owned).toBeGreaterThan(0);
    });
  });

  test('the migration role is still not a superuser and still has no BYPASSRLS', async () => {
    await withMigrator(async (client) => {
      const { rows } = await client.query(
        'SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user'
      );
      expect(rows[0].rolsuper).toBe(false);
      expect(rows[0].rolbypassrls).toBe(false);
    });
  });

  test('the migration role can perform DDL, which the runtime role cannot', async () => {
    await withMigrator(async (client) => {
      await client.query('CREATE TABLE public.rls_migrator_probe (id int)');
      await client.query('DROP TABLE public.rls_migrator_probe');
    });
    // …and the same statement is still refused to the runtime role.
    await expectDenied('CREATE TABLE public.rls_migrator_probe (id int)');
  });
});
