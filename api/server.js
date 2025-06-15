const express = require('express');
const cors = require('cors');
const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize BigQuery client
const bigquery = new BigQuery({
  projectId: 'instant-ground-394115',
  keyFilename: path.join(__dirname, 'gcp-service-account.json')
});

// Email campaigns endpoint
app.get('/api/campaigns', async (req, res) => {
  try {
    const { 
      brand, 
      dateRange, 
      theme, 
      designLevel, 
      search, 
      limit, 
      offset = 0 
    } = req.query;

    let whereConditions = ['a.screenshot_url IS NOT NULL']; // Only show campaigns with screenshots
    let parameters = {};

    // Brand filter
    if (brand && brand !== 'All Brands') {
      whereConditions.push('(LOWER(e.sender_domain) = LOWER(@brand) OR LOWER(s.merchant_name) = LOWER(@brand) OR LOWER(s.store_id) = LOWER(@brand))');
      parameters.brand = brand;
    }

    // Search filter
    if (search) {
      whereConditions.push(`(
        LOWER(e.sender_domain) LIKE LOWER(@search) OR 
        LOWER(e.subject) LIKE LOWER(@search) OR 
        LOWER(s.merchant_name) LIKE LOWER(@search) OR
        LOWER(s.store_id) LIKE LOWER(@search) OR
        LOWER(JSON_EXTRACT_SCALAR(a.gpt_analysis, '$.campaign_theme')) LIKE LOWER(@search)
      )`);
      parameters.search = `%${search}%`;
    }

    // Theme filter
    if (theme && theme !== 'All Themes') {
      whereConditions.push('LOWER(JSON_EXTRACT_SCALAR(a.gpt_analysis, "$.campaign_theme")) = LOWER(@theme)');
      parameters.theme = theme;
    }

    // Design level filter
    if (designLevel && designLevel !== 'All Levels') {
      whereConditions.push('LOWER(JSON_EXTRACT_SCALAR(a.gpt_analysis, "$.design_level")) = LOWER(@designLevel)');
      parameters.designLevel = designLevel;
    }

    // Date range filter
    if (dateRange && dateRange !== 'All Time') {
      switch (dateRange) {
        case 'Last 7 days':
          whereConditions.push('e.date_received >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)');
          break;
        case 'Last 30 days':
          whereConditions.push('e.date_received >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)');
          break;
        case 'This Year':
          whereConditions.push('EXTRACT(YEAR FROM e.date_received) = EXTRACT(YEAR FROM CURRENT_TIMESTAMP())');
          break;
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Build pagination clause
    let paginationClause = '';
    if (limit) {
      parameters.limit = parseInt(limit);
      paginationClause += 'LIMIT @limit';
      
      if (offset) {
        parameters.offset = parseInt(offset);
        paginationClause += ' OFFSET @offset';
      }
    }

    const query = `
      SELECT 
        a.email_id,
        e.sender_email,
        e.sender_domain,
        e.subject,
        e.date_received,
        a.screenshot_url,
        s.merchant_name,
        s.store_id,
        s.estimated_sales_yearly,
        JSON_EXTRACT_SCALAR(a.gpt_analysis, '$.campaign_theme') as campaign_theme,
        JSON_EXTRACT_SCALAR(a.gpt_analysis, '$.design_level') as design_level,
        JSON_EXTRACT_SCALAR(a.gpt_analysis, '$.discount_percent') as discount_percent,
        JSON_EXTRACT_SCALAR(a.gpt_analysis, '$.emotional_tone') as emotional_tone,
        JSON_EXTRACT_SCALAR(a.gpt_analysis, '$.event_or_seasonality') as event_or_seasonality,
        JSON_EXTRACT_SCALAR(a.gpt_analysis, '$.flow_vs_campaign') as flow_vs_campaign,
        CAST(JSON_EXTRACT_SCALAR(a.gpt_analysis, '$.image_vs_text_ratio') AS FLOAT64) as image_vs_text_ratio,
        CAST(JSON_EXTRACT_SCALAR(a.gpt_analysis, '$.num_products_featured') AS INT64) as num_products_featured,
        CAST(JSON_EXTRACT_SCALAR(a.gpt_analysis, '$.personalization_used') AS BOOL) as personalization_used,
        CAST(JSON_EXTRACT_SCALAR(a.gpt_analysis, '$.social_proof_used') AS BOOL) as social_proof_used,
        CAST(JSON_EXTRACT_SCALAR(a.gpt_analysis, '$.unsubscribe_visible') AS BOOL) as unsubscribe_visible,
        a.gpt_analysis
      FROM \`instant-ground-394115.email_analytics.email_analysis_results_v3\` a
      LEFT JOIN \`instant-ground-394115.email_analytics.marketing_emails_clean_20250612_082945\` e 
        ON a.email_id = e.email_id
      LEFT JOIN \`instant-ground-394115.email_analytics.storeleads\` s 
        ON LOWER(e.sender_domain) = LOWER(s.store_id)
        OR LOWER(REGEXP_REPLACE(e.sender_domain, r'^www\.', '')) = LOWER(s.store_id)
        OR LOWER(CONCAT('www.', e.sender_domain)) = LOWER(s.store_id)
      ${whereClause}
      ORDER BY e.date_received DESC
      ${paginationClause}
    `;

    const options = {
      query: query,
      params: parameters,
      location: 'US',
    };

    console.log('Executing query with parameters:', parameters);
    console.log('Full query:', query);
    console.log('Limit parameter:', limit);
    console.log('Pagination clause:', paginationClause);
    const [rows] = await bigquery.query(options);
    
    // Transform data to match frontend format
    const campaigns = rows.map(row => ({
      id: row.email_id,
      brand: row.merchant_name || row.sender_domain || 'Unknown',
      subject: row.subject || 'No Subject',
      date: row.date_received ? new Date(row.date_received.value).toISOString().split('T')[0] : '2024-01-01',
      screenshot: row.screenshot_url,
      campaign_theme: row.campaign_theme || 'general',
      design_level: row.design_level || 'Unknown',
      discount_percent: row.discount_percent ? parseInt(row.discount_percent) : null,
      emotional_tone: row.emotional_tone || 'neutral',
      event_or_seasonality: row.event_or_seasonality,
      flow_type: null,
      flow_vs_campaign: row.flow_vs_campaign || 'campaign',
      image_vs_text_ratio: row.image_vs_text_ratio || 0.5,
      num_products_featured: row.num_products_featured || 0,
      personalization_used: row.personalization_used || false,
      social_proof_used: row.social_proof_used || false,
      unsubscribe_visible: row.unsubscribe_visible || false,
      // Store metadata
      estimated_revenue: row.estimated_sales_yearly,
      sender_domain: row.sender_domain,
      store_id: row.store_id,
      gpt_analysis: row.gpt_analysis ? JSON.parse(row.gpt_analysis) : null
    }));

    console.log(`Found ${campaigns.length} campaigns`);
    res.json({
      campaigns,
      total: campaigns.length,
      hasMore: limit ? campaigns.length === parseInt(limit) : false
    });

  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns', details: error.message });
  }
});

// Get available filter options
app.get('/api/filters', async (req, res) => {
  try {
    const query = `
      SELECT 
        ARRAY_AGG(DISTINCT COALESCE(s.merchant_name, e.sender_domain) IGNORE NULLS ORDER BY COALESCE(s.merchant_name, e.sender_domain)) as brands,
        ARRAY_AGG(DISTINCT JSON_EXTRACT_SCALAR(a.gpt_analysis, '$.campaign_theme') IGNORE NULLS ORDER BY JSON_EXTRACT_SCALAR(a.gpt_analysis, '$.campaign_theme')) as themes,
        ARRAY_AGG(DISTINCT JSON_EXTRACT_SCALAR(a.gpt_analysis, '$.design_level') IGNORE NULLS ORDER BY JSON_EXTRACT_SCALAR(a.gpt_analysis, '$.design_level')) as design_levels
      FROM \`instant-ground-394115.email_analytics.email_analysis_results_v3\` a
      LEFT JOIN \`instant-ground-394115.email_analytics.marketing_emails_clean_20250612_082945\` e 
        ON a.email_id = e.email_id
      LEFT JOIN \`instant-ground-394115.email_analytics.storeleads\` s 
        ON LOWER(e.sender_domain) = LOWER(s.store_id)
        OR LOWER(REGEXP_REPLACE(e.sender_domain, r'^www\.', '')) = LOWER(s.store_id)
      WHERE a.screenshot_url IS NOT NULL
    `;

    const [rows] = await bigquery.query(query);
    const filters = rows[0];

    res.json({
      brands: ['All Brands', ...(filters.brands || [])],
      themes: ['All Themes', ...(filters.themes || [])],
      designLevels: ['All Levels', ...(filters.design_levels || [])]
    });

  } catch (error) {
    console.error('Error fetching filters:', error);
    res.status(500).json({ error: 'Failed to fetch filters', details: error.message });
  }
});

// Get campaign stats
app.get('/api/stats', async (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_campaigns,
        COUNT(DISTINCT COALESCE(s.merchant_name, e.sender_domain)) as unique_brands,
        COUNT(DISTINCT JSON_EXTRACT_SCALAR(a.gpt_analysis, '$.campaign_theme')) as unique_themes,
        AVG(CAST(JSON_EXTRACT_SCALAR(a.gpt_analysis, '$.num_products_featured') AS INT64)) as avg_products,
        COUNT(CASE WHEN JSON_EXTRACT_SCALAR(a.gpt_analysis, '$.personalization_used') = 'true' THEN 1 END) as personalized_campaigns
      FROM \`instant-ground-394115.email_analytics.email_analysis_results_v3\` a
      LEFT JOIN \`instant-ground-394115.email_analytics.marketing_emails_clean_20250612_082945\` e 
        ON a.email_id = e.email_id
      LEFT JOIN \`instant-ground-394115.email_analytics.storeleads\` s 
        ON LOWER(e.sender_domain) = LOWER(s.store_id)
        OR LOWER(REGEXP_REPLACE(e.sender_domain, r'^www\.', '')) = LOWER(s.store_id)
      WHERE a.screenshot_url IS NOT NULL
    `;

    const [rows] = await bigquery.query(query);
    res.json(rows[0]);

  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats', details: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`🚀 Pulse API server running on port ${port}`);
  console.log(`📊 BigQuery project: instant-ground-394115`);
  console.log(`🔍 Health check: http://localhost:${port}/health`);
}); 