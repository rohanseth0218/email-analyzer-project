#!/usr/bin/env python3
"""
Create a new clean BigQuery table for marketing emails
This avoids the streaming buffer deletion issue
"""

from google.cloud import bigquery
from google.oauth2 import service_account
from datetime import datetime
import os

def create_new_clean_table():
    """Create a new clean table with timestamp"""
    
    # Setup credentials
    if not os.path.exists('bigquery_credentials.json'):
        print("❌ bigquery_credentials.json not found")
        return None
    
    credentials = service_account.Credentials.from_service_account_file('bigquery_credentials.json')
    client = bigquery.Client(credentials=credentials, project='instant-ground-394115')
    
    # Generate new table name with timestamp
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    new_table_name = f"marketing_emails_clean_{timestamp}"
    
    print(f"🚀 Creating new clean table: {new_table_name}")
    
    # Create table with enhanced schema
    dataset_id = "email_analytics"
    table_id = f"instant-ground-394115.{dataset_id}.{new_table_name}"
    
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
    
    try:
        table = bigquery.Table(table_id, schema=schema)
        table = client.create_table(table)
        print(f"✅ Created new table: {new_table_name}")
        print(f"📊 Table path: {table_id}")
        
        # Update the config in the main script
        print(f"\n🔧 Updating export script to use new table...")
        update_export_script(new_table_name)
        
        return new_table_name
        
    except Exception as e:
        print(f"❌ Failed to create table: {e}")
        return None

def update_export_script(new_table_name):
    """Update the main export script to use the new table"""
    
    # Read the current script
    with open('export_emails_to_bigquery.py', 'r') as f:
        content = f.read()
    
    # Replace the table name in BIGQUERY_CONFIG
    old_config = "'table': 'marketing_emails_clean'"
    new_config = f"'table': '{new_table_name}'"
    
    if old_config in content:
        updated_content = content.replace(old_config, new_config)
        
        # Write back the updated script
        with open('export_emails_to_bigquery.py', 'w') as f:
            f.write(updated_content)
        
        print(f"✅ Updated export script to use table: {new_table_name}")
    else:
        print("⚠️ Could not find table config to update")

if __name__ == "__main__":
    print("🧹 CREATING NEW CLEAN BIGQUERY TABLE")
    print("=" * 50)
    
    new_table = create_new_clean_table()
    
    if new_table:
        print("\n" + "=" * 50)
        print("🎉 SUCCESS!")
        print(f"📋 New clean table: {new_table}")
        print("🚀 Ready to run email extraction with proper warmup filtering!")
        print("=" * 50)
    else:
        print("\n❌ Failed to create new table") 