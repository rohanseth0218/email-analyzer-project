#!/usr/bin/env python3
import imaplib
import ssl
import email
from datetime import datetime, timedelta
import re
from collections import defaultdict

def extract_domain(sender):
    """Extract domain from sender email"""
    # Remove display names and get email
    email_match = re.search(r'<([^>]+)>', sender)
    if email_match:
        email_addr = email_match.group(1)
    else:
        # If no brackets, assume whole string is email
        email_addr = sender.strip()
    
    # Extract domain
    if '@' in email_addr:
        domain = email_addr.split('@')[1].lower()
        return domain
    return None

def is_marketing_email(sender, subject):
    """Basic check if email looks like marketing"""
    marketing_indicators = [
        'no-reply', 'noreply', 'info@', 'marketing@', 'newsletter@', 
        'support@', 'hello@', 'team@', 'contact@', 'welcome@'
    ]
    
    # Skip obvious personal/spam patterns
    spam_patterns = [
        'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
        'let\'s chat', 'collaboration', 'partnership', 'ripple'
    ]
    
    sender_lower = sender.lower()
    subject_lower = subject.lower()
    
    # Skip if looks like spam/personal
    for pattern in spam_patterns:
        if pattern in sender_lower or pattern in subject_lower:
            return False
    
    # Check for marketing indicators
    for indicator in marketing_indicators:
        if indicator in sender_lower:
            return True
    
    # If it has unsubscribe links or promotional content
    return True

# Connect
mail = imaplib.IMAP4_SSL('imapn2.mymailsystem.com', 993, ssl_context=ssl.create_default_context())
mail.login('rohan.seth@openripplestudio.info', 'lnfkG$4!MFPH')
mail.select('INBOX')

# Search last 6 months for comprehensive view
since_date = (datetime.now() - timedelta(days=180)).strftime('%d-%b-%Y')
status, message_ids = mail.search(None, f'SINCE {since_date}')

print(f"📧 Found {len(message_ids[0].split())} emails in last 6 months")
print("🔍 Analyzing all unique brands/domains...")

domain_counts = defaultdict(int)
domain_subjects = defaultdict(list)
marketing_domains = set()

total_processed = 0
for msg_id in message_ids[0].split():
    try:
        total_processed += 1
        if total_processed % 100 == 0:
            print(f"   Processed {total_processed} emails...")
            
        status, msg_data = mail.fetch(msg_id, '(RFC822)')
        email_body = msg_data[0][1]
        email_message = email.message_from_bytes(email_body)
        
        sender = email_message.get('From', '')
        subject = email_message.get('Subject', '')
        
        domain = extract_domain(sender)
        if domain:
            domain_counts[domain] += 1
            domain_subjects[domain].append(subject[:50])  # First 50 chars
            
            # Check if looks like marketing
            if is_marketing_email(sender, subject):
                marketing_domains.add(domain)
                
    except Exception as e:
        continue

mail.logout()

print(f"\n📊 COMPREHENSIVE BRAND ANALYSIS:")
print(f"Total emails processed: {total_processed}")
print(f"Total unique domains: {len(domain_counts)}")
print(f"Marketing-like domains: {len(marketing_domains)}")

# Sort by email count
sorted_domains = sorted(domain_counts.items(), key=lambda x: x[1], reverse=True)

print(f"\n🏷️  TOP 50 DOMAINS BY EMAIL COUNT:")
for i, (domain, count) in enumerate(sorted_domains[:50]):
    marketing_flag = "📧" if domain in marketing_domains else "📝"
    print(f"{i+1:2d}. {marketing_flag} {domain}: {count} emails")
    if len(domain_subjects[domain]) > 0:
        print(f"    Example: {domain_subjects[domain][0]}")

print(f"\n🎯 MARKETING DOMAINS ONLY ({len(marketing_domains)} total):")
marketing_sorted = [(d, domain_counts[d]) for d in marketing_domains]
marketing_sorted.sort(key=lambda x: x[1], reverse=True)

for i, (domain, count) in enumerate(marketing_sorted[:30]):
    print(f"{i+1:2d}. {domain}: {count} emails")

print(f"\n📈 COMPARISON TO SIGNUP LIST:")
print(f"Brands signed up for: 101")
print(f"Marketing domains found: {len(marketing_domains)}")
print(f"Conversion rate: {len(marketing_domains)/101*100:.1f}%") 