const express = require('express');
const cors = require('cors');
const { Client } = require('pg');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize PostgreSQL client for Supabase
const pool = new Pool({
  connectionString: 'postgresql://postgres.xlvfjdvjfywkjhmkaevp:2nUMS5DRqlPct0JQ@aws-0-us-east-2.pooler.supabase.com:6543/postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

// Connect to Supabase
pool.connect()
  .then(() => {
    console.log('🚀 Pulse API server running on port', port);
    console.log('🐘 Connected to Supabase PostgreSQL');
    console.log('🔍 Health check: http://localhost:' + port + '/health');
  })
  .catch(err => {
    console.error('❌ Failed to connect to Supabase:', err);
    process.exit(1);
  });

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    database: 'supabase-postgresql',
    timestamp: new Date().toISOString()
  });
});

// Email campaigns endpoint - MUCH FASTER with PostgreSQL
app.get('/api/campaigns', async (req, res) => {
  try {
    const { 
      brand, 
      dateRange, 
      theme, 
      designLevel, 
      search, 
      limit = 50, 
      offset = 0 
    } = req.query;

    let whereConditions = ['screenshot_url IS NOT NULL'];
    let queryParams = [];
    let paramIndex = 1;

    // Brand filter
    if (brand && brand !== 'All Brands') {
      whereConditions.push(`(LOWER(sender_domain) = LOWER($${paramIndex}) OR LOWER(brand) = LOWER($${paramIndex}))`);
      queryParams.push(brand);
      paramIndex++;
    }

    // Theme filter
    if (theme && theme !== 'All Themes') {
      whereConditions.push(`campaign_theme = $${paramIndex}`);
      queryParams.push(theme);
      paramIndex++;
    }

    // Design level filter
    if (designLevel && designLevel !== 'All Levels') {
      whereConditions.push(`design_level = $${paramIndex}`);
      queryParams.push(designLevel);
      paramIndex++;
    }

    // Date range filter
    if (dateRange && dateRange !== 'All Time') {
      let dateCondition = '';
      switch (dateRange) {
        case 'Last 7 days':
          dateCondition = `date_received >= NOW() - INTERVAL '7 days'`;
          break;
        case 'Last 30 days':
          dateCondition = `date_received >= NOW() - INTERVAL '30 days'`;
          break;
        case 'Last 3 months':
          dateCondition = `date_received >= NOW() - INTERVAL '3 months'`;
          break;
        case 'Last 6 months':
          dateCondition = `date_received >= NOW() - INTERVAL '6 months'`;
          break;
        case 'Last year':
          dateCondition = `date_received >= NOW() - INTERVAL '1 year'`;
          break;
      }
      if (dateCondition) {
        whereConditions.push(dateCondition);
      }
    }

    // Search filter - using full-text search for performance
    if (search) {
      whereConditions.push(`(
        to_tsvector('english', COALESCE(subject, '') || ' ' || COALESCE(brand, '') || ' ' || COALESCE(sender_domain, '')) 
        @@ plainto_tsquery('english', $${paramIndex})
        OR LOWER(subject) LIKE LOWER($${paramIndex + 1})
        OR LOWER(brand) LIKE LOWER($${paramIndex + 1})
        OR LOWER(sender_domain) LIKE LOWER($${paramIndex + 1})
        OR LOWER(campaign_theme) LIKE LOWER($${paramIndex + 1})
      )`);
      queryParams.push(search);
      queryParams.push(`%${search}%`);
      paramIndex += 2;
    }

    // Build the main query
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    let query = `
      SELECT 
        ec.email_id as id,
        ec.brand,
        ec.subject,
        ec.date_received as date,
        ec.screenshot_url as screenshot,
        ec.campaign_theme,
        ec.design_level,
        ec.discount_percent,
        ec.emotional_tone,
        ec.event_or_seasonality,
        ec.flow_type,
        ec.flow_vs_campaign,
        ec.image_vs_text_ratio,
        ec.num_products_featured,
        ec.personalization_used,
        ec.social_proof_used,
        ec.unsubscribe_visible,
        ec.estimated_revenue,
        ec.sender_domain,
        ec.store_id,
        ec.gpt_analysis
      FROM email_campaigns ec
      ${whereClause.replace('email_campaigns', 'ec')}
      ORDER BY ec.date_received DESC
    `;

    // Add pagination
    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      queryParams.push(parseInt(limit));
      paramIndex++;
    }
    
    if (offset) {
      query += ` OFFSET $${paramIndex}`;
      queryParams.push(parseInt(offset));
      paramIndex++;
    }

    console.log(`Executing query with ${queryParams.length} parameters`);
    const startTime = Date.now();
    
    const result = await pool.query(query, queryParams);
    const campaigns = result.rows;
    
    const queryTime = Date.now() - startTime;
    console.log(`Found ${campaigns.length} campaigns in ${queryTime}ms`);

    // Transform data to match frontend expectations
    const transformedCampaigns = campaigns.map(campaign => ({
      id: campaign.id,
      brand: campaign.brand || campaign.sender_domain,
      subject: campaign.subject,
      date: campaign.date,
      screenshot: campaign.screenshot,
      campaign_theme: campaign.campaign_theme,
      design_level: campaign.design_level,
      discount_percent: campaign.discount_percent,
      emotional_tone: campaign.emotional_tone,
      event_or_seasonality: campaign.event_or_seasonality,
      flow_type: campaign.flow_type,
      flow_vs_campaign: campaign.flow_vs_campaign,
      image_vs_text_ratio: campaign.image_vs_text_ratio,
      num_products_featured: campaign.num_products_featured,
      personalization_used: campaign.personalization_used,
      social_proof_used: campaign.social_proof_used,
      unsubscribe_visible: campaign.unsubscribe_visible,
      estimated_revenue: campaign.estimated_revenue,
      sender_domain: campaign.sender_domain,
      store_id: campaign.store_id,
      gpt_analysis: campaign.gpt_analysis
    }));

    res.json({
      campaigns: transformedCampaigns,
      total: transformedCampaigns.length,
      hasMore: limit ? transformedCampaigns.length === parseInt(limit) : false,
      queryTime: queryTime
    });

  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ 
      error: 'Failed to fetch campaigns',
      details: error.message 
    });
  }
});

