#!/usr/bin/env node
'use strict';

/**
 * Remove the leftover tenant shell left behind by a live QA run.
 *
 *   node scripts/cleanup-qa-tenant.js --marker TRENIKO-LIVE-QA-20260816T142228Z
 *   node scripts/cleanup-qa-tenant.js --marker <marker> --apply
 *   node scripts/cleanup-qa-tenant.js --marker <marker> --orphaned --apply
 *
 * ── What this is for ─────────────────────────────────────────────────────────
 * A QA account was created in production, exercised, and then erased through
 * the supported account-deletion path. That path (before the fix in
 * jobs/deletionJob.js) removed the trainer and every row hanging off them, but
 * left the `tenants` row itself, plus the tenant's `tenant_subscriptions` and
 * `subscription_usage` rows — an empty shell carrying no personal data.
 *
 * This script removes exactly that shell, and nothing else.
 *
 * ── Why it is written this way ───────────────────────────────────────────────
 * It is deliberately not a DELETE anybody can point at a tenant. Every run:
 *
 *   1. resolves the marker to tenants whose NAME CONTAINS the marker, and
 *      refuses to continue unless EXACTLY ONE matches;
 *   2. establishes that tenant's context — without it, row-level security hides
 *      the very rows the emptiness check is looking for and every count reads 0
 *      — and refuses to continue unless the context is verifiably in effect;
 *   3. requires the tenant to have NO users at all — see below — and then
 *      counts the rows of every tenant-scoped product table, refusing to
 *      continue if any is non-empty unless --orphaned is given;
 *   4. deletes by that one resolved tenant id, inside a transaction, asserting
 *      the affected row counts as it goes, and rolls back on any surprise;
 *   5. re-verifies that nothing matching the marker remains.
 *
 * ── `users` is the gate; the other tables are a warning ──────────────────────
 * The emptiness check was originally uniform: any product row at all aborted
 * the run. Pointed at the real leftover in production it aborted — the tenant
 * held three training_sessions, an exercise, a group, a group session and a
 * package, all of them QA-marked, all with client_id NULL, and NO users.
 *
 * That combination is not an occupied account. It is the signature of the very
 * bug this cleanup exists to mop up: the OLD deletion path removed the trainer
 * and the clients and then stopped, so everything else in the tenant was left
 * behind unreachable. With zero users nobody can authenticate into the tenant,
 * so no one can read, own or recover those rows.
 *
 * So the two conditions are separated by how much they actually prove:
 *
 *   users > 0    ABSOLUTE. A tenant with a user is somebody's live account and
 *                is never deleted by this script, whatever flags are passed and
 *                whatever its name says. There is no override.
 *   other rows   A refusal by default, because an operator who expected an
 *                empty shell must see that it is not one. `--orphaned` accepts
 *                them — after the full inventory has been printed — and is the
 *                only way to clear a tenant the old deletion bug stranded.
 *
 * It is a dry run unless --apply is given, and it prints the full evidence
 * either way. `--tenant-id <uuid>` may be supplied as an additional guard: when
 * present, the resolved tenant must be that exact id or the run aborts.
 *
 * Credentials come from the environment like every other script here.
 */

require('dotenv').config();

const { Client } = require('pg');
const { buildSslOptions, TLS_HELP } = require('../config/dbSsl');

/**
 * Every table that holds tenant-scoped product or personal data.
 *
 * `column` is the tenant key. Tables reached only through a parent (training
 * sets, attendance rows, …) are covered by the parent's count: they cannot
 * exist without it.
 *
 * If a future migration adds a tenant-scoped table and it is not listed here,
 * the emptiness check is weaker than it looks — so the script also asks the
 * catalogue for every table carrying a tenant_id column and fails if it finds
 * one this list does not mention.
 */
const TENANT_DATA_TABLES = [
  ['users', 'tenant_id'],
  ['clients', 'tenant_id'],
  ['training_sessions', 'tenant_id'],
  ['trainings', 'tenant_id'],
  ['exercises', 'tenant_id'],
  ['training_templates', 'tenant_id'],
  ['progress_entries', 'tenant_id'],
  ['training_images', 'tenant_id'],
  ['training_logs', 'tenant_id'],
  ['groups', 'tenant_id'],
  ['group_sessions', 'tenant_id'],
  ['packages', 'tenant_id'],
  ['client_packages', 'tenant_id'],
  ['client_payments', 'tenant_id'],
  ['session_attendees', 'tenant_id'],
  ['package_session_usage', 'tenant_id'],
];

