#!/usr/bin/env python3
"""
Convert existing brand analysis results to BigQuery format
Uses the analysis we already have instead of re-processing emails
"""

import json
import csv
from datetime import datetime
from typing import List, Dict, Any

def load_existing_analysis():
    """Load the existing brand analysis results"""
    try:
        with open('brand_analysis_summary_20250611_173950.json', 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading existing analysis: {e}")
        return None

def create_bigquery_records(analysis_data):
    """Convert analysis data to BigQuery record format"""
    records = []
    
    metadata = analysis_data['analysis_metadata']
    top_brands = analysis_data['top_30_brands']
    
    # Create a record for each brand
    for brand in top_brands:
        record = {
            'email_id': f"brand_{brand['rank']}_{brand['domain']}",
            'processed_at': datetime.now().isoformat(),
            'mailbox_email': 'multiple_mailboxes',  # Since we aggregated across all
            'sender_email': f"info@{brand['domain']}",  # Estimated
            'sender_domain': brand['domain'],
            'sender_display_name': brand['brand_name'],
            'subject': brand['example'],
            'date_received': metadata['timestamp'],
            'date_sent': metadata['timestamp'],
            'text_content': f"Marketing email from {brand['brand_name']}. Example: {brand['example']}",
            'html_content': f"<html><body><h1>{brand['brand_name']}</h1><p>{brand['example']}</p></body></html>",
            'has_unsubscribe': True,  # Assume marketing emails have unsubscribe
            'has_attachments': False,
            'content_type': 'text/html',
            'message_id': f"<brand_{brand['rank']}@{brand['domain']}>",
            'reply_to': f"noreply@{brand['domain']}",
            'marketing_score': 5,  # High since these are confirmed marketing emails
            'email_size_bytes': len(brand['example']) * 10,  # Estimate
            'is_multipart': True,
            'brand_name': brand['brand_name'],
            'processing_status': 'aggregated_from_analysis',
            'total_emails_from_brand': brand['total_emails'],
            'mailbox_count': brand['mailbox_count'],
            'brand_rank': brand['rank']
        }
        records.append(record)
    
    return records

def create_summary_record(analysis_data):
    """Create a summary record with overall statistics"""
    metadata = analysis_data['analysis_metadata']
    stats = analysis_data['distribution_stats']
    
    summary_record = {
        'email_id': 'ANALYSIS_SUMMARY',
        'processed_at': datetime.now().isoformat(),
        'mailbox_email': 'ALL_MAILBOXES',
        'sender_email': 'analysis@system',
        'sender_domain': 'system.analysis',
        'sender_display_name': 'Brand Analysis System',
        'subject': f"Brand Analysis Summary - {metadata['total_unique_brands']} Unique Brands Found",
        'date_received': metadata['timestamp'],
        'date_sent': metadata['timestamp'],
        'text_content': f"""
BRAND ANALYSIS SUMMARY
======================
Analysis Date: {metadata['timestamp']}
Days Analyzed: {metadata['days_analyzed']}
Mailboxes Analyzed: {metadata['mailboxes_analyzed']}
Total Unique Brands: {metadata['total_unique_brands']}
Total Marketing Emails: {metadata['total_marketing_emails']}
Average Emails per Brand: {metadata['average_emails_per_brand']}

DISTRIBUTION:
- Brands with 1 email: {stats['brands_with_1_email']} ({stats['brands_with_1_email']/metadata['total_unique_brands']*100:.1f}%)
- Brands with 2-5 emails: {stats['brands_with_2_5_emails']} ({stats['brands_with_2_5_emails']/metadata['total_unique_brands']*100:.1f}%)
- Brands with 6-10 emails: {stats['brands_with_6_10_emails']} ({stats['brands_with_6_10_emails']/metadata['total_unique_brands']*100:.1f}%)
- Brands with 10+ emails: {stats['brands_with_10_plus_emails']} ({stats['brands_with_10_plus_emails']/metadata['total_unique_brands']*100:.1f}%)
        """,
        'html_content': f"""
<html>
<body>
<h1>Brand Analysis Summary</h1>
<h2>📊 Key Metrics</h2>
<ul>
<li><strong>Total Unique Brands:</strong> {metadata['total_unique_brands']}</li>
<li><strong>Total Marketing Emails:</strong> {metadata['total_marketing_emails']}</li>
<li><strong>Mailboxes Analyzed:</strong> {metadata['mailboxes_analyzed']}</li>
<li><strong>Days Analyzed:</strong> {metadata['days_analyzed']}</li>
</ul>

<h2>📈 Distribution</h2>
<table border="1">
<tr><th>Email Count</th><th>Brands</th><th>Percentage</th></tr>
<tr><td>1 email</td><td>{stats['brands_with_1_email']}</td><td>{stats['brands_with_1_email']/metadata['total_unique_brands']*100:.1f}%</td></tr>
<tr><td>2-5 emails</td><td>{stats['brands_with_2_5_emails']}</td><td>{stats['brands_with_2_5_emails']/metadata['total_unique_brands']*100:.1f}%</td></tr>
<tr><td>6-10 emails</td><td>{stats['brands_with_6_10_emails']}</td><td>{stats['brands_with_6_10_emails']/metadata['total_unique_brands']*100:.1f}%</td></tr>
<tr><td>10+ emails</td><td>{stats['brands_with_10_plus_emails']}</td><td>{stats['brands_with_10_plus_emails']/metadata['total_unique_brands']*100:.1f}%</td></tr>
</table>
</body>
</html>
        """,
        'has_unsubscribe': False,
        'has_attachments': False,
        'content_type': 'text/html',
        'message_id': '<analysis_summary@system>',
        'reply_to': 'noreply@system',
        'marketing_score': 0,
        'email_size_bytes': 5000,
        'is_multipart': True,
        'brand_name': 'System Analysis',
        'processing_status': 'summary_record',
        'total_emails_from_brand': metadata['total_marketing_emails'],
        'mailbox_count': metadata['mailboxes_analyzed'],
        'brand_rank': 0
    }
    
    return summary_record

def save_to_bigquery_format(records, filename_prefix="existing_analysis"):
    """Save records in BigQuery-compatible format"""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    # Save as JSON for BigQuery upload
    json_filename = f'{filename_prefix}_bigquery_{timestamp}.json'
    with open(json_filename, 'w', encoding='utf-8') as f:
        for record in records:
            json.dump(record, f, ensure_ascii=False)
            f.write('\n')  # NEWLINE_DELIMITED_JSON format
    
    # Save as CSV for easy viewing
    csv_filename = f'{filename_prefix}_bigquery_{timestamp}.csv'
    if records:
        with open(csv_filename, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=records[0].keys())
            writer.writeheader()
            writer.writerows(records)
    
    # Create BigQuery schema
    schema_filename = f'{filename_prefix}_schema_{timestamp}.json'
    schema = [
        {"name": "email_id", "type": "STRING", "mode": "REQUIRED"},
        {"name": "processed_at", "type": "TIMESTAMP", "mode": "NULLABLE"},
        {"name": "mailbox_email", "type": "STRING", "mode": "NULLABLE"},
        {"name": "sender_email", "type": "STRING", "mode": "NULLABLE"},
        {"name": "sender_domain", "type": "STRING", "mode": "NULLABLE"},
        {"name": "sender_display_name", "type": "STRING", "mode": "NULLABLE"},
        {"name": "subject", "type": "STRING", "mode": "NULLABLE"},
        {"name": "date_received", "type": "TIMESTAMP", "mode": "NULLABLE"},
        {"name": "date_sent", "type": "STRING", "mode": "NULLABLE"},
        {"name": "text_content", "type": "STRING", "mode": "NULLABLE"},
        {"name": "html_content", "type": "STRING", "mode": "NULLABLE"},
        {"name": "has_unsubscribe", "type": "BOOLEAN", "mode": "NULLABLE"},
        {"name": "has_attachments", "type": "BOOLEAN", "mode": "NULLABLE"},
        {"name": "content_type", "type": "STRING", "mode": "NULLABLE"},
        {"name": "message_id", "type": "STRING", "mode": "NULLABLE"},
        {"name": "reply_to", "type": "STRING", "mode": "NULLABLE"},
        {"name": "marketing_score", "type": "INTEGER", "mode": "NULLABLE"},
        {"name": "email_size_bytes", "type": "INTEGER", "mode": "NULLABLE"},
        {"name": "is_multipart", "type": "BOOLEAN", "mode": "NULLABLE"},
        {"name": "brand_name", "type": "STRING", "mode": "NULLABLE"},
        {"name": "processing_status", "type": "STRING", "mode": "NULLABLE"},
        {"name": "total_emails_from_brand", "type": "INTEGER", "mode": "NULLABLE"},
        {"name": "mailbox_count", "type": "INTEGER", "mode": "NULLABLE"},
        {"name": "brand_rank", "type": "INTEGER", "mode": "NULLABLE"}
    ]
    
    with open(schema_filename, 'w', encoding='utf-8') as f:
        json.dump(schema, f, indent=2)
    
    return json_filename, csv_filename, schema_filename

def main():
    print("🔄 CONVERTING EXISTING ANALYSIS TO BIGQUERY FORMAT")
    print("=" * 60)
    
    # Load existing analysis
    analysis_data = load_existing_analysis()
    if not analysis_data:
        print("❌ Could not load existing analysis data")
        return
    
    print("✅ Loaded existing analysis data")
    print(f"📊 Found {analysis_data['analysis_metadata']['total_unique_brands']} unique brands")
    print(f"📧 Total marketing emails: {analysis_data['analysis_metadata']['total_marketing_emails']}")
    
    # Convert to BigQuery records
    brand_records = create_bigquery_records(analysis_data)
    summary_record = create_summary_record(analysis_data)
    
    all_records = [summary_record] + brand_records
    
    print(f"🔄 Created {len(all_records)} BigQuery records")
    
    # Save files
    json_file, csv_file, schema_file = save_to_bigquery_format(all_records)
    
    print("\n" + "=" * 60)
    print("✅ CONVERSION COMPLETE")
    print("=" * 60)
    print(f"📄 BigQuery JSON: {json_file}")
    print(f"📊 CSV file: {csv_file}")
    print(f"📋 Schema file: {schema_file}")
    
    print(f"\n📋 BIGQUERY UPLOAD INSTRUCTIONS:")
    print(f"1. Go to: https://console.cloud.google.com/bigquery")
    print(f"2. Select project: instant-ground-394115")
    print(f"3. Create dataset 'email_analytics' if needed")
    print(f"4. Create table 'brand_analysis' with schema: {schema_file}")
    print(f"5. Upload data: {json_file}")
    print(f"")
    print(f"Or use command line:")
    print(f"bq load --source_format=NEWLINE_DELIMITED_JSON \\")
    print(f"  --schema={schema_file} \\")
    print(f"  instant-ground-394115:email_analytics.brand_analysis \\")
    print(f"  {json_file}")
    
    print(f"\n📊 SAMPLE QUERIES:")
    print(f"```sql")
    print(f"-- Top brands by email count")
    print(f"SELECT brand_name, sender_domain, total_emails_from_brand, mailbox_count")
    print(f"FROM `instant-ground-394115.email_analytics.brand_analysis`")
    print(f"WHERE processing_status = 'aggregated_from_analysis'")
    print(f"ORDER BY total_emails_from_brand DESC")
    print(f"LIMIT 20;")
    print(f"")
    print(f"-- Analysis summary")
    print(f"SELECT text_content")
    print(f"FROM `instant-ground-394115.email_analytics.brand_analysis`")
    print(f"WHERE email_id = 'ANALYSIS_SUMMARY';")
    print(f"```")

if __name__ == "__main__":
    main() 