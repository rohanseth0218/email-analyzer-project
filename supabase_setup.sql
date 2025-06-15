-- EmailScope Supabase Database Schema
-- Optimized for fast web app queries

-- Main campaigns table (denormalized for performance)
CREATE TABLE email_campaigns (
    id SERIAL PRIMARY KEY,
    email_id VARCHAR(255) UNIQUE NOT NULL,
    
    -- Email metadata
    sender_email VARCHAR(255),
    sender_domain VARCHAR(255),
    subject TEXT,
    date_received TIMESTAMP,
    screenshot_url TEXT,
    
    -- Store/brand info
    brand VARCHAR(255),
    store_id VARCHAR(255),
    estimated_revenue BIGINT,
    
    -- GPT analysis fields (extracted from JSON for fast filtering)
    campaign_theme VARCHAR(100),
    design_level VARCHAR(50),
    discount_percent VARCHAR(50),
    emotional_tone VARCHAR(255),
    event_or_seasonality VARCHAR(100),
    flow_type VARCHAR(50),
    flow_vs_campaign VARCHAR(50),
    image_vs_text_ratio DECIMAL(3,2),
    num_products_featured INTEGER,
    personalization_used BOOLEAN,
    social_proof_used BOOLEAN,
    unsubscribe_visible BOOLEAN,
    
    -- Full GPT analysis JSON for detailed view
    gpt_analysis JSONB,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast filtering and searching
CREATE INDEX idx_email_campaigns_date ON email_campaigns(date_received DESC);
CREATE INDEX idx_email_campaigns_brand ON email_campaigns(brand);
CREATE INDEX idx_email_campaigns_theme ON email_campaigns(campaign_theme);
CREATE INDEX idx_email_campaigns_design_level ON email_campaigns(design_level);
CREATE INDEX idx_email_campaigns_sender_domain ON email_campaigns(sender_domain);

-- Full-text search index for subject and brand
CREATE INDEX idx_email_campaigns_search ON email_campaigns USING gin(
    to_tsvector('english', COALESCE(subject, '') || ' ' || COALESCE(brand, '') || ' ' || COALESCE(sender_domain, ''))
);

-- Composite indexes for common filter combinations
CREATE INDEX idx_email_campaigns_brand_theme ON email_campaigns(brand, campaign_theme);
CREATE INDEX idx_email_campaigns_theme_date ON email_campaigns(campaign_theme, date_received DESC);

-- Enable Row Level Security (optional, for future multi-tenancy)
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow all operations for now (adjust as needed)
CREATE POLICY "Allow all operations" ON email_campaigns FOR ALL USING (true);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_email_campaigns_updated_at 
    BEFORE UPDATE ON email_campaigns 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- View for campaign statistics
CREATE VIEW campaign_stats AS
SELECT 
    COUNT(*) as total_campaigns,
    COUNT(DISTINCT brand) as unique_brands,
    COUNT(DISTINCT campaign_theme) as unique_themes,
    AVG(num_products_featured) as avg_products_featured,
    COUNT(*) FILTER (WHERE personalization_used = true) as personalized_campaigns
FROM email_campaigns; 