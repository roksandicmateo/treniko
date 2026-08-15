'use strict';

/**
 * Test-only helper for seeding data that row-level security protects.
 *
 * ── Why this is needed ───────────────────────────────────────────────────────
 * Fixtures insert rows directly with `pool.query`, outside any HTTP request, so
 * there is no authenticated identity and therefore no tenant context. Once the
 * suite runs as the restricted runtime role, every protected table answers such
 * a query with zero rows — which is exactly the intended behaviour, and exactly
 * what would make the fixtures silently produce empty tenants.
 *
 * ── Why it is not a bypass ───────────────────────────────────────────────────
 * This does not weaken anything. It establishes a tenant context through the
 * SAME `runWithTenantContext` the server uses, so seeded writes are subject to
 * the same policies as production writes: an attempt to seed a row stamped with
 * a different tenant's id still fails. The alternatives that would have been
 * bypasses — disabling RLS for tests, granting BYPASSRLS, running fixtures as
 * the owner, or making a missing context permissive — are all deliberately
 * avoided, because each of them would mean the suite no longer tests the
 * architecture that ships.
 *
 * The only privilege this helper has is the one the application itself has:
 * it may name the tenant it is acting as. In production that name comes from a
 * verified JWT and can come from nowhere else (see server.js); here it comes
 * from the fixture that just created the tenant.
 */

const { runWithTenantContext } = require('../../config/tenantContext');
const { pool } = require('../../config/database');

/**
 * Run `fn` with a tenant context bound, exactly as an authenticated request would.
 *
 * @param {{tenantId: string, userId?: string}} identity
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 * @template T
 */
const asTenant = (identity, fn) => runWithTenantContext(identity, fn);

/**
 * One query, run as a tenant. The common case in assertions.
 *
 * Tests verify outcomes by reading rows back directly, and those reads are
 * subject to the policies like everything else — a verification query with no
 * context returns nothing and the assertion fails for the wrong reason. Passing
 * the tenant explicitly also documents, at each assertion, whose view of the
 * data is being checked, which matters in a suite whose subject is exactly that
 * distinction.
 *
 * @param {{tenantId: string, userId?: string}} identity — a fixture tenant works directly
 * @param {string} text
 * @param {any[]} [params]
 */
const queryAs = (identity, text, params) =>
  asTenant(identity, () => pool.query(text, params));

module.exports = { asTenant, queryAs };
