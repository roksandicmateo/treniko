const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'treniko_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
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
    // Set tenant context for RLS
    if (tenantId) {
      await client.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
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
