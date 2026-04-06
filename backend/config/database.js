const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL connection pool
const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'treniko_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  // Use SSL in production (required by managed DB services like DigitalOcean, Railway)
  ...(isProduction && process.env.DB_SSL !== 'false' ? {
    ssl: { rejectUnauthorized: false }
  } : {}),
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
 * Execute a query with tenant isolation
 * Sets the tenant_id in session for Row Level Security
 */
const queryWithTenant = async (text, params, tenantId) => {
  const client = await pool.connect();
  try {
    // Set tenant context for RLS using set_config (works on all PG versions)
    if (tenantId) {
      await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
    }
    const result = await client.query(text, params);
    return result;
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
