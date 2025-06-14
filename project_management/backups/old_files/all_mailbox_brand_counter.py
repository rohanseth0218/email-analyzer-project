#!/usr/bin/env python3
"""
Count ALL unique brands across ALL mailboxes
Simple and focused - just count unique marketing brands regardless of signup status
"""

import imaplib
import ssl
import email
import csv
import json
from datetime import datetime, timedelta
import re
from collections import defaultdict
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
    email_match = re.search(r'<([^>]+)>', sender)
    if email_match:
        email_addr = email_match.group(1)
    else:
        email_addr = sender.strip()
    
    if '@' in email_addr:
        domain = email_addr.split('@')[1].lower()
        return domain
    return None

def extract_brand_name(domain):
    """Extract likely brand name from domain"""
    if not domain:
        return None
    
    domain_parts = domain.replace('www.', '').split('.')
    if len(domain_parts) > 1:
        brand = domain_parts[0]
        brand = re.sub(r'^(mail|email|newsletter|noreply|no-reply)', '', brand)
        return brand.strip('-').title() if brand else None
    return domain.title()

def is_marketing_email(sender, subject):
    """Simple but effective marketing email detector"""
    sender_lower = sender.lower()
    subject_lower = subject.lower()
    
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
        'support@', 'contact@', 'marketing@'
    ]
    
    marketing_score = sum(1 for indicator in marketing_indicators 
                         if indicator in sender_lower or indicator in subject_lower)
    
    return marketing_score >= 1

def load_mailboxes():
    """Load mailbox credentials from CSV"""
    mailboxes = []
    try:
        with open('mailboxaccounts.csv', 'r', encoding='utf-8') as f:
            content = f.read()
            lines = content.strip().split('\n')
            headers = lines[0].split(',')
            
            for line in lines[1:]:
                if line.strip():
                    values = line.split(',')
                    if len(values) >= 6:  # Ensure we have enough columns
                        mailbox = {
                            'email': values[0].strip(),
                            'password': values[4].strip(),  # IMAP Password column
                            'host': values[5].strip(),      # IMAP Host column
                            'port': int(values[6].strip())  # IMAP Port column
                        }
                        mailboxes.append(mailbox)
    except Exception as e:
        print(f"Error loading mailboxes: {e}")
        
    return mailboxes

def analyze_single_mailbox(mailbox, days_back=30):
    """Analyze one mailbox for marketing brands"""
    email_addr = mailbox['email']
    print(f"📧 Analyzing: {email_addr}")
    
    brands = {}
    
    try:
        # Connect
        mail = imaplib.IMAP4_SSL(mailbox['host'], mailbox['port'], 
                                ssl_context=ssl.create_default_context())
        mail.login(email_addr, mailbox['password'])
        mail.select('INBOX')
        
        # Search recent emails
        since_date = (datetime.now() - timedelta(days=days_back)).strftime('%d-%b-%Y')
        status, message_ids = mail.search(None, f'SINCE {since_date}')
        
        if status != 'OK' or not message_ids[0]:
            print(f"   📭 No recent emails")
            mail.logout()
            return brands
        
        email_ids = message_ids[0].split()
        print(f"   🔍 Checking {len(email_ids)} emails...")
        
        processed = 0
        for msg_id in email_ids:
            try:
                processed += 1
                if processed % 100 == 0:
                    print(f"      Progress: {processed}/{len(email_ids)}")
                
                status, msg_data = mail.fetch(msg_id, '(RFC822)')
                if status != 'OK':
                    continue
                
                email_message = email.message_from_bytes(msg_data[0][1])
                sender = decode_mime_header(email_message.get('From', ''))
                subject = decode_mime_header(email_message.get('Subject', ''))
                
                if is_marketing_email(sender, subject):
                    domain = extract_domain(sender)
                    if domain:
                        brand_name = extract_brand_name(domain)
                        if domain not in brands:
                            brands[domain] = {
                                'name': brand_name,
                                'count': 0,
                                'examples': []
                            }
                        brands[domain]['count'] += 1
                        if len(brands[domain]['examples']) < 2:
                            brands[domain]['examples'].append(subject[:60])
                        
            except Exception as e:
                continue
        
        mail.logout()
        print(f"   ✅ Found {len(brands)} brands with {sum(b['count'] for b in brands.values())} marketing emails")
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    return brands

