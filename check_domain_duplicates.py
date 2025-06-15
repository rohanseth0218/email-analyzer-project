#!/usr/bin/env python3
"""
Check which domains from the current upload are already in BigQuery
"""

import json
from google.cloud import bigquery
from google.oauth2 import service_account
import os

def setup_bigquery_client():
    """Setup BigQuery client"""
    if not os.path.exists('bigquery_credentials.json'):
        print("❌ bigquery_credentials.json not found")
        return None
    
    try:
        credentials = service_account.Credentials.from_service_account_file('bigquery_credentials.json')
        client = bigquery.Client(credentials=credentials, project='instant-ground-394115')
        return client
    except Exception as e:
        print(f"❌ BigQuery setup failed: {e}")
        return None

def main():
    print("🔍 CHECKING DOMAIN DUPLICATES")
    print("=" * 50)
    
    client = setup_bigquery_client()
    if not client:
        return
    
    # Load current upload data
    with open('bigquery_upload_data.json', 'r') as f:
        data = json.load(f)
    
    upload_domains = set(record['domain'] for record in data)
    print(f"📊 Current upload contains {len(upload_domains)} unique domains")
    
    # Check what's already in BigQuery
    table_id = 'instant-ground-394115.email_analytics.newsletter_signup_results_v2'
    
    try:
        query = f"""
        SELECT DISTINCT domain, COUNT(*) as count
        FROM `{table_id}`
        GROUP BY domain
        ORDER BY count DESC
        LIMIT 10
        """
        
        result = client.query(query)
        existing_domains = set()
        
        print(f"\n📋 Sample of existing domains in BigQuery:")
        for i, row in enumerate(result):
            existing_domains.add(row.domain)
            if i < 10:
                print(f"  {row.domain} ({row.count} records)")
        
        # Get total count of existing domains
        count_query = f"SELECT COUNT(DISTINCT domain) as total_domains FROM `{table_id}`"
        count_result = client.query(count_query)
        total_existing = list(count_result)[0].total_domains
        
        print(f"\n📊 Total existing domains in BigQuery: {total_existing}")
        
        # Check overlap
        overlapping_domains = upload_domains.intersection(existing_domains)
        new_domains = upload_domains - existing_domains
        
        print(f"\n🔍 ANALYSIS:")
        print(f"  Domains in upload: {len(upload_domains)}")
        print(f"  Already in BigQuery: {len(overlapping_domains)}")
        print(f"  New domains: {len(new_domains)}")
        print(f"  Duplicate rate: {len(overlapping_domains)/len(upload_domains)*100:.1f}%")
        
        if len(new_domains) > 0:
            print(f"\n🆕 First 10 new domains:")
            for i, domain in enumerate(list(new_domains)[:10]):
                print(f"  {domain}")
        else:
            print(f"\n⚠️ All domains in upload already exist in BigQuery!")
            
    except Exception as e:
        print(f"❌ Error checking BigQuery: {e}")

if __name__ == "__main__":
    main() 