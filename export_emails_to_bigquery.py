#!/usr/bin/env python3
"""
Export ALL emails from ALL mailboxes to BigQuery
One row per email with full details: domain, subject, date, HTML content, etc.
"""

import imaplib
import ssl
import email
import csv
import json
import os
import re
from datetime import datetime, timedelta
from email.header import decode_header
from google.cloud import bigquery
from typing import List, Dict, Any, Optional
import hashlib

# BigQuery Configuration
BIGQUERY_CONFIG = {
    'project_id': 'instant-ground-394115',
    'dataset': 'email_analytics', 
    'table': 'marketing_emails_clean'
}

# Set up Google Cloud credentials
def setup_credentials():
    """Setup Google Cloud credentials"""
    # Check if credentials file exists
    creds_file = 'bigquery_credentials.json'
    if os.path.exists(creds_file):
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = creds_file
        print("✅ Using local BigQuery credentials")
        return True
    
    # Check for environment variable
    if 'GOOGLE_APPLICATION_CREDENTIALS' in os.environ:
        print("✅ Using environment BigQuery credentials")
        return True
    
    print("❌ No BigQuery credentials found!")
    print("Please either:")
    print("1. Place your service account JSON file as 'bigquery_credentials.json'")
    print("2. Set GOOGLE_APPLICATION_CREDENTIALS environment variable")
    return False

def decode_mime_header(header):
    """Decode MIME header"""
    if header is None:
        return ""
    decoded_parts = decode_header(header)
    decoded_header = ""
    for part, encoding in decoded_parts:
        if isinstance(part, bytes):
            try:
                if encoding:
                    decoded_header += part.decode(encoding)
                else:
                    decoded_header += part.decode('utf-8')
            except (UnicodeDecodeError, LookupError):
                decoded_header += part.decode('utf-8', errors='ignore')
        else:
            decoded_header += str(part)
    return decoded_header

def extract_domain(sender):
    """Extract domain from sender email"""
    email_match = re.search(r'<([^>]+)>', sender)
    if email_match:
        email_addr = email_match.group(1)
    else:
        email_addr = sender.strip()
    
    if '@' in email_addr:
        domain = email_addr.split('@')[1].lower()
        return domain
    return None

def extract_sender_email(sender):
    """Extract clean email address from sender"""
    email_match = re.search(r'<([^>]+)>', sender)
    if email_match:
        return email_match.group(1).strip()
    elif '@' in sender:
        return sender.strip()
    return sender

def extract_email_content(email_message):
    """Extract both text and HTML content from email"""
    text_content = ""
    html_content = ""
    
    if email_message.is_multipart():
        for part in email_message.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition"))
            
            # Skip attachments
            if "attachment" in content_disposition:
                continue
                
            try:
                body = part.get_payload(decode=True)
                if body:
                    body_str = body.decode('utf-8', errors='ignore')
                    
                    if content_type == "text/plain":
                        text_content += body_str
                    elif content_type == "text/html":
                        html_content += body_str
            except:
                continue
    else:
        try:
            body = email_message.get_payload(decode=True)
            if body:
                content = body.decode('utf-8', errors='ignore')
                content_type = email_message.get_content_type()
                
                if content_type == "text/plain":
                    text_content = content
                elif content_type == "text/html":
                    html_content = content
                else:
                    text_content = content  # Default to text
        except:
            pass
    
    return text_content.strip(), html_content.strip()

def is_marketing_email(sender, subject, text_content):
    """Enhanced marketing email detection"""
    sender_lower = sender.lower()
    subject_lower = subject.lower()
    content_lower = text_content.lower()
    
    # Skip warmup emails - these have codes like W51Q0NG, 2MAX439, etc.
    warmup_patterns = [
        r'[A-Z0-9]{7,8}$',  # Codes like W51Q0NG at end of subject
        r'[0-9][A-Z]{3}[0-9]{3}',  # Codes like 2MAX439
        'warmup', 'warm up', 'warm-up'
    ]
    
    import re
    for pattern in warmup_patterns:
        if re.search(pattern, subject_lower) or re.search(pattern, content_lower):
            return False
    
    # Skip personal/spam emails
    spam_patterns = [
        'rohan', 'ripple', 'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com',
        'let\'s chat', 'collaboration', 'partnership', 'quick question'
    ]
    
    for pattern in spam_patterns:
        if pattern in sender_lower or pattern in subject_lower:
            return False
    
    # Look for marketing indicators
    marketing_indicators = [
        'welcome', 'newsletter', 'unsubscribe', 'sale', '% off', 'discount',
        'offer', 'deal', 'shop', 'new arrival', 'exclusive', 'limited time',
        'free shipping', 'coupon', 'promo', 'clearance', 'collection',
        'no-reply@', 'noreply@', 'newsletter@', 'info@', 'hello@', 'team@',
        'support@', 'contact@', 'marketing@', 'privacy policy', 'manage preferences'
    ]
    
    marketing_score = sum(1 for indicator in marketing_indicators 
                         if indicator in sender_lower or indicator in subject_lower or indicator in content_lower)
    
    return marketing_score >= 1

