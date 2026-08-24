'use strict';

/**
 * The shape of the row-level-security configuration (Phase 4, Steps 5 and 6).
 *
 * These are catalogue facts — which tables have RLS enabled, which policies
 * exist, which tables are deliberately outside the enforced set. They are true
 * regardless of which role is connected, so this suite runs in BOTH modes
 * (`npm test` and `npm run test:restricted`) rather than only the restricted
 * one. That matters: this is the suite that fails when a future migration adds
 * a tenant-owning table and forgets to protect it, and it needs to fail in the
 * run developers do by default.
 *
 * The exclusion list is asserted EXACTLY, not as a subset. A table may leave
 * the enforced set only by someone editing this file and, in doing so, writing
 * down why.
 */

const { pool } = require('../helpers/fixtures');

// ── The intended configuration ──────────────────────────────────────────────
// Mirrors migration 029. Duplicated here on purpose: a test that derived its
// expectations from the same source as the thing it tests would agree with any
// mistake in it.

/** Tables whose own row carries tenant_id. */
const DIRECT_TENANT_TABLES = [
  'clients',
  'trainings',
  'training_sessions',
  'training_logs',
  'training_images',
  'progress_entries',
  'exercises',
  'training_templates',
  'groups',
  'group_sessions',
  'session_attendees',
  'packages',
  'client_packages',
  'client_payments',
  'package_session_usage',
  'subscription_history',
];

/** Tables whose ownership derives through a parent row. */
const INDIRECT_TENANT_TABLES = [
  'group_members',
  'group_session_attendance',
  'template_exercises',
  'template_sets',
  'training_exercises',
  'training_sets',
  'exercise_entries',
];

/** Tables owned by a trainer rather than a tenant. */
const TRAINER_SCOPED_TABLES = [
  'client_consents',
  'trainer_consents',
  'data_export_requests',
];

const PROTECTED_TABLES = [
  ...DIRECT_TENANT_TABLES,
  ...INDIRECT_TENANT_TABLES,
  ...TRAINER_SCOPED_TABLES,
];

/**
 * Tables that carry tenant-identifying data and are nonetheless NOT protected
 * by a policy, each with the reason it cannot be.
 *
 * Every entry was re-derived from the code for Phase 4 Step 6 rather than taken
 * from the migration's comments. `subscription_history` was on this list when
 * the phase began and was moved into the enforced set as a result: it is
 * written only by an authenticated request and read by nothing, so none of the
 * reasons below applied to it.
 */
const UNPROTECTED_TENANT_TABLES = {
  users:
    'Login, registration, password reset and email verification all resolve a ' +
    'user BEFORE any tenant is known — authentication would be impossible if a ' +
    'tenant context were required to read this table. The daily subscription ' +
    'checker also reads it across tenants to find each tenant\'s trainer.',
  tenants:
    'Created during registration, before a tenant context can exist. A policy ' +
    'here would make signing up impossible.',
  tenant_subscriptions:
    'Written during registration (pre-context) and read across all tenants by ' +
    'jobs/subscriptionChecker.js to find expiring subscriptions.',
  subscription_usage:
    'Written during registration (pre-context) and maintained by triggers that ' +
    'fire on cascade deletes, where no context is established.',
  signup_attribution:
    'Migration 034. Written during registration, before a tenant context can ' +
    'exist — the tenant is milliseconds old and no request has established a ' +
    'context for it, so a policy here would fail closed on the one flow that ' +
    'must never fail closed. Nothing in the authenticated application reads ' +
    'it; it is read only by operational reporting run as the owner role and ' +
    'by the platform-admin aggregate, which reads counts and no business data.',
  subscription_notifications:
    'Written across all tenants by jobs/subscriptionChecker.js from a timer, ' +
    'with no request and therefore no tenant context.',
  audit_log:
    'An append-only security log rather than tenant business data, written by ' +
    'jobs/deletionJob.js outside any request context. Keyed by trainer_id.',
  admin_audit_log:
    'Migration 033. An append-only record of platform-administrator writes. It ' +
    'carries tenant_id to say which tenant an action affected, but it is a ' +
    'security log rather than tenant business data: entries routinely span ' +
    'tenants, are written by staff who belong to none, and must outlive both ' +
    'the administrator and the tenant. A tenant policy would also hide the log ' +
    'from the admin API, which establishes no tenant context by design.',
  deletion_requests:
    'jobs/deletionJob.js must enumerate pending requests across every tenant in ' +
    'order to do its work at all; that scan is what lets it then act under each ' +
    'tenant\'s own context.',
};

