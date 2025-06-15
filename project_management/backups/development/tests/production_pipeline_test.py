#!/usr/bin/env python3
"""
Production Email Pipeline Test
IMAP → Marketing Email Detection → Screenshot → Analysis
"""

import os
import json
import imaplib
import email
import re
from datetime import datetime, timedelta
from playwright.sync_api import sync_playwright

# Configuration
IMAP_SERVER = "imapn2.mymailsystem.com"
IMAP_PORT = 993
EMAIL_ADDRESS = "rohan.s@openripplestudio.info"
EMAIL_PASSWORD = "hQ&#vvN2R%&J"

def connect_to_email():
    """Connect to IMAP server"""
    try:
        print(f"🔌 Connecting to {IMAP_SERVER}...")
        mail = imaplib.IMAP4_SSL(IMAP_SERVER, IMAP_PORT)
        mail.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
        mail.select('inbox')
        print("✅ IMAP connection successful")
        return mail
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return None

def is_marketing_email(content, sender):
    """Check if email is marketing"""
    marketing_keywords = [
        'unsubscribe', 'newsletter', 'promotion', 'discount', 
        'sale', 'offer', 'deal', 'marketing', 'thank you for signing up'
    ]
    return any(keyword in content.lower() for keyword in marketing_keywords)

def get_latest_marketing_emails(mail, count=3):
    """Get latest marketing emails"""
    print(f"📫 Fetching latest {count} marketing emails...")
    
    # Search for recent emails (last 30 days)
    since_date = (datetime.now() - timedelta(days=30)).strftime("%d-%b-%Y")
    status, messages = mail.search(None, f'SINCE "{since_date}"')
    
    if status != 'OK':
        print("❌ Failed to search emails")
        return []
    
    message_ids = messages[0].split()
    print(f"📧 Found {len(message_ids)} recent emails")
    
    marketing_emails = []
    
    # Process emails from newest to oldest
    for msg_id in reversed(message_ids[-50:]):  # Check last 50 emails
        try:
            # Fetch email
            status, msg_data = mail.fetch(msg_id, '(RFC822)')
            if status != 'OK':
                continue
            
            # Parse email
            email_body = msg_data[0][1]
            email_message = email.message_from_bytes(email_body)
            
            # Extract content
            html_content = ""
            text_content = ""
            
            if email_message.is_multipart():
                for part in email_message.walk():
                    content_type = part.get_content_type()
                    if content_type == "text/html":
                        html_content = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                    elif content_type == "text/plain":
                        text_content = part.get_payload(decode=True).decode('utf-8', errors='ignore')
            else:
                if email_message.get_content_type() == "text/html":
                    html_content = email_message.get_payload(decode=True).decode('utf-8', errors='ignore')
                else:
                    text_content = email_message.get_payload(decode=True).decode('utf-8', errors='ignore')
            
            # Check if marketing email
            full_content = text_content + " " + html_content
            sender = email_message.get('From', '')
            
            if is_marketing_email(full_content, sender) and html_content:
                email_data = {
                    'message_id': msg_id.decode(),
                    'sender': sender,
                    'subject': email_message.get('Subject', ''),
                    'date': email_message.get('Date', ''),
                    'html_content': html_content,
                    'text_content': text_content
                }
                marketing_emails.append(email_data)
                print(f"✅ Marketing email: {sender} - {email_message.get('Subject', '')[:50]}")
                
                if len(marketing_emails) >= count:
                    break
                    
        except Exception as e:
            print(f"❌ Error processing email: {e}")
            continue
    
    return marketing_emails

def create_clean_screenshot(email_data):
    """Create clean screenshot from email HTML"""
    print(f"📸 Creating screenshot for email from {email_data['sender']}")
    
    # Clean HTML template
    clean_html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Content</title>
    <style>
        body {{
            margin: 0;
            padding: 20px;
            font-family: Arial, sans-serif;
            background: white;
            max-width: 800px;
            line-height: 1.4;
        }}
        img {{
            max-width: 100%;
            height: auto;
        }}
        table {{
            max-width: 100%;
        }}
        a {{
            color: #0066cc;
        }}
    </style>
</head>
<body>
    {email_data['html_content']}
