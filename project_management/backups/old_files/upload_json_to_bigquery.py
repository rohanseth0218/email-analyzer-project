#!/usr/bin/env python3
"""
Upload JSON data to BigQuery
Handles both storeleads and newsletter signup data
"""

import json
import pandas as pd
from tqdm import tqdm
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

def load_json_data(json_path):
    """Load JSON data from file"""
    print(f"📂 Loading JSON data from: {json_path}")
    
    if not os.path.exists(json_path):
        print(f"❌ JSON file not found: {json_path}")
        return []
    
    try:
        # Try loading as a single JSON array first
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, list):
                print(f"✅ Loaded {len(data)} records from JSON array")
                return data
    except:
        pass
    
    # Fall back to JSONL format (line-by-line JSON)
    lines = []
    with open(json_path, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            try:
                lines.append(json.loads(line))
            except Exception as e:
                print(f"⚠️ Skipping broken line {line_num}: {e}")
                continue
    
    print(f"✅ Loaded {len(lines)} records from JSONL")
    return lines

def process_newsletter_signup_data(data):
    """Process newsletter signup data"""
    print("🔄 Processing newsletter signup records...")
    
    # Data is already in the correct format for BigQuery
    df = pd.DataFrame(data)
    
    # Ensure all required columns exist
    required_columns = [
        'domain', 'success', 'email_used', 'signup_timestamp', 
        'error_message', 'batch_id', 'industry', 'country', 'employee_count'
    ]
    
    for col in required_columns:
        if col not in df.columns:
            df[col] = None
    
    print(f"✅ Processed {len(df)} newsletter signup records")
    return df

def extract_email(contact_info):
    """Extract email from contact info"""
    if not contact_info:
        return None
    for c in contact_info:
        if c.get('type', '').lower() == 'email':
            return c.get('value')
    return None

def extract_klaviyo_info(apps, technologies):
    """Extract Klaviyo installation info from apps and technologies"""
    klaviyo_installed_at = None
    klaviyo_active = False
    
    if apps:
        for app in apps:
            if "klaviyo" in (app.get('name', '') + app.get('token', '')).lower():
                klaviyo_installed_at = app.get('installed_at')
                klaviyo_active = (app.get('state', '').lower() == 'active')
    
    if not klaviyo_installed_at and technologies:
        for tech in technologies:
            if "klaviyo" in tech.get('name', '').lower():
                klaviyo_installed_at = tech.get('installed_at')
    
    return klaviyo_installed_at, klaviyo_active

def process_storeleads_data(lines):
    """Process storeleads data into structured format"""
    print("🔄 Processing storeleads records...")
    
    records = []
    for shop in tqdm(lines, desc="Processing stores"):
        klaviyo_installed_at, klaviyo_active = extract_klaviyo_info(
            shop.get('apps'), shop.get('technologies')
        )
        
        records.append({
            'store_id': shop.get('name'),
            'platform_domain': shop.get('platform_domain'),
            'merchant_name': shop.get('merchant_name'),
            'platform': shop.get('platform'),
            'country_code': shop.get('country_code'),
            'region': shop.get('region'),
            'subregion': shop.get('subregion'),
            'location': shop.get('location'),
            'state': shop.get('state'),
            'created_at': shop.get('created_at'),
            'last_updated_at': shop.get('last_updated_at'),
            'email': extract_email(shop.get('contact_info')),
            'contact_page': shop.get('contact_page'),
            'about_us': shop.get('about_us'),
            'title': shop.get('title'),
            'description': shop.get('description'),
            'klaviyo_installed_at': klaviyo_installed_at,
            'klaviyo_active': klaviyo_active,
            'avg_price': shop.get('avg_price'),
            'product_count': shop.get('product_count'),
            'employee_count': shop.get('employee_count'),
            'estimated_sales_yearly': shop.get('estimated_sales_yearly'),
            'estimated_page_views': shop.get('estimated_page_views'),
            'rank': shop.get('rank'),
            'categories': shop.get('categories')
        })
    
    df = pd.DataFrame(records)
    print(f"✅ Processed {len(df)} storeleads records into DataFrame")
    return df

def detect_data_type(data):
    """Detect whether data is newsletter signup or storeleads format"""
    if not data:
        return "unknown"
    
    sample = data[0] if isinstance(data, list) else data
    
    # Check for newsletter signup fields
    if 'email_used' in sample and 'signup_timestamp' in sample:
        return "newsletter_signup"
    
    # Check for storeleads fields
    if 'platform_domain' in sample or 'merchant_name' in sample:
        return "storeleads"
    
    return "unknown"

def upload_to_bigquery(client, df, dataset_table):
    """Upload DataFrame to BigQuery"""
    print(f"🚀 Uploading to BigQuery table: {dataset_table}")
    
    try:
        # Create table reference
        table_parts = dataset_table.split('.')
        if len(table_parts) != 2:
            raise ValueError(f"Invalid table format: {dataset_table}. Expected format: dataset.table")
        
        dataset_id, table_id = table_parts
        table_ref = client.dataset(dataset_id).table(table_id)
        
        # Configure load job
        job_config = bigquery.LoadJobConfig(
            write_disposition=bigquery.WriteDisposition.WRITE_APPEND,  # Append to existing table
            autodetect=True  # Auto-detect schema
        )
        
        # Load data
        job = client.load_table_from_dataframe(df, table_ref, job_config=job_config)
        job.result()  # Wait for job to complete
        
        print(f"✅ Successfully loaded {len(df)} rows to {dataset_table}")
        return True
        
    except Exception as e:
        print(f"❌ BigQuery upload failed: {e}")
        return False

def main():
    print("🚀 JSON TO BIGQUERY UPLOADER")
    print("=" * 50)
    
    # Configuration
    PROJECT_ID = "instant-ground-394115"
    DATASET_TABLE = os.getenv('DATASET_TABLE', 'email_analytics.storeleads')
    
    # Get JSON file path from environment or default
    json_path = os.getenv('JSON_FILE_PATH', 'data.json')
    
    print(f"📊 Project: {PROJECT_ID}")
    print(f"📋 Table: {DATASET_TABLE}")
    print(f"📂 JSON File: {json_path}")
    print("=" * 50)
    
    # Setup BigQuery client
    client = setup_bigquery_client()
    if not client:
        print("❌ Failed to setup BigQuery client")
        sys.exit(1)
    
    # Load JSON data
    data = load_json_data(json_path)
    if not data:
        print("❌ No data loaded from JSON file")
        sys.exit(1)
    
    # Detect data type and process accordingly
    data_type = detect_data_type(data)
    print(f"🔍 Detected data type: {data_type}")
    
    if data_type == "newsletter_signup":
        df = process_newsletter_signup_data(data)
    elif data_type == "storeleads":
        df = process_storeleads_data(data)
    else:
        print("❌ Unknown data format")
        sys.exit(1)
    
    if df.empty:
        print("❌ No records processed")
        sys.exit(1)
    
    # Show sample data
    print("\n📋 SAMPLE DATA:")
    print(df.head())
    print(f"\n📊 SUMMARY:")
    print(f"Total records: {len(df)}")
    print(f"Columns: {list(df.columns)}")
    
    # Upload to BigQuery
    success = upload_to_bigquery(client, df, DATASET_TABLE)
    
    if success:
        print("\n🎉 SUCCESS!")
        print(f"📊 {len(df)} records uploaded to {DATASET_TABLE}")
        print(f"🔍 View in BigQuery: https://console.cloud.google.com/bigquery?project={PROJECT_ID}")
    else:
        print("\n❌ Upload failed")
        sys.exit(1)

if __name__ == "__main__":
    main() 