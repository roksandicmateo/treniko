const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'treniko_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

async function initDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Initializing database...\n');

    // Read schema file
    const schemaPath = path.join(__dirname, '..', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Execute schema
    console.log('📝 Creating tables and indexes...');
    await client.query(schema);
    console.log('✅ Database schema created successfully\n');

    // Verify tables
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    console.log('📊 Created tables:');
    tables.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    console.log('\n✅ Database initialization complete!\n');
    console.log('🎉 Demo account created:');
    console.log('   Email: demo@treniko.com');
    console.log('   Password: password123\n');

  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run initialization
initDatabase()
  .then(() => {
    console.log('👍 All done! You can now start the server.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
