#!/usr/bin/env python3
"""
Prepare Newsletter Signup Logs for BigQuery Upload
Converts JSONL log files to proper JSON format for BigQuery
"""

import json
import os
from datetime import datetime
from pathlib import Path

def convert_jsonl_to_json(jsonl_file, json_file):
    """Convert JSONL file to JSON array format"""
    print(f"📄 Converting {jsonl_file} to {json_file}")
    
    records = []
    if os.path.exists(jsonl_file):
        with open(jsonl_file, 'r', encoding='utf-8') as f:
            for line in f:
                try:
                    record = json.loads(line.strip())
                    # Transform record to match BigQuery schema
                    transformed_record = {
                        'domain': record.get('domain', ''),
                        'success': record.get('success', False),
                        'email_used': record.get('email', ''),
                        'signup_timestamp': record.get('timestamp', datetime.now().isoformat()),
                        'failure_reason': record.get('reason', ''),
                        'error_message': record.get('error', ''),
                        'batch_number': record.get('batch', 0)
                    }
                    records.append(transformed_record)
                except json.JSONDecodeError as e:
                    print(f"⚠️ Skipping malformed line: {e}")
                    continue
    
    # Write as JSON array
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(records, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Converted {len(records)} records")
    return len(records)

def main():
    print("🔄 PREPARING NEWSLETTER SIGNUP LOGS FOR BIGQUERY")
    print("=" * 60)
    
    logs_dir = Path("logs")
    
    # Convert successful submissions
    successful_count = 0
    if (logs_dir / "successful_submissions_production.jsonl").exists():
        successful_count = convert_jsonl_to_json(
            logs_dir / "successful_submissions_production.jsonl",
            "successful_signups_for_bigquery.json"
        )
    
    # Convert failed submissions  
    failed_count = 0
    if (logs_dir / "failed_submissions_production.jsonl").exists():
        failed_count = convert_jsonl_to_json(
            logs_dir / "failed_submissions_production.jsonl", 
            "failed_signups_for_bigquery.json"
        )
    
    # Combine all records into single file
    all_records = []
    
    # Load successful records
    if os.path.exists("successful_signups_for_bigquery.json"):
        with open("successful_signups_for_bigquery.json", 'r') as f:
            all_records.extend(json.load(f))
    
    # Load failed records
    if os.path.exists("failed_signups_for_bigquery.json"):
        with open("failed_signups_for_bigquery.json", 'r') as f:
            all_records.extend(json.load(f))
    
    # Write combined file
    with open("bigquery_upload_data.json", 'w', encoding='utf-8') as f:
        json.dump(all_records, f, indent=2, ensure_ascii=False)
    
    print("\n📊 SUMMARY:")
    print(f"✅ Successful signups: {successful_count}")
    print(f"❌ Failed signups: {failed_count}")
    print(f"📊 Total records: {len(all_records)}")
    print(f"📂 BigQuery upload file: bigquery_upload_data.json")
    print("\n🚀 Ready for BigQuery upload!")

if __name__ == "__main__":
    main() 