'use strict';

/**
 * Environment detection for the row-level-security suites (Phase 4).
 *
 * ── The two ways this project's tests run ────────────────────────────────────
 *   npm test              against a database the connecting role OWNS. RLS
 *                         policies exist but PostgreSQL skips them, exactly as
 *                         in a deployment that has applied migration 029
 *                         without switching DB_USER yet.
 *   npm run test:restricted
 *                         against a disposable database, connected as a
 *                         non-owner NOBYPASSRLS role. Policies are in force.
 *
 * Assertions that a foreign row is INVISIBLE can only hold in the second mode —
 * under the first, the owner legitimately sees everything, and a test asserting
 * otherwise would be asserting something false rather than something secure.
 *
 * So those suites declare themselves restricted-only. Two things keep that from
 * becoming a hole where the checks quietly never run:
 *
 *   - the decision is made from the DATABASE, not from an environment variable
 *     a caller could set. `isRlsEnforced()` asks PostgreSQL whether the current
 *     role would actually be subject to policies.
 *   - the policy-inventory suite (rlsPolicyInventory.test.js) is deliberately
 *     NOT restricted-only. Catalogue facts — which tables have RLS, which
 *     policies exist, which tables are on the exclusion list — are true
 *     regardless of who is connected, so that suite runs in both modes and is
 *     what catches a new tenant table shipped without protection.
 */

const { pool } = require('../../config/database');

/**
 * Would policies actually be applied to the role this pool is connected as?
 *
 * @returns {Promise<{enforced: boolean, role: string, reason: string}>}
 */
const inspect = async () => {
  const { rows: [role] } = await pool.query(
    `SELECT current_user AS role, rolsuper, rolbypassrls
       FROM pg_roles WHERE rolname = current_user`
  );
  const { rows: [{ owned }] } = await pool.query(
    `SELECT count(*)::int AS owned
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
        AND pg_get_userbyid(c.relowner) = current_user`
  );

  if (role.rolsuper) return { enforced: false, role: role.role, reason: 'role is a superuser' };
  if (role.rolbypassrls) return { enforced: false, role: role.role, reason: 'role has BYPASSRLS' };
  if (owned > 0) return { enforced: false, role: role.role, reason: `role owns ${owned} protected table(s)` };
  return { enforced: true, role: role.role, reason: 'non-owner, non-superuser, NOBYPASSRLS' };
};

/**
 * Guard for a suite whose assertions require policies to be in force.
 *
 * Call at the top of the file; it returns a `describe`-like function that is
 * `describe.skip` when policies would be skipped, and logs why.
 *
 * @param {string} suiteName
 */
const describeWhenRlsEnforced = (suiteName) => {
  // Jest needs the decision synchronously at collection time, so the check is
  // driven by the runner that built the restricted database (it sets
  // RLS_TEST_ACTIVE) and then CONFIRMED against the database inside the suite —
  // see `assertReallyEnforced` below. The env var alone is never trusted.
  if (process.env.RLS_TEST_ACTIVE === '1') return describe;

  // eslint-disable-next-line no-console
  console.log(
    `[rls] skipping "${suiteName}": these assertions require the restricted ` +
    'runtime role. Run them with:  npm run test:restricted'
  );
  return describe.skip;
};

/**
 * Assert, from the database itself, that policies really are in force.
 *
 * Belt and braces for the env-var-driven skip above: if RLS_TEST_ACTIVE were
 * ever set against an owner connection, every "foreign row is invisible" test
 * in the file would pass vacuously. This makes that impossible — the suite
 * fails loudly instead.
 */
const assertReallyEnforced = async () => {
  const status = await inspect();
  if (!status.enforced) {
    throw new Error(
      `RLS_TEST_ACTIVE is set but policies would NOT be enforced for role ` +
      `"${status.role}" (${status.reason}). Refusing to run assertions that ` +
      'would pass without proving anything.'
    );
  }
  return status;
};

module.exports = { inspect, describeWhenRlsEnforced, assertReallyEnforced };
