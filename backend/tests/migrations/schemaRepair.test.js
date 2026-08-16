'use strict';

/**
 * Migration regressions for the two production incidents of Aug 2026.
 *
 *   BUG-8   password reset was broken in production, and only in production,
 *           because `password_reset_tokens` there was a pre-021 table carrying
 *           `tenant_id NOT NULL`. Migration 021 is CREATE TABLE IF NOT EXISTS,
 *           so it created nothing; `db:baseline` recorded it as applied because
 *           its probe asked only whether a table of that name existed. Every
 *           forgot-password request then raised 23502 — swallowed by design, so
 *           the trainer saw "check your email" and no mail was ever sent.
 *
 *   PROBES  the same class of mistake, found by inspection: migration 009
 *           creates five tables and four columns, and its probe checked one
 *           table. A database where 009 had partly landed could be baselined as
 *           complete, and a recorded migration is never re-run.
 *
 * Neither reproduces on a freshly migrated database, which is exactly why they
 * survived every local run. So these tests BUILD the broken shapes on a
 * disposable database and prove the repair, rather than asserting anything
 * about the developer's own.
 *
 * Everything happens on databases named with the disposable prefix;
 * provision-restricted-db.js refuses any other name.
 */

const { Client } = require('pg');
const {
  provision,
  migrateAgain,
  teardown,
  DISPOSABLE_PREFIX,
  MIGRATOR_ROLE,
} = require('../../scripts/provision-restricted-db');
const probes = require('../../scripts/migrationProbes');

jest.setTimeout(180000);

const UPGRADE_DB = `${DISPOSABLE_PREFIX}prtrepair`;
const PARTIAL_DB = `${DISPOSABLE_PREFIX}partial`;

/** The last migration before the repair — the state production was in. */
const BEFORE_REPAIR = 31;

