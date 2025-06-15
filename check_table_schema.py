#!/usr/bin/env python3
"""
Check the schema of the marketing emails table
"""

from google.cloud import bigquery
from google.oauth2 import service_account
import os

def check_table_schema():
    """Check the schema of the marketing emails table"""
    
    if not os.path.exists('bigquery_credentials.json'):
        print("❌ bigquery_credentials.json not found")
        return
    
    try:
        # Initialize client
        credentials = service_account.Credentials.from_service_account_file('bigquery_credentials.json')
        client = bigquery.Client(credentials=credentials, project='instant-ground-394115')
        
        # Get table reference
        table_id = "instant-ground-394115.email_analytics.marketing_emails_clean_20250612_082945"
        table = client.get_table(table_id)
        
        print(f"📊 TABLE SCHEMA: {table_id}")
        print("=" * 60)
        print(f"Rows: {table.num_rows:,}")
        print(f"Size: {table.num_bytes / (1024**3):.2f} GB")
        print()
        
        print("COLUMNS:")
        for field in table.schema:
            print(f"  • {field.name} ({field.field_type}) - {field.mode}")
        
        print()
        print("SAMPLE DATA:")
        
        # Get a sample row
        query = f"""
        SELECT *
        FROM `{table_id}`
        WHERE sender_email IS NOT NULL
        LIMIT 1
        """
        
        query_job = client.query(query)
        results = list(query_job)
        
        if results:
            row = results[0]
            for key, value in row.items():
                if isinstance(value, str) and len(value) > 100:
                    value = value[:100] + "..."
                print(f"  {key}: {value}")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    check_table_schema() 