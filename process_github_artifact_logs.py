#!/usr/bin/env python3
"""
Process GitHub Actions Artifact Logs for BigQuery Upload
Extracts logs from the downloaded artifact ZIP and prepares them for BigQuery
"""

import json
import os
import zipfile
from datetime import datetime
from pathlib import Path

def extract_artifact_logs(zip_path):
    """Extract logs from GitHub Actions artifact ZIP"""
    print(f"📦 Extracting logs from: {zip_path}")
    
    if not os.path.exists(zip_path):
        print(f"❌ Artifact ZIP not found: {zip_path}")
        return False
    
    # Create extraction directory
    extract_dir = "github_artifact_logs"
    os.makedirs(extract_dir, exist_ok=True)
    
    # Extract ZIP
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(extract_dir)
        extracted_files = zip_ref.namelist()
    
    print(f"✅ Extracted {len(extracted_files)} files to {extract_dir}/")
    for file in extracted_files:
        print(f"  📄 {file}")
    
    return extract_dir

def process_artifact_jsonl_files(extract_dir):
    """Process JSONL files from the artifact"""
    print(f"\n🔄 Processing JSONL files from {extract_dir}")
    
    all_records = []
    
    # Look for successful and failed submissions
    jsonl_files = list(Path(extract_dir).glob("**/*.jsonl"))
    
    for jsonl_file in jsonl_files:
        print(f"📄 Processing: {jsonl_file}")
        
        with open(jsonl_file, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
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
                        'batch_number': record.get('batch', 0),
                        'source_file': str(jsonl_file.name)
                    }
                    all_records.append(transformed_record)
                except json.JSONDecodeError as e:
                    print(f"⚠️ Skipping malformed line {line_num} in {jsonl_file}: {e}")
                    continue
    
    return all_records

def create_bigquery_upload_file(records, output_file="github_artifact_bigquery_data.json"):
    """Create BigQuery upload file from processed records"""
    print(f"\n📊 Creating BigQuery upload file: {output_file}")
    
    # Write as JSON array
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(records, f, indent=2, ensure_ascii=False)
    
    # Generate summary
    successful = sum(1 for r in records if r['success'])
    failed = len(records) - successful
    
    print(f"✅ Created {output_file} with {len(records)} total records")
    print(f"📊 SUMMARY:")
    print(f"  ✅ Successful signups: {successful}")
    print(f"  ❌ Failed attempts: {failed}")
    print(f"  📈 Success rate: {successful/len(records)*100:.1f}%" if records else "0%")
    
    # Show failure reasons
    if failed > 0:
        failure_reasons = {}
        for record in records:
            if not record['success']:
                reason = record['failure_reason'] or 'unknown'
                failure_reasons[reason] = failure_reasons.get(reason, 0) + 1
        
        print(f"  🔍 Top failure reasons:")
        for reason, count in sorted(failure_reasons.items(), key=lambda x: x[1], reverse=True)[:5]:
            print(f"    - {reason}: {count}")
    
    return output_file

def main():
    print("🚀 GITHUB ARTIFACT LOG PROCESSOR")
    print("=" * 60)
    
    # Look for downloaded artifact ZIP
    possible_zip_names = [
        "Newsletter Automation Logs.zip",
        "newsletter-automation-logs-15.zip",
        "artifact.zip",
        "logs.zip"
    ]
    
    zip_path = None
    for zip_name in possible_zip_names:
        if os.path.exists(zip_name):
            zip_path = zip_name
            break
    
    if not zip_path:
        print("❌ No artifact ZIP found. Please download the artifact from GitHub Actions and place it in this directory.")
        print("Expected names: " + ", ".join(possible_zip_names))
        return
    
    # Extract artifact
    extract_dir = extract_artifact_logs(zip_path)
    if not extract_dir:
        return
    
    # Process JSONL files
    records = process_artifact_jsonl_files(extract_dir)
    
    if not records:
        print("❌ No records found in artifact logs")
        return
    
    # Create BigQuery upload file
    output_file = create_bigquery_upload_file(records)
    
    print(f"\n🎉 SUCCESS!")
    print(f"📂 BigQuery upload file: {output_file}")
    print(f"📊 Total records: {len(records)}")
    print(f"\n💡 Next steps:")
    print(f"1. Upload {output_file} to BigQuery using your existing workflow")
    print(f"2. Or commit this file and trigger the upload workflow")

if __name__ == "__main__":
    main() 