const asMigrator = async (handle, fn) => {
  const client = new Client({
    host: handle.host,
    port: handle.port,
    database: handle.database,
    user: MIGRATOR_ROLE,
    password: handle.migratorPassword,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
};

/**
 * Not run under `npm run test:restricted`.
 *
 * That harness provisions ONE disposable database up front and runs the whole
 * suite against it as the restricted role. This file provisions databases of
 * its own — and provisioning resets the shared test roles' passwords, which
 * would pull the connection out from under every other suite in the same run.
 *
 * Skipping there costs nothing: these tests build their own databases from
 * zero either way, so they assert exactly the same thing in both modes, and
 * `npm test` (which CI runs, before test:restricted) executes them in full.
 * Nothing here concerns the runtime role.
 */
const describeMigrations = process.env.RLS_TEST_ACTIVE === '1' ? describe.skip : describe;

/**
 * Provisioning failures are FAILURES here, not skips.
 *
 * The restricted suites skip when policies are not in force, because their
 * assertions would then be false rather than unmet. Nothing of the sort applies
 * to this file: it needs a database it can build, and if it cannot build one it
 * has verified nothing. A skip would be indistinguishable from a pass, which is
 * how the incidents above went unnoticed in the first place. The project's own
 * gates already require this capability — `npm run db:verify` and
 * `npm run test:restricted` both provision disposable databases in CI.
 */

const columnsOf = (client, table) =>
  client
    .query(
      `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY column_name`,
      [table]
    )
    .then((r) => r.rows);

describeMigrations('password_reset_tokens: the historical production shape upgrades cleanly', () => {
  let handle;
  let freshColumns;

  beforeAll(async () => {
    handle = await provision({ database: UPGRADE_DB, through: String(BEFORE_REPAIR) });

    // What a freshly built database has, for the convergence check at the end.
    freshColumns = await asMigrator(handle, (c) => columnsOf(c, 'password_reset_tokens'));

    // ── Reproduce production ────────────────────────────────────────────────
    // Column for column, as observed on the live database: the pre-021 table,
    // which already carried user_id/token_hash/used_at (added by hand at some
    // point) and still carried the original tenant_id NOT NULL, token and used.
    await asMigrator(handle, async (c) => {
      await c.query('DROP TABLE IF EXISTS password_reset_tokens');
      await c.query(`
        CREATE TABLE password_reset_tokens (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id   UUID NOT NULL,
          token       VARCHAR(255) NOT NULL,
          expires_at  TIMESTAMP NOT NULL,
          used        BOOLEAN NOT NULL DEFAULT FALSE,
          created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
          user_id     UUID,
          token_hash  VARCHAR(255),
          used_at     TIMESTAMP
        )`);

      // A tenant + user to hang rows off, and two legacy rows: one unusable by
      // the current code (no token_hash) and one that is.
      const { rows: [tenant] } = await c.query(
        "INSERT INTO tenants (name) VALUES ('legacy prt tenant') RETURNING id");
      const { rows: [user] } = await c.query(
        `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name)
         VALUES ($1, 'legacy-prt@example.test', 'x', 'Legacy', 'User') RETURNING id`,
        [tenant.id]);

      await c.query(
        `INSERT INTO password_reset_tokens (tenant_id, token, expires_at, user_id)
         VALUES ($1, 'raw-legacy-token', NOW() + INTERVAL '1 hour', $2)`,
        [tenant.id, user.id]);
      await c.query(
        `INSERT INTO password_reset_tokens (tenant_id, token, expires_at, user_id, token_hash)
         VALUES ($1, 'raw-legacy-token-2', NOW() + INTERVAL '1 hour', $2, 'hash-that-survives')`,
        [tenant.id, user.id]);
    });
  });

  afterAll(async () => {
    if (handle) await teardown(UPGRADE_DB).catch(() => {});
  });

  const t = test;

  t('the reproduced shape breaks the insert the controller actually makes', async () => {
    await asMigrator(handle, async (c) => {
      const { rows: [u] } = await c.query(
        "SELECT id FROM users WHERE email = 'legacy-prt@example.test'");
      // Exactly what passwordResetController does — and exactly what failed in
      // production. If this ever stops raising 23502, the reproduction has
      // drifted and the rest of this suite is proving nothing.
      await expect(
        c.query(
          `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
           VALUES ($1, 'probe', NOW() + INTERVAL '1 hour')`,
          [u.id])
      ).rejects.toMatchObject({ code: '23502' });
    });
  });

  t('the 032 probe refuses to baseline the broken shape', async () => {
    await asMigrator(handle, async (c) => {
      const { rows } = await c.query(probes['032_password_reset_token_repair.sql'].sql);
      expect(rows[0].present).toBe(false);
    });
  });

  t('db:migrate repairs it', async () => {
    const out = migrateAgain(handle);
    expect(out).toMatch(/applied\s+032_password_reset_token_repair\.sql/);

    await asMigrator(handle, async (c) => {
      const cols = await columnsOf(c, 'password_reset_tokens');
      const byName = Object.fromEntries(cols.map((x) => [x.column_name, x]));

      // The legacy columns are gone — the tenant_id NOT NULL above all.
      expect(byName.tenant_id).toBeUndefined();
      expect(byName.token).toBeUndefined();
      expect(byName.used).toBeUndefined();

      // The canonical ones are present, correctly typed and NOT NULL.
      for (const col of ['user_id', 'token_hash', 'expires_at', 'created_at']) {
        expect(byName[col]).toBeDefined();
        expect(byName[col].is_nullable).toBe('NO');
      }
      expect(byName.used_at.is_nullable).toBe('YES');
      expect(byName.token_hash.data_type).toBe('text');
      expect(byName.expires_at.data_type).toBe('timestamp with time zone');
    });
  });

  t('the insert the controller makes now succeeds', async () => {
    await asMigrator(handle, async (c) => {
      const { rows: [u] } = await c.query(
        "SELECT id FROM users WHERE email = 'legacy-prt@example.test'");
      const { rowCount } = await c.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, 'post-repair-hash', NOW() + INTERVAL '1 hour')`,
        [u.id]);
      expect(rowCount).toBe(1);
    });
  });

  t('unusable legacy rows are discarded and usable ones kept', async () => {
    await asMigrator(handle, async (c) => {
      const { rows } = await c.query(
        'SELECT token_hash FROM password_reset_tokens ORDER BY token_hash');
      const hashes = rows.map((r) => r.token_hash);
      expect(hashes).toContain('hash-that-survives');   // had a hash: kept
      expect(hashes).not.toContain(null);               // had none: unusable, dropped
    });
  });

  t('the token hash is unique, and the user reference cascades', async () => {
    await asMigrator(handle, async (c) => {
      const { rows: [u] } = await c.query(
        "SELECT id FROM users WHERE email = 'legacy-prt@example.test'");
      await expect(
        c.query(
          `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
           VALUES ($1, 'post-repair-hash', NOW() + INTERVAL '1 hour')`,
          [u.id])
      ).rejects.toMatchObject({ code: '23505' });

      const { rows: [fk] } = await c.query(`
        SELECT confdeltype FROM pg_constraint
         WHERE conrelid = 'password_reset_tokens'::regclass AND contype = 'f'`);
      expect(fk.confdeltype).toBe('c');   // ON DELETE CASCADE
    });
  });

  t('the upgraded shape matches a freshly built one', async () => {
    await asMigrator(handle, async (c) => {
      const upgraded = await columnsOf(c, 'password_reset_tokens');
      // Compared column for column, because "it works now" and "the two paths
      // produce the same database" are different claims and only the second one
      // stops the next environment from drifting.
      expect(upgraded).toEqual(freshColumns);
    });
  });

  t('re-running the migration is a no-op', async () => {
    const out = migrateAgain(handle);
    expect(out).toMatch(/up to date/);
    expect(out).not.toMatch(/applied\s+032/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describeMigrations('baseline probes reject a partially-applied migration', () => {
  let handle;

  beforeAll(async () => {
    handle = await provision({ database: PARTIAL_DB });
  });

  afterAll(async () => {
    if (handle) await teardown(PARTIAL_DB).catch(() => {});
  });

  const t = test;

  t('every probe passes on a fully migrated database', async () => {
    await asMigrator(handle, async (c) => {
      const failures = [];
      for (const [name, probe] of Object.entries(probes)) {
        if (name === '__helpers') continue;
        const { rows } = await c.query(probe.sql);
        if (!rows[0].present) failures.push(`${name} (${probe.describes})`);
      }
      // A probe that fails here would leave a correct database's migration
      // permanently pending, which is its own kind of broken.
      expect(failures).toEqual([]);
    });
  });

  t('009 is rejected when only some of its objects exist', async () => {
    await asMigrator(handle, async (c) => {
      const probe = probes['009_gdpr_compliance.sql'];

      // Remove one of the five tables 009 creates. audit_log — the object the
      // old probe looked at — stays exactly where it was, so this reproduces
      // the production situation precisely: the sample says yes, the migration
      // is incomplete.
      await c.query('DROP TABLE data_export_requests');

      const { rows: [{ present: auditStillThere }] } = await c.query(
        "SELECT to_regclass('public.audit_log') IS NOT NULL AS present");
      expect(auditStillThere).toBe(true);

      const { rows } = await c.query(probe.sql);
      expect(rows[0].present).toBe(false);
    });
  });

  t('009 is rejected when a column it adds to users is missing', async () => {
    await asMigrator(handle, async (c) => {
      await c.query('ALTER TABLE users DROP COLUMN locked_until');
      const { rows } = await c.query(probes['009_gdpr_compliance.sql'].sql);
      expect(rows[0].present).toBe(false);
    });
  });

  t('004 is rejected when one of its five tables is missing', async () => {
    await asMigrator(handle, async (c) => {
      await c.query('DROP TABLE subscription_history');
      const { rows } = await c.query(probes['004_subscriptions.sql'].sql);
      expect(rows[0].present).toBe(false);
    });
  });

  t('every probe names more than one object, or says why not', async () => {
    // The rule this codifies: a probe is a claim about a whole migration. The
    // single-object exceptions are listed here individually, so adding another
    // one is a decision somebody has to write down.
    const SINGLE_OBJECT_BY_DESIGN = {
      '012_client_notes.sql': 'adds exactly one column',
      '013_session_status.sql': 'adds exactly one column',
      '014_client_archived.sql': 'adds exactly one column',
      '019_user_language.sql': 'adds exactly one column',
      '020_client_payments.sql': 'creates exactly one table',
      '022_fix_usage_period.sql': 'replaces exactly one function',
      '024_token_invalidation.sql': 'adds exactly one column',
      '031_client_statistics_status_aware.sql': 'replaces exactly one view',
      '032_password_reset_token_repair.sql': 'one compound catalogue assertion over one table',
      '016_group_sessions.sql': 'its column is dropped again by 017 — see the entry',
    };

    const offenders = [];
    for (const [name, probe] of Object.entries(probes)) {
      if (name === '__helpers') continue;
      const compound = / \+ | OR /.test(probe.describes);
      if (!compound && !SINGLE_OBJECT_BY_DESIGN[name]) offenders.push(name);
    }
    expect(offenders).toEqual([]);
  });
});