/** Tables with no tenant-identifying data at all. */
const TENANT_NEUTRAL_TABLES = [
  'subscription_plans',      // the plan catalogue, identical for everyone
  'password_reset_tokens',   // keyed by user, consumed before authentication
  'schema_migrations',       // the migration ledger
  // Migration 033 — platform administration.
  //
  // platform_admins holds TRENIKO staff accounts. It has no tenant_id and
  // cannot have one: a staff account scoped to a single tenant would defeat its
  // own purpose. It is a separate authentication realm from `users`, never
  // reached by a tenant-scoped query, and protected by application-level
  // authorization exactly as `users` is.
  'platform_admins',
  // Migration 035. Anonymous page views. There is no tenant_id and there
  // cannot be one: a view happens before anybody has an account, and most
  // never lead to one. The table holds a path, a referrer host, campaign
  // labels and a timestamp — no IP, no user agent, no cookie, no visitor
  // identifier of any kind — so there is nothing here belonging to any tenant
  // or identifying any person.
  'page_view',
];

afterAll(async () => {
  await pool.end();
});

const tableNames = async (predicate) => {
  const { rows } = await pool.query(`
    SELECT c.relname AS name, c.relrowsecurity AS rls
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r'
     ORDER BY c.relname`);
  return rows.filter(predicate).map((r) => r.name);
};

describe('RLS inventory: every table that should be protected, is', () => {
  test('migration 029 has been applied to this database', async () => {
    const { rows } = await pool.query(
      "SELECT to_regprocedure('public.app_current_tenant_id()') IS NOT NULL AS present"
    );
    expect(rows[0].present).toBe(true);
  });

  test.each(PROTECTED_TABLES)('%s has row-level security enabled', async (table) => {
    const { rows } = await pool.query(
      `SELECT c.relrowsecurity AS rls
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = $1`,
      [table]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].rls).toBe(true);
  });

  test.each(PROTECTED_TABLES)('%s has exactly one policy, covering all commands', async (table) => {
    const { rows } = await pool.query(
      `SELECT policyname, cmd, qual, with_check
         FROM pg_policies WHERE schemaname = 'public' AND tablename = $1`,
      [table]
    );
    expect(rows).toHaveLength(1);

    // FOR ALL. A policy that covered only SELECT would leave writes unguarded.
    expect(rows[0].cmd).toBe('ALL');

    // USING controls which rows are visible; WITH CHECK controls which rows may
    // be written. Without the latter, a caller can insert a row stamped with
    // another tenant's id — the single most important half of the policy.
    expect(rows[0].qual).toBeTruthy();
    expect(rows[0].with_check).toBeTruthy();
  });

  test.each(DIRECT_TENANT_TABLES)('%s policy is keyed on tenant_id', async (table) => {
    const { rows } = await pool.query(
      "SELECT qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = $1",
      [table]
    );
    expect(rows[0].qual).toContain('tenant_id');
    expect(rows[0].qual).toContain('app_current_tenant_id');
    expect(rows[0].with_check).toContain('tenant_id');
  });

  test.each(TRAINER_SCOPED_TABLES)('%s policy is keyed on the trainer', async (table) => {
    const { rows } = await pool.query(
      "SELECT qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = $1",
      [table]
    );
    expect(rows[0].qual).toContain('trainer_id');
    expect(rows[0].qual).toContain('app_current_user_id');
  });
});