def load_mailboxes():
    """Load mailbox credentials from CSV"""
    mailboxes = []
    try:
        with open('mailboxaccounts.csv', 'r', encoding='utf-8') as f:
            content = f.read()
            lines = content.strip().split('\n')
            
            for line in lines[1:]:  # Skip header
                if line.strip():
                    values = line.split(',')
                    if len(values) >= 6:
                        mailbox = {
                            'email': values[0].strip(),
                            'password': values[4].strip(),
                            'host': values[5].strip(),
                            'port': int(values[6].strip())
                        }
                        mailboxes.append(mailbox)
    except Exception as e:
        print(f"Error loading mailboxes: {e}")
        
    return mailboxes

def setup_bigquery():
    """Initialize BigQuery client and ensure table exists"""
    try:
        client = bigquery.Client(project=BIGQUERY_CONFIG['project_id'])
        
        # Ensure dataset exists
        dataset_id = BIGQUERY_CONFIG['dataset']
        try:
            dataset = client.get_dataset(dataset_id)
            print(f"✅ BigQuery dataset {dataset_id} exists")
        except:
            dataset = bigquery.Dataset(f"{BIGQUERY_CONFIG['project_id']}.{dataset_id}")
            dataset.location = "US"
            dataset = client.create_dataset(dataset)
            print(f"✅ Created BigQuery dataset {dataset_id}")
        
        # Create table with enhanced schema for full email details
        table_id = f"{BIGQUERY_CONFIG['project_id']}.{dataset_id}.{BIGQUERY_CONFIG['table']}"
        
        schema = [
            bigquery.SchemaField("email_id", "STRING"),  # Unique identifier
            bigquery.SchemaField("processed_at", "TIMESTAMP"),
            bigquery.SchemaField("mailbox_email", "STRING"),
            bigquery.SchemaField("sender_email", "STRING"), 
            bigquery.SchemaField("sender_domain", "STRING"),
            bigquery.SchemaField("sender_display_name", "STRING"),
            bigquery.SchemaField("subject", "STRING"),
            bigquery.SchemaField("date_received", "TIMESTAMP"),
            bigquery.SchemaField("date_sent", "STRING"),  # Original date header
            bigquery.SchemaField("text_content", "STRING"),
            bigquery.SchemaField("html_content", "STRING"),
            bigquery.SchemaField("has_unsubscribe", "BOOLEAN"),
            bigquery.SchemaField("has_attachments", "BOOLEAN"), 
            bigquery.SchemaField("content_type", "STRING"),
            bigquery.SchemaField("message_id", "STRING"),
            bigquery.SchemaField("reply_to", "STRING"),
            bigquery.SchemaField("marketing_score", "INTEGER"),
            bigquery.SchemaField("email_size_bytes", "INTEGER"),
            bigquery.SchemaField("is_multipart", "BOOLEAN"),
            bigquery.SchemaField("brand_name", "STRING"),  # Extracted brand name
            bigquery.SchemaField("processing_status", "STRING")
        ]
        
        try:
            table = client.get_table(table_id)
            print(f"✅ BigQuery table {BIGQUERY_CONFIG['table']} exists")
        except:
            table = bigquery.Table(table_id, schema=schema)
            table = client.create_table(table)
            print(f"✅ Created BigQuery table {BIGQUERY_CONFIG['table']}")
        
        return client
        
    except Exception as e:
        print(f"❌ BigQuery setup failed: {e}")
        return None

def extract_brand_name(domain):
    """Extract brand name from domain"""
    if not domain:
        return None
    
    domain_parts = domain.replace('www.', '').split('.')
    if len(domain_parts) > 1:
        brand = domain_parts[0]
        brand = re.sub(r'^(mail|email|newsletter|noreply|no-reply)', '', brand)
        return brand.strip('-').title() if brand else None
    return domain.title()

def create_email_id(mailbox_email, sender_email, subject, date_sent):
    """Create unique email ID"""
    content = f"{mailbox_email}:{sender_email}:{subject}:{date_sent}"
    return hashlib.md5(content.encode()).hexdigest()

