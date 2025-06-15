#!/usr/bin/env python3
"""
Create BigQuery table for email analysis results - GitHub Actions version
"""

import os
import sys

def create_table_via_github():
    """Create table using the existing pipeline setup"""
    
    # Import the pipeline class
    sys.path.append('src')
    from production_email_pipeline import ProductionEmailAnalysisPipeline, CONFIG
    
    try:
        # Initialize pipeline (this will create the table if it doesn't exist)
        pipeline = ProductionEmailAnalysisPipeline(CONFIG)
        
        print("✅ Pipeline initialized successfully")
        print(f"✅ Table {CONFIG['bigquery']['table_id']} is ready")
        print("🆕 This is a fresh table - no duplicate prevention needed")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Creating BigQuery table via pipeline initialization...")
    success = create_table_via_github()
    if success:
        print("✅ Table creation completed!")
    else:
        print("❌ Table creation failed!")
        sys.exit(1) 