/**
 * Rows that MAY remain and that this script is authorised to remove.
 *
 * `deletion_requests` is here for a reason worth writing down. Migration 009
 * creates it keyed by `trainer_id` alone, with NO tenant_id column — so on a
 * freshly migrated database the catalogue cross-check below never sees it, and
 * this list never needed to mention it. Production, however, carries an OLDER
 * table of that name from before migration tracking, and that one DOES have
 * `tenant_id` (the same CREATE TABLE IF NOT EXISTS drift that migration 032
 * repairs for password_reset_tokens). The cross-check therefore fired against
 * production and only against production, and the script refused to clean the
 * very tenant shell it was written to remove.
 *
 * It belongs on THIS list, not TENANT_DATA_TABLES: a deletion request is a
 * lifecycle record of the account's own erasure — timestamps, a status and ids
 * — not product or personal data. Requiring it to be empty would make the
 * script permanently unable to clean up exactly the case it exists for, since a
 * tenant that went through account deletion always has one. It is also already
 * ON DELETE CASCADE from tenants, so removing it explicitly changes nothing
 * about the outcome; it only makes the count visible in the evidence printed
 * below.
 */
const SHELL_TABLES = [
  // Migration 033. Records of administrator actions taken against this tenant.
  // In SHELL_TABLES rather than TENANT_DATA_TABLES deliberately: performing an
  // admin action on a QA tenant during a QA run is expected, so treating these
  // rows as "must be empty first" would block the very cleanup this script
  // exists to do. For a real tenant the log is never touched — this script only
  // ever resolves a single marker-matched QA tenant.
  ['admin_audit_log', 'tenant_id'],
  ['subscription_usage', 'tenant_id'],
  ['tenant_subscriptions', 'tenant_id'],
  ['subscription_notifications', 'tenant_id'],
  ['subscription_history', 'tenant_id'],
  ['deletion_requests', 'tenant_id'],
];

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};

const tableExists = async (client, name) => {
  const { rows } = await client.query(
    `SELECT to_regclass('public.' || $1) IS NOT NULL AS present`, [name]);
  return rows[0].present;
};

const countFor = async (client, table, column, tenantId) => {
  if (!(await tableExists(client, table))) return null;
  const { rows } = await client.query(
    `SELECT count(*)::int AS n FROM public.${table} WHERE ${column} = $1`, [tenantId]);
  return rows[0].n;
};