def parse_date_header(date_header):
    """Parse email date header to timestamp"""
    if not date_header:
        return None
    
    try:
        from email.utils import parsedate_to_datetime
        return parsedate_to_datetime(date_header)
    except:
        try:
            # Fallback parsing
            import dateutil.parser
            return dateutil.parser.parse(date_header)
        except:
            return None

def extract_emails_from_mailbox(mailbox, client, existing_ids=None, days_back=30):
    """Extract all marketing emails from a single mailbox"""
    print(f"📧 Processing: {mailbox['email']}")
    
    emails_data = []
    
    try:
        # Connect to mailbox with timeout
        print(f"   🔌 Connecting to {mailbox['host']}...")
        mail = imaplib.IMAP4_SSL(mailbox['host'], mailbox['port'], 
                                ssl_context=ssl.create_default_context())
        mail.login(mailbox['email'], mailbox['password'])
        print(f"   ✅ Connected to mailbox")
        mail.select('INBOX')
        
        # Search recent emails
        since_date = (datetime.now() - timedelta(days=days_back)).strftime('%d-%b-%Y')
        print(f"   🔍 Searching emails since {since_date}...")
        status, message_ids = mail.search(None, f'SINCE {since_date}')
        
        if status != 'OK' or not message_ids[0]:
            print(f"   📭 No recent emails found")
            mail.logout()
            return emails_data
        
        email_ids = message_ids[0].split()
        print(f"   🔍 Processing {len(email_ids)} emails...")
        
        batch_size = 100
        total_marketing = 0
        
        for i, msg_id in enumerate(email_ids):
            try:
                if i % 100 == 0:
                    print(f"      Progress: {i}/{len(email_ids)} ({total_marketing} marketing emails found)")
                
                # Fetch full email
                status, msg_data = mail.fetch(msg_id, '(RFC822)')
                if status != 'OK':
                    continue
                
                email_message = email.message_from_bytes(msg_data[0][1])
                
                # Extract email details
                sender = decode_mime_header(email_message.get('From', ''))
                subject = decode_mime_header(email_message.get('Subject', ''))
                date_sent = email_message.get('Date', '')
                message_id = email_message.get('Message-ID', '')
                reply_to = email_message.get('Reply-To', '')
                
                # Extract content
                text_content, html_content = extract_email_content(email_message)
                
                # Check if marketing email
                if is_marketing_email(sender, subject, text_content):
                    sender_email = extract_sender_email(sender)
                    sender_domain = extract_domain(sender)
                    brand_name = extract_brand_name(sender_domain)
                    
                    # Parse date
                    date_received = parse_date_header(date_sent)
                    
                    # Create email record
                    email_record = {
                        'email_id': create_email_id(mailbox['email'], sender_email, subject, date_sent),
                        'processed_at': datetime.now().isoformat(),
                        'mailbox_email': mailbox['email'],
                        'sender_email': sender_email,
                        'sender_domain': sender_domain,
                        'sender_display_name': sender.split('<')[0].strip() if '<' in sender else sender,
                        'subject': subject,
                        'date_received': date_received.isoformat() if date_received else None,
                        'date_sent': date_sent,
                        'text_content': text_content[:50000],  # Limit to 50k chars
                        'html_content': html_content[:100000],  # Limit to 100k chars  
                        'has_unsubscribe': 'unsubscribe' in text_content.lower() or 'unsubscribe' in html_content.lower(),
                        'has_attachments': len([part for part in email_message.walk() if part.get_content_disposition() == 'attachment']) > 0,
                        'content_type': email_message.get_content_type(),
                        'message_id': message_id,
                        'reply_to': reply_to,
                        'marketing_score': len([ind for ind in ['sale', 'discount', 'offer', 'welcome', 'newsletter'] 
                                              if ind in text_content.lower() or ind in subject.lower()]),
                        'email_size_bytes': len(str(email_message)),
                        'is_multipart': email_message.is_multipart(),
                        'brand_name': brand_name,
                        'processing_status': 'success'
                    }
                    
                    emails_data.append(email_record)
                    total_marketing += 1
                    
                    # Insert in batches to avoid memory issues
                    if len(emails_data) >= batch_size:
                        insert_to_bigquery(client, emails_data, existing_ids)
                        emails_data = []  # Clear batch
                        
            except Exception as e:
                print(f"      ❌ Error processing email {i}: {e}")
                continue
        
        # Insert remaining emails
        if emails_data:
            insert_to_bigquery(client, emails_data, existing_ids)
        
        mail.logout()
        print(f"   ✅ Found {total_marketing} marketing emails")
        
    except Exception as e:
        print(f"   ❌ Error processing mailbox: {e}")
    
    return total_marketing

