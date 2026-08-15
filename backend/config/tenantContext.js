'use strict';

const { AsyncLocalStorage } = require('async_hooks');
const { isUuid } = require('../utils/validation');

/**
 * Request-scoped tenant context (Security Hardening Phase 4).
 *
 * PostgreSQL row-level security needs to know which tenant is asking. The
 * mechanism has to satisfy four things at once:
 *
 *   1. It must reach every query, including the ~190 call sites that use
 *      `pool.query` directly and know nothing about tenants.
 *   2. It must never survive a pooled connection being returned to the pool —
 *      the next request to borrow that connection must not inherit it.
 *   3. A missing or malformed context must deny access, never crash and never
 *      fall back to "no filtering".
 *   4. It must come only from the verified identity on the request. A tenant id
 *      appearing in a body, a query string or a route parameter must have no
 *      influence whatsoever.
 *
 * ── How ──────────────────────────────────────────────────────────────────────
 * `AsyncLocalStorage` carries the tenant id for the lifetime of one request,
 * across every await, without threading a parameter through every function.
 * `config/database.js` reads it and applies the value to the database with
 * `SET LOCAL` semantics inside the transaction that runs the query, so the
 * setting is released at COMMIT/ROLLBACK. Point 2 is therefore a property of
 * PostgreSQL's transaction scoping rather than of our cleanup code — there is
 * no "reset" step that can be missed or skipped by an early return.
 *
 * ── What this does NOT change ────────────────────────────────────────────────
 * Application-level `WHERE tenant_id = $n` filtering remains exactly as it was
 * and remains the primary control. This is a second, independent boundary
 * underneath it, for the case where a query is written without that clause —
 * which is how TR-CRIT-2 happened.
 */

const storage = new AsyncLocalStorage();

/** The PostgreSQL setting names the policies read. */
const TENANT_SETTING = 'app.current_tenant_id';
const USER_SETTING = 'app.current_user_id';

/**
 * Run `callback` with a tenant context bound to the current async execution.
 *
 * @param {{tenantId: string, userId?: string}} identity — MUST come from the
 *   verified JWT (`req.user`), never from request data.
 * @param {Function} callback
 */
const runWithTenantContext = (identity, callback) => {
  const tenantId = identity && identity.tenantId;
  const userId = identity && identity.userId;

  // A context that is not a well-formed UUID is refused rather than passed on:
  // the value is interpolated into a `set_config` call, and a policy comparing
  // against a malformed value would raise instead of denying.
  if (!isUuid(tenantId)) {
    throw new Error('Refusing to establish a tenant context from a non-UUID tenant id');
  }

  return storage.run(
    { tenantId, userId: isUuid(userId) ? userId : null },
    callback
  );
};

/**
 * The context for the current async execution, or null outside a request.
 *
 * Returning null (rather than throwing) is deliberate: background jobs and the
 * pre-authentication endpoints legitimately run without one, and the tables
 * they touch are outside the enforced set. Enforced tables answer a missing
 * context with zero rows, which is the correct failure direction.
 *
 * @returns {{tenantId: string, userId: string|null}|null}
 */
const getTenantContext = () => storage.getStore() || null;

/**
 * SQL that establishes the context for the current transaction.
 *
 * The ids are interpolated rather than parameterised so this can be sent in the
 * same round trip as BEGIN. That is safe only because both values are asserted
 * to be UUIDs first — enforced here, not assumed. `true` is `is_local`, so the
 * settings are discarded when the transaction ends.
 *
 * @param {{tenantId: string, userId: string|null}} context
 * @returns {string}
 */
const contextSql = (context) => {
  if (!isUuid(context.tenantId)) {
    throw new Error('Refusing to build tenant context SQL from a non-UUID tenant id');
  }
  const parts = [`SELECT set_config('${TENANT_SETTING}', '${context.tenantId}', true)`];
  if (context.userId) {
    if (!isUuid(context.userId)) {
      throw new Error('Refusing to build user context SQL from a non-UUID user id');
    }
    parts.push(`SELECT set_config('${USER_SETTING}', '${context.userId}', true)`);
  }
  return parts.join('; ');
};

module.exports = {
  runWithTenantContext,
  getTenantContext,
  contextSql,
  TENANT_SETTING,
  USER_SETTING,
};
