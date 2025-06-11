#!/usr/bin/env python3
"""
Deep analysis of one mailbox to find ALL marketing emails and match with signup list
"""

import imaplib
import email
import ssl
from datetime import datetime, timedelta
from email.header import decode_header
import re
import json

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

def extract_domain(email_addr):
    """Extract domain from email address"""
    if '@' in email_addr:
        return email_addr.split('@')[1].lower()
    return email_addr.lower()

def is_marketing_email(email_content: str, sender_email: str) -> bool:
    """Determine if email is legitimate marketing/promotional from brands"""
    
    # Skip if from self or internal domains
    if any(domain in sender_email.lower() for domain in ['ripple', 'openripple']):
        return False
    
    # Skip obvious spam/personal outreach patterns
    content_lower = email_content.lower()
    
    # RED FLAGS - Skip these (personal outreach/spam/business partnerships)
    spam_indicators = [
        'let\'s chat', 'what\'s your opinion', 'would you like to join', 'what do you think',
        'are you looking for', 'can i interest you', 'i noticed your', 'quick question',
        'brief chat', 'partnership opportunity', 'business opportunity', 'interested in growing',
        'help you grow', 'ripple x', 're: ripple', 'collaboration'
    ]
    
    # Skip if contains spam indicators
    for indicator in spam_indicators:
        if indicator in content_lower:
            return False
    
    # Skip if has random tracking codes (spam pattern)
    if re.search(r'\|\s*[A-Z0-9]{7}\s+[A-Z0-9]{7}', email_content):
        return False
    
    # STRONG MARKETING INDICATORS
    strong_marketing_keywords = {
        'sale': 3, 'discount': 3, 'deal': 3, 'offer': 3, 'coupon': 3,
        'limited time': 3, 'exclusive': 3, 'promotion': 3, 'promo': 3,
        'save': 3, 'free shipping': 3, '% off': 3, 'clearance': 3,
        'newsletter': 3, 'weekly update': 3, 'monthly update': 3,
        'new arrival': 3, 'product launch': 3, 'featured': 3,
        'best seller': 3, 'trending': 3, 'collection': 3,
        'shop now': 3, 'buy now': 3, 'order now': 3, 'add to cart': 3,
        'browse': 2, 'catalog': 2, 'store': 2
    }
    
    # BRAND INDICATORS (legitimate companies)
    brand_indicators = [
        'unsubscribe', 'email preferences', 'manage subscription', 'view in browser',
        'update preferences', 'privacy policy', 'customer service', 'support team',
        'headquarters', 'follow us', 'social media', 'facebook', 'twitter', 'instagram'
    ]
    
    marketing_score = 0
    brand_score = 0
    
    # Count marketing keywords
    for keyword, points in strong_marketing_keywords.items():
        if keyword in content_lower:
            marketing_score += points
    
    # Count brand indicators
    for indicator in brand_indicators:
        if indicator in content_lower:
            brand_score += 1
    
    # Check for promotional patterns
    if re.search(r'\d+%\s*off', content_lower):
        marketing_score += 3
    if re.search(r'\$\d+', content_lower):
        marketing_score += 2
    if re.search(r'(shop|buy|order)\s+(now|today)', content_lower):
        marketing_score += 3
    
    # Must have both marketing content AND brand legitimacy indicators
    return marketing_score >= 3 and brand_score >= 1

def connect_to_mailbox():
    """Connect to the test mailbox"""
    email_addr = "rohan.seth@openripplestudio.info"
    password = "lnfkG$4!MFPH"
    imap_server = "imapn2.mymailsystem.com"
    imap_port = 993
    
    print(f"🔌 Connecting to {email_addr}...")
    
    # Create SSL context
    context = ssl.create_default_context()
    
    # Connect to IMAP server
    mail = imaplib.IMAP4_SSL(imap_server, imap_port, ssl_context=context)
    mail.login(email_addr, password)
    
    print(f"✅ Connected successfully!")
    return mail, email_addr

def load_signup_brands():
    """Load the brands this email signed up for"""
    with open('full_signup_list.txt', 'r') as f:
        signup_domains = [line.strip() for line in f.readlines()]
    return signup_domains

