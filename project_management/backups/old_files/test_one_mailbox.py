#!/usr/bin/env python3
"""
Test script to manually check one mailbox for marketing emails
"""

import imaplib
import email
import ssl
from datetime import datetime, timedelta
from email.header import decode_header
import re

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

def is_marketing_email(email_content: str, sender_email: str) -> bool:
    """Determine if email is legitimate marketing/promotional from brands"""
    
    # Skip if from self or internal domains
    if any(domain in sender_email.lower() for domain in ['ripple', 'openripple']):
        return False
    
    # Skip obvious spam/personal outreach patterns
    content_lower = email_content.lower()
    subject_lower = email_content.lower()  # This will include subject in content
    
    # RED FLAGS - Skip these (personal outreach/spam/business partnerships)
    spam_indicators = [
        'let\'s chat',
        'what\'s your opinion',
        'would you like to join',
        'what do you think',
        'are you looking for',
        'can i interest you',
        'i noticed your',
        'quick question',
        'brief chat',
        'partnership opportunity',
        'business opportunity',
        'interested in growing',
        'help you grow',
        'ripple x',  # Business partnerships/collaborations
        're: ripple',  # Business correspondence
        'collaboration',
        'partnership'
    ]
    
    # Skip if contains spam indicators
    for indicator in spam_indicators:
        if indicator in content_lower:
            return False
    
    # Skip if has random tracking codes (spam pattern)
    if re.search(r'\|\s*[A-Z0-9]{7}\s+[A-Z0-9]{7}', email_content):
        return False
    
    # STRONG MARKETING INDICATORS (must have at least one)
    strong_marketing_keywords = {
        # Sales/Offers
        'sale': 3, 'discount': 3, 'deal': 3, 'offer': 3, 'coupon': 3,
        'limited time': 3, 'exclusive': 3, 'promotion': 3, 'promo': 3,
        'save': 3, 'free shipping': 3, '% off': 3, 'clearance': 3,
        
        # Newsletter/Brand
        'newsletter': 3, 'weekly update': 3, 'monthly update': 3,
        'new arrival': 3, 'product launch': 3, 'featured': 3,
        'best seller': 3, 'trending': 3, 'collection': 3,
        
        # E-commerce
        'shop now': 3, 'buy now': 3, 'order now': 3, 'add to cart': 3,
        'browse': 2, 'catalog': 2, 'store': 2
    }
    
    # BRAND INDICATORS (legitimate companies)
    brand_indicators = [
        'unsubscribe', 'email preferences', 'manage subscription',
        'view in browser', 'update preferences', 'privacy policy',
        'customer service', 'support team', 'headquarters',
        'follow us', 'social media', 'facebook', 'twitter', 'instagram'
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

def get_folders(mail):
    """Get all folders in the mailbox"""
    print("\n📁 Available folders:")
    folders = []
    
    status, folder_list = mail.list()
    for folder_line in folder_list:
        folder_name = folder_line.decode('utf-8').split(' "/" ')[-1].strip('"')
        folders.append(folder_name)
        print(f"   • {folder_name}")
    
    return folders

def check_folder(mail, folder_name, days_back=3):
    """Check a specific folder for marketing emails"""
    print(f"\n📬 Checking folder: {folder_name}")
    
    try:
        mail.select(folder_name)
        
        # Get date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days_back)
        date_str = start_date.strftime("%d-%b-%Y")
        
        print(f"   📅 Looking for emails since {date_str}")
        
        # Search for emails in date range
        status, messages = mail.search(None, f'SINCE "{date_str}"')
        
        if status != 'OK':
            print(f"   ❌ Search failed")
            return []
        
        email_ids = messages[0].split()
        print(f"   📧 Found {len(email_ids)} total emails")
        
        marketing_emails = []
        processed = 0
        
        # Process emails (limit to 100 for testing)
        for email_id in email_ids[:100]:
            processed += 1
            if processed % 20 == 0:
                print(f"   🔄 Processed {processed}/{min(len(email_ids), 100)} emails...")
            
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
                
                # Get content
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
                    marketing_emails.append({
                        'sender': sender_email,
                        'subject': subject[:80],
                        'folder': folder_name
                    })
                    
            except Exception as e:
                continue
        
        print(f"   ✅ Found {len(marketing_emails)} marketing emails out of {processed} checked")
        return marketing_emails
        
    except Exception as e:
        print(f"   ❌ Error checking folder {folder_name}: {e}")
        return []

def main():
    """Main test function"""
    print("🧪 Testing One Mailbox for Marketing Emails")
    print("=" * 50)
    
    # Connect
    mail, email_addr = connect_to_mailbox()
    
    # Get folders
    folders = get_folders(mail)
    
    # Test different time ranges
    print(f"\n⏰ Testing different time ranges:")
    
    all_marketing = []
    
    # Check key folders
    key_folders = ['INBOX', 'Junk', 'Spam', 'Trash']
    available_folders = [f for f in key_folders if f in folders]
    
    if not available_folders:
        # Use first few folders if standard ones not found
        available_folders = folders[:3]
    
    print(f"📂 Will check folders: {available_folders}")
    
    for folder in available_folders:
        folder_emails = check_folder(mail, folder, days_back=3)
        all_marketing.extend(folder_emails)
    
    # Summary
    print(f"\n📊 SUMMARY")
    print(f"📧 Email: {email_addr}")
    print(f"📁 Folders checked: {len(available_folders)}")
    print(f"🎯 Total marketing emails found: {len(all_marketing)}")
    print(f"⏰ Time range: Last 3 days")
    
    # Show sample emails
    if all_marketing:
        print(f"\n📋 Sample marketing emails:")
        for i, email_info in enumerate(all_marketing[:10]):
            print(f"   {i+1}. From: {email_info['sender']}")
            print(f"      Subject: {email_info['subject']}")
            print(f"      Folder: {email_info['folder']}")
            print()
    
    # Estimate for all mailboxes
    if len(all_marketing) > 0:
        estimated_per_mailbox = len(all_marketing)
        estimated_total = estimated_per_mailbox * 68
        estimated_screenshots = estimated_total  # Assuming most will have screenshots
        estimated_processing_time = (estimated_total * 30) / 60  # 30 seconds per email in minutes
        
        print(f"📈 ESTIMATES FOR ALL 68 MAILBOXES:")
        print(f"   • ~{estimated_per_mailbox} marketing emails per mailbox")
        print(f"   • ~{estimated_total:,} total marketing emails")
        print(f"   • ~{estimated_screenshots:,} screenshots to create")
        print(f"   • ~{estimated_processing_time:.0f} minutes processing time")
        print(f"   • Would need ~{estimated_processing_time/60:.1f} hours total")
        
        if estimated_processing_time > 60:
            batches_needed = int(estimated_processing_time / 50) + 1
            print(f"   • ⚠️  Would need ~{batches_needed} separate 50-minute runs")
    
    mail.close()
    mail.logout()

if __name__ == "__main__":
    main() 