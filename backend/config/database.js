const { Pool } = require('pg');
require('dotenv').config();
const { buildSslOptions } = require('./dbSsl');
const { getTenantContext, contextSql } = require('./tenantContext');

// PostgreSQL connection pool
const isSocketPath = (process.env.DB_HOST || '').startsWith('/');
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  ...(isSocketPath ? {} : { port: parseInt(process.env.DB_PORT) || 5432 }),
  database: process.env.DB_NAME || 'treniko_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || undefined,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  // TLS in production, with the server's certificate actually verified.
  // See config/dbSsl.js — this used to be `rejectUnauthorized: false`, which
  // encrypted the connection without authenticating the server.
  ...buildSslOptions(),
});

// Test database connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

/**
 * Execute a query with tenant context set for Row Level Security.
 *
 * ── What was wrong (TR-MED-8) ────────────────────────────────────────────────
 * The tenant id was set with `set_config(..., true)`. The third argument is
 * `is_local`, i.e. SET LOCAL semantics: the value lives until the end of the
 * *current transaction*. It was issued as its own standalone statement, and
 * outside an explicit transaction PostgreSQL wraps every statement in its own
 * implicit one — so the setting was discarded the moment that statement
 * finished, before the real query ever ran.
 *
 * That was not theoretical. Measured against the development database, a query
 * run through this helper saw `current_setting('app.current_tenant_id', true)`
 * as an empty string: the tenant context never reached the query at all.
 *
 * Wrapping both statements in one explicit transaction makes the setting hold
 * for the query it was meant for, and roll off automatically afterwards, so no
 * tenant context can leak onto the next user of a pooled connection.
 *
 * ── What this does NOT do ────────────────────────────────────────────────────
 * This does not make RLS an enforcement layer. Two other conditions still
 * prevent the policies from engaging, both out of scope for this change:
 *   - no table declares FORCE ROW LEVEL SECURITY, and
 *   - the application connects as the tables' owner (`postgres`, which also
 *     carries BYPASSRLS), for whom PostgreSQL skips policies entirely.
 * Tenant isolation therefore continues to rest on the explicit
 * `WHERE tenant_id = $n` clause in every query. Turning RLS into a real
 * backstop means routing *all* database access through a tenant-aware helper
 * (much of the codebase uses `pool.query` directly), adding FORCE RLS and
 * connecting as a non-owner role — a coordinated change, recorded as follow-up
 * work rather than half-applied here, because enabling it while any query path
 * still bypasses this helper would deny those queries in production.
 */
const queryWithTenant = async (text, params, tenantId) => {
  if (!tenantId) {
    // No tenant context to establish — behave exactly like a plain query.
    return pool.query(text, params);
  }

  const client = await pool.connect();
  try {
    // BEGIN and the context are sent together, as one round trip. The user id
    // comes from the ambient request context when there is one, so
    // trainer-scoped policies work on this path too.
    const ambient = getTenantContext();
    await client.query(`BEGIN; ${contextSql({
      tenantId,
      userId: ambient && ambient.tenantId === tenantId ? ambient.userId : null,
    })}`);
    const result = await client.query(text, params);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

// ── Automatic tenant context for row-level security (Phase 4) ────────────────
//
// Roughly 190 query sites across 20 files call `pool.query` directly and know
// nothing about tenants. Row-level security needs every one of them to carry a
// tenant context, and rewriting them all would be a large, risky change with a
// silent failure mode: a site that was missed would simply return no rows.
//
// So the context is applied at the one place every query already passes
// through. `pool.query` is wrapped: when a request-scoped context exists, the
// query runs inside its own transaction that first sets the context with
// SET LOCAL semantics; when there is none — background jobs, the
// pre-authentication endpoints — it runs exactly as before.
//
// Two properties matter and both come from PostgreSQL rather than from our
// bookkeeping:
//   - the setting is discarded at COMMIT/ROLLBACK, so it cannot leak to the
//     next borrower of a pooled connection, with no cleanup step to forget;
//   - a query that fails rolls back its own transaction and nothing else.
//
// The cost is two extra round trips per query (BEGIN+set_config, then COMMIT).
// BEGIN and set_config are sent together as one statement to keep it to two.
const rawPoolQuery = pool.query.bind(pool);

const queryWithAmbientContext = async (context, text, values) => {
  const client = await pool.connect();
  try {
    await client.query(`BEGIN; ${contextSql(context)}`);
    const result = await client.query(text, values);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

pool.query = (text, values, callback) => {
  const context = getTenantContext();

  // Callback style and cursor/stream submittables are passed straight through:
  // nothing in this codebase uses them, and quietly changing their semantics
  // would be worse than leaving them without a context.
  if (typeof callback === 'function' || typeof text !== 'string') {
    return rawPoolQuery(text, values, callback);
  }
  if (!context) return rawPoolQuery(text, values);

  return queryWithAmbientContext(context, text, values);
};

/**
 * Execute a regular query without tenant isolation
 * Used for authentication and tenant-agnostic operations
 */
const query = (text, params) => {
  return pool.query(text, params);
};

/**
 * Check out a client for an explicit multi-statement transaction.
 *
 * The returned client applies the request's tenant context immediately after
 * the caller's own BEGIN, so a transaction gets the same protection as a single
 * query without any call site having to know about it. Callers already write
 * `client.query('BEGIN')`; that is the only interception point, and it is
 * matched exactly rather than by pattern so an unrelated statement cannot
 * trigger it.
 */
const getClient = async () => {
  const client = await pool.connect();
  const context = getTenantContext();
  if (!context) return client;

  const originalQuery = client.query.bind(client);
  client.query = async (text, values, callback) => {
    if (typeof callback === 'function' || typeof text !== 'string') {
      return originalQuery(text, values, callback);
    }
    if (text.trim().toUpperCase() === 'BEGIN') {
      // One round trip: open the transaction and establish the context in it.
      return originalQuery(`BEGIN; ${contextSql(context)}`);
    }
    return originalQuery(text, values);
  };
  return client;
};

module.exports = {
  query,
  queryWithTenant,
  getClient,
  pool
};
