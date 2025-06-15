#!/usr/bin/env python3
"""
Export ALL emails from ALL mailboxes to JSON files for BigQuery upload
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
from typing import List, Dict, Any, Optional
import hashlib

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

def extract_emails_from_mailbox(mailbox, days_back=30):
    """Extract all marketing emails from a single mailbox"""
    print(f"📧 Processing: {mailbox['email']}")
    
    emails_data = []
    
    try:
        # Connect to mailbox
        mail = imaplib.IMAP4_SSL(mailbox['host'], mailbox['port'], 
                                ssl_context=ssl.create_default_context())
        mail.login(mailbox['email'], mailbox['password'])
        mail.select('INBOX')
        
        # Search recent emails
        since_date = (datetime.now() - timedelta(days=days_back)).strftime('%d-%b-%Y')
        status, message_ids = mail.search(None, f'SINCE {since_date}')
        
        if status != 'OK' or not message_ids[0]:
            print(f"   📭 No recent emails found")
            mail.logout()
            return emails_data
        
        email_ids = message_ids[0].split()
        print(f"   🔍 Processing {len(email_ids)} emails...")
        
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
                    
                    # Create email record for BigQuery
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
                        
            except Exception as e:
                print(f"      ❌ Error processing email {i}: {e}")
                continue
        
        mail.logout()
        print(f"   ✅ Found {total_marketing} marketing emails")
        
    except Exception as e:
        print(f"   ❌ Error processing mailbox: {e}")
    
    return emails_data

def main():
    print("🚀 EXPORTING ALL EMAILS TO JSON FOR BIGQUERY")
    print("=" * 60)
    print("Creating detailed email records with HTML content, metadata, etc.")
    print("=" * 60)
    
    # Load mailboxes
    mailboxes = load_mailboxes()
    print(f"📬 Loaded {len(mailboxes)} mailboxes")
    
    if len(mailboxes) == 0:
        print("❌ No mailboxes loaded. Exiting.")
        return
    
    # Process each mailbox
    days_back = 30
    all_emails = []
    
    print(f"📅 Processing emails from last {days_back} days")
    print("=" * 60)
    
    for i, mailbox in enumerate(mailboxes, 1):
        print(f"\n📋 MAILBOX {i}/{len(mailboxes)}")
        
        emails_data = extract_emails_from_mailbox(mailbox, days_back)
        all_emails.extend(emails_data)
        
        print(f"📊 Running total: {len(all_emails)} marketing emails")
        
        # Save intermediate results every 10 mailboxes
        if i % 10 == 0:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            temp_filename = f'emails_batch_{i}_{timestamp}.json'
            with open(temp_filename, 'w', encoding='utf-8') as f:
                json.dump(emails_data, f, indent=2, ensure_ascii=False)
            print(f"💾 Saved batch to: {temp_filename}")
    
    # Save final results
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    final_filename = f'all_emails_for_bigquery_{timestamp}.json'
    
    with open(final_filename, 'w', encoding='utf-8') as f:
        json.dump(all_emails, f, indent=2, ensure_ascii=False)
    
    # Create BigQuery schema file
    schema_filename = f'bigquery_schema_{timestamp}.json'
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
        {"name": "processing_status", "type": "STRING", "mode": "NULLABLE"}
    ]
    
    with open(schema_filename, 'w', encoding='utf-8') as f:
        json.dump(schema, f, indent=2)
    
    print("\n" + "=" * 60)
    print("📊 EXPORT COMPLETE")
    print("=" * 60)
    print(f"🏷️  Total marketing emails exported: {len(all_emails)}")
    print(f"📬 Mailboxes processed: {len(mailboxes)}")
    print(f"📅 Days analyzed: {days_back}")
    print(f"💾 JSON file: {final_filename}")
    print(f"📋 Schema file: {schema_filename}")
    
    # Instructions for BigQuery upload
    print(f"\n📋 TO UPLOAD TO BIGQUERY:")
    print(f"1. Go to BigQuery console: https://console.cloud.google.com/bigquery")
    print(f"2. Create dataset 'email_analytics' if it doesn't exist")
    print(f"3. Create table 'all_marketing_emails' using schema file: {schema_filename}")
    print(f"4. Upload JSON file: {final_filename}")
    print(f"5. Or use command line:")
    print(f"   bq load --source_format=NEWLINE_DELIMITED_JSON \\")
    print(f"   --schema={schema_filename} \\")
    print(f"   instant-ground-394115:email_analytics.all_marketing_emails \\")
    print(f"   {final_filename}")

if __name__ == "__main__":
    main() 