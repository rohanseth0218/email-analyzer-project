#!/usr/bin/env python3
"""
Upload Newsletter Signup JSON data to BigQuery
Specifically designed for newsletter signup results
"""

import json
import pandas as pd
from google.cloud import bigquery
from google.oauth2 import service_account
import os
import sys

def setup_bigquery_client():
    """Setup BigQuery client with service account credentials"""
    if not os.path.exists('bigquery_credentials.json'):
        print("❌ bigquery_credentials.json not found")
        return None
    
    try:
        credentials = service_account.Credentials.from_service_account_file('bigquery_credentials.json')
        client = bigquery.Client(credentials=credentials, project='instant-ground-394115')
        print("✅ BigQuery client initialized")
        return client
    except Exception as e:
        print(f"❌ BigQuery setup failed: {e}")
        return None

def load_newsletter_signup_data(json_path):
    """Load newsletter signup JSON data from file"""
    print(f"📂 Loading newsletter signup data from: {json_path}")
    
    if not os.path.exists(json_path):
        print(f"❌ JSON file not found: {json_path}")
        return []
    
    try:
        # Load as JSON array
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, list):
                print(f"✅ Loaded {len(data)} newsletter signup records")
                return data
    except Exception as e:
        print(f"❌ Error loading JSON: {e}")
        return []

def process_newsletter_signup_data(data):
    """Process newsletter signup data for BigQuery"""
    print("🔄 Processing newsletter signup records...")
    
    if not data:
        print("❌ No data to process")
        return pd.DataFrame()
    
    # Convert to DataFrame
    df = pd.DataFrame(data)
    
    # Ensure all required columns exist with proper types
    required_columns = {
        'domain': str,
        'success': bool,
        'email_used': str,
        'signup_timestamp': str,
        'error_message': str,
        'batch_id': str,
        'industry': str,
        'country': str,
        'employee_count': 'Int64'  # Nullable integer
    }
    
    for col, dtype in required_columns.items():
        if col not in df.columns:
            df[col] = None
        
        # Convert data types more robustly
        if dtype == str:
            df[col] = df[col].fillna('').astype(str)
            df[col] = df[col].replace({'nan': None, 'None': None, '': None})
        elif dtype == bool:
            df[col] = df[col].fillna(False).astype(bool)
        elif dtype == 'Int64':
            # Handle employee_count conversion more carefully
            df[col] = df[col].replace({'': None, 'None': None, 'nan': None})
            df[col] = pd.to_numeric(df[col], errors='coerce')
    
    # Clean up data - handle various null representations
    df = df.replace({pd.NA: None, 'None': None, '': None, 'nan': None})
    
    # Remove any rows with missing required fields
    df = df.dropna(subset=['domain'])
    
    print(f"✅ Processed {len(df)} newsletter signup records")
    print(f"📊 Success rate: {df['success'].sum()}/{len(df)} ({df['success'].mean()*100:.1f}%)")
    
    return df

def check_existing_domains(client, table_id, domains):
    """Check which domains already exist in BigQuery to prevent duplicates"""
    print("🔍 Checking for existing domains in BigQuery...")
    
    try:
        # Create a query to check existing domains
        domains_list = "', '".join(domains)
        query = f"""
        SELECT DISTINCT domain
        FROM `{table_id}`
        WHERE domain IN ('{domains_list}')
        """
        
        query_job = client.query(query)
        existing_domains = set()
        
        for row in query_job:
            existing_domains.add(row.domain)
        
        print(f"📋 Found {len(existing_domains)} existing domains in BigQuery")
        return existing_domains
        
    except Exception as e:
        print(f"⚠️ Could not check existing domains (table might not exist): {e}")
        return set()

