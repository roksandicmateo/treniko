#!/usr/bin/env node
'use strict';

/**
 * Run the backend test suite against a disposable database, connected as the
 * restricted runtime role (Security Hardening Phase 4).
 *
 * This is the decisive check for the whole phase. Everything else verifies a
 * property in isolation; this verifies that the real application — every
 * controller, every route, every fixture — still works when row-level security
 * is genuinely in force and the connection has no way to bypass it.
 *
 *   npm run test:restricted              full suite
 *   npm run test:restricted -- security  a subset, passed through to jest
 *   npm run test:restricted -- --keep    leave the database up for inspection
 *   npm run test:restricted -- --through 028   build the DB at an older schema
 *
 * The database is created from zero by the ordinary migration runner and torn
 * down afterwards. Nothing touches the development database.
 */

require('dotenv').config();

const path = require('path');
const { spawnSync } = require('child_process');
const { provision, teardown, DISPOSABLE_PREFIX } = require('./provision-restricted-db');

const BACKEND_DIR = path.join(__dirname, '..');

const takeFlag = (args, name) => {
  const i = args.indexOf(name);
  if (i === -1) return { args, value: undefined };
  const value = args[i + 1];
  return { args: [...args.slice(0, i), ...args.slice(i + 2)], value };
};

const run = async () => {
  let jestArgs = process.argv.slice(2);

  const keep = jestArgs.includes('--keep');
  jestArgs = jestArgs.filter((a) => a !== '--keep');

  const through = takeFlag(jestArgs, '--through');
  jestArgs = through.args;

  const database = `${DISPOSABLE_PREFIX}suite`;

  console.log(`provisioning ${database} …`);
  const handle = await provision({ database, through: through.value });
  console.log(`runtime role: ${handle.appUser} (non-superuser, NOBYPASSRLS, owns nothing)\n`);

  // Invoke jest's JS entry point directly rather than through npx: spawning a
  // .cmd shim on Windows needs a shell, and putting a shell in the middle would
  // mean quoting user-supplied jest arguments. The path is resolved rather than
  // hardcoded, but not via require.resolve — jest's package "exports" map does
  // not expose its own bin.
  const jestBin = path.join(BACKEND_DIR, 'node_modules', 'jest-cli', 'bin', 'jest.js');

  const result = spawnSync(
    process.execPath,
    [jestBin, '--runInBand', '--forceExit', ...jestArgs],
    {
      cwd: BACKEND_DIR,
      stdio: 'inherit',
      env: {
        ...process.env,
        DB_HOST: handle.host,
        DB_PORT: String(handle.port),
        DB_NAME: handle.database,
        DB_USER: handle.appUser,
        DB_PASSWORD: handle.appPassword,
        // Point the migration identity at the disposable database's own
        // migrator. Without this, an inherited DB_MIGRATION_USER from the
        // developer's .env would send any migration run during the suite to a
        // privileged role on a different database.
        DB_MIGRATION_USER: handle.migratorUser,
        DB_MIGRATION_PASSWORD: handle.migratorPassword,
        DB_SSL: 'false',
        NODE_ENV: 'test',
        // Surfaced to the RLS suites so they can open their own connections as
        // the migration role for the checks that need one (asserting that the
        // runtime role is NOT the owner requires knowing who is).
        RLS_TEST_MIGRATOR_USER: handle.migratorUser,
        RLS_TEST_MIGRATOR_PASSWORD: handle.migratorPassword,
        RLS_TEST_ACTIVE: '1',
      },
    }
  );

  if (keep) {
    console.log(`\n--keep: ${database} left in place. Drop it with:`);
    console.log(`  node scripts/provision-restricted-db.js --database ${database} --drop-only`);
  } else {
    await teardown(database);
  }

  process.exit(result.status === null ? 1 : result.status);
};

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