def check_folder_comprehensive(mail, folder_name, days_back=7):
    """Check a folder comprehensively for ALL emails"""
    print(f"\n📬 DEEP ANALYSIS: {folder_name}")
    
    try:
        mail.select(folder_name)
        
        # Get date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days_back)
        date_str = start_date.strftime("%d-%b-%Y")
        
        print(f"   📅 Looking for emails since {date_str} ({days_back} days)")
        
        # Search for ALL emails in date range
        status, messages = mail.search(None, f'SINCE "{date_str}"')
        
        if status != 'OK':
            print(f"   ❌ Search failed")
            return []
        
        email_ids = messages[0].split()
        print(f"   📧 Found {len(email_ids)} total emails")
        
        all_emails = []
        marketing_emails = []
        processed = 0
        
        # Process ALL emails (no limit)
        for email_id in email_ids:
            processed += 1
            if processed % 50 == 0:
                print(f"   🔄 Processed {processed}/{len(email_ids)} emails...")
            
            try:
                # Fetch email
                status, msg_data = mail.fetch(email_id, '(RFC822)')
                if status != 'OK':
                    continue
                
                # Parse email
                email_message = email.message_from_bytes(msg_data[0][1])
                
                # Get sender
                sender = decode_mime_header(email_message.get('From', ''))
                sender_email = ""
                if '<' in sender and '>' in sender:
                    sender_email = sender.split('<')[1].split('>')[0].strip()
                elif '@' in sender:
                    sender_email = sender.strip()
                
                # Get subject
                subject = decode_mime_header(email_message.get('Subject', ''))
                
                # Get date
                date_header = email_message.get('Date', '')
                
                # Extract domain
                sender_domain = extract_domain(sender_email)
                
                # Store ALL email info
                email_info = {
                    'sender': sender_email,
                    'sender_domain': sender_domain,
                    'subject': subject,
                    'date': date_header,
                    'folder': folder_name
                }
                all_emails.append(email_info)
                
                # Get content for marketing check
                content = ""
                if email_message.is_multipart():
                    for part in email_message.walk():
                        if part.get_content_type() in ['text/plain', 'text/html']:
                            try:
                                content += str(part.get_payload(decode=True).decode('utf-8', errors='ignore'))
                            except:
                                pass
                else:
                    try:
                        content = str(email_message.get_payload(decode=True).decode('utf-8', errors='ignore'))
                    except:
                        pass
                
                # Check if marketing
                if is_marketing_email(content, sender_email):
                    email_info['content_sample'] = content[:500]  # Store sample content
                    marketing_emails.append(email_info)
                    
            except Exception as e:
                continue
        
        print(f"   ✅ Found {len(marketing_emails)} marketing emails out of {processed} total")
        return all_emails, marketing_emails
        
    except Exception as e:
        print(f"   ❌ Error checking folder {folder_name}: {e}")
        return [], []

def find_domain_matches(marketing_emails, signup_domains):
    """Find matches between email domains and signup domains"""
    matches = []
    potential_matches = []
    
    for email_info in marketing_emails:
        sender_domain = email_info['sender_domain']
        
        # Exact match
        if sender_domain in signup_domains:
            email_info['match_type'] = 'exact'
            email_info['matched_signup_domain'] = sender_domain
            matches.append(email_info)
            continue
        
        # Check for subdomain matches (e.g., newsletter.brand.com matches brand.com)
        found_match = False
        for signup_domain in signup_domains:
            if sender_domain.endswith('.' + signup_domain) or signup_domain.endswith('.' + sender_domain):
                email_info['match_type'] = 'subdomain'
                email_info['matched_signup_domain'] = signup_domain
                potential_matches.append(email_info)
                found_match = True
                break
        
        if found_match:
            continue
        
        # Check for partial matches (common root)
        sender_parts = sender_domain.split('.')
        if len(sender_parts) >= 2:
            sender_root = '.'.join(sender_parts[-2:])  # Get last two parts (brand.com)
            
            for signup_domain in signup_domains:
                signup_parts = signup_domain.split('.')
                if len(signup_parts) >= 2:
                    signup_root = '.'.join(signup_parts[-2:])
                    
                    if sender_root == signup_root:
                        email_info['match_type'] = 'root_domain'
                        email_info['matched_signup_domain'] = signup_domain
                        potential_matches.append(email_info)
                        found_match = True
                        break
        
        if not found_match:
            email_info['match_type'] = 'no_match'
            email_info['matched_signup_domain'] = None
    
    return matches, potential_matches

