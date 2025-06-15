const { BigQuery } = require('@google-cloud/bigquery');
const { Pool } = require('pg');

// BigQuery setup
const bigquery = new BigQuery({
  projectId: 'instant-ground-394115',
  keyFilename: '/Users/rohanseth/Downloads/AI Library/Miscellaneous/instant-ground-394115-57f88e5c0ec4.json'
});

// Supabase setup
const pool = new Pool({
  connectionString: 'postgresql://postgres.xlvfjdvjfywkjhmkaevp:2nUMS5DRqlPct0JQ@aws-0-us-east-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function syncStoreleadsToSupabase() {
  try {
    console.log('🚀 Starting storeleads sync from BigQuery to Supabase...');
    
    // Step 1: Create storeleads table in Supabase if it doesn't exist
    console.log('📋 Creating storeleads table in Supabase...');
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS storeleads (
        id SERIAL PRIMARY KEY,
        store_id VARCHAR(255) UNIQUE NOT NULL,
        platform_domain VARCHAR(255),
        merchant_name VARCHAR(255),
        platform VARCHAR(100),
        country_code VARCHAR(10),
        region VARCHAR(100),
        subregion VARCHAR(100),
        location VARCHAR(255),
        state VARCHAR(100),
        email VARCHAR(255),
        contact_page TEXT,
        about_us TEXT,
        title VARCHAR(500),
        description TEXT,
        klaviyo_installed_at VARCHAR(50),
        klaviyo_active BOOLEAN,
        avg_price DECIMAL(10,2),
        product_count INTEGER,
        employee_count INTEGER,
        estimated_sales_yearly BIGINT,
        estimated_page_views DECIMAL(15,2),
        rank INTEGER,
        categories JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_storeleads_store_id ON storeleads(store_id);
      CREATE INDEX IF NOT EXISTS idx_storeleads_merchant_name ON storeleads(merchant_name);
    `;
    
    await pool.query(createTableQuery);
    console.log('✅ Storeleads table created/verified');
    
    // Step 2: Get storeleads data from BigQuery
    console.log('📊 Fetching storeleads data from BigQuery...');
    const bigqueryQuery = `
      SELECT 
        store_id,
        platform_domain,
        merchant_name,
        platform,
        country_code,
        region,
        subregion,
        location,
        state,
        email,
        contact_page,
        about_us,
        title,
        description,
        klaviyo_installed_at,
        klaviyo_active,
        avg_price,
        product_count,
        employee_count,
        estimated_sales_yearly,
        estimated_page_views,
        rank,
        categories
      FROM \`instant-ground-394115.email_analytics.storeleads\`
      WHERE store_id IS NOT NULL
      ORDER BY estimated_sales_yearly DESC
      LIMIT 10000
    `;
    
    const [rows] = await bigquery.query(bigqueryQuery);
    console.log(`📈 Found ${rows.length} storeleads records`);
    
    // Step 3: Insert data into Supabase in batches
    console.log('💾 Inserting data into Supabase...');
    const batchSize = 100;
    let inserted = 0;
    
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      
      // Build the insert query
      const values = [];
      const placeholders = [];
      let paramIndex = 1;
      
      batch.forEach((row) => {
        const rowPlaceholders = [];
        
        // Add each field
        values.push(row.store_id);
        rowPlaceholders.push(`$${paramIndex++}`);
        
        values.push(row.platform_domain);
        rowPlaceholders.push(`$${paramIndex++}`);
        
        values.push(row.merchant_name);
        rowPlaceholders.push(`$${paramIndex++}`);
        
        values.push(row.platform);
        rowPlaceholders.push(`$${paramIndex++}`);
        
        values.push(row.country_code);
        rowPlaceholders.push(`$${paramIndex++}`);
        
        values.push(row.region);
        rowPlaceholders.push(`$${paramIndex++}`);
        
        values.push(row.subregion);
        rowPlaceholders.push(`$${paramIndex++}`);
        
        values.push(row.location);
        rowPlaceholders.push(`$${paramIndex++}`);
        
        values.push(row.state);
        rowPlaceholders.push(`$${paramIndex++}`);
        
        values.push(row.email);
        rowPlaceholders.push(`$${paramIndex++}`);
        
        values.push(row.contact_page);
        rowPlaceholders.push(`$${paramIndex++}`);
        
        values.push(row.about_us);
        rowPlaceholders.push(`$${paramIndex++}`);
        
        values.push(row.title);
        rowPlaceholders.push(`$${paramIndex++}`);
        
        values.push(row.description);
        rowPlaceholders.push(`$${paramIndex++}`);
        
        values.push(row.klaviyo_installed_at);
        rowPlaceholders.push(`$${paramIndex++}`);
        
        values.push(row.klaviyo_active);
        rowPlaceholders.push(`$${paramIndex++}`);
        
        values.push(row.avg_price);
        rowPlaceholders.push(`$${paramIndex++}`);
        
        values.push(row.product_count);
        rowPlaceholders.push(`$${paramIndex++}`);
        
        values.push(row.employee_count);
        rowPlaceholders.push(`$${paramIndex++}`);
        
        values.push(row.estimated_sales_yearly);
        rowPlaceholders.push(`$${paramIndex++}`);
        
        values.push(row.estimated_page_views);
        rowPlaceholders.push(`$${paramIndex++}`);
        
        values.push(row.rank);
        rowPlaceholders.push(`$${paramIndex++}`);
        
        values.push(JSON.stringify(row.categories));
        rowPlaceholders.push(`$${paramIndex++}`);
        
        placeholders.push(`(${rowPlaceholders.join(', ')})`);
      });
      
      const insertQuery = `
        INSERT INTO storeleads (
          store_id, platform_domain, merchant_name, platform, country_code,
          region, subregion, location, state, email, contact_page, about_us,
          title, description, klaviyo_installed_at, klaviyo_active, avg_price,
          product_count, employee_count, estimated_sales_yearly, estimated_page_views,
          rank, categories
        ) VALUES ${placeholders.join(', ')}
        ON CONFLICT (store_id) DO UPDATE SET
          platform_domain = EXCLUDED.platform_domain,
          merchant_name = EXCLUDED.merchant_name,
          platform = EXCLUDED.platform,
          country_code = EXCLUDED.country_code,
          region = EXCLUDED.region,
          subregion = EXCLUDED.subregion,
          location = EXCLUDED.location,
          state = EXCLUDED.state,
          email = EXCLUDED.email,
          contact_page = EXCLUDED.contact_page,
          about_us = EXCLUDED.about_us,
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          klaviyo_installed_at = EXCLUDED.klaviyo_installed_at,
          klaviyo_active = EXCLUDED.klaviyo_active,
          avg_price = EXCLUDED.avg_price,
          product_count = EXCLUDED.product_count,
          employee_count = EXCLUDED.employee_count,
          estimated_sales_yearly = EXCLUDED.estimated_sales_yearly,
          estimated_page_views = EXCLUDED.estimated_page_views,
          rank = EXCLUDED.rank,
          categories = EXCLUDED.categories,
          updated_at = NOW()
      `;
      
      await pool.query(insertQuery, values);
      inserted += batch.length;
      console.log(`✅ Inserted batch ${Math.ceil((i + batchSize) / batchSize)} - Total: ${inserted}/${rows.length}`);
    }
    
    console.log(`🎉 Successfully synced ${inserted} storeleads records to Supabase!`);
    
    // Step 4: Verify the data
    const countResult = await pool.query('SELECT COUNT(*) as total FROM storeleads');
    console.log(`📊 Total storeleads in Supabase: ${countResult.rows[0].total}`);
    
  } catch (error) {
    console.error('❌ Error syncing storeleads:', error);
  } finally {
    await pool.end();
  }
}

syncStoreleadsToSupabase(); 