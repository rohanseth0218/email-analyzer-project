#!/usr/bin/env python3
"""
Merge newsletter signup data from v3 table into v2 table
"""

import os
import json
from google.cloud import bigquery
from google.oauth2 import service_account

def setup_bigquery_client():
    """Setup BigQuery client with credentials"""
    try:
        # Try to load credentials from environment variable
        if 'BIGQUERY_CREDENTIALS' in os.environ:
            credentials_json = os.environ['BIGQUERY_CREDENTIALS']
            credentials_info = json.loads(credentials_json)
            credentials = service_account.Credentials.from_service_account_info(credentials_info)
        else:
            # Fallback to service account file
            credentials_file = 'bigquery_credentials.json'
            if os.path.exists(credentials_file):
                credentials = service_account.Credentials.from_service_account_file(credentials_file)
            else:
                raise FileNotFoundError("No credentials found")
        
        client = bigquery.Client(credentials=credentials, project=credentials.project_id)
        return client
    except Exception as e:
        print(f"Error setting up BigQuery client: {e}")
        raise

def check_table_schemas(client):
    """Check the schemas of both tables to ensure compatibility"""
    project_id = "instant-ground-394115"
    dataset_id = "email_analytics"
    
    v2_table_id = f"{project_id}.{dataset_id}.newsletter_signup_results_v2"
    v3_table_id = f"{project_id}.{dataset_id}.newsletter_signup_results_v3"
    
    try:
        v2_table = client.get_table(v2_table_id)
        v3_table = client.get_table(v3_table_id)
        
        print("V2 Table Schema:")
        for field in v2_table.schema:
            print(f"  {field.name}: {field.field_type}")
        
        print("\nV3 Table Schema:")
        for field in v3_table.schema:
            print(f"  {field.name}: {field.field_type}")
            
        return v2_table, v3_table
    except Exception as e:
        print(f"Error checking table schemas: {e}")
        raise

def get_table_counts(client):
    """Get row counts for both tables"""
    project_id = "instant-ground-394115"
    dataset_id = "email_analytics"
    
    v2_query = f"SELECT COUNT(*) as count FROM `{project_id}.{dataset_id}.newsletter_signup_results_v2`"
    v3_query = f"SELECT COUNT(*) as count FROM `{project_id}.{dataset_id}.newsletter_signup_results_v3`"
    
    try:
        v2_result = client.query(v2_query).result()
        v2_count = list(v2_result)[0].count
        
        v3_result = client.query(v3_query).result()
        v3_count = list(v3_result)[0].count
        
        print(f"V2 table currently has: {v2_count} rows")
        print(f"V3 table currently has: {v3_count} rows")
        
        return v2_count, v3_count
    except Exception as e:
        print(f"Error getting table counts: {e}")
        raise

def merge_tables(client):
    """Merge v3 data into v2 table"""
    project_id = "instant-ground-394115"
    dataset_id = "email_analytics"
    
    # SQL to insert data from v3 into v2, avoiding duplicates
    merge_query = f"""
    INSERT INTO `{project_id}.{dataset_id}.newsletter_signup_results_v2`
    SELECT * FROM `{project_id}.{dataset_id}.newsletter_signup_results_v3`
    WHERE NOT EXISTS (
        SELECT 1 FROM `{project_id}.{dataset_id}.newsletter_signup_results_v2` v2
        WHERE v2.domain = `{project_id}.{dataset_id}.newsletter_signup_results_v3`.domain
        AND v2.timestamp = `{project_id}.{dataset_id}.newsletter_signup_results_v3`.timestamp
    )
    """
    
    try:
        print("Merging data from v3 into v2...")
        job = client.query(merge_query)
        result = job.result()
        
        print(f"Merge completed. Affected rows: {job.num_dml_affected_rows}")
        return job.num_dml_affected_rows
    except Exception as e:
        print(f"Error merging tables: {e}")
        raise

def cleanup_v3_table(client):
    """Delete the v3 table after successful merge"""
    project_id = "instant-ground-394115"
    dataset_id = "email_analytics"
    table_id = f"{project_id}.{dataset_id}.newsletter_signup_results_v3"
    
    try:
        client.delete_table(table_id, not_found_ok=True)
        print("V3 table deleted successfully")
    except Exception as e:
        print(f"Error deleting v3 table: {e}")
        raise

def main():
    """Main function to perform the merge operation"""
    print("Starting newsletter table merge operation...")
    
    # Setup BigQuery client
    client = setup_bigquery_client()
    
    # Check table schemas
    print("\n1. Checking table schemas...")
    v2_table, v3_table = check_table_schemas(client)
    
    # Get initial counts
    print("\n2. Getting current row counts...")
    v2_count_before, v3_count = get_table_counts(client)
    
    # Confirm merge operation
    print(f"\n3. About to merge {v3_count} rows from v3 into v2 (current: {v2_count_before})")
    response = input("Proceed with merge? (y/N): ")
    
    if response.lower() != 'y':
        print("Merge cancelled.")
        return
    
    # Perform merge
    print("\n4. Performing merge...")
    affected_rows = merge_tables(client)
    
    # Get final count
    print("\n5. Verifying merge...")
    v2_count_after, _ = get_table_counts(client)
    
    print(f"V2 table before merge: {v2_count_before} rows")
    print(f"V2 table after merge: {v2_count_after} rows")
    print(f"Rows added: {v2_count_after - v2_count_before}")
    print(f"Expected rows added: {affected_rows}")
    
    # Ask about cleanup
    print("\n6. Cleanup...")
    cleanup_response = input("Delete v3 table now that data is merged? (y/N): ")
    
    if cleanup_response.lower() == 'y':
        cleanup_v3_table(client)
    else:
        print("V3 table preserved. You can delete it manually later if needed.")
    
    print(f"\nMerge operation completed successfully!")
    print(f"All newsletter signup data is now consolidated in the v2 table with {v2_count_after} total rows.")

if __name__ == "__main__":
    main() 