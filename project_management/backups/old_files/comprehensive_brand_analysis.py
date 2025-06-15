#!/usr/bin/env python3
"""
Comprehensive Brand Analysis Across All Mailboxes
Analyzes all 69 mailboxes to count unique brands and emails per brand
"""

import imaplib
import ssl
import email
import csv
from datetime import datetime, timedelta
import re
from collections import defaultdict
import json
from email.header import decode_header

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

def extract_brand_name(domain):
    """Extract likely brand name from domain"""
    if not domain:
        return None
    
    # Remove common subdomains and TLDs
    domain_parts = domain.replace('www.', '').split('.')
    if len(domain_parts) > 1:
        brand = domain_parts[0]
        # Clean up common patterns
        brand = re.sub(r'^(mail|email|newsletter|noreply|no-reply)', '', brand)
        return brand.strip('-').title() if brand else None
    return domain.title()

def is_legitimate_marketing_email(sender, subject, content_preview=""):
    """Enhanced check for legitimate retail/brand marketing emails"""
    sender_lower = sender.lower()
    subject_lower = subject.lower()
    content_lower = content_preview.lower()
    
    # IMMEDIATELY REJECT spam/outreach patterns
    spam_indicators = [
        'rohan', 'ripple', 'let\'s chat', 'quick question', 'looking forward',
        'can i interest you', 'help you grow', 'business plan', 'partnership',
        'collaboration', 'proposal', 'working with you', 'pick your brain',
        'what\'s new', 'following up', 'project brief', 'need help',
        'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'
    ]
    
    for spam in spam_indicators:
        if spam in sender_lower or spam in subject_lower:
            return False
    
    # POSITIVE indicators for legitimate brands
    strong_marketing_indicators = [
        'welcome', 'thank you for signing up', 'confirm your subscription',
        'unsubscribe', '% off', 'sale', 'new arrivals', 'exclusive offer',
        'free shipping', 'limited time', 'shop now', 'your order',
        'newsletter', 'updates from', 'get 15%', 'bogo', 'preorder',
        'first order', 'summer', 'collection', 'new products', 'clearance',
        'discount', 'deal', 'coupon', 'promotion', 'promo', 'save'
    ]
    
    # SENDER patterns that indicate legitimate brands
    legitimate_senders = [
        'no-reply@', 'noreply@', 'newsletter@', 'info@', 'hello@',
        'team@', 'support@', 'contact@', 'welcome@', 'shop@', 'marketing@'
    ]
    
    # Count indicators
    marketing_score = sum(1 for indicator in strong_marketing_indicators 
                         if indicator in sender_lower or indicator in subject_lower or indicator in content_lower)
    
    sender_legit = any(pattern in sender_lower for pattern in legitimate_senders)
    
    # Must have BOTH marketing indicators AND legitimate sender pattern
    return marketing_score >= 1 and sender_legit