def upload_to_bigquery(client, df, table_id):
    """Upload DataFrame to BigQuery with duplicate prevention"""
    print(f"🚀 Uploading to BigQuery table: {table_id}")
    
    # Check for existing domains
    existing_domains = check_existing_domains(client, table_id, df['domain'].tolist())
    
    # Filter out existing domains
    if existing_domains:
        original_count = len(df)
        df = df[~df['domain'].isin(existing_domains)]
        print(f"🔄 Filtered out {original_count - len(df)} duplicate domains")
        print(f"📊 Uploading {len(df)} new records")
        
        if df.empty:
            print("⚠️ No new records to upload (all domains already exist)")
            return True
    
    try:
        # Configure load job
        job_config = bigquery.LoadJobConfig(
            write_disposition=bigquery.WriteDisposition.WRITE_APPEND,  # Append to existing table
            autodetect=False,  # Use explicit schema
            schema=[
                bigquery.SchemaField("domain", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("success", "BOOLEAN", mode="REQUIRED"),
                bigquery.SchemaField("email_used", "STRING", mode="NULLABLE"),
                bigquery.SchemaField("signup_timestamp", "TIMESTAMP", mode="NULLABLE"),
                bigquery.SchemaField("error_message", "STRING", mode="NULLABLE"),
                bigquery.SchemaField("batch_id", "STRING", mode="NULLABLE"),
                bigquery.SchemaField("industry", "STRING", mode="NULLABLE"),
                bigquery.SchemaField("country", "STRING", mode="NULLABLE"),
                bigquery.SchemaField("employee_count", "INTEGER", mode="NULLABLE"),
            ]
        )
        
        # Load data
        job = client.load_table_from_dataframe(df, table_id, job_config=job_config)
        job.result()  # Wait for job to complete
        
        print(f"✅ Successfully loaded {len(df)} rows to {table_id}")
        
        # Get table info
        table = client.get_table(table_id)
        print(f"📊 Table now has {table.num_rows} total rows")
        
        return True
        
    except Exception as e:
        print(f"❌ BigQuery upload failed: {e}")
        print(f"🔍 Error details: {type(e).__name__}")
        
        # Show sample data for debugging
        print("\n🔍 DEBUGGING INFO:")
        print("Sample data types:")
        print(df.dtypes)
        print("\nSample data:")
        print(df.head(2))
        
        return False

def main():
    print("🚀 NEWSLETTER SIGNUP TO BIGQUERY UPLOADER")
    print("=" * 60)
    
    # Configuration
    PROJECT_ID = "instant-ground-394115"
    DATASET_TABLE = os.getenv('DATASET_TABLE', 'email_analytics.newsletter_signup_results_v2')
    
    # Get JSON file path from environment or default
    json_path = os.getenv('JSON_FILE_PATH', 'bigquery_upload_data.json')
    
    print(f"📊 Project: {PROJECT_ID}")
    print(f"📋 Table: {DATASET_TABLE}")
    print(f"📂 JSON File: {json_path}")
    print("=" * 60)
    
    # Setup BigQuery client
    client = setup_bigquery_client()
    if not client:
        print("❌ Failed to setup BigQuery client")
        sys.exit(1)
    
    # Load newsletter signup data
    data = load_newsletter_signup_data(json_path)
    if not data:
        print("❌ No data loaded from JSON file")
        sys.exit(1)
    
    # Process data
    df = process_newsletter_signup_data(data)
    if df.empty:
        print("❌ No records processed")
        sys.exit(1)
    
    # Show sample data
    print("\n📋 SAMPLE DATA:")
    print(df.head(3))
    print(f"\n📊 SUMMARY:")
    print(f"Total records: {len(df)}")
    print(f"Successful signups: {df['success'].sum()}")
    print(f"Failed attempts: {(~df['success']).sum()}")
    print(f"Success rate: {df['success'].mean()*100:.1f}%")
    print(f"Unique domains: {df['domain'].nunique()}")
    
    # Upload to BigQuery
    success = upload_to_bigquery(client, df, DATASET_TABLE)
    
    if success:
        print("\n🎉 SUCCESS!")
        print(f"📊 {len(df)} newsletter signup records uploaded to {DATASET_TABLE}")
        print(f"🔍 View in BigQuery: https://console.cloud.google.com/bigquery?project={PROJECT_ID}")
        print("\n💡 These domains will now be excluded from future signup attempts!")
    else:
        print("\n❌ Upload failed")
        sys.exit(1)

if __name__ == "__main__":
    main() 