</body>
</html>"""
    
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={'width': 800, 'height': 1200})
            
            # Load HTML content
            page.set_content(clean_html)
            page.wait_for_timeout(3000)  # Wait for content to load
            
            # Generate filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            sender_clean = re.sub(r'[^a-zA-Z0-9]', '_', email_data['sender'])
            filename = f"production_email_{sender_clean}_{timestamp}.png"
            
            # Take screenshot
            page.screenshot(path=filename, full_page=True)
            browser.close()
            
            print(f"✅ Screenshot saved: {filename}")
            return filename
            
    except Exception as e:
        print(f"❌ Screenshot failed: {e}")
        return None

def analyze_email_simple(screenshot_path, email_data):
    """Simple email analysis (simulated GPT)"""
    print(f"🤖 Analyzing email with AI (simulated)")
    
    # Create structured analysis without calling GPT API
    analysis = {
        'timestamp': datetime.now().isoformat(),
        'screenshot_path': screenshot_path,
        'email_context': {
            'sender': email_data['sender'],
            'subject': email_data['subject'],
            'date': email_data['date']
        },
        'content_analysis': {
            'email_type': 'marketing',
            'has_discount': any(word in email_data['subject'].lower() for word in ['discount', 'sale', 'off', '%']),
            'has_urgency': any(word in email_data['subject'].lower() for word in ['limited', 'hurry', 'today', 'now']),
            'content_length': len(email_data.get('text_content', '')),
            'html_length': len(email_data.get('html_content', '')),
            'estimated_quality': 'high' if len(email_data.get('html_content', '')) > 1000 else 'medium'
        },
        'marketing_indicators': {
            'has_unsubscribe': 'unsubscribe' in email_data.get('html_content', '').lower(),
            'sender_domain': email_data['sender'].split('@')[-1] if '@' in email_data['sender'] else 'unknown',
            'is_newsletter': 'newsletter' in email_data.get('html_content', '').lower()
        },
        'ai_analysis_note': 'Simulated analysis - ready for OpenAI GPT-4V integration'
    }
    
    return analysis

def save_production_results(results):
    """Save complete production results"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"production_pipeline_results_{timestamp}.json"
    
    output = {
        'processed_at': datetime.now().isoformat(),
        'total_emails': len(results),
        'pipeline_version': 'imap_screenshot_analysis_v1',
        'successful_processing': len([r for r in results if r['status'] == 'completed']),
        'results': results
    }
    
    with open(filename, 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"💾 Production results saved: {filename}")
    return filename

def main():
    """Main production pipeline"""
    print("🚀 Production Email Pipeline: IMAP → Marketing Detection → Screenshot → Analysis")
    print("=" * 80)
    
    # Connect to email
    mail = connect_to_email()
    if not mail:
        return
    
    try:
        # Get marketing emails
        marketing_emails = get_latest_marketing_emails(mail, count=3)  # Process 3 emails for testing
        
        if not marketing_emails:
            print("❌ No marketing emails found")
            return
        
        results = []
        
        # Process each email
        for i, email_data in enumerate(marketing_emails, 1):
            print(f"\n🔄 Processing email {i}/{len(marketing_emails)}")
            print(f"   📧 From: {email_data['sender']}")
            print(f"   📝 Subject: {email_data['subject'][:60]}...")
            
            result = {
                'email_data': email_data,
                'screenshot_path': None,
                'analysis': None,
                'status': 'started'
            }
            
            # Create screenshot
            screenshot_path = create_clean_screenshot(email_data)
            if screenshot_path:
                result['screenshot_path'] = screenshot_path
                
                # Analyze email
                analysis = analyze_email_simple(screenshot_path, email_data)
                result['analysis'] = analysis
                result['status'] = 'completed'
                
                print(f"   ✅ Pipeline completed successfully")
            else:
                result['status'] = 'failed'
                print(f"   ❌ Screenshot creation failed")
            
            results.append(result)
        
        # Save results
        results_file = save_production_results(results)
        
        # Summary
        print("\n" + "=" * 80)
        print("🎯 PRODUCTION PIPELINE SUMMARY")
        print("=" * 80)
        
        successful = len([r for r in results if r['status'] == 'completed'])
        failed = len([r for r in results if r['status'] == 'failed'])
        
        print(f"📧 Total emails processed: {len(results)}")
        print(f"✅ Successfully processed: {successful}")
        print(f"❌ Failed: {failed}")
        print(f"💾 Results saved to: {results_file}")
        
        if successful > 0:
            print(f"\n🎉 Production pipeline working!")
            print(f"📋 Pipeline Status:")
            print(f"   ✅ IMAP email fetching: WORKING")
            print(f"   ✅ Marketing email detection: WORKING")
            print(f"   ✅ Clean HTML screenshot generation: WORKING")
            print(f"   ✅ Structured email analysis: WORKING")
            print(f"   🔧 Ready to add: Real GPT-4V API calls")
            print(f"   🔧 Ready to add: BigQuery integration")
            print(f"   🔧 Ready to add: Google Cloud Storage")
            
            print(f"\n📋 Next Steps:")
            print(f"   1. Add OpenAI GPT-4V API integration")
            print(f"   2. Install Google Cloud dependencies")
            print(f"   3. Set up BigQuery tables and storage")
            print(f"   4. Scale to multiple mailboxes")
        
    finally:
        mail.close()
        mail.logout()
        print("\n🔒 Email connection closed")

if __name__ == "__main__":
    main() 