'use strict';

/**
 * Startup report on whether row-level security is actually in force
 * (Security Hardening Phase 4).
 *
 * ── The problem this exists to prevent ───────────────────────────────────────
 * Migration 029 uses ENABLE ROW LEVEL SECURITY rather than FORCE, and
 * PostgreSQL skips policies for a table's OWNER and for any role holding
 * BYPASSRLS. That is what makes the migration safe to apply ahead of the role
 * change — but it also means a deployment can have every policy correctly in
 * place and still be enforcing none of them, simply because DB_USER was never
 * switched away from the owner.
 *
 * There is no way to detect that from the application's behaviour: queries
 * succeed and return the right rows either way, because the explicit
 * `WHERE tenant_id = $n` filtering is doing the work. The difference only shows
 * up when a query is missing that clause — that is, at the exact moment the
 * backstop was supposed to matter.
 *
 * So it is reported explicitly at startup instead of being assumed.
 *
 * This module only ever reads catalogue metadata and logs. It never changes a
 * privilege, never fails a boot, and never logs a credential.
 */

const { pool } = require('./database');

/**
 * Determine, for the role the pool is actually connected as, whether policies
 * would be applied to it.
 *
 * @param {{query: Function}} [db] injectable for tests
 * @returns {Promise<{role: string, isSuperuser: boolean, bypassRls: boolean,
 *   ownedProtectedTables: string[], protectedTables: number, effective: boolean}>}
 */
const inspectRlsEffectiveness = async (db = pool) => {
  const { rows: [role] } = await db.query(`
    SELECT current_user                       AS role,
           r.rolsuper                         AS is_superuser,
           r.rolbypassrls                     AS bypass_rls
      FROM pg_roles r
     WHERE r.rolname = current_user`);

  // Tables that have RLS enabled AND are owned by the connecting role: for
  // these, policies are skipped no matter how well they are written.
  const { rows: owned } = await db.query(`
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'
       AND c.relrowsecurity
       AND pg_get_userbyid(c.relowner) = current_user
     ORDER BY c.relname`);

  const { rows: [{ count }] } = await db.query(`
    SELECT count(*)::int AS count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity`);

  const ownedProtectedTables = owned.map((r) => r.relname);

  return {
    role: role.role,
    isSuperuser: role.is_superuser,
    bypassRls: role.bypass_rls,
    ownedProtectedTables,
    protectedTables: count,
    effective:
      count > 0 &&
      !role.is_superuser &&
      !role.bypass_rls &&
      ownedProtectedTables.length === 0,
  };
};

/**
 * Log the result. Loud when RLS is not in force, quiet-but-explicit when it is.
 *
 * Never throws: a monitoring feature must not be able to take the service down.
 * A failure to inspect is itself reported, because silence would be
 * indistinguishable from a clean result.
 *
 * @param {object} [options]
 * @param {{query: Function}} [options.db]
 * @param {Console} [options.logger]
 */
const reportRlsStatus = async ({ db = pool, logger = console } = {}) => {
  let status;
  try {
    status = await inspectRlsEffectiveness(db);
  } catch (err) {
    logger.warn(`⚠️  Could not determine row-level security status: ${err.message}`);
    return null;
  }

  if (status.protectedTables === 0) {
    logger.warn(
      '⚠️  Row-level security: no policies found. Migration 029 has not been applied ' +
      'to this database. Tenant isolation rests on application filtering alone.'
    );
    return status;
  }

  if (status.effective) {
    logger.log(
      `✅ Row-level security in force for role "${status.role}" ` +
      `across ${status.protectedTables} tables.`
    );
    return status;
  }

  // Name the specific reason rather than a generic warning — the remedy is
  // different for each, and an operator reading this at 3am should not have to
  // work out which one applies.
  const reasons = [];
  if (status.isSuperuser) reasons.push('the role is a SUPERUSER');
  if (status.bypassRls) reasons.push('the role carries BYPASSRLS');
  if (status.ownedProtectedTables.length) {
    reasons.push(
      `the role OWNS ${status.ownedProtectedTables.length} of the protected tables ` +
      '(PostgreSQL skips policies for a table owner)'
    );
  }

  logger.warn(
    `⚠️  Row-level security is NOT in force for role "${status.role}", because ` +
    `${reasons.join(' and ')}. ${status.protectedTables} tables have policies that ` +
    'are being skipped. Tenant isolation currently rests on application-level ' +
    'filtering alone. Remedy: run backend/scripts/least-privilege.sql and set ' +
    'DB_USER to the dedicated runtime role.'
  );
  return status;
};

/**
 * In production, refuse to serve traffic with row-level security silently off.
 *
 * `reportRlsStatus` writes a warning, which is the right thing in development
 * and the wrong thing on a production box: a warning in a PM2 log is exactly
 * the kind of signal that goes unread for months, and the whole point of the
 * policies is that nothing in the application's behaviour reveals their
 * absence. A deployment that connects as the table owner would run for a year
 * looking perfectly healthy with its second boundary disabled.
 *
 * So in production it is a startup failure instead. The remedy is one command
 * (backend/scripts/least-privilege.sql) plus a DB_USER change, and an operator
 * who genuinely needs to boot without it can set ALLOW_RLS_BYPASS=true and own
 * that decision explicitly.
 *
 * Never fails when the policies are absent altogether — a database that has not
 * had migration 029 applied is a different problem, already reported, and
 * blocking on it would make the migration impossible to roll out.
 *
 * @returns {Promise<boolean>} true when it is safe to continue
 */
const enforceRlsInProduction = async ({ db = pool, logger = console, exit = process.exit } = {}) => {
  const status = await reportRlsStatus({ db, logger });

  if (process.env.NODE_ENV !== 'production') return true;
  if (!status || status.protectedTables === 0 || status.effective) return true;
  if (process.env.ALLOW_RLS_BYPASS === 'true') {
    logger.warn(
      '⚠️  Continuing without row-level security because ALLOW_RLS_BYPASS=true. ' +
      'Tenant isolation rests on application filtering alone.'
    );
    return true;
  }

  logger.error(
    `❌ Refusing to start: row-level security is not in force for role "${status.role}" ` +
    'and NODE_ENV=production. Client health data is protected by one boundary instead ' +
    'of two. Run backend/scripts/least-privilege.sql, point DB_USER at the restricted ' +
    'runtime role, and restart. To start anyway, set ALLOW_RLS_BYPASS=true.'
  );
  exit(1);
  return false;
};

module.exports = { inspectRlsEffectiveness, reportRlsStatus, enforceRlsInProduction };
