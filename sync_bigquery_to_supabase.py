#!/usr/bin/env python3
"""
EmailScope Data Sync Job
Syncs email campaign data from BigQuery to Supabase PostgreSQL for fast web app queries
"""

import os
import json
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
import psycopg2
from psycopg2.extras import RealDictCursor, execute_values
from google.cloud import bigquery


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Supabase connection
SUPABASE_URL = "postgresql://postgres.xlvfjdvjfywkjhmkaevp:2nUMS5DRqlPct0JQ@aws-0-us-east-2.pooler.supabase.com:6543/postgres"

class EmailScopeSync:
    def __init__(self, supabase_url: str, supabase_key: str, bigquery_project: str):
        """Initialize the sync job with database connections"""
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.bigquery_project = bigquery_project
        
        # Initialize BigQuery client
        self.bigquery_client = bigquery.Client(project=bigquery_project)
        
        # Parse Supabase connection details
        self.pg_conn = None
        
    def connect_to_supabase(self):
        """Connect to Supabase PostgreSQL database"""
        try:
            # Use direct connection string
            self.pg_conn = psycopg2.connect(
                self.supabase_url,
                sslmode='require'
            )
            logger.info("✅ Connected to Supabase PostgreSQL")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to connect to Supabase: {e}")
            return False
    
    def fetch_campaigns_from_bigquery(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Fetch email campaigns from BigQuery"""
        logger.info("🔍 Fetching campaigns from BigQuery...")
        
        query = """
        WITH ranked_campaigns AS (
            SELECT 
                a.email_id,
                e.sender_email,
                e.sender_domain,
                e.subject,
                e.date_received,
                a.screenshot_url,
                COALESCE(s.merchant_name, e.sender_domain) as brand,
                s.store_id,
                s.estimated_sales_yearly as estimated_revenue,
                JSON_EXTRACT_SCALAR(a.gpt_analysis, '$.campaign_theme') as campaign_theme,
                JSON_EXTRACT_SCALAR(a.gpt_analysis, '$.design_level') as design_level,
                JSON_EXTRACT_SCALAR(a.gpt_analysis, '$.discount_percent') as discount_percent,
                JSON_EXTRACT_SCALAR(a.gpt_analysis, '$.emotional_tone') as emotional_tone,
                JSON_EXTRACT_SCALAR(a.gpt_analysis, '$.event_or_seasonality') as event_or_seasonality,
                JSON_EXTRACT_SCALAR(a.gpt_analysis, '$.flow_type') as flow_type,
                JSON_EXTRACT_SCALAR(a.gpt_analysis, '$.flow_vs_campaign') as flow_vs_campaign,
                CAST(JSON_EXTRACT_SCALAR(a.gpt_analysis, '$.image_vs_text_ratio') AS FLOAT64) as image_vs_text_ratio,
                CAST(JSON_EXTRACT_SCALAR(a.gpt_analysis, '$.num_products_featured') AS INT64) as num_products_featured,
                CAST(JSON_EXTRACT_SCALAR(a.gpt_analysis, '$.personalization_used') AS BOOL) as personalization_used,
                CAST(JSON_EXTRACT_SCALAR(a.gpt_analysis, '$.social_proof_used') AS BOOL) as social_proof_used,
                CAST(JSON_EXTRACT_SCALAR(a.gpt_analysis, '$.unsubscribe_visible') AS BOOL) as unsubscribe_visible,
                a.gpt_analysis,
                ROW_NUMBER() OVER (PARTITION BY a.email_id ORDER BY e.date_received DESC) as rn
            FROM `instant-ground-394115.email_analytics.email_analysis_results_v3` a
            LEFT JOIN `instant-ground-394115.email_analytics.marketing_emails_clean_20250612_082945` e 
                ON a.email_id = e.email_id
            LEFT JOIN `instant-ground-394115.email_analytics.storeleads` s 
                ON LOWER(e.sender_domain) = LOWER(s.store_id)
                OR LOWER(REGEXP_REPLACE(e.sender_domain, r'^www.', '')) = LOWER(s.store_id)
                OR LOWER(CONCAT('www.', e.sender_domain)) = LOWER(s.store_id)
            WHERE a.screenshot_url IS NOT NULL
        )
        SELECT 
            email_id, sender_email, sender_domain, subject, date_received,
            screenshot_url, brand, store_id, estimated_revenue,
            campaign_theme, design_level, discount_percent, emotional_tone,
            event_or_seasonality, flow_type, flow_vs_campaign,
            image_vs_text_ratio, num_products_featured,
            personalization_used, social_proof_used, unsubscribe_visible,
            gpt_analysis
        FROM ranked_campaigns 
        WHERE rn = 1
        ORDER BY date_received DESC
        """
        
        if limit:
            query += f" LIMIT {limit}"
        
        try:
            query_job = self.bigquery_client.query(query)
            results = query_job.result()
            
            campaigns = []
            for row in results:
                # Convert BigQuery row to dict
                campaign = dict(row)
                
                # Handle JSON parsing for gpt_analysis
                if campaign.get('gpt_analysis'):
                    try:
                        if isinstance(campaign['gpt_analysis'], str):
                            campaign['gpt_analysis'] = json.loads(campaign['gpt_analysis'])
                    except json.JSONDecodeError:
                        logger.warning(f"Failed to parse gpt_analysis for email_id: {campaign.get('email_id')}")
                        campaign['gpt_analysis'] = {}
                
                campaigns.append(campaign)
            
            logger.info(f"✅ Fetched {len(campaigns)} campaigns from BigQuery")
            return campaigns
            
        except Exception as e:
            logger.error(f"❌ Failed to fetch from BigQuery: {e}")
            return []
    
    def upsert_campaigns_to_supabase(self, campaigns: List[Dict[str, Any]]) -> bool:
        """Insert or update campaigns in Supabase"""
        if not campaigns:
            logger.info("No campaigns to sync")
            return True
            
        logger.info(f"💾 Upserting {len(campaigns)} campaigns to Supabase...")
        
        try:
            with self.pg_conn.cursor() as cursor:
                # Prepare the upsert query
                upsert_query = """
                INSERT INTO email_campaigns (
                    email_id, sender_email, sender_domain, subject, date_received,
                    screenshot_url, brand, store_id, estimated_revenue,
                    campaign_theme, design_level, discount_percent, emotional_tone,
                    event_or_seasonality, flow_type, flow_vs_campaign,
                    image_vs_text_ratio, num_products_featured,
                    personalization_used, social_proof_used, unsubscribe_visible,
                    gpt_analysis
                ) VALUES %s
                ON CONFLICT (email_id) DO UPDATE SET
                    sender_email = EXCLUDED.sender_email,
                    sender_domain = EXCLUDED.sender_domain,
                    subject = EXCLUDED.subject,
                    date_received = EXCLUDED.date_received,
                    screenshot_url = EXCLUDED.screenshot_url,
                    brand = EXCLUDED.brand,
                    store_id = EXCLUDED.store_id,
                    estimated_revenue = EXCLUDED.estimated_revenue,
                    campaign_theme = EXCLUDED.campaign_theme,
                    design_level = EXCLUDED.design_level,
                    discount_percent = EXCLUDED.discount_percent,
                    emotional_tone = EXCLUDED.emotional_tone,
                    event_or_seasonality = EXCLUDED.event_or_seasonality,
                    flow_type = EXCLUDED.flow_type,
                    flow_vs_campaign = EXCLUDED.flow_vs_campaign,
                    image_vs_text_ratio = EXCLUDED.image_vs_text_ratio,
                    num_products_featured = EXCLUDED.num_products_featured,
                    personalization_used = EXCLUDED.personalization_used,
                    social_proof_used = EXCLUDED.social_proof_used,
                    unsubscribe_visible = EXCLUDED.unsubscribe_visible,
                    gpt_analysis = EXCLUDED.gpt_analysis,
                    updated_at = NOW()
                """
                
                # Prepare data tuples
                data_tuples = []
                for campaign in campaigns:
                    data_tuple = (
                        campaign.get('email_id'),
                        campaign.get('sender_email'),
                        campaign.get('sender_domain'),
                        campaign.get('subject'),
                        campaign.get('date_received'),
                        campaign.get('screenshot_url'),
                        campaign.get('brand'),
                        campaign.get('store_id'),
                        campaign.get('estimated_revenue'),
                        campaign.get('campaign_theme'),
                        campaign.get('design_level'),
                        campaign.get('discount_percent'),
                        campaign.get('emotional_tone'),
                        campaign.get('event_or_seasonality'),
                        campaign.get('flow_type'),
                        campaign.get('flow_vs_campaign'),
                        campaign.get('image_vs_text_ratio'),
                        campaign.get('num_products_featured'),
                        campaign.get('personalization_used'),
                        campaign.get('social_proof_used'),
                        campaign.get('unsubscribe_visible'),
                        json.dumps(campaign.get('gpt_analysis', {}))
                    )
                    data_tuples.append(data_tuple)
                
                # Execute batch upsert
                execute_values(cursor, upsert_query, data_tuples)
                self.pg_conn.commit()
                
                logger.info(f"✅ Successfully upserted {len(campaigns)} campaigns to Supabase")
                return True
                
        except Exception as e:
            logger.error(f"❌ Failed to upsert to Supabase: {e}")
            if self.pg_conn:
                self.pg_conn.rollback()
            return False
    
    def get_sync_stats(self) -> Dict[str, Any]:
        """Get statistics about the synced data"""
        try:
            with self.pg_conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute("SELECT * FROM campaign_stats")
                stats = cursor.fetchone()
                return dict(stats) if stats else {}
        except Exception as e:
            logger.error(f"❌ Failed to get sync stats: {e}")
            return {}
    
    def run_sync(self, limit: Optional[int] = None) -> bool:
        """Run the complete sync process"""
        logger.info("🚀 Starting EmailScope sync job...")
        
        # Connect to databases
        if not self.connect_to_supabase():
            return False
        
        try:
            # Fetch data from BigQuery
            campaigns = self.fetch_campaigns_from_bigquery(limit)
            
            if not campaigns:
                logger.warning("No campaigns fetched from BigQuery")
                return False
            
            # Upsert to Supabase
            success = self.upsert_campaigns_to_supabase(campaigns)
            
            if success:
                # Get final stats
                stats = self.get_sync_stats()
                logger.info(f"📊 Sync completed successfully!")
                logger.info(f"   Total campaigns: {stats.get('total_campaigns', 'N/A')}")
                logger.info(f"   Unique brands: {stats.get('unique_brands', 'N/A')}")
                logger.info(f"   Unique themes: {stats.get('unique_themes', 'N/A')}")
                
            return success
            
        finally:
            if self.pg_conn:
                self.pg_conn.close()

def main():
    """Main function to run the sync"""
    
    # Use hardcoded connection details
    supabase_url = SUPABASE_URL
    supabase_key = "dummy_key"  # Not needed for direct PostgreSQL connection
    bigquery_project = "instant-ground-394115"
    
    print("🚀 Starting EmailScope BigQuery → Supabase Sync")
    print("=" * 50)
    
    try:
        # Initialize sync
        sync = EmailScopeSync(supabase_url, supabase_key, bigquery_project)
        
        # Run sync with no limit (sync all data)
        sync.run_sync()
        
        print("\n🎉 Sync completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Sync failed: {e}")
        raise

if __name__ == "__main__":
    main() 