def get_existing_email_ids(client):
    """Get set of existing email IDs from BigQuery to avoid duplicates"""
    table_id = f"{BIGQUERY_CONFIG['project_id']}.{BIGQUERY_CONFIG['dataset']}.{BIGQUERY_CONFIG['table']}"
    
    try:
        query = f"SELECT DISTINCT email_id FROM `{table_id}`"
        results = client.query(query)
        existing_ids = {row.email_id for row in results}
        print(f"📋 Found {len(existing_ids)} existing emails in BigQuery")
        return existing_ids
    except Exception as e:
        print(f"⚠️ Could not fetch existing IDs (table might not exist yet): {e}")
        return set()

def insert_to_bigquery(client, emails_data, existing_ids=None):
    """Insert email data to BigQuery, avoiding duplicates"""
    if not emails_data:
        return
    
    # Filter out duplicates if we have existing IDs
    if existing_ids:
        new_emails = [email for email in emails_data if email['email_id'] not in existing_ids]
        duplicates_skipped = len(emails_data) - len(new_emails)
        if duplicates_skipped > 0:
            print(f"      🔄 Skipping {duplicates_skipped} duplicate emails")
        emails_data = new_emails
    
    if not emails_data:
        print(f"      ⏭️ No new emails to insert")
        return
    
    table_id = f"{BIGQUERY_CONFIG['project_id']}.{BIGQUERY_CONFIG['dataset']}.{BIGQUERY_CONFIG['table']}"
    
    try:
        errors = client.insert_rows_json(table_id, emails_data)
        if errors:
            print(f"      ❌ BigQuery insert errors: {errors}")
        else:
            print(f"      ✅ Inserted {len(emails_data)} NEW emails to BigQuery")
            # Add new IDs to existing set
            if existing_ids is not None:
                existing_ids.update(email['email_id'] for email in emails_data)
    except Exception as e:
        print(f"      ❌ BigQuery insert failed: {e}")

def main():
    print("🚀 EXPORTING ALL EMAILS TO BIGQUERY")
    print("=" * 60)
    print("Creating detailed email records with HTML content, metadata, etc.")
    print("=" * 60)
    
    # Setup credentials first
    if not setup_credentials():
        print("❌ Credentials setup failed. Exiting.")
        return
    
    # Setup BigQuery
    client = setup_bigquery()
    if not client:
        print("❌ BigQuery setup failed. Exiting.")
        return
    
    # Get existing email IDs to avoid duplicates
    existing_ids = get_existing_email_ids(client)
    
    # Load mailboxes
    mailboxes = load_mailboxes()
    print(f"📬 Loaded {len(mailboxes)} mailboxes")
    
    if len(mailboxes) == 0:
        print("❌ No mailboxes loaded. Exiting.")
        return
    
    # Process each mailbox
    days_back = 30
    total_emails = 0
    
    print(f"📅 Processing emails from last {days_back} days")
    print("=" * 60)
    
    for i, mailbox in enumerate(mailboxes, 1):
        print(f"\n📋 MAILBOX {i}/{len(mailboxes)}")
        
        marketing_count = extract_emails_from_mailbox(mailbox, client, existing_ids, days_back)
        total_emails += marketing_count
        
        print(f"📊 Running total: {total_emails} marketing emails")
    
    print("\n" + "=" * 60)
    print("📊 EXPORT COMPLETE")
    print("=" * 60)
    print(f"🏷️  Total marketing emails exported: {total_emails}")
    print(f"📬 Mailboxes processed: {len(mailboxes)}")
    print(f"📅 Days analyzed: {days_back}")
    print(f"🗄️  BigQuery table: {BIGQUERY_CONFIG['project_id']}.{BIGQUERY_CONFIG['dataset']}.{BIGQUERY_CONFIG['table']}")
    
    # Query example
    print(f"\n📋 EXAMPLE BIGQUERY QUERIES:")
    print(f"```sql")
    print(f"-- Count emails by domain")
    print(f"SELECT sender_domain, COUNT(*) as email_count")
    print(f"FROM `{BIGQUERY_CONFIG['project_id']}.{BIGQUERY_CONFIG['dataset']}.{BIGQUERY_CONFIG['table']}`")
    print(f"GROUP BY sender_domain")
    print(f"ORDER BY email_count DESC")
    print(f"LIMIT 50;")
    print(f"")
    print(f"-- Get all email details")
    print(f"SELECT *")
    print(f"FROM `{BIGQUERY_CONFIG['project_id']}.{BIGQUERY_CONFIG['dataset']}.{BIGQUERY_CONFIG['table']}`")
    print(f"WHERE sender_domain = 'example.com'")
    print(f"ORDER BY date_received DESC;")
    print(f"```")

if __name__ == "__main__":
    main() 