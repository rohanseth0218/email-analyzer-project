#!/usr/bin/env python3
"""
Create BigQuery table for email analysis results with correct schema
"""

import os
from google.cloud import bigquery
from google.oauth2 import service_account

def create_email_analysis_table():
    """Create the email analysis results table with proper schema"""
    
    # Configuration
    project_id = 'instant-ground-394115'
    dataset_id = 'email_analytics'
    table_id = 'email_analysis_results_v2'  # New table name
    credentials_path = './gcp-service-account.json'
    
    try:
        # Initialize BigQuery client
        if os.path.exists(credentials_path):
            credentials = service_account.Credentials.from_service_account_file(credentials_path)
            client = bigquery.Client(credentials=credentials, project=project_id)
            print("✅ BigQuery client configured with service account")
        else:
            client = bigquery.Client(project=project_id)
            print("✅ BigQuery client configured with default credentials")
        
        # Ensure dataset exists
        dataset_ref = client.dataset(dataset_id)
        try:
            client.get_dataset(dataset_ref)
            print(f"✅ Dataset {dataset_id} exists")
        except:
            dataset = bigquery.Dataset(dataset_ref)
            dataset.location = "US"
            client.create_dataset(dataset)
            print(f"✅ Created dataset {dataset_id}")
        
        # Define the complete schema for email analysis
        schema = [
            bigquery.SchemaField("email_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("sender_email", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("subject", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("date_received", "TIMESTAMP", mode="NULLABLE"),
            bigquery.SchemaField("sender_domain", "STRING", mode="NULLABLE"),
            
            # Screenshot fields
            bigquery.SchemaField("screenshot_path", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("screenshot_url", "STRING", mode="NULLABLE"),
            
            # GPT Analysis fields
            bigquery.SchemaField("gpt_analysis", "JSON", mode="NULLABLE"),
            bigquery.SchemaField("num_products_featured", "INTEGER", mode="NULLABLE"),
            
            # Processing metadata
            bigquery.SchemaField("processing_status", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("errors", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("raw_email_data", "JSON", mode="NULLABLE"),
            bigquery.SchemaField("analysis_timestamp", "TIMESTAMP", mode="NULLABLE"),
            
            # Additional analysis fields for future use
            bigquery.SchemaField("flow_vs_campaign", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("flow_type", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("campaign_theme", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("event_or_seasonality", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("discount_percent", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("design_level", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("image_vs_text_ratio", "FLOAT", mode="NULLABLE"),
            bigquery.SchemaField("unsubscribe_visible", "BOOLEAN", mode="NULLABLE"),
            bigquery.SchemaField("personalization_used", "BOOLEAN", mode="NULLABLE"),
            bigquery.SchemaField("social_proof_used", "BOOLEAN", mode="NULLABLE"),
            bigquery.SchemaField("emotional_tone", "STRING", mode="NULLABLE"),
        ]
        
        # Create table reference
        table_ref = dataset_ref.table(table_id)
        
        # Check if table already exists
        try:
            existing_table = client.get_table(table_ref)
            print(f"⚠️ Table {table_id} already exists")
            
            # Ask if we should delete and recreate
            response = input("Do you want to delete and recreate the table? (y/N): ")
            if response.lower() == 'y':
                client.delete_table(table_ref)
                print(f"🗑️ Deleted existing table {table_id}")
            else:
                print("❌ Keeping existing table. Exiting.")
                return False
                
        except:
            print(f"✅ Table {table_id} doesn't exist, will create new one")
        
        # Create the table
        table = bigquery.Table(table_ref, schema=schema)
        table.description = "Email analysis results with GPT-4V analysis, screenshots, and metadata"
        
        # Add table labels for organization
        table.labels = {
            "environment": "production",
            "purpose": "email_analysis",
            "version": "v2"
        }
        
        created_table = client.create_table(table)
        print(f"✅ Created table {project_id}.{dataset_id}.{table_id}")
        print(f"📊 Table has {len(schema)} columns")
        
        # Print schema summary
        print("\n📋 Table Schema:")
        for field in schema:
            print(f"   {field.name}: {field.field_type} ({field.mode})")
        
        return True
        
    except Exception as e:
        print(f"❌ Error creating table: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Creating BigQuery table for email analysis results...")
    success = create_email_analysis_table()
    if success:
        print("\n✅ Table creation completed successfully!")
        print("💡 Update your pipeline config to use table: email_analysis_results_v2")
    else:
        print("\n❌ Table creation failed!") 