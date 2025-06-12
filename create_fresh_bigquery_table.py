#!/usr/bin/env python3
"""
Create a fresh BigQuery table for clean email extraction
"""

import os
from google.cloud import bigquery

# BigQuery Configuration
BIGQUERY_CONFIG = {
    'project_id': 'instant-ground-394115',
    'dataset': 'email_analytics', 
    'old_table': 'all_marketing_emails',
    'new_table': 'marketing_emails_clean'
}

def setup_credentials():
    """Setup Google Cloud credentials"""
    creds_file = 'bigquery_credentials.json'
    if os.path.exists(creds_file):
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = creds_file
        print("✅ Using local BigQuery credentials")
        return True
    
    print("❌ No BigQuery credentials found!")
    return False

def create_fresh_table():
    """Create a fresh BigQuery table"""
    if not setup_credentials():
        return
    
    try:
        client = bigquery.Client(project=BIGQUERY_CONFIG['project_id'])
        
        # Create new table with same schema
        table_id = f"{BIGQUERY_CONFIG['project_id']}.{BIGQUERY_CONFIG['dataset']}.{BIGQUERY_CONFIG['new_table']}"
        
        schema = [
            bigquery.SchemaField("email_id", "STRING"),
            bigquery.SchemaField("processed_at", "TIMESTAMP"),
            bigquery.SchemaField("mailbox_email", "STRING"),
            bigquery.SchemaField("sender_email", "STRING"), 
            bigquery.SchemaField("sender_domain", "STRING"),
            bigquery.SchemaField("sender_display_name", "STRING"),
            bigquery.SchemaField("subject", "STRING"),
            bigquery.SchemaField("date_received", "TIMESTAMP"),
            bigquery.SchemaField("date_sent", "STRING"),
            bigquery.SchemaField("text_content", "STRING"),
            bigquery.SchemaField("html_content", "STRING"),
            bigquery.SchemaField("has_unsubscribe", "BOOLEAN"),
            bigquery.SchemaField("has_attachments", "BOOLEAN"), 
            bigquery.SchemaField("content_type", "STRING"),
            bigquery.SchemaField("message_id", "STRING"),
            bigquery.SchemaField("reply_to", "STRING"),
            bigquery.SchemaField("marketing_score", "INTEGER"),
            bigquery.SchemaField("email_size_bytes", "INTEGER"),
            bigquery.SchemaField("is_multipart", "BOOLEAN"),
            bigquery.SchemaField("brand_name", "STRING"),
            bigquery.SchemaField("processing_status", "STRING")
        ]
        
        table = bigquery.Table(table_id, schema=schema)
        table = client.create_table(table, exists_ok=True)
        
        print(f"✅ Created fresh BigQuery table: {BIGQUERY_CONFIG['new_table']}")
        print("🚀 Ready for clean email extraction without warmup emails")
        
        # Update the config in the main script
        print(f"\n📝 Update export_emails_to_bigquery.py to use table: {BIGQUERY_CONFIG['new_table']}")
        
    except Exception as e:
        print(f"❌ Error creating table: {e}")

if __name__ == "__main__":
    print("🆕 CREATING FRESH BIGQUERY TABLE")
    print("=" * 50)
    create_fresh_table() 