def load_mailbox_accounts():
    """Load all mailbox accounts from CSV"""
    mailboxes = []
    try:
        with open('mailboxaccounts.csv', 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                mailboxes.append({
                    'email': row['Email'],
                    'password': row['IMAP Password'],
                    'host': row['IMAP Host'],
                    'port': int(row['IMAP Port'])
                })
    except FileNotFoundError:
        # Fallback to src directory
        with open('src/mailboxaccounts.csv', 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                mailboxes.append({
                    'email': row['Email'],
                    'password': row['IMAP Password'],
                    'host': row['IMAP Host'],
                    'port': int(row['IMAP Port'])
                })
    
    return mailboxes

def analyze_mailbox(mailbox_info, days_back=30):
    """Analyze a single mailbox for marketing emails"""
    print(f"🔍 Analyzing: {mailbox_info['email']}")
    
    brands_found = {}
    
    try:
        # Connect to mailbox
        mail = imaplib.IMAP4_SSL(mailbox_info['host'], mailbox_info['port'], 
                                ssl_context=ssl.create_default_context())
        mail.login(mailbox_info['email'], mailbox_info['password'])
        mail.select('INBOX')
        
        # Search emails from last N days
        since_date = (datetime.now() - timedelta(days=days_back)).strftime('%d-%b-%Y')
        status, message_ids = mail.search(None, f'SINCE {since_date}')
        
        if status != 'OK' or not message_ids[0]:
            print(f"   📭 No emails found")
            mail.logout()
            return brands_found
        
        email_ids = message_ids[0].split()
        print(f"   📧 Found {len(email_ids)} emails to analyze")
        
        processed = 0
        for msg_id in email_ids:
            try:
                processed += 1
                if processed % 50 == 0:
                    print(f"   🔄 Processed {processed}/{len(email_ids)} emails...")
                
                # Fetch email headers and some body
                status, msg_data = mail.fetch(msg_id, '(RFC822)')
                if status != 'OK':
                    continue
                
                email_message = email.message_from_bytes(msg_data[0][1])
                
                sender = decode_mime_header(email_message.get('From', ''))
                subject = decode_mime_header(email_message.get('Subject', ''))
                
                # Get email preview for better analysis
                content_preview = ""
                if email_message.is_multipart():
                    for part in email_message.walk():
                        if part.get_content_type() == "text/plain":
                            try:
                                content_preview = str(part.get_payload(decode=True)[:500])
                                break
                            except:
                                pass
                else:
                    try:
                        content_preview = str(email_message.get_payload(decode=True)[:500])
                    except:
                        pass
                
                # Check if legitimate marketing email
                if is_legitimate_marketing_email(sender, subject, content_preview):
                    domain = extract_domain(sender)
                    if domain:
                        brand_name = extract_brand_name(domain)
                        
                        if domain not in brands_found:
                            brands_found[domain] = {
                                'brand_name': brand_name,
                                'domain': domain,
                                'email_count': 0,
                                'mailbox': mailbox_info['email'],
                                'example_subjects': []
                            }
                        
                        brands_found[domain]['email_count'] += 1
                        
                        if len(brands_found[domain]['example_subjects']) < 3:
                            brands_found[domain]['example_subjects'].append(subject[:80])
                        
            except Exception as e:
                continue
        
        mail.logout()
        print(f"   ✅ Found {len(brands_found)} unique brands")
        
    except Exception as e:
        print(f"   ❌ Error analyzing {mailbox_info['email']}: {e}")
    
    return brands_found

def main():
    print("🚀 COMPREHENSIVE BRAND ANALYSIS ACROSS ALL MAILBOXES")
    print("=" * 70)
    
    # Load all mailboxes
    mailboxes = load_mailbox_accounts()
    print(f"📬 Loaded {len(mailboxes)} mailboxes to analyze")
    
    # Track all brands across mailboxes
    all_brands = {}  # domain -> brand_info
    mailbox_results = {}
    
    days_back = 30  # Analyze last 30 days
    print(f"📅 Analyzing emails from last {days_back} days")
    print("=" * 70)
    
    total_mailboxes = len(mailboxes)
    for i, mailbox in enumerate(mailboxes, 1):
        print(f"\n📋 MAILBOX {i}/{total_mailboxes}")
        
        brands_in_mailbox = analyze_mailbox(mailbox, days_back)
        mailbox_results[mailbox['email']] = brands_in_mailbox
        
        # Merge into all_brands
        for domain, brand_info in brands_in_mailbox.items():
            if domain not in all_brands:
                all_brands[domain] = {
                    'brand_name': brand_info['brand_name'],
                    'domain': domain,
                    'total_emails': 0,
                    'mailboxes_found_in': [],
                    'example_subjects': []
                }
            
            all_brands[domain]['total_emails'] += brand_info['email_count']
            all_brands[domain]['mailboxes_found_in'].append({
                'mailbox': mailbox['email'],
                'count': brand_info['email_count']
            })
            
            # Add unique example subjects
            for subject in brand_info['example_subjects']:
                if subject not in all_brands[domain]['example_subjects'] and len(all_brands[domain]['example_subjects']) < 5:
                    all_brands[domain]['example_subjects'].append(subject)
    
    # Sort brands by total email count
    sorted_brands = sorted(all_brands.items(), key=lambda x: x[1]['total_emails'], reverse=True)
    
    print("\n" + "=" * 70)
    print("📊 COMPREHENSIVE RESULTS")
    print("=" * 70)
    print(f"🏷️  Total Unique Brands Found: {len(all_brands)}")
    print(f"📧 Total Marketing Emails: {sum(brand['total_emails'] for brand in all_brands.values())}")
    print(f"📬 Mailboxes Analyzed: {len(mailboxes)}")
    
    print(f"\n🏆 TOP 50 BRANDS BY EMAIL VOLUME:")
    print("-" * 70)
    for i, (domain, brand_info) in enumerate(sorted_brands[:50], 1):
        mailbox_count = len(brand_info['mailboxes_found_in'])
        print(f"{i:2d}. {brand_info['brand_name']} ({domain})")
        print(f"    📧 {brand_info['total_emails']} emails across {mailbox_count} mailboxes")
        if brand_info['example_subjects']:
            print(f"    📋 Example: {brand_info['example_subjects'][0]}")
        print()
    
    # Save detailed results
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    results_file = f'comprehensive_brand_analysis_{timestamp}.json'
    
    # Prepare data for JSON serialization
    results_data = {
        'analysis_date': datetime.now().isoformat(),
        'days_analyzed': days_back,
        'mailboxes_analyzed': len(mailboxes),
        'total_unique_brands': len(all_brands),
        'total_marketing_emails': sum(brand['total_emails'] for brand in all_brands.values()),
        'brands': dict(sorted_brands)
    }
    
    with open(results_file, 'w') as f:
        json.dump(results_data, f, indent=2, default=str)
    
    print(f"💾 Detailed results saved to: {results_file}")
    
    # Show distribution stats
    email_counts = [brand['total_emails'] for brand in all_brands.values()]
    if email_counts:
        print(f"\n📈 EMAIL VOLUME DISTRIBUTION:")
        print(f"Average emails per brand: {sum(email_counts) / len(email_counts):.1f}")
        print(f"Median emails per brand: {sorted(email_counts)[len(email_counts)//2]}")
        print(f"Top brand email count: {max(email_counts)}")
        print(f"Brands with 1 email: {sum(1 for count in email_counts if count == 1)}")
        print(f"Brands with 5+ emails: {sum(1 for count in email_counts if count >= 5)}")
        print(f"Brands with 10+ emails: {sum(1 for count in email_counts if count >= 10)}")

if __name__ == "__main__":
    main() 