def save_results_to_files(all_brands, mailboxes_analyzed, days_analyzed):
    """Save all results to JSON and CSV files"""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    # Prepare data for saving
    sorted_brands = sorted(all_brands.items(), key=lambda x: x[1]['total_emails'], reverse=True)
    
    # Save to JSON
    json_filename = f'all_brands_analysis_{timestamp}.json'
    json_data = {
        'analysis_metadata': {
            'timestamp': datetime.now().isoformat(),
            'days_analyzed': days_analyzed,
            'mailboxes_analyzed': mailboxes_analyzed,
            'total_unique_brands': len(all_brands),
            'total_marketing_emails': sum(brand['total_emails'] for brand in all_brands.values()),
            'average_emails_per_brand': sum(brand['total_emails'] for brand in all_brands.values()) / len(all_brands) if all_brands else 0
        },
        'brands': {}
    }
    
    for domain, info in sorted_brands:
        json_data['brands'][domain] = {
            'brand_name': info['name'],
            'domain': domain,
            'total_emails': info['total_emails'],
            'mailboxes_found_in': list(info['mailboxes']),
            'mailbox_count': len(info['mailboxes']),
            'example_subjects': info['examples']
        }
    
    with open(json_filename, 'w', encoding='utf-8') as f:
        json.dump(json_data, f, indent=2, ensure_ascii=False)
    
    print(f"💾 JSON saved to: {json_filename}")
    
    # Save to CSV
    csv_filename = f'all_brands_analysis_{timestamp}.csv'
    with open(csv_filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        
        # Write header
        writer.writerow([
            'Brand Name',
            'Domain',
            'Total Emails',
            'Mailbox Count',
            'Mailboxes Found In',
            'Example Subject 1',
            'Example Subject 2',
            'Example Subject 3'
        ])
        
        # Write data
        for domain, info in sorted_brands:
            mailboxes_list = '; '.join(list(info['mailboxes']))
            examples = info['examples'] + [''] * (3 - len(info['examples']))  # Pad to ensure 3 columns
            
            writer.writerow([
                info['name'],
                domain,
                info['total_emails'],
                len(info['mailboxes']),
                mailboxes_list,
                examples[0] if len(examples) > 0 else '',
                examples[1] if len(examples) > 1 else '',
                examples[2] if len(examples) > 2 else ''
            ])
    
    print(f"💾 CSV saved to: {csv_filename}")
    
    # Also create a summary CSV
    summary_csv = f'brand_summary_{timestamp}.csv'
    with open(summary_csv, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Metric', 'Value'])
        writer.writerow(['Analysis Date', datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
        writer.writerow(['Days Analyzed', days_analyzed])
        writer.writerow(['Mailboxes Analyzed', mailboxes_analyzed])
        writer.writerow(['Total Unique Brands', len(all_brands)])
        writer.writerow(['Total Marketing Emails', sum(brand['total_emails'] for brand in all_brands.values())])
        writer.writerow(['Average Emails per Brand', f"{sum(brand['total_emails'] for brand in all_brands.values()) / len(all_brands):.1f}" if all_brands else '0'])
        
        # Distribution stats
        email_counts = [brand['total_emails'] for brand in all_brands.values()]
        if email_counts:
            writer.writerow(['Brands with 1 email', sum(1 for c in email_counts if c == 1)])
            writer.writerow(['Brands with 2-5 emails', sum(1 for c in email_counts if 2 <= c <= 5)])
            writer.writerow(['Brands with 6-10 emails', sum(1 for c in email_counts if 6 <= c <= 10)])
            writer.writerow(['Brands with 10+ emails', sum(1 for c in email_counts if c > 10)])
            writer.writerow(['Top brand email count', max(email_counts)])
    
    print(f"💾 Summary CSV saved to: {summary_csv}")
    
    return json_filename, csv_filename, summary_csv

def main():
    print("🚀 COUNTING ALL UNIQUE BRANDS ACROSS ALL MAILBOXES")
    print("=" * 65)
    
    # Load mailboxes
    mailboxes = load_mailboxes()
    print(f"📬 Loaded {len(mailboxes)} mailboxes")
    
    if len(mailboxes) == 0:
        print("❌ No mailboxes loaded! Check your CSV file.")
        return
    
    # Global brand tracker
    all_brands = defaultdict(lambda: {
        'name': '',
        'total_emails': 0,
        'mailboxes': set(),
        'examples': []
    })
    
    days_back = 30
    print(f"📅 Analyzing last {days_back} days")
    print("=" * 65)
    
    # Analyze each mailbox
    for i, mailbox in enumerate(mailboxes, 1):
        print(f"\n📋 MAILBOX {i}/{len(mailboxes)}")
        
        brands_in_mailbox = analyze_single_mailbox(mailbox, days_back)
        
        # Merge results
        for domain, brand_info in brands_in_mailbox.items():
            all_brands[domain]['name'] = brand_info['name']
            all_brands[domain]['total_emails'] += brand_info['count']
            all_brands[domain]['mailboxes'].add(mailbox['email'])
            
            # Add unique examples
            for example in brand_info['examples']:
                if example not in all_brands[domain]['examples'] and len(all_brands[domain]['examples']) < 3:
                    all_brands[domain]['examples'].append(example)
    
    # Save results to files
    print("\n" + "=" * 65)
    print("💾 SAVING RESULTS TO FILES")
    print("=" * 65)
    
    json_file, csv_file, summary_file = save_results_to_files(all_brands, len(mailboxes), days_back)
    
    # Results
    print("\n" + "=" * 65)
    print("📊 FINAL RESULTS")
    print("=" * 65)
    
    total_brands = len(all_brands)
    total_emails = sum(brand['total_emails'] for brand in all_brands.values())
    
    print(f"🏷️  TOTAL UNIQUE BRANDS: {total_brands}")
    print(f"📧 TOTAL MARKETING EMAILS: {total_emails}")
    print(f"📬 MAILBOXES ANALYZED: {len(mailboxes)}")
    
    if total_brands > 0:
        avg_emails = total_emails / total_brands
        print(f"📈 AVERAGE EMAILS PER BRAND: {avg_emails:.1f}")
    
    # Top brands
    sorted_brands = sorted(all_brands.items(), 
                          key=lambda x: x[1]['total_emails'], 
                          reverse=True)
    
    print(f"\n🏆 TOP 30 BRANDS BY EMAIL VOLUME:")
    print("-" * 65)
    
    for i, (domain, info) in enumerate(sorted_brands[:30], 1):
        mailbox_count = len(info['mailboxes'])
        print(f"{i:2d}. {info['name']} ({domain})")
        print(f"    📧 {info['total_emails']} emails in {mailbox_count} mailboxes")
        if info['examples']:
            print(f"    📝 Example: {info['examples'][0]}")
        print()
    
    # Distribution stats
    email_counts = [brand['total_emails'] for brand in all_brands.values()]
    if email_counts:
        print(f"📊 EMAIL DISTRIBUTION:")
        print(f"   • Brands with 1 email: {sum(1 for c in email_counts if c == 1)}")
        print(f"   • Brands with 2-5 emails: {sum(1 for c in email_counts if 2 <= c <= 5)}")
        print(f"   • Brands with 6-10 emails: {sum(1 for c in email_counts if 6 <= c <= 10)}")
        print(f"   • Brands with 10+ emails: {sum(1 for c in email_counts if c > 10)}")
        print(f"   • Top brand has: {max(email_counts)} emails")
    
    print(f"\n📁 FILES CREATED:")
    print(f"   📊 Detailed JSON: {json_file}")
    print(f"   📋 Detailed CSV: {csv_file}")  
    print(f"   📈 Summary CSV: {summary_file}")

if __name__ == "__main__":
    main() 