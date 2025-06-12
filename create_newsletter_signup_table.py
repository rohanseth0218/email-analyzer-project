#!/usr/bin/env python3
"""
Create BigQuery table for newsletter signup results
"""

from google.cloud import bigquery
from google.oauth2 import service_account
import json

def create_newsletter_signup_table():
    """Create the newsletter signup results table in BigQuery"""
    
    # Initialize client
    credentials = service_account.Credentials.from_service_account_file(
        'bigquery_credentials.json'
    )
    client = bigquery.Client(credentials=credentials, project='instant-ground-394115')
    
    # Define table schema
    schema = [
        bigquery.SchemaField("domain", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("success", "BOOLEAN", mode="REQUIRED"),
        bigquery.SchemaField("email_used", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("signup_timestamp", "TIMESTAMP", mode="REQUIRED"),
        bigquery.SchemaField("error_message", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("batch_id", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("industry", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("country", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("employee_count", "INTEGER", mode="NULLABLE"),
        bigquery.SchemaField("form_type", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("response_status", "INTEGER", mode="NULLABLE"),
        bigquery.SchemaField("redirect_url", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("session_id", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("retry_count", "INTEGER", mode="NULLABLE"),
        bigquery.SchemaField("processing_time_seconds", "FLOAT", mode="NULLABLE"),
    ]
    
    # Table reference
    table_id = "instant-ground-394115.email_analytics.newsletter_signup_results"
    
    try:
        # Check if table already exists
        table = client.get_table(table_id)
        print(f"✅ Table {table_id} already exists")
        
        # Print current schema
        print("\n📋 Current schema:")
        for field in table.schema:
            print(f"   {field.name}: {field.field_type} ({field.mode})")
        
        return table
        
    except Exception:
        print(f"📝 Creating new table: {table_id}")
        
        # Create table
        table = bigquery.Table(table_id, schema=schema)
        
        # Set table description
        table.description = "Newsletter signup automation results with domain metadata"
        
        # Set time partitioning on signup_timestamp
        table.time_partitioning = bigquery.TimePartitioning(
            type_=bigquery.TimePartitioningType.DAY,
            field="signup_timestamp"
        )
        
        # Create the table
        table = client.create_table(table)
        
        print(f"✅ Created table {table.project}.{table.dataset_id}.{table.table_id}")
        
        # Print schema
        print("\n📋 Table schema:")
        for field in table.schema:
            print(f"   {field.name}: {field.field_type} ({field.mode})")
        
        return table

def create_domain_tracking_table():
    """Create a table to track domain processing status"""
    
    # Initialize client
    credentials = service_account.Credentials.from_service_account_file(
        'bigquery_credentials.json'
    )
    client = bigquery.Client(credentials=credentials, project='instant-ground-394115')
    
    # Define schema for domain tracking
    schema = [
        bigquery.SchemaField("domain", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("first_attempt", "TIMESTAMP", mode="REQUIRED"),
        bigquery.SchemaField("last_attempt", "TIMESTAMP", mode="REQUIRED"),
        bigquery.SchemaField("attempt_count", "INTEGER", mode="REQUIRED"),
        bigquery.SchemaField("success_count", "INTEGER", mode="REQUIRED"),
        bigquery.SchemaField("failure_count", "INTEGER", mode="REQUIRED"),
        bigquery.SchemaField("last_success", "TIMESTAMP", mode="NULLABLE"),
        bigquery.SchemaField("last_failure", "TIMESTAMP", mode="NULLABLE"),
        bigquery.SchemaField("status", "STRING", mode="REQUIRED"),  # active, blocked, completed
        bigquery.SchemaField("industry", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("country", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("employee_count", "INTEGER", mode="NULLABLE"),
        bigquery.SchemaField("priority_score", "FLOAT", mode="NULLABLE"),
        bigquery.SchemaField("notes", "STRING", mode="NULLABLE"),
    ]
    
    # Table reference
    table_id = "instant-ground-394115.email_analytics.domain_signup_tracking"
    
    try:
        # Check if table exists
        table = client.get_table(table_id)
        print(f"✅ Domain tracking table {table_id} already exists")
        return table
        
    except Exception:
        print(f"📝 Creating domain tracking table: {table_id}")
        
        # Create table
        table = bigquery.Table(table_id, schema=schema)
        table.description = "Domain processing status tracking for newsletter signups"
        
        # Create the table
        table = client.create_table(table)
        print(f"✅ Created domain tracking table {table.project}.{table.dataset_id}.{table.table_id}")
        
        return table

def create_bigquery_views():
    """Create useful views for analyzing signup data"""
    
    # Initialize client
    credentials = service_account.Credentials.from_service_account_file(
        'bigquery_credentials.json'
    )
    client = bigquery.Client(credentials=credentials, project='instant-ground-394115')
    
    # Daily signup summary view
    daily_summary_sql = """
    CREATE OR REPLACE VIEW `instant-ground-394115.email_analytics.daily_signup_summary` AS
    SELECT 
        DATE(signup_timestamp) as signup_date,
        COUNT(*) as total_attempts,
        SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_signups,
        SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed_signups,
        ROUND(SUM(CASE WHEN success THEN 1 ELSE 0 END) / COUNT(*) * 100, 2) as success_rate_pct,
        COUNT(DISTINCT domain) as unique_domains,
        COUNT(DISTINCT email_used) as unique_emails_used,
        AVG(processing_time_seconds) as avg_processing_time_sec
    FROM `instant-ground-394115.email_analytics.newsletter_signup_results`
    GROUP BY DATE(signup_timestamp)
    ORDER BY signup_date DESC
    """
    
    # Industry performance view
    industry_performance_sql = """
    CREATE OR REPLACE VIEW `instant-ground-394115.email_analytics.industry_signup_performance` AS
    SELECT 
        industry,
        COUNT(*) as total_attempts,
        SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_signups,
        ROUND(SUM(CASE WHEN success THEN 1 ELSE 0 END) / COUNT(*) * 100, 2) as success_rate_pct,
        COUNT(DISTINCT domain) as unique_domains,
        AVG(processing_time_seconds) as avg_processing_time_sec,
        MIN(signup_timestamp) as first_signup,
        MAX(signup_timestamp) as last_signup
    FROM `instant-ground-394115.email_analytics.newsletter_signup_results`
    WHERE industry IS NOT NULL AND industry != ''
    GROUP BY industry
    HAVING COUNT(*) >= 5  -- Only show industries with at least 5 attempts
    ORDER BY success_rate_pct DESC, total_attempts DESC
    """
    
    # Failed signups analysis view
    failed_analysis_sql = """
    CREATE OR REPLACE VIEW `instant-ground-394115.email_analytics.failed_signup_analysis` AS
    SELECT 
        error_message,
        COUNT(*) as failure_count,
        COUNT(DISTINCT domain) as unique_domains_affected,
        ROUND(COUNT(*) / (SELECT COUNT(*) FROM `instant-ground-394115.email_analytics.newsletter_signup_results` WHERE NOT success) * 100, 2) as pct_of_failures,
        STRING_AGG(DISTINCT industry, ', ' LIMIT 5) as top_affected_industries,
        MIN(signup_timestamp) as first_occurrence,
        MAX(signup_timestamp) as last_occurrence
    FROM `instant-ground-394115.email_analytics.newsletter_signup_results`
    WHERE NOT success AND error_message IS NOT NULL
    GROUP BY error_message
    ORDER BY failure_count DESC
    """
    
    # Execute view creation queries
    views = [
        ("Daily Signup Summary", daily_summary_sql),
        ("Industry Performance", industry_performance_sql),
        ("Failed Signup Analysis", failed_analysis_sql)
    ]
    
    for view_name, sql in views:
        try:
            job = client.query(sql)
            job.result()  # Wait for completion
            print(f"✅ Created view: {view_name}")
        except Exception as e:
            print(f"❌ Failed to create view {view_name}: {e}")

if __name__ == "__main__":
    print("🚀 Setting up BigQuery tables for newsletter signup automation...")
    
    try:
        # Create main results table
        print("\n1. Creating newsletter signup results table...")
        create_newsletter_signup_table()
        
        # Create domain tracking table
        print("\n2. Creating domain tracking table...")
        create_domain_tracking_table()
        
        # Create analysis views
        print("\n3. Creating analysis views...")
        create_bigquery_views()
        
        print("\n🎉 BigQuery setup completed successfully!")
        print("\n📊 Available tables and views:")
        print("   Tables:")
        print("   - email_analytics.newsletter_signup_results")
        print("   - email_analytics.domain_signup_tracking")
        print("   Views:")
        print("   - email_analytics.daily_signup_summary")
        print("   - email_analytics.industry_signup_performance")
        print("   - email_analytics.failed_signup_analysis")
        
    except Exception as e:
        print(f"❌ Error setting up BigQuery: {e}")
        exit(1) 