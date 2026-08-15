#!/usr/bin/env node
'use strict';

/**
 * TRENIKO migration runner.
 *
 * A deliberately small runner built on the project's existing `pg` dependency —
 * no ORM, no migration framework.
 *
 *   npm run db:migrate     apply every pending migration, in order
 *   npm run db:status      show what is applied and what is pending
 *   npm run db:baseline    adopt an existing database into migration tracking
 *
 *   npm run db:migrate -- --through 028   stop after migration 028 (used to
 *                          reproduce a previous release's schema before testing
 *                          an upgrade; it can only stop earlier, never skip)
 *
 * ── How the sequence is defined ──────────────────────────────────────────────
 * `schema.sql` is the BASELINE: it creates the original four tables and is not
 * idempotent (plain CREATE TABLE, plus seed rows), so it runs exactly once on an
 * empty database and is then recorded like any other step. Everything in
 * `migrations/` layers on top of it, ordered by the numeric filename prefix.
 *
 * ── Guarantees ───────────────────────────────────────────────────────────────
 *  - deterministic numeric ordering (baseline first, then 002, 003, … 026)
 *  - each file applied at most once, recorded in `schema_migrations`
 *  - one transaction per migration: a failure rolls back that migration AND
 *    leaves it unrecorded, so it is retried next run rather than silently skipped
 *  - the run aborts on the first failure; later migrations are not attempted
 *  - a session-level advisory lock serialises concurrent deploys
 *  - credentials come only from the environment; nothing secret is logged
 *  - never drops, truncates or resets anything
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');
const { buildSslOptions, TLS_HELP } = require('../config/dbSsl');

const SCHEMA_FILE = path.join(__dirname, '..', 'schema.sql');
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

// Identifies the baseline in the ledger. Stable — do not rename.
const BASELINE_NAME = 'schema.sql';

// Arbitrary but fixed key so every deploy contends for the same lock.
const ADVISORY_LOCK_KEY = 4_182_026_001;
const LOCK_RETRY_MS = 1000;
const LOCK_TIMEOUT_MS = 60_000;

// ── psql compatibility ───────────────────────────────────────────────────────
// The historical migration 009_gdpr_compliance.sql ends with `\echo '...'`, a
// psql meta-command. psql strips those itself; the pg driver cannot, and because
// the file is sent as one statement the syntax error rolls back the entire
// migration (silently omitting audit_log and the GDPR tables).
//
// We therefore remove ONLY `\echo` lines — a pure console-output directive with
// no database effect — and we do it loudly. Any OTHER meta-command (\i, \copy,
// \set, \gexec, …) can change what SQL actually runs, so rather than guess we
// abort and tell the operator to apply that file with psql.
const ECHO_META = /^[ \t]*\\echo\b.*$/;
const ANY_META = /^[ \t]*\\[a-zA-Z]/;

/**
 * @returns {{sql: string, strippedEchoLines: number[]}}
 * @throws if the file contains a meta-command we refuse to interpret
 */
const prepareSql = (filename, raw) => {
  const lines = raw.split(/\r?\n/);
  const strippedEchoLines = [];
  const unsupported = [];

  const out = lines.map((line, i) => {
    if (ECHO_META.test(line)) {
      strippedEchoLines.push(i + 1);
      return ''; // keep line numbering stable for error messages
    }
    if (ANY_META.test(line)) {
      unsupported.push(`${i + 1}: ${line.trim()}`);
    }
    return line;
  });

  if (unsupported.length) {
    throw new Error(
      `${filename} contains psql meta-commands this runner will not interpret:\n` +
      unsupported.map((u) => `    ${u}`).join('\n') +
      `\n  Apply this file manually with:  psql -d <db> -v ON_ERROR_STOP=1 -f migrations/${filename}\n` +
      '  then re-run the migration command.'
    );
  }

  return { sql: out.join('\n'), strippedEchoLines };
};

// ── ordering ─────────────────────────────────────────────────────────────────
const numericPrefix = (name) => {
  const m = name.match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
};

/** Baseline first, then migrations by numeric prefix. */
const buildPlan = () => {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => numericPrefix(a) - numericPrefix(b) || a.localeCompare(b))
    .map((f) => ({ name: f, file: path.join(MIGRATIONS_DIR, f) }));

  return [{ name: BASELINE_NAME, file: SCHEMA_FILE }, ...files];
};

const checksum = (text) =>
  crypto.createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');

