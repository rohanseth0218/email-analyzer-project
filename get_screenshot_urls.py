#!/usr/bin/env python3
"""
Simple script to fetch and display raw screenshot URLs from BigQuery
"""

import os
import sys
sys.path.append('src')

from google.cloud import bigquery
from google.oauth2 import service_account

def get_screenshot_urls():
    """Fetch and display raw screenshot URLs"""
    
    # Configuration
    project_id = 'instant-ground-394115'
    credentials_path = './gcp-service-account.json'
    
    try:
        # Initialize BigQuery client
        if os.path.exists(credentials_path):
            credentials = service_account.Credentials.from_service_account_file(credentials_path)
            client = bigquery.Client(credentials=credentials, project=project_id)
        else:
            client = bigquery.Client(project=project_id)
        
        # Query to get screenshot URLs
        query = """
        SELECT 
            email_id,
            sender_email,
            screenshot_url,
            screenshot_path
        FROM `instant-ground-394115.email_analytics.email_analysis_results_v3`
        ORDER BY analysis_timestamp DESC
        LIMIT 10
        """
        
        print("🔍 Fetching screenshot URLs from BigQuery...")
        query_job = client.query(query)
        results = query_job.result()
        
        print("\n📊 Screenshot URLs:")
        print("=" * 100)
        
        for i, row in enumerate(results, 1):
            print(f"\n{i}. Email ID: {row['email_id']}")
            print(f"   Sender: {row['sender_email']}")
            print(f"   Screenshot URL: {row['screenshot_url']}")
            print(f"   Local Path: {row['screenshot_path']}")
            print("-" * 100)
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Getting screenshot URLs from BigQuery...")
    success = get_screenshot_urls()
    if not success:
        sys.exit(1) 