def main():
    """Deep comprehensive analysis"""
    print("🔍 DEEP MAILBOX ANALYSIS")
    print("=" * 50)
    
    # Load signup domains
    print("📋 Loading signup domains...")
    signup_domains = load_signup_brands()
    print(f"   ✅ Loaded {len(signup_domains)} signup domains")
    
    # Connect
    mail, email_addr = connect_to_mailbox()
    
    # Get all folders
    status, folder_list = mail.list()
    folders = []
    for folder_line in folder_list:
        folder_name = folder_line.decode('utf-8').split(' "/" ')[-1].strip('"')
        folders.append(folder_name)
    
    print(f"\n📁 Found folders: {folders}")
    
    # Check all folders for last 14 days
    all_marketing_emails = []
    all_emails_total = []
    
    for folder in folders:
        if folder.lower() in ['drafts', 'sent']:
            continue  # Skip these folders
            
        all_emails, marketing_emails = check_folder_comprehensive(mail, folder, days_back=14)
        all_emails_total.extend(all_emails)
        all_marketing_emails.extend(marketing_emails)
    
    print(f"\n📊 COMPREHENSIVE RESULTS")
    print(f"📧 Email: {email_addr}")
    print(f"📁 Folders checked: {len([f for f in folders if f.lower() not in ['drafts', 'sent']])}")
    print(f"📬 Total emails found: {len(all_emails_total)}")
    print(f"🎯 Marketing emails found: {len(all_marketing_emails)}")
    print(f"⏰ Time range: Last 14 days")
    
    # Find matches
    print(f"\n🔍 MATCHING WITH SIGNUP DOMAINS...")
    exact_matches, potential_matches = find_domain_matches(all_marketing_emails, signup_domains)
    
    print(f"\n✅ EXACT MATCHES ({len(exact_matches)}):")
    for match in exact_matches:
        print(f"   • {match['sender']} ({match['matched_signup_domain']})")
        print(f"     Subject: {match['subject'][:60]}...")
    
    print(f"\n🤔 POTENTIAL MATCHES ({len(potential_matches)}):")
    for match in potential_matches:
        print(f"   • {match['sender']} -> {match['matched_signup_domain']} ({match['match_type']})")
        print(f"     Subject: {match['subject'][:60]}...")
    
    no_matches = [e for e in all_marketing_emails if e.get('match_type') == 'no_match']
    print(f"\n❌ NO MATCHES ({len(no_matches)}):")
    for email_info in no_matches[:10]:  # Show first 10
        print(f"   • {email_info['sender']}")
        print(f"     Subject: {email_info['subject'][:60]}...")
    
    # Save detailed results
    results = {
        'total_emails': len(all_emails_total),
        'marketing_emails': len(all_marketing_emails),
        'exact_matches': len(exact_matches),
        'potential_matches': len(potential_matches),
        'no_matches': len(no_matches),
        'signup_domains_count': len(signup_domains),
        'match_rate_exact': len(exact_matches) / len(all_marketing_emails) * 100 if all_marketing_emails else 0,
        'match_rate_with_potential': (len(exact_matches) + len(potential_matches)) / len(all_marketing_emails) * 100 if all_marketing_emails else 0,
        'detailed_matches': exact_matches + potential_matches
    }
    
    with open('deep_analysis_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n📈 FINAL ANALYSIS:")
    print(f"   • Exact match rate: {results['match_rate_exact']:.1f}%")
    print(f"   • With potential matches: {results['match_rate_with_potential']:.1f}%")
    print(f"   • Results saved to deep_analysis_results.json")
    
    mail.close()
    mail.logout()

if __name__ == "__main__":
    main() 