// ── connection ───────────────────────────────────────────────────────────────
const connect = async () => {
  const database = process.env.DB_NAME || 'treniko_db';
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || undefined,
    // Same verified-TLS policy as the runtime pool (see config/dbSsl.js). The
    // migration runner carries the same credentials over the same network, so
    // it must not be the weaker of the two.
    ...buildSslOptions(),
  });
  try {
    await client.connect();
  } catch (e) {
    e.message = `${e.message}
  ${TLS_HELP}`;
    throw e;
  }
  // Database name only — never credentials.
  console.log(`database: ${database}`);
  return client;
};

const ensureLedger = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename     TEXT PRIMARY KEY,
      checksum     TEXT NOT NULL,
      applied_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      execution_ms INTEGER,
      baselined    BOOLEAN NOT NULL DEFAULT FALSE
    )`);
  await client.query(`
    COMMENT ON TABLE schema_migrations IS
      'One row per applied migration file. baselined=true means the file was adopted by db:baseline after its objects were verified present, rather than executed by this runner.'`);
};

const appliedMap = async (client) => {
  const { rows } = await client.query(
    'SELECT filename, checksum, baselined FROM schema_migrations');
  return new Map(rows.map((r) => [r.filename, r]));
};

const acquireLock = async (client) => {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  for (;;) {
    const { rows } = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [ADVISORY_LOCK_KEY]);
    if (rows[0].ok) return;
    if (Date.now() > deadline) {
      throw new Error(
        'could not acquire the migration advisory lock within 60s — another migration run is in progress');
    }
    console.log('waiting for migration lock held by another run…');
    await new Promise((r) => setTimeout(r, LOCK_RETRY_MS));
  }
};

const releaseLock = async (client) => {
  try { await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]); } catch { /* closing anyway */ }
};

/** Is this a populated pre-migration-tracking database? */
const looksLikeExistingDb = async (client) => {
  const { rows } = await client.query("SELECT to_regclass('public.tenants') IS NOT NULL AS present");
  return rows[0].present;
};

// ── commands ─────────────────────────────────────────────────────────────────

/**
 * Apply pending migrations.
 *
 * @param {import('pg').Client} client
 * @param {object} [options]
 * @param {number} [options.through] stop after the migration with this numeric
 *   prefix. It can only make the run stop EARLIER — never skip a file, never
 *   reorder one — so a database built with it is always a genuine prefix of the
 *   full sequence. That is what makes it usable to reproduce a previous
 *   production state (e.g. `--through 028`) before testing an upgrade.
 */
const migrate = async (client, { through } = {}) => {
  await ensureLedger(client);
  const applied = await appliedMap(client);
  const plan = buildPlan().filter(
    (step) => through === undefined || step.name === BASELINE_NAME || numericPrefix(step.name) <= through
  );

  // Guard: an existing database with an empty ledger must be baselined first,
  // otherwise we would try to re-run schema.sql (which is not idempotent) and
  // every historical migration against a database that already has them.
  if (applied.size === 0 && await looksLikeExistingDb(client)) {
    throw new Error(
      'this database already has application tables but no migration history.\n' +
      '  Adopt it into migration tracking first:\n' +
      '      npm run db:baseline          (dry run — shows what would be recorded)\n' +
      '      npm run db:baseline -- --apply\n' +
      '  Then run npm run db:migrate again.'
    );
  }

  const pending = [];
  for (const step of plan) {
    const raw = fs.readFileSync(step.file, 'utf8');
    const sum = checksum(raw);
    const prev = applied.get(step.name);
    if (prev) {
      if (prev.checksum !== sum) {
        console.warn(
          `WARNING  ${step.name} has changed since it was applied ` +
          '(checksum mismatch). It will NOT be re-run. Historical migrations ' +
          'should be treated as immutable — add a new migration instead.');
      }
      continue;
    }
    pending.push({ ...step, raw, sum });
  }

  if (!pending.length) {
    console.log(`up to date — ${applied.size} migration(s) already applied, 0 pending`);
    return;
  }

  console.log(`${pending.length} pending migration(s):`);
  pending.forEach((p) => console.log(`   - ${p.name}`));
  console.log('');

  for (const step of pending) {
    const { sql, strippedEchoLines } = prepareSql(step.name, step.raw);
    if (strippedEchoLines.length) {
      console.log(
        `   note: ignored psql \\echo on line(s) ${strippedEchoLines.join(', ')} of ${step.name} ` +
        '(console output only, no database effect)');
    }

    const started = Date.now();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        `INSERT INTO schema_migrations (filename, checksum, execution_ms, baselined)
         VALUES ($1, $2, $3, FALSE)`,
        [step.name, step.sum, Date.now() - started]
      );
      await client.query('COMMIT');
      console.log(`   applied  ${step.name}  (${Date.now() - started}ms)`);
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      // Not recorded: the migration will be retried on the next run.
      throw new Error(
        `migration failed: ${step.name}\n  ${e.message.split('\n')[0]}\n` +
        '  The transaction was rolled back and the migration was NOT recorded as applied.\n' +
        '  No further migrations were attempted.');
    }
  }

  console.log(`\ndone — ${pending.length} migration(s) applied`);
};

const status = async (client) => {
  await ensureLedger(client);
  const applied = await appliedMap(client);
  const plan = buildPlan();

  let pending = 0;
  for (const step of plan) {
    const prev = applied.get(step.name);
    if (!prev) {
      pending += 1;
      console.log(`  PENDING    ${step.name}`);
      continue;
    }
    const sum = checksum(fs.readFileSync(step.file, 'utf8'));
    const drift = prev.checksum !== sum ? '  [CHANGED SINCE APPLIED]' : '';
    console.log(`  ${prev.baselined ? 'BASELINED' : 'applied  '}  ${step.name}${drift}`);
  }
  console.log(`\n${plan.length - pending} applied, ${pending} pending`);
};

/**
 * Adopt an existing database into migration tracking.
 *
 * Records a historical migration as applied ONLY when a probe confirms the
 * objects it creates are actually present. Anything unverified is left pending
 * so db:migrate will apply it for real — the tracker is never told something
 * that was not checked.
 *
 * Dry run by default; pass --apply to write.
 */
const baseline = async (client, { apply }) => {
  await ensureLedger(client);
  const applied = await appliedMap(client);
  const plan = buildPlan();

  const probes = require('./migrationProbes');

  const verified = [];
  const unverified = [];

  for (const step of plan) {
    if (applied.has(step.name)) continue;

    const probe = probes[step.name];
    if (!probe) {
      unverified.push({ name: step.name, reason: 'no verification probe defined' });
      continue;
    }
    const { rows } = await client.query(probe.sql);
    if (rows[0].present) {
      verified.push({ name: step.name, evidence: probe.describes });
    } else {
      unverified.push({ name: step.name, reason: `not present: ${probe.describes}` });
    }
  }

  console.log(`\nalready tracked : ${applied.size}`);
  console.log(`verified present: ${verified.length}`);
  verified.forEach((v) => console.log(`   + ${v.name}   (verified: ${v.evidence})`));
  console.log(`left pending    : ${unverified.length}`);
  unverified.forEach((u) => console.log(`   - ${u.name}   (${u.reason})`));

  if (!apply) {
    console.log('\nDRY RUN — nothing was written.');
    console.log('Re-run with:  npm run db:baseline -- --apply');
    return;
  }

  if (!verified.length) {
    console.log('\nnothing to record.');
    return;
  }

  await client.query('BEGIN');
  try {
    for (const v of verified) {
      const step = plan.find((p) => p.name === v.name);
      await client.query(
        `INSERT INTO schema_migrations (filename, checksum, execution_ms, baselined)
         VALUES ($1, $2, NULL, TRUE)
         ON CONFLICT (filename) DO NOTHING`,
        [v.name, checksum(fs.readFileSync(step.file, 'utf8'))]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  }

  console.log(`\nrecorded ${verified.length} migration(s) as already applied (baselined).`);
  if (unverified.length) {
    console.log(`${unverified.length} left pending — run: npm run db:migrate`);
  }
};

// ── entry point ──────────────────────────────────────────────────────────────
(async () => {
  const argv = process.argv.slice(2);
  const command = argv.find((a) => !a.startsWith('-')) || 'migrate';
  const apply = argv.includes('--apply');

  const throughArg = argv.indexOf('--through');
  let through;
  if (throughArg !== -1) {
    through = parseInt(argv[throughArg + 1], 10);
    if (!Number.isInteger(through)) {
      console.error('usage: migrate.js migrate --through <migration-number>');
      process.exitCode = 1;
      return;
    }
  }

  let client;
  try {
    client = await connect();
    await acquireLock(client);

    if (command === 'migrate') await migrate(client, { through });
    else if (command === 'status') await status(client);
    else if (command === 'baseline') await baseline(client, { apply });
    else {
      console.error(`unknown command: ${command}`);
      console.error('usage: migrate.js [migrate [--through N]|status|baseline [--apply]]');
      process.exitCode = 1;
    }
  } catch (e) {
    console.error(`\nERROR: ${e.message}`);
    process.exitCode = 1;
  } finally {
    if (client) {
      await releaseLock(client);
      await client.end().catch(() => {});
    }
  }
})();
