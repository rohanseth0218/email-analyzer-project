#!/usr/bin/env python3
"""
Get Recent Emails - Extract 5 most recent emails with links for direct engagement
"""

import imaplib
import email
import re
import json
from datetime import datetime
from typing import List, Dict, Any
from urllib.parse import urlparse

# Email configuration
EMAIL_CONFIG = {
    'imap_server': 'imapn2.mymailsystem.com',
    'imap_port': 993,
    'email': 'rohan.s@openripplestudio.info',
    'password': 'hQ&#vvN2R%&J'
}

def connect_to_imap():
    """Connect to IMAP server"""
    try:
        print(f"🔌 Connecting to {EMAIL_CONFIG['imap_server']}...")
        mail = imaplib.IMAP4_SSL(EMAIL_CONFIG['imap_server'], EMAIL_CONFIG['imap_port'])
        mail.login(EMAIL_CONFIG['email'], EMAIL_CONFIG['password'])
        mail.select('inbox')
        print("✅ IMAP connection successful")
        return mail
    except Exception as e:
        print(f"❌ IMAP connection failed: {e}")
        return None

def extract_links_from_html(html_content: str) -> List[Dict[str, str]]:
    """Extract all links from HTML content"""
    links = []
    
    # Find all href attributes
    href_pattern = r'href=["\']([^"\']+)["\']'
    matches = re.findall(href_pattern, html_content, re.IGNORECASE)
    
    for i, url in enumerate(matches):
        # Skip mailto, tel, and anchor links
        if url.startswith(('#', 'mailto:', 'tel:')):
            continue
            
        # Parse URL to get more info
        parsed = urlparse(url)
        
        # Try to find the link text (look for text between <a> tags near this href)
        link_text_pattern = rf'<a[^>]*href=["\']' + re.escape(url) + r'["\'][^>]*>([^<]*)</a>'
        text_match = re.search(link_text_pattern, html_content, re.IGNORECASE | re.DOTALL)
        
        link_text = "Unknown"
        if text_match:
            link_text = text_match.group(1).strip()
            # Remove HTML tags from link text
            link_text = re.sub(r'<[^>]+>', '', link_text).strip()
        
        links.append({
            'url': url,
            'text': link_text,
            'domain': parsed.netloc,
            'is_tracking': any(tracker in url.lower() for tracker in [
                'klclick', 'klaviyo', 'ctrk', 'click', 'track', 'utm_', 'email'
            ])
        })
    
    return links

def get_recent_emails(count: int = 5) -> List[Dict[str, Any]]:
    """Get the most recent emails from inbox"""
    mail = connect_to_imap()
    if not mail:
        return []
    
    try:
        # Search for all emails, get most recent
        status, messages = mail.search(None, 'ALL')
        if status != 'OK':
            print("❌ Failed to search emails")
            return []
        
        message_ids = messages[0].split()
        recent_ids = message_ids[-count:]  # Get last N emails
        
        print(f"📧 Processing {len(recent_ids)} most recent emails...")
        
        emails = []
        
        for i, msg_id in enumerate(reversed(recent_ids), 1):  # Reverse to show newest first
            try:
                print(f"   📧 Processing email {i}/{len(recent_ids)}...")
                
                # Fetch email
                status, msg_data = mail.fetch(msg_id, '(RFC822)')
                if status != 'OK':
                    continue
                
                # Parse email
                email_body = msg_data[0][1]
                email_message = email.message_from_bytes(email_body)
                
                # Extract content
                text_content = ""
                html_content = ""
                
                if email_message.is_multipart():
                    for part in email_message.walk():
                        content_type = part.get_content_type()
                        if content_type == "text/plain":
                            text_content = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                        elif content_type == "text/html":
                            html_content = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                else:
                    if email_message.get_content_type() == "text/html":
                        html_content = email_message.get_payload(decode=True).decode('utf-8', errors='ignore')
                    else:
                        text_content = email_message.get_payload(decode=True).decode('utf-8', errors='ignore')
                
                # Extract sender info
                sender = email_message.get('From', '')
                sender_email = re.search(r'<(.+?)>', sender)
                sender_email = sender_email.group(1) if sender_email else sender.strip()
                
                # Extract links from HTML
                links = extract_links_from_html(html_content) if html_content else []
                
                email_data = {
                    'position': i,
                    'message_id': msg_id.decode(),
                    'sender_email': sender_email,
                    'sender_name': sender.split('<')[0].strip().strip('"') if '<' in sender else sender,
                    'subject': email_message.get('Subject', ''),
                    'date_received': email_message.get('Date', ''),
                    'has_html': bool(html_content),
                    'text_length': len(text_content),
                    'html_length': len(html_content),
                    'total_links': len(links),
                    'tracking_links': len([l for l in links if l['is_tracking']]),
                    'links': links,
                    'preview': text_content[:200] + "..." if text_content else html_content[:200] + "..."
                }
                
                emails.append(email_data)
                print(f"   ✅ {sender_email} - {email_message.get('Subject', '')[:50]}...")
                
            except Exception as e:
                print(f"   ❌ Error processing email {i}: {e}")
                continue
        
        mail.close()
        mail.logout()
        
        return emails
        
    except Exception as e:
        print(f"❌ Error fetching emails: {e}")
        return []

def display_email_summary(emails: List[Dict[str, Any]]):
    """Display a summary of emails with their links"""
    print("\n" + "=" * 80)
    print("📧 RECENT EMAILS SUMMARY")
    print("=" * 80)
    
    for email_data in emails:
        print(f"\n📧 Email #{email_data['position']}")
        print(f"   👤 From: {email_data['sender_email']}")
        print(f"   📝 Subject: {email_data['subject']}")
        print(f"   📅 Date: {email_data['date_received']}")
        print(f"   📄 Content: {email_data['text_length']} chars text, {email_data['html_length']} chars HTML")
        print(f"   🔗 Links: {email_data['total_links']} total, {email_data['tracking_links']} tracking")
        
        if email_data['links']:
            print(f"   🔗 Link Details:")
            for j, link in enumerate(email_data['links'][:5], 1):  # Show first 5 links
                tracking_indicator = "📊" if link['is_tracking'] else "🔗"
                print(f"      {tracking_indicator} {j}. {link['text'][:30]}... -> {link['domain']}")
                if link['is_tracking']:
                    print(f"         URL: {link['url'][:100]}...")
            
            if len(email_data['links']) > 5:
                print(f"      ... and {len(email_data['links']) - 5} more links")
        
        print(f"   📖 Preview: {email_data['preview'][:100]}...")
        print("-" * 60)

def save_emails_to_file(emails: List[Dict[str, Any]]):
    """Save emails data to JSON file"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"recent_emails_{timestamp}.json"
    
    with open(filename, 'w') as f:
        json.dump({
            'extracted_at': datetime.now().isoformat(),
            'total_emails': len(emails),
            'emails': emails
        }, f, indent=2)
    
    print(f"\n💾 Email data saved to: {filename}")
    return filename

def main():
    """Main function"""
    print("🚀 Getting 5 Most Recent Emails with Links")
    print("=" * 50)
    
    emails = get_recent_emails(5)
    
    if emails:
        display_email_summary(emails)
        save_emails_to_file(emails)
        
        print(f"\n✅ Successfully processed {len(emails)} emails")
        print("🎯 Next steps:")
        print("   1. Review the tracking links identified")
        print("   2. Test direct HTTP requests to these links")
        print("   3. Monitor for engagement tracking")
    else:
        print("❌ No emails processed")

if __name__ == "__main__":
    main() 