// Filters endpoint - get available filter options
app.get('/api/filters', async (req, res) => {
  try {
    console.log('Fetching filter options...');
    const startTime = Date.now();

    // Get unique brands
    const brandsQuery = `
      SELECT DISTINCT brand 
      FROM email_campaigns 
      WHERE brand IS NOT NULL 
      ORDER BY brand
    `;
    const brandsResult = await pool.query(brandsQuery);
    const brands = ['All Brands', ...brandsResult.rows.map(row => row.brand)];

    // Get unique themes
    const themesQuery = `
      SELECT DISTINCT campaign_theme 
      FROM email_campaigns 
      WHERE campaign_theme IS NOT NULL 
      ORDER BY campaign_theme
    `;
    const themesResult = await pool.query(themesQuery);
    const themes = ['All Themes', ...themesResult.rows.map(row => row.campaign_theme)];

    // Get unique design levels
    const designLevelsQuery = `
      SELECT DISTINCT design_level 
      FROM email_campaigns 
      WHERE design_level IS NOT NULL 
      ORDER BY design_level
    `;
    const designLevelsResult = await pool.query(designLevelsQuery);
    const designLevels = ['All Levels', ...designLevelsResult.rows.map(row => row.design_level)];

    const queryTime = Date.now() - startTime;
    console.log(`Fetched filters in ${queryTime}ms`);

    res.json({
      brands,
      themes,
      designLevels,
      dateRanges: [
        'All Time',
        'Last 7 days',
        'Last 30 days',
        'Last 3 months',
        'Last 6 months',
        'Last year'
      ],
      queryTime: queryTime
    });

  } catch (error) {
    console.error('Error fetching filters:', error);
    res.status(500).json({ 
      error: 'Failed to fetch filters',
      details: error.message 
    });
  }
});

