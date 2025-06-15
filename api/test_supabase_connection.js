const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function testConnection() {
  const pool = new Pool({
    connectionString: 'postgresql://postgres:2nUMS5DRqlPct0JQ@db.xlvfjdvjfywkjhmkaevp.supabase.co:5432/postgres',
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔌 Testing Supabase connection...');
    
    // Test basic connection
    const client = await pool.connect();
    console.log('✅ Connected to Supabase successfully!');
    
    // Test a simple query
    const result = await client.query('SELECT NOW() as current_time');
    console.log('⏰ Current database time:', result.rows[0].current_time);
    
    // Read and execute schema
    console.log('📖 Reading schema file...');
    const schemaPath = path.join(__dirname, '..', 'supabase_setup.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('🏗️  Creating tables and indexes...');
    await client.query(schema);
    
    // Verify tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('email_campaigns', 'campaign_stats')
    `);
    
    console.log(`✅ Successfully created ${tablesResult.rows.length} tables:`);
    tablesResult.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });
    
    client.release();
    await pool.end();
    console.log('🎉 Schema setup complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

testConnection(); 