const run = async () => {
  const marker = arg('marker');
  const expectedId = arg('tenant-id');
  const apply = process.argv.includes('--apply');
  const orphaned = process.argv.includes('--orphaned');

  if (!marker) {
    throw new Error(
      'usage: cleanup-qa-tenant.js --marker <QA marker> [--tenant-id <uuid>] [--orphaned] [--apply]');
  }
  if (marker.length < 12) {
    throw new Error('refusing to run: the marker is too short to identify a single tenant safely');
  }

  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME || 'treniko_db',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ...buildSslOptions(),
  });

  try {
    await client.connect();
  } catch (e) {
    e.message = `${e.message}\n  ${TLS_HELP}`;
    throw e;
  }

  try {
    console.log(`database : ${process.env.DB_NAME || 'treniko_db'}  (role: ${(await client.query('SELECT current_user AS u')).rows[0].u})`);
    console.log(`marker   : ${marker}`);
    console.log(apply ? 'mode     : APPLY\n' : 'mode     : DRY RUN (nothing will be written)\n');

    // ── 1. Resolve the marker to exactly one tenant ──────────────────────────
    const { rows: matches } = await client.query(
      'SELECT id, name, created_at FROM tenants WHERE name LIKE $1 ORDER BY created_at',
      [`%${marker}%`]
    );

    console.log(`tenants matching the marker: ${matches.length}`);
    matches.forEach((t) => console.log(`   ${t.id}  ${t.name}`));

    if (matches.length === 0) {
      console.log('\nNothing to do — no tenant carries this marker.');
      return { removed: false, reason: 'no match' };
    }
    if (matches.length > 1) {
      throw new Error(
        `refusing to delete: ${matches.length} tenants match the marker, expected exactly 1`);
    }

    const tenant = matches[0];
    if (expectedId && tenant.id !== expectedId) {
      throw new Error(
        `refusing to delete: the marker resolved to ${tenant.id}, not the expected ${expectedId}`);
    }

    // ── 2. Prove the tenant is empty ─────────────────────────────────────────
    // Catalogue cross-check first: a tenant-scoped table this script does not
    // know about would make the emptiness proof below incomplete.
    const { rows: catalogue } = await client.query(
      `SELECT c.relname AS table_name
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         JOIN pg_attribute a ON a.attrelid = c.oid
        WHERE n.nspname = 'public' AND c.relkind = 'r'
          AND a.attname = 'tenant_id' AND a.attnum > 0 AND NOT a.attisdropped
        ORDER BY c.relname`
    );
    const known = new Set([...TENANT_DATA_TABLES, ...SHELL_TABLES].map(([t]) => t));
    const unknown = catalogue.map((r) => r.table_name).filter((t) => !known.has(t));
    if (unknown.length) {
      throw new Error(
        `refusing to delete: these tenant-scoped tables are not covered by this script: ${unknown.join(', ')}`);
    }

    // ── 2a. Make the counts able to SEE the rows ────────────────────────────
    //
    // This is the single most important step in the script, and it is not
    // obvious. Most of the tables above are protected by row-level security,
    // and this script connects as the ordinary runtime role. A count issued
    // with NO tenant context therefore returns 0 for every one of them —
    // including for a tenant full of clients, trainings and payments. The
    // emptiness proof would be unanimous, confident and completely wrong, and
    // it would authorise deleting a live account.
    //
    // So the context is established first, exactly as an authenticated request
    // does, and then CHECKED. If it cannot be established and the connecting
    // role is subject to policies, the run aborts rather than counting blind.
    await client.query('SELECT set_config($1, $2, false)', ['app.current_tenant_id', tenant.id]);

    const { rows: [ctx] } = await client.query(`
      SELECT
        (SELECT to_regprocedure('public.app_current_tenant_id()') IS NOT NULL) AS accessor,
        current_user AS role,
        (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user) AS unrestricted,
        (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
            AND pg_get_userbyid(c.relowner) = current_user) AS owned`);

    let visible = ctx.unrestricted || ctx.owned > 0;
    if (ctx.accessor) {
      const { rows: [bound] } = await client.query('SELECT app_current_tenant_id() AS t');
      if (String(bound.t) === String(tenant.id)) visible = true;
      console.log(`\ntenant context: ${bound.t || 'none'} (role ${ctx.role})`);
    } else {
      console.log(`\ntenant context: not applicable — this database predates it (role ${ctx.role})`);
    }

    if (!visible) {
      throw new Error(
        'refusing to delete: the tenant context could not be established, so the ' +
        'row counts below would read 0 for every RLS-protected table whether or ' +
        'not the tenant is empty. Nothing was checked and nothing will be deleted.');
    }

    console.log('\nrow counts for this tenant:');
    let occupied = 0;
    let userRows = 0;
    const occupiedTables = [];
    for (const [table, column] of TENANT_DATA_TABLES) {
      const n = await countFor(client, table, column, tenant.id);
      if (n === null) { console.log(`   ${table.padEnd(28)} (table absent)`); continue; }
      console.log(`   ${table.padEnd(28)} ${n}${n > 0 ? '   <-- occupied' : ''}`);
      if (table === 'users') userRows = n;
      if (n > 0) { occupied += n; occupiedTables.push(`${table}=${n}`); }
    }
    const shellCounts = {};
    for (const [table, column] of SHELL_TABLES) {
      const n = await countFor(client, table, column, tenant.id);
      shellCounts[table] = n;
      console.log(`   ${table.padEnd(28)} ${n === null ? '(table absent)' : n}   [removable shell row]`);
    }

    // ── The absolute gate ────────────────────────────────────────────────────
    // A tenant with even one user is somebody's account. No flag reaches past
    // this, and it is checked before the softer condition below so that a run
    // carrying --orphaned can never talk its way through it.
    if (userRows > 0) {
      throw new Error(
        `refusing to delete: tenant ${tenant.id} still has ${userRows} user(s). ` +
        'A tenant with users is a live account, not a leftover shell, and this ' +
        'script will not remove it under any flag.');
    }

    // ── The softer one ───────────────────────────────────────────────────────
    // Zero users and product rows still present is the fingerprint of the old
    // deletion bug: rows stranded in a tenant nobody can log in to. It still
    // stops by default, because an operator who came here expecting an empty
    // shell needs to see that it is not one, and needs to read the inventory
    // above before agreeing to remove it.
    if (occupied > 0 && !orphaned) {
      throw new Error(
        `refusing to delete: tenant ${tenant.id} still holds ${occupied} row(s) of ` +
        `product data (${occupiedTables.join(', ')}).\n` +
        '  It has no users, so this may be data stranded by the pre-fix deletion\n' +
        '  path rather than a live account. Check the inventory above; if every\n' +
        '  row is expendable, re-run with --orphaned to accept them.');
    }

    if (occupied > 0) {
      console.log(
        `\n--orphaned: accepting ${occupied} stranded row(s) (${occupiedTables.join(', ')})` +
        '\n            in a tenant with 0 users; the tenant cascade removes them.');
    }

    if (!apply) {
      console.log('\nDRY RUN — all guards passed. Re-run with --apply to delete this tenant shell.');
      return { removed: false, reason: 'dry run', tenantId: tenant.id };
    }

    // ── 3. Delete, by exact id, inside one transaction ───────────────────────
    await client.query('BEGIN');
    try {
      const removed = {};

      // ── Empty the trigger-bearing tables first ─────────────────────────────
      // Same hazard jobs/deletionJob.js documents: `clients` and
      // `training_sessions` carry AFTER DELETE triggers that maintain
      // subscription_usage, and get_current_usage_period() RE-CREATES the usage
      // row when it is missing. Fired from inside the `tenants` cascade, that
      // insert references a tenant row being deleted by the same statement and
      // the whole delete fails on a foreign key. Emptied explicitly here, while
      // the tenant still exists, the trigger has something valid to write to
      // and the later cascade has no rows left to fire on.
      //
      // On a genuinely empty shell both statements delete nothing, so this
      // costs a no-op; it only matters on the --orphaned path.
      for (const table of ['training_sessions', 'clients']) {
        if (!(await tableExists(client, table))) continue;
        const r = await client.query(
          `DELETE FROM public.${table} WHERE tenant_id = $1`, [tenant.id]);
        if (r.rowCount > 0) removed[table] = r.rowCount;
      }

      for (const [table, column] of SHELL_TABLES) {
        if (shellCounts[table] === null) continue;
        const r = await client.query(
          `DELETE FROM public.${table} WHERE ${column} = $1`, [tenant.id]);
        removed[table] = r.rowCount;
      }

      const t = await client.query('DELETE FROM tenants WHERE id = $1', [tenant.id]);
      if (t.rowCount !== 1) {
        throw new Error(`expected to delete exactly 1 tenant row, deleted ${t.rowCount}`);
      }

      // Fail closed: nothing may match the marker afterwards, and no other
      // tenant may have been touched.
      const { rows: [{ n: left }] } = await client.query(
        'SELECT count(*)::int AS n FROM tenants WHERE name LIKE $1', [`%${marker}%`]);
      if (left !== 0) throw new Error(`${left} tenant(s) still match the marker after deletion`);

      // The cascade is what actually clears the product tables, so check that
      // it did rather than assuming it. A survivor here rolls the whole thing
      // back and leaves the tenant intact to be looked at.
      for (const [table, column] of TENANT_DATA_TABLES) {
        const n = await countFor(client, table, column, tenant.id);
        if (n) {
          throw new Error(
            `${n} row(s) survived in ${table} after the tenant cascade`);
        }
      }

      await client.query('COMMIT');

      console.log('\ndeleted:');
      Object.entries(removed).forEach(([k, v]) => console.log(`   ${k.padEnd(28)} ${v}`));
      console.log(`   ${'tenants'.padEnd(28)} 1`);
      console.log(`\nVERIFIED: 0 rows remain for marker ${marker}.`);
      return { removed: true, tenantId: tenant.id, counts: removed };
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw new Error(`deletion rolled back, nothing was removed: ${e.message}`);
    }
  } finally {
    await client.end().catch(() => {});
  }
};

if (require.main === module) {
  run().catch((e) => {
    console.error(`\nERROR: ${e.message}`);
    process.exitCode = 1;
  });
}

module.exports = { run, TENANT_DATA_TABLES, SHELL_TABLES };