describe('RLS inventory: the exclusion list is exact', () => {
  test('no table has RLS enabled without a policy', async () => {
    // Enabled-but-policy-less denies everything to a non-owner. That is a
    // failure mode that looks like "protected" in the catalogue and behaves
    // like an outage at runtime.
    const { rows } = await pool.query(`
      SELECT c.relname AS name
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
         AND NOT EXISTS (
           SELECT 1 FROM pg_policies p
            WHERE p.schemaname = 'public' AND p.tablename = c.relname)`);
    expect(rows.map((r) => r.name)).toEqual([]);
  });

  test('the set of protected tables is exactly the intended one', async () => {
    const enabled = await tableNames((r) => r.rls);
    expect(enabled.sort()).toEqual([...PROTECTED_TABLES].sort());
  });

  test('every unprotected table is on the reviewed list, with a reason', async () => {
    const unprotected = await tableNames((r) => !r.rls);
    const accounted = [
      ...Object.keys(UNPROTECTED_TENANT_TABLES),
      ...TENANT_NEUTRAL_TABLES,
    ];

    // This is the check that fails when a future migration adds a table and
    // nobody decides whether it needs a policy. The remedy is either to protect
    // it in a migration, or to add it above with the reason it does not need
    // protection — never to loosen this assertion.
    const unaccounted = unprotected.filter((t) => !accounted.includes(t));
    expect(unaccounted).toEqual([]);

    // And the reverse: an entry left behind after its table was protected or
    // dropped would make the list read as more considered than it is.
    const stale = accounted.filter((t) => !unprotected.includes(t));
    expect(stale).toEqual([]);
  });

  test('each excluded table has a recorded reason', () => {
    for (const [table, reason] of Object.entries(UNPROTECTED_TENANT_TABLES)) {
      expect(typeof reason).toBe('string');
      expect(reason.length).toBeGreaterThan(40);
      expect(table).toMatch(/^[a-z_]+$/);
    }
  });

  test('no table carrying tenant_id is silently unprotected', async () => {
    // Tighter than the list check above: a tenant_id column is direct evidence
    // that rows belong to somebody. Any such table must be either protected or
    // explicitly excused.
    const { rows } = await pool.query(`
      SELECT c.relname AS name
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
         AND EXISTS (
           SELECT 1 FROM information_schema.columns col
            WHERE col.table_schema = 'public'
              AND col.table_name = c.relname
              AND col.column_name = 'tenant_id')
       ORDER BY c.relname`);

    const names = rows.map((r) => r.name);
    for (const name of names) {
      expect(Object.keys(UNPROTECTED_TENANT_TABLES)).toContain(name);
    }
  });
});

describe('RLS inventory: the context accessor fails closed', () => {
  /**
   * Set a raw setting value and read the accessor back, as two separate
   * statements inside one transaction.
   *
   * Deliberately not `SELECT set_config(...), app_current_tenant_id()`: the
   * evaluation order of a target list is not defined, so that form could read
   * the setting before writing it and pass for the wrong reason.
   *
   * @param {string} setting
   * @param {string|null} value  null means "never set at all"
   * @param {string} accessor
   */
  const readAccessor = async (setting, value, accessor) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (value !== null) {
        await client.query('SELECT set_config($1, $2, true)', [setting, value]);
      }
      const { rows } = await client.query(`SELECT ${accessor}() AS v`);
      return rows[0].v;
    } finally {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
    }
  };

  // These are every state a pooled connection can present. The accessor must
  // answer NULL for all of the bad ones — an exception would abort the
  // statement instead of denying it, which is how the pre-029 policies behaved.
  test('missing context yields NULL', async () => {
    expect(await readAccessor('app.current_tenant_id', null, 'app_current_tenant_id')).toBeNull();
  });

  test('empty context yields NULL', async () => {
    expect(await readAccessor('app.current_tenant_id', '', 'app_current_tenant_id')).toBeNull();
  });

  test('malformed context yields NULL rather than raising', async () => {
    expect(
      await readAccessor('app.current_tenant_id', 'not-a-uuid', 'app_current_tenant_id')
    ).toBeNull();
  });

  test('a SQL fragment in the context yields NULL rather than being interpreted', async () => {
    expect(
      await readAccessor(
        'app.current_tenant_id',
        "' OR '1'='1",
        'app_current_tenant_id'
      )
    ).toBeNull();
  });

  test('a well-formed context is returned unchanged', async () => {
    const id = '11111111-2222-3333-4444-555555555555';
    expect(await readAccessor('app.current_tenant_id', id, 'app_current_tenant_id')).toBe(id);
  });

  test('the user accessor behaves the same way', async () => {
    expect(await readAccessor('app.current_user_id', 'nonsense', 'app_current_user_id')).toBeNull();
  });
});