// Campaign details endpoint - get detailed campaign info from Supabase
app.get('/api/campaigns/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Fetching campaign details for ID: ${id}`);
    const startTime = Date.now();

    // Get campaign data from Supabase (fast!)
    const query = `
      SELECT 
        email_id as id,
        brand,
        subject,
        date_received as date,
        screenshot_url as screenshot,
        campaign_theme,
        design_level,
        discount_percent,
        emotional_tone,
        event_or_seasonality,
        flow_type,
        flow_vs_campaign,
        image_vs_text_ratio,
        num_products_featured,
        personalization_used,
        social_proof_used,
        unsubscribe_visible,
        estimated_revenue,
        sender_domain,
        store_id,
        gpt_analysis
      FROM email_campaigns
      WHERE email_id = $1
      LIMIT 1
    `;

    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const campaign = result.rows[0];
    const queryTime = Date.now() - startTime;
    console.log(`Fetched campaign details in ${queryTime}ms`);

    // Transform the data
    const transformedCampaign = {
      id: campaign.id,
      brand: campaign.brand || campaign.sender_domain,
      subject: campaign.subject,
      date: campaign.date,
      screenshot: campaign.screenshot,
      campaign_theme: campaign.campaign_theme,
      design_level: campaign.design_level,
      discount_percent: campaign.discount_percent,
      emotional_tone: campaign.emotional_tone,
      event_or_seasonality: campaign.event_or_seasonality,
      flow_type: campaign.flow_type,
      flow_vs_campaign: campaign.flow_vs_campaign,
      image_vs_text_ratio: campaign.image_vs_text_ratio,
      num_products_featured: campaign.num_products_featured,
      personalization_used: campaign.personalization_used,
      social_proof_used: campaign.social_proof_used,
      unsubscribe_visible: campaign.unsubscribe_visible,
      estimated_revenue: campaign.estimated_revenue,
      sender_domain: campaign.sender_domain,
      store_id: campaign.store_id,
      gpt_analysis: campaign.gpt_analysis
    };

    res.json({
      campaign: transformedCampaign,
      queryTime: queryTime
    });

  } catch (error) {
    console.error('Error fetching campaign details:', error);
    res.status(500).json({ 
      error: 'Failed to fetch campaign details',
      details: error.message 
    });
  }
});

// Store/merchant details endpoint - get store information
app.get('/api/stores/:domain', async (req, res) => {
  try {
    const { domain } = req.params;
    console.log(`Fetching store details for domain: ${domain}`);
    const startTime = Date.now();

    // Get store data from Supabase storeleads table
    const query = `
      SELECT 
        store_id,
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
      FROM storeleads
      WHERE 
        LOWER(store_id) = LOWER($1)
        OR LOWER(store_id) = LOWER(REGEXP_REPLACE($1, '^www\.', ''))
        OR LOWER(store_id) = LOWER(CONCAT('www.', $1))
      LIMIT 1
    `;

    const result = await pool.query(query, [domain]);
    const queryTime = Date.now() - startTime;
    
    if (result.rows.length === 0) {
      console.log(`No store found for domain: ${domain} in ${queryTime}ms`);
      return res.json({
        store: null,
        queryTime: queryTime
      });
    }

    const store = result.rows[0];
    console.log(`Fetched store details for ${store.merchant_name} in ${queryTime}ms`);

    res.json({
      store: {
        store_id: store.store_id,
        merchant_name: store.merchant_name,
        platform: store.platform,
        country_code: store.country_code,
        region: store.region,
        subregion: store.subregion,
        location: store.location,
        state: store.state,
        email: store.email,
        contact_page: store.contact_page,
        about_us: store.about_us,
        title: store.title,
        description: store.description,
        klaviyo_installed_at: store.klaviyo_installed_at,
        klaviyo_active: store.klaviyo_active,
        avg_price: store.avg_price,
        product_count: store.product_count,
        employee_count: store.employee_count,
        estimated_sales_yearly: store.estimated_sales_yearly,
        estimated_page_views: store.estimated_page_views,
        rank: store.rank,
        categories: store.categories
      },
      queryTime: queryTime
    });

  } catch (error) {
    console.error('Error fetching store details:', error);
    res.status(500).json({ 
      error: 'Failed to fetch store details',
      details: error.message 
    });
  }
});

// Stats endpoint - get campaign statistics
app.get('/api/stats', async (req, res) => {
  try {
    console.log('Fetching campaign statistics...');
    const startTime = Date.now();

    const statsQuery = `SELECT * FROM campaign_stats`;
    const result = await pool.query(statsQuery);
    const stats = result.rows[0];

    const queryTime = Date.now() - startTime;
    console.log(`Fetched stats in ${queryTime}ms`);

    res.json({
      ...stats,
      queryTime: queryTime
    });

  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch stats',
      details: error.message 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    details: err.message 
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
}); 