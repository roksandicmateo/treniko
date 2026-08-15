#!/usr/bin/env node
'use strict';

/**
 * Prove the migration chain from both directions (Phase 4, Steps 10 and 11).
 *
 *   npm run db:verify
 *
 * Two questions matter before migration 029 goes anywhere near a real database,
 * and neither can be answered by applying it to the development database and
 * looking at the result:
 *
 *   FRESH      does a database built from nothing, through the whole chain,
 *              end up in the intended state? This is what a new environment
 *              and every CI run gets.
 *   UPGRADE    does a database that already looks like the current production
 *              release (through 028) reach the same state when 029 is applied
 *              on top? This is what the actual deployment will do, and it is a
 *              different code path from the fresh build.
 *
 * Both are then re-run to confirm the migration is a no-op the second time,
 * because an operator re-running a deploy must not be a destructive event.
 *
 * Everything happens on disposable databases. The development database is never
 * touched — provision-restricted-db.js refuses any name without the disposable
 * prefix.
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { Client } = require('pg');
const {
  provision,
  migrateAgain,
  teardown,
  DISPOSABLE_PREFIX,
  MIGRATOR_ROLE,
} = require('./provision-restricted-db');

const BACKEND_DIR = path.join(__dirname, '..');

/** The release the upgrade path starts from — the last migration in production. */
const UPGRADE_FROM = 28;

/**
 * Migrations that land after UPGRADE_FROM, derived from the directory rather
 * than hardcoded, so adding a migration does not silently weaken this check.
 */
const migrationsAfter = (n) =>
  fs.readdirSync(path.join(BACKEND_DIR, 'migrations'))
    .filter((f) => f.endsWith('.sql'))
    .filter((f) => {
      const m = f.match(/^(\d+)/);
      return m && parseInt(m[1], 10) > n;
    })
    .sort();

const FRESH_DB = `${DISPOSABLE_PREFIX}fresh`;
const UPGRADE_DB = `${DISPOSABLE_PREFIX}upgrade`;

let failures = 0;

const check = (label, ok, detail) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

/** Run `db:status` against a database as the migration role and parse the tail. */
const status = (handle) => {
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, 'migrate.js'), 'status'],
    {
      cwd: BACKEND_DIR,
      encoding: 'utf8',
      env: {
        ...process.env,
        DB_HOST: handle.host,
        DB_PORT: String(handle.port),
        DB_NAME: handle.database,
        DB_USER: MIGRATOR_ROLE,
        DB_PASSWORD: handle.migratorPassword,
        DB_SSL: 'false',
        NODE_ENV: 'test',
      },
    }
  );
  const out = `${result.stdout || ''}${result.stderr || ''}`;
  const m = out.match(/(\d+) applied, (\d+) pending/);
  if (!m) throw new Error(`could not parse db:status output:\n${out}`);
  return { applied: parseInt(m[1], 10), pending: parseInt(m[2], 10), raw: out };
};

const withDb = async (handle, fn) => {
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

/** The catalogue facts that define "migration 029 has landed correctly". */
const rlsShape = (client) =>
  client
    .query(`
      SELECT
        (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity)     AS rls_tables,
        (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public')        AS policies,
        (SELECT to_regprocedure('public.app_current_tenant_id()') IS NOT NULL)     AS accessor,
        (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
            AND NOT EXISTS (SELECT 1 FROM pg_policies p
                             WHERE p.schemaname = 'public' AND p.tablename = c.relname))
                                                                                  AS enabled_without_policy`)
    .then((r) => r.rows[0]);

const run = async () => {
  console.log('\n── FRESH DATABASE: zero → 029 ───────────────────────────────────');
  const fresh = await provision({ database: FRESH_DB });
  const freshStatus = status(fresh);
  check('all migrations applied', freshStatus.pending === 0,
    `${freshStatus.applied} applied, ${freshStatus.pending} pending`);
  check('029 is in the applied set', /applied\s+029_row_level_security\.sql/.test(freshStatus.raw));

  const freshShape = await withDb(fresh, rlsShape);
  check('the tenant context accessor exists', freshShape.accessor === true);
  check('every RLS-enabled table has a policy', freshShape.enabled_without_policy === 0,
    `${freshShape.enabled_without_policy} without`);
  check('policy count matches protected-table count',
    freshShape.policies === freshShape.rls_tables,
    `${freshShape.rls_tables} tables / ${freshShape.policies} policies`);

  console.log('\n  re-running db:migrate …');
  const freshAgain = migrateAgain(fresh);
  check('re-run is a safe no-op', /up to date/.test(freshAgain) && !/applied\s{2}0\d\d/.test(freshAgain));
  const freshStatus2 = status(fresh);
  check('still 0 pending after re-run', freshStatus2.pending === 0);
  check('nothing was re-applied', freshStatus2.applied === freshStatus.applied,
    `${freshStatus.applied} → ${freshStatus2.applied}`);

  const pendingAfter = migrationsAfter(UPGRADE_FROM);
  console.log(
    `\n── UPGRADE: a 0${UPGRADE_FROM}-era database receiving ${pendingAfter.join(', ')} ──`
  );
  const upgrade = await provision({ database: UPGRADE_DB, through: String(UPGRADE_FROM) });
  const before = status(upgrade);
  check('starts with exactly the post-release migrations pending',
    before.pending === pendingAfter.length,
    `${before.applied} applied, ${before.pending} pending (expected ${pendingAfter.length})`);
  for (const name of pendingAfter) {
    check(`${name} is pending`,
      new RegExp(`PENDING\\s+${name.replace(/\./g, '\\.')}`).test(before.raw));
  }

  const beforeShape = await withDb(upgrade, rlsShape);
  check('the accessor does not exist before the upgrade', beforeShape.accessor === false);

  console.log('\n  applying 029 …');
  migrateAgain(upgrade);
  const after = status(upgrade);
  check('0 pending after the upgrade', after.pending === 0,
    `${after.applied} applied, ${after.pending} pending`);

  const afterShape = await withDb(upgrade, rlsShape);
  check('the accessor now exists', afterShape.accessor === true);
  check('every RLS-enabled table has a policy', afterShape.enabled_without_policy === 0);

  // The point of running both paths: they must converge. A migration that
  // builds one state from scratch and a different one on upgrade is the classic
  // way a schema drifts between environments.
  check('upgraded state matches the freshly built state',
    afterShape.rls_tables === freshShape.rls_tables &&
    afterShape.policies === freshShape.policies,
    `fresh ${freshShape.rls_tables}/${freshShape.policies} vs upgraded ${afterShape.rls_tables}/${afterShape.policies}`);

  console.log('\n  re-running db:migrate …');
  const upgradeAgain = migrateAgain(upgrade);
  check('re-run is a safe no-op', /up to date/.test(upgradeAgain));
  check('still 0 pending', status(upgrade).pending === 0);

  await teardown(FRESH_DB);
  await teardown(UPGRADE_DB);

  console.log(
    failures === 0
      ? '\nAll migration checks passed.\n'
      : `\n${failures} migration check(s) FAILED.\n`
  );
  process.exit(failures === 0 ? 0 : 1);
};

run().catch(async (err) => {
  console.error(`\nERROR: ${err.message}`);
  await teardown(FRESH_DB).catch(() => {});
  await teardown(UPGRADE_DB).catch(() => {});
  process.exit(1);
});
