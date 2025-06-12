#!/usr/bin/env python3
"""
Email Link Automation Script
Automatically clicks on:
1. Subscription confirmation links
2. Engagement links to stay on mailing lists
"""

import imaplib
import ssl
import email
import re
import requests
import time
from datetime import datetime, timedelta
from email.header import decode_header
from urllib.parse import urlparse
import csv

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

def extract_links_from_email(email_message):
    """Extract all links from email content"""
    links = []
    
    if email_message.is_multipart():
        for part in email_message.walk():
            content_type = part.get_content_type()
            if content_type in ["text/html", "text/plain"]:
                try:
                    body = part.get_payload(decode=True)
                    if body:
                        content = body.decode('utf-8', errors='ignore')
                        # Extract links using regex
                        url_pattern = r'https?://[^\s<>"\']+|www\.[^\s<>"\']+|[^\s<>"\']+\.[a-z]{2,}[^\s<>"\']*'
                        found_links = re.findall(url_pattern, content, re.IGNORECASE)
                        links.extend(found_links)
                except:
                    continue
    else:
        try:
            body = email_message.get_payload(decode=True)
            if body:
                content = body.decode('utf-8', errors='ignore')
                url_pattern = r'https?://[^\s<>"\']+|www\.[^\s<>"\']+|[^\s<>"\']+\.[a-z]{2,}[^\s<>"\']*'
                found_links = re.findall(url_pattern, content, re.IGNORECASE)
                links.extend(found_links)
        except:
            pass
    
    # Clean and validate links
    clean_links = []
    for link in links:
        link = link.strip('.,;:!?()[]{}"\'>').rstrip('>')
        if link.startswith('www.'):
            link = 'https://' + link
        elif not link.startswith(('http://', 'https://')):
            continue
        clean_links.append(link)
    
    return list(set(clean_links))  # Remove duplicates

def is_confirmation_link(link, subject, sender):
    """Check if link is a subscription confirmation"""
    link_lower = link.lower()
    subject_lower = subject.lower()
    
    confirmation_patterns = [
        'confirm', 'verify', 'activate', 'subscribe', 'opt-in', 'optin',
        'double-opt', 'validation', 'welcome', 'complete'
    ]
    
    # Check link URL
    for pattern in confirmation_patterns:
        if pattern in link_lower:
            return True
    
    # Check if subject suggests confirmation needed
    subject_confirmation_patterns = [
        'confirm your subscription', 'verify your email', 'activate your account',
        'complete your subscription', 'please confirm', 'click to confirm'
    ]
    
    for pattern in subject_confirmation_patterns:
        if pattern in subject_lower:
            return True
    
    return False

def is_engagement_link(link, subject, sender):
    """Check if link is for engagement (staying on list)"""
    link_lower = link.lower()
    subject_lower = subject.lower()
    
    # Skip unsubscribe links
    if 'unsubscribe' in link_lower:
        return False
    
    engagement_patterns = [
        'view', 'read', 'shop', 'browse', 'discover', 'explore',
        'learn', 'get', 'find', 'see', 'check', 'click'
    ]
    
    # Look for engagement indicators
    for pattern in engagement_patterns:
        if pattern in link_lower:
            return True
    
    return False

def click_link_safely(link, sender, subject):
    """Safely click a link with proper headers"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        }
        
        response = requests.get(link, headers=headers, timeout=10, allow_redirects=True)
        
        if response.status_code == 200:
            print(f"      ✅ Successfully clicked: {link[:60]}...")
            return True
        else:
            print(f"      ⚠️ Link returned {response.status_code}: {link[:60]}...")
            return False
            
    except Exception as e:
        print(f"      ❌ Error clicking link: {e}")
        return False

def process_mailbox_for_links(mailbox, days_back=7):
    """Process a single mailbox for confirmation and engagement links"""
    print(f"📧 Processing: {mailbox['email']}")
    
    links_clicked = 0
    
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
            return links_clicked
        
        email_ids = message_ids[0].split()
        print(f"   🔍 Processing {len(email_ids)} emails for links...")
        
        for i, msg_id in enumerate(email_ids):
            try:
                if i % 50 == 0:
                    print(f"      Progress: {i}/{len(email_ids)} ({links_clicked} links clicked)")
                
                # Fetch email
                status, msg_data = mail.fetch(msg_id, '(RFC822)')
                if status != 'OK':
                    continue
                
                email_message = email.message_from_bytes(msg_data[0][1])
                
                # Extract email details
                sender = decode_mime_header(email_message.get('From', ''))
                subject = decode_mime_header(email_message.get('Subject', ''))
                
                # Skip warmup emails
                if re.search(r'[A-Z0-9]{7,8}$', subject) or re.search(r'[0-9][A-Z]{3}[0-9]{3}', subject):
                    continue
                
                # Extract links
                links = extract_links_from_email(email_message)
                
                for link in links:
                    # Check if it's a confirmation link
                    if is_confirmation_link(link, subject, sender):
                        print(f"   🔗 CONFIRMATION LINK found from {sender[:30]}...")
                        print(f"      Subject: {subject[:50]}...")
                        if click_link_safely(link, sender, subject):
                            links_clicked += 1
                        time.sleep(2)  # Be polite
                    
                    # Check if it's an engagement link (but limit to avoid spam)
                    elif is_engagement_link(link, subject, sender) and links_clicked < 10:
                        print(f"   🎯 ENGAGEMENT LINK found from {sender[:30]}...")
                        print(f"      Subject: {subject[:50]}...")
                        if click_link_safely(link, sender, subject):
                            links_clicked += 1
                        time.sleep(3)  # Be more polite for engagement
                        
            except Exception as e:
                print(f"      ❌ Error processing email {i}: {e}")
                continue
        
        mail.logout()
        print(f"   ✅ Clicked {links_clicked} links")
        
    except Exception as e:
        print(f"   ❌ Error processing mailbox: {e}")
    
    return links_clicked

def load_mailboxes():
    """Load mailbox credentials from CSV"""
    mailboxes = []
    try:
        with open('src/mailboxaccounts.csv', 'r', encoding='utf-8') as f:
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

def main():
    print("🔗 EMAIL LINK AUTOMATION")
    print("=" * 60)
    print("Auto-clicking confirmation and engagement links")
    print("=" * 60)
    
    # Load mailboxes
    mailboxes = load_mailboxes()
    print(f"📬 Loaded {len(mailboxes)} mailboxes")
    
    if len(mailboxes) == 0:
        print("❌ No mailboxes loaded. Exiting.")
        return
    
    # Process each mailbox
    days_back = 7  # Look at last week's emails
    total_links = 0
    
    print(f"📅 Processing emails from last {days_back} days")
    print("=" * 60)
    
    for i, mailbox in enumerate(mailboxes, 1):
        print(f"\n📋 MAILBOX {i}/{len(mailboxes)}")
        
        links_count = process_mailbox_for_links(mailbox, days_back)
        total_links += links_count
        
        print(f"📊 Running total: {total_links} links clicked")
        
        # Add delay between mailboxes to be respectful
        if i < len(mailboxes):
            time.sleep(5)
    
    print("\n" + "=" * 60)
    print("🔗 LINK AUTOMATION COMPLETE")
    print("=" * 60)
    print(f"🎯 Total links clicked: {total_links}")
    print(f"📬 Mailboxes processed: {len(mailboxes)}")
    print(f"📅 Days analyzed: {days_back}")

if __name__ == "__main__":
    main() 