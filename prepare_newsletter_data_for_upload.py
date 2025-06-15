#!/usr/bin/env python3
"""
Prepare Newsletter Signup Data for BigQuery Upload
Converts the JSONL files from github artifacts into the format expected by the upload script
"""

import json
import os
from datetime import datetime

def load_jsonl_file(filepath):
    """Load JSONL file and return list of records"""
    records = []
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        record = json.loads(line)
                        records.append(record)
                    except json.JSONDecodeError as e:
                        print(f"⚠️ Skipping invalid JSON line: {line[:100]}...")
                        continue
        print(f"✅ Loaded {len(records)} records from {filepath}")
    else:
        print(f"❌ File not found: {filepath}")
    return records

def convert_to_upload_format(record, is_success=True):
    """Convert a JSONL record to the format expected by the upload script"""
    # Extract domain from URL
    domain = record.get('domain', '')
    if domain.startswith('https://'):
        domain = domain[8:]  # Remove https://
    elif domain.startswith('http://'):
        domain = domain[7:]   # Remove http://
    
    return {
        'domain': domain,
        'success': is_success,
        'email_used': record.get('email', ''),
        'signup_timestamp': record.get('timestamp', datetime.now().isoformat())
    }

def main():
    print("🔄 PREPARING NEWSLETTER SIGNUP DATA FOR BIGQUERY")
    print("=" * 60)
    
    # Paths to the JSONL files
    successful_file = 'github_artifact_logs/logs/successful_submissions_production.jsonl'
    failed_file = 'github_artifact_logs/logs/failed_submissions_production.jsonl'
    output_file = 'newsletter_signup_results.json'
    
    # Load successful submissions
    print("📥 Loading successful submissions...")
    successful_records = load_jsonl_file(successful_file)
    successful_converted = [convert_to_upload_format(record, True) for record in successful_records]
    
    # Load failed submissions
    print("📥 Loading failed submissions...")
    failed_records = load_jsonl_file(failed_file)
    failed_converted = [convert_to_upload_format(record, False) for record in failed_records]
    
    # Combine all records
    all_records = successful_converted + failed_converted
    
    print(f"📊 SUMMARY:")
    print(f"  ✅ Successful submissions: {len(successful_converted)}")
    print(f"  ❌ Failed submissions: {len(failed_converted)}")
    print(f"  📋 Total records: {len(all_records)}")
    
    # Save to JSON file
    print(f"💾 Saving to {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_records, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Newsletter signup data prepared for upload!")
    print(f"📂 Output file: {output_file}")
    print(f"🚀 Now you can upload with: python bigquery_tools/upload_scripts/upload_newsletter_signup_to_bigquery.py")
    
    # Show sample records
    print("\n📋 Sample records:")
    for i, record in enumerate(all_records[:3]):
        print(f"  {i+1}. {record}")

if __name__ == "__main__":
    main() 