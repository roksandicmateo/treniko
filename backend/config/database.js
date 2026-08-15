const { Pool } = require('pg');
require('dotenv').config();
const { buildSslOptions } = require('./dbSsl');

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
    await client.query('BEGIN');
    // is_local = true: scoped to this transaction, released on COMMIT/ROLLBACK.
    await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
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

/**
 * Execute a regular query without tenant isolation
 * Used for authentication and tenant-agnostic operations
 */
const query = (text, params) => {
  return pool.query(text, params);
};

/**
 * Begin a transaction
 */
const getClient = async () => {
  const client = await pool.connect();
  return client;
};

module.exports = {
  query,
  queryWithTenant,
  getClient,
  pool
};
