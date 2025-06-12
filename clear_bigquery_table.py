#!/usr/bin/env python3
"""
Clear BigQuery table to remove warmup emails and start fresh
"""

import os
from google.cloud import bigquery

# BigQuery Configuration
BIGQUERY_CONFIG = {
    'project_id': 'instant-ground-394115',
    'dataset': 'email_analytics', 
    'table': 'all_marketing_emails'
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

def clear_table():
    """Clear all data from the BigQuery table"""
    if not setup_credentials():
        return
    
    try:
        client = bigquery.Client(project=BIGQUERY_CONFIG['project_id'])
        table_id = f"{BIGQUERY_CONFIG['project_id']}.{BIGQUERY_CONFIG['dataset']}.{BIGQUERY_CONFIG['table']}"
        
        # Count existing records
        count_query = f"SELECT COUNT(*) as total FROM `{table_id}`"
        count_result = client.query(count_query)
        total_records = list(count_result)[0].total
        
        print(f"📊 Found {total_records} existing records in BigQuery")
        
        if total_records > 0:
            # Delete all records
            delete_query = f"DELETE FROM `{table_id}` WHERE TRUE"
            
            print("🗑️ Clearing all records from BigQuery table...")
            job = client.query(delete_query)
            job.result()  # Wait for completion
            
            print("✅ BigQuery table cleared successfully!")
            print("🚀 Ready for fresh email extraction without warmup emails")
        else:
            print("📭 Table is already empty")
            
    except Exception as e:
        print(f"❌ Error clearing table: {e}")

if __name__ == "__main__":
    print("🗑️ CLEARING BIGQUERY TABLE")
    print("=" * 50)
    clear_table() 