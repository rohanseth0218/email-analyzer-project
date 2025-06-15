#!/usr/bin/env python3
import imaplib
import ssl
import email
from datetime import datetime, timedelta
import re
from collections import defaultdict

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

def is_legitimate_brand_email(sender, subject):
    """Sophisticated check for legitimate retail/brand marketing emails"""
    sender_lower = sender.lower()
    subject_lower = subject.lower()
    
    # IMMEDIATELY REJECT spam/outreach patterns
    spam_indicators = [
        'rohan', 'ripple', 'let\'s chat', 'quick question', 'looking forward',
        'can i interest you', 'help you grow', 'business plan', 'partnership',
        'collaboration', 'proposal', 'working with you', 'pick your brain',
        'what\'s new', 'following up', 'project brief', 'need help',
        'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'
    ]
    
    for spam in spam_indicators:
        if spam in sender_lower or spam in subject_lower:
            return False
    
    # POSITIVE indicators for legitimate brands
    brand_indicators = [
        'welcome', 'thank you for signing up', 'confirm your subscription',
        'unsubscribe', '% off', 'sale', 'new arrivals', 'exclusive offer',
        'free shipping', 'limited time', 'shop now', 'your order',
        'newsletter', 'updates from', 'get 15%', 'bogo', 'preorder',
        'first order', 'summer', 'collection', 'new products'
    ]
    
    brand_count = sum(1 for indicator in brand_indicators 
                     if indicator in sender_lower or indicator in subject_lower)
    
    # SENDER patterns that indicate legitimate brands
    legitimate_senders = [
        'no-reply@', 'noreply@', 'newsletter@', 'info@', 'hello@',
        'team@', 'support@', 'contact@', 'welcome@', 'shop@'
    ]
    
    sender_legit = any(pattern in sender_lower for pattern in legitimate_senders)
    
    # Must have BOTH brand indicators AND legitimate sender pattern
    return brand_count >= 1 and sender_legit

# Connect
mail = imaplib.IMAP4_SSL('imapn2.mymailsystem.com', 993, ssl_context=ssl.create_default_context())
mail.login('rohan.seth@openripplestudio.info', 'lnfkG$4!MFPH')
mail.select('INBOX')

# Search last 6 months
since_date = (datetime.now() - timedelta(days=180)).strftime('%d-%b-%Y')
status, message_ids = mail.search(None, f'SINCE {since_date}')

print(f"📧 Analyzing {len(message_ids[0].split())} emails for LEGITIMATE BRANDS only...")

legitimate_brands = {}
all_examples = []

total_processed = 0
for msg_id in message_ids[0].split():
    try:
        total_processed += 1
        if total_processed % 200 == 0:
            print(f"   Processed {total_processed} emails...")
            
        status, msg_data = mail.fetch(msg_id, '(RFC822)')
        email_body = msg_data[0][1]
        email_message = email.message_from_bytes(email_body)
        
        sender = email_message.get('From', '')
        subject = email_message.get('Subject', '')
        date = email_message.get('Date', '')
        
        if is_legitimate_brand_email(sender, subject):
            domain = extract_domain(sender)
            if domain:
                if domain not in legitimate_brands:
                    legitimate_brands[domain] = {
                        'count': 0,
                        'examples': []
                    }
                
                legitimate_brands[domain]['count'] += 1
                if len(legitimate_brands[domain]['examples']) < 3:
                    legitimate_brands[domain]['examples'].append({
                        'sender': sender,
                        'subject': subject[:80],
                        'date': date
                    })
                
    except Exception as e:
        continue

mail.logout()

# Sort by email count
sorted_brands = sorted(legitimate_brands.items(), key=lambda x: x[1]['count'], reverse=True)

print(f"\n🏪 LEGITIMATE RETAIL/BRAND EMAILS ONLY:")
print(f"Total legitimate brands found: {len(legitimate_brands)}")
print(f"Compared to signup automation: {len(legitimate_brands)}/101 = {len(legitimate_brands)/101*100:.1f}%")

print(f"\n📋 TOP LEGITIMATE BRANDS:")
for i, (domain, data) in enumerate(sorted_brands[:30]):
    print(f"\n{i+1}. {domain} ({data['count']} emails)")
    for example in data['examples'][:2]:
        print(f"   📧 {example['subject']}")
        print(f"      From: {example['sender']}")

# Load signup list for comparison
try:
    with open('full_signup_list.txt', 'r') as f:
        signup_domains = [line.strip().lower() for line in f if line.strip()]
        
    print(f"\n🎯 MATCHES WITH SIGNUP LIST:")
    matches = []
    for domain in legitimate_brands.keys():
        if domain in signup_domains:
            matches.append(domain)
            print(f"✅ {domain} - {legitimate_brands[domain]['count']} emails")
    
    print(f"\nExact matches: {len(matches)}/101 = {len(matches)/101*100:.1f}%")
    
except FileNotFoundError:
    print("Signup list file not found for comparison") 