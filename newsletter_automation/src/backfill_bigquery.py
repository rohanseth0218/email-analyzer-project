#!/usr/bin/env python3
"""
BigQuery Backfill Script
Recovers and inserts failed BigQuery records from JSON result files
"""

import json
import os
import glob
from datetime import datetime
from google.cloud import bigquery
from typing import List, Dict, Any


def load_json_results(json_file_path: str) -> List[Dict]:
    """Load results from JSON file"""
    try:
        with open(json_file_path, 'r') as f:
            data = json.load(f)
            return data.get('emails', [])
    except Exception as e:
        print(f"❌ Error loading {json_file_path}: {e}")
        return []


def convert_to_bigquery_format(results: List[Dict]) -> List[Dict]:
    """Convert JSON results to BigQuery schema format"""
    rows_to_insert = []
    
    for result in results:
        email_data = result.get('email_data', {})
        gpt_analysis = result.get('gpt_analysis', {})
        
        # Create email_id from sender and subject
        email_id = f"{email_data.get('sender_email', '')}_{email_data.get('subject', '')}"[:100]
        
        row = {
            'email_id': email_id,
            'mailbox_name': email_data.get('mailbox_name', ''),
            'sender_email': email_data.get('sender_email', ''),
            'sender_domain': email_data.get('sender_domain', ''),
            'subject': email_data.get('subject', ''),
            'received_date': email_data.get('date_received', ''),
            'processing_timestamp': datetime.now().isoformat(),
            'brand_name': gpt_analysis.get('brand_name', ''),
            'industry': gpt_analysis.get('industry', ''),
            'email_flow_type': gpt_analysis.get('email_flow_type', ''),
            'campaign_type': gpt_analysis.get('campaign_type', ''),
            'target_audience': gpt_analysis.get('target_audience', ''),
            'design_quality_score': gpt_analysis.get('design_quality_score', 0),
            'professional_score': gpt_analysis.get('professional_score', 0),
            'design_complexity': gpt_analysis.get('design_complexity', 0),
            'visual_hierarchy_strength': gpt_analysis.get('visual_hierarchy_strength', 0),
            'layout_type': gpt_analysis.get('layout_type', ''),
            'color_scheme': gpt_analysis.get('color_scheme', ''),
            'colors_used': gpt_analysis.get('colors_used', ''),
            'typography_style': gpt_analysis.get('typography_style', ''),
            'padding_density': gpt_analysis.get('padding_density', ''),
            'is_mobile_optimized': gpt_analysis.get('is_mobile_optimized', False),
            'image_vs_text_ratio': float(gpt_analysis.get('image_vs_text_ratio', 0)) if gpt_analysis.get('image_vs_text_ratio') else 0.0,
            'main_offer': gpt_analysis.get('main_offer', ''),
            'discount_percent': gpt_analysis.get('discount_percent', ''),
            'urgency_tactics': gpt_analysis.get('urgency_tactics', ''),
            'free_shipping_mentioned': gpt_analysis.get('free_shipping_mentioned', False),
            'products_mentioned': gpt_analysis.get('products_mentioned', ''),
            'product_categories': gpt_analysis.get('product_categories', ''),
            'num_products_featured': gpt_analysis.get('num_products_featured', 0),
            'price_range_shown': gpt_analysis.get('price_range_shown', ''),
            'cta_count': gpt_analysis.get('cta_count', 0),
            'engagement_likelihood': gpt_analysis.get('engagement_likelihood', ''),
            'conversion_potential': gpt_analysis.get('conversion_potential', ''),
            'social_proof_used': gpt_analysis.get('social_proof_used', False),
            'personalization_used': gpt_analysis.get('personalization_used', ''),
            'trust_badges_present': gpt_analysis.get('trust_badges_present', False),
            'unsubscribe_visible': email_data.get('has_unsubscribe', False),
            'marketing_score': email_data.get('marketing_score', 0),
            'screenshot_path': result.get('screenshot_path', ''),
            'gpt_analysis': gpt_analysis if gpt_analysis else {},
            'model_used': 'gpt-4-vision-preview',
            'raw_email_data_json': email_data
        }
        rows_to_insert.append(row)
    
    return rows_to_insert


def backfill_bigquery(project_id: str, dataset: str, table: str, json_pattern: str = "production_screenshot_gpt_results_*.json"):
    """Backfill BigQuery with data from JSON files"""
    
    # Initialize BigQuery client
    client = bigquery.Client(project=project_id)
    table_id = f"{project_id}.{dataset}.{table}"
    
    # Find all JSON result files
    json_files = glob.glob(json_pattern)
    
    if not json_files:
        print(f"❌ No JSON files found matching pattern: {json_pattern}")
        return
    
    print(f"🔍 Found {len(json_files)} JSON result files:")
    for file in json_files:
        print(f"   📄 {file}")
    
    total_inserted = 0
    total_errors = 0
    
    for json_file in json_files:
        print(f"\n📂 Processing {json_file}...")
        
        # Load results from JSON
        results = load_json_results(json_file)
        if not results:
            print(f"   ⚠️ No results found in {json_file}")
            continue
        
        print(f"   📧 Found {len(results)} email records")
        
        # Convert to BigQuery format
        rows_to_insert = convert_to_bigquery_format(results)
        
        if not rows_to_insert:
            print(f"   ⚠️ No valid rows to insert from {json_file}")
            continue
        
        # Insert into BigQuery
        try:
            errors = client.insert_rows_json(table_id, rows_to_insert)
            
            if errors:
                print(f"   ❌ BigQuery insert errors: {errors}")
                total_errors += len(errors)
            else:
                print(f"   ✅ Successfully inserted {len(rows_to_insert)} rows")
                total_inserted += len(rows_to_insert)
                
        except Exception as e:
            print(f"   ❌ BigQuery insert failed: {e}")
            total_errors += len(rows_to_insert)
    
    print(f"\n🎉 BACKFILL COMPLETE:")
    print(f"   ✅ Total rows inserted: {total_inserted}")
    print(f"   ❌ Total errors: {total_errors}")
    print(f"   📁 Files processed: {len(json_files)}")


def main():
    """Main function"""
    # Configuration
    PROJECT_ID = "instant-ground-394115"
    DATASET = "email_analytics" 
    TABLE = "marketing_emails"
    
    print("🚀 Starting BigQuery Backfill...")
    print("=" * 50)
    
    backfill_bigquery(PROJECT_ID, DATASET, TABLE)


if __name__ == "__main__":
    main() 