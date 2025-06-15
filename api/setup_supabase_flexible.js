const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Multiple connection string formats to try
const connectionStrings = [
  'postgresql://postgres.xlvfjdvjfywkjhmkaevp:2nUMS5DRqlPct0JQ@aws-0-us-east-2.pooler.supabase.com:6543/postgres',
  'postgresql://postgres:2nUMS5DRqlPct0JQ@db.xlvfjdvjfywkjhmkaevp.supabase.co:5432/postgres',
  'postgresql://postgres.xlvfjdvjfywkjhmkaevp:2nUMS5DRqlPct0JQ@aws-0-us-west-1.pooler.supabase.com:5432/postgres',
  'postgresql://postgres.xlvfjdvjfywkjhmkaevp:2nUMS5DRqlPct0JQ@aws-0-us-west-1.pooler.supabase.com:6543/postgres'
];

async function tryConnection(connectionString, index) {
  console.log(`\n🔌 Trying connection ${index + 1}...`);
  console.log(`   ${connectionString.replace(/:[^:@]*@/, ':****@')}`);
  
  const pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 10000, // 10 second timeout
  });

  try {
    const client = await pool.connect();
    console.log('✅ Connected successfully!');
    
    // Test a simple query
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('⏰ Database time:', result.rows[0].current_time);
    console.log('🗄️  PostgreSQL version:', result.rows[0].pg_version.split(' ')[0]);
    
    client.release();
    await pool.end();
    return connectionString;
    
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`);
    await pool.end();
    return null;
  }
}

async function setupSchema(workingConnectionString) {
  console.log('\n🏗️  Setting up database schema...');
  
  const pool = new Pool({
    connectionString: workingConnectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    const client = await pool.connect();
    
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
    return true;
    
  } catch (error) {
    console.error('❌ Schema setup error:', error.message);
    await pool.end();
    return false;
  }
}

async function main() {
  console.log('🚀 Supabase Connection & Setup Tool');
  console.log('=====================================');
  
  let workingConnection = null;
  
  // Try each connection string
  for (let i = 0; i < connectionStrings.length; i++) {
    workingConnection = await tryConnection(connectionStrings[i], i);
    if (workingConnection) {
      break;
    }
  }
  
  if (!workingConnection) {
    console.log('\n❌ All connection attempts failed.');
    console.log('\n💡 Please check your Supabase dashboard for the correct connection string:');
    console.log('   1. Go to https://supabase.com/dashboard');
    console.log('   2. Select your project');
    console.log('   3. Go to Settings → Database');
    console.log('   4. Copy the connection string from the "Connection string" section');
    process.exit(1);
  }
  
  console.log('\n🎉 Connection successful!');
  console.log(`📝 Working connection string: ${workingConnection.replace(/:[^:@]*@/, ':****@')}`);
  
  // Setup schema
  const schemaSuccess = await setupSchema(workingConnection);
  
  if (schemaSuccess) {
    console.log('\n🎉 Setup complete! Your Supabase database is ready.');
    console.log('\n📋 Next steps:');
    console.log('   1. Update your API server with the working connection string');
    console.log('   2. Run the data sync: python sync_bigquery_to_supabase.py');
    console.log('   3. Start the new API server: node supabase_server.js');
  } else {
    console.log('\n❌ Schema setup failed. Please check the error messages above.');
  }
}

main(); 