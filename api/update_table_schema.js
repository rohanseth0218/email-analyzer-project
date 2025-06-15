const { Pool } = require('pg');

async function updateSchema() {
  const pool = new Pool({
    connectionString: 'postgresql://postgres.xlvfjdvjfywkjhmkaevp:2nUMS5DRqlPct0JQ@aws-0-us-east-2.pooler.supabase.com:6543/postgres',
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔧 Updating table schema...');
    
    const client = await pool.connect();
    
    // Increase column sizes
    await client.query('ALTER TABLE email_campaigns ALTER COLUMN discount_percent TYPE VARCHAR(50)');
    await client.query('ALTER TABLE email_campaigns ALTER COLUMN flow_vs_campaign TYPE VARCHAR(50)');
    
    console.log('✅ Schema updated successfully!');
    
    client.release();
    await pool.end();
    
  } catch (error) {
    console.error('❌ Error updating schema:', error.message);
    await pool.end();
    process.exit(1);
  }
}

updateSchema(); 