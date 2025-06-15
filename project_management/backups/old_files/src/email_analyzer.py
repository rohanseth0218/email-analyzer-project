#!/usr/bin/env python3
"""
Email Analyzer - Identify Marketing Emails vs Cold Emails vs Warmup Emails
"""

import imaplib
import email
import re
from datetime import datetime, timedelta
from collections import defaultdict
import json
import requests

# Email server configuration
IMAP_SERVER = "imapn2.mymailsystem.com"
IMAP_PORT = 993
EMAIL_ADDRESS = "rohan.s@openripplestudio.info"
EMAIL_PASSWORD = "hQ&#vvN2R%&J"

# Marketing email indicators
MARKETING_KEYWORDS = [
    'unsubscribe', 'newsletter', 'promotion', 'discount', 'offer', 'sale', 'deal',
    'limited time', 'exclusive', 'free shipping', 'thank you for signing up',
    'welcome', 'get started', 'click here', 'shop now', 'learn more',
    'special offer', 'save money', 'don\'t miss', 'act now', 'expires'
]

MARKETING_DOMAINS = [
    'noreply', 'newsletter', 'marketing', 'promo', 'offers', 'notifications',
    'hello@', 'hi@', 'team@', 'support@'
]

COLD_EMAIL_INDICATORS = [
    'reaching out', 'quick question', 'partnership', 'collaboration', 'opportunity',
    'connect', 'interested in', 'following up', 'touching base', 'hope this finds you well'
]

# Slack webhook URL (same as automation)
SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/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"

def connect_to_imap():
    """Connect to IMAP server"""
    print("🔗 Connecting to IMAP server...")
    mail = imaplib.IMAP4_SSL(IMAP_SERVER, IMAP_PORT)
    print("🔐 Logging in...")
    mail.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
    print("✅ Connected successfully")
    return mail

def get_recent_emails(mail, days_back=7, limit=100):
    """Get recent emails from inbox"""
    print(f"📫 Fetching emails from last {days_back} days (limit: {limit})...")
    
    mail.select('inbox')
    
    # Calculate date range
    since_date = (datetime.now() - timedelta(days=days_back)).strftime("%d-%b-%Y")
    
    # Search for recent emails
    search_criteria = f'SINCE "{since_date}"'
    status, messages = mail.search(None, search_criteria)
    
    if status != 'OK':
        print("❌ Failed to search emails")
        return []
    
    message_ids = messages[0].split()
    
    # Limit the number of emails to process
    if len(message_ids) > limit:
        message_ids = message_ids[-limit:]  # Get most recent
    
    print(f"📧 Found {len(message_ids)} recent emails")
    return message_ids

def analyze_email(mail, message_id):
    """Analyze a single email and extract characteristics"""
    try:
        # Fetch the email
        status, msg_data = mail.fetch(message_id, '(RFC822)')
        if status != 'OK':
            return None
        
        # Parse the email
        email_body = msg_data[0][1]
        email_message = email.message_from_bytes(email_body)
        
        # Extract basic info
        subject = email_message.get('Subject', '')
        sender = email_message.get('From', '')
        date_str = email_message.get('Date', '')
        
        # Extract text and HTML content
        text_content = ""
        html_content = ""
        
        if email_message.is_multipart():
            for part in email_message.walk():
                content_type = part.get_content_type()
                content_disposition = str(part.get("Content-Disposition", ""))
                
                if "attachment" not in content_disposition:
                    if content_type == "text/plain":
                        text_content = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                    elif content_type == "text/html":
                        html_content = part.get_payload(decode=True).decode('utf-8', errors='ignore')
        else:
            content_type = email_message.get_content_type()
            if content_type == "text/plain":
                text_content = email_message.get_payload(decode=True).decode('utf-8', errors='ignore')
            elif content_type == "text/html":
                html_content = email_message.get_payload(decode=True).decode('utf-8', errors='ignore')
        
        # Combine content for analysis
        full_content = (text_content + " " + html_content).lower()
        
        # Extract sender domain
        sender_email = re.search(r'<(.+?)>', sender)
        if sender_email:
            sender_email = sender_email.group(1)
        else:
            sender_email = sender
        
        sender_domain = sender_email.split('@')[-1] if '@' in sender_email else ""
        
        # Analyze characteristics
        analysis = {
            'message_id': message_id.decode(),
            'subject': subject,
            'sender': sender,
            'sender_email': sender_email,
            'sender_domain': sender_domain,
            'date': date_str,
            'has_html': bool(html_content),
            'content_length': len(full_content),
            'marketing_score': 0,
            'cold_email_score': 0,
            'indicators': []
        }
        
        # Check for marketing indicators
        marketing_matches = []
        for keyword in MARKETING_KEYWORDS:
            if keyword in full_content:
                marketing_matches.append(keyword)
                analysis['marketing_score'] += 1
        
        # Check sender domain patterns
        for domain_pattern in MARKETING_DOMAINS:
            if domain_pattern in sender_email.lower():
                marketing_matches.append(f"domain:{domain_pattern}")
                analysis['marketing_score'] += 2
        
        # Check for cold email indicators
        cold_matches = []
        for indicator in COLD_EMAIL_INDICATORS:
            if indicator in full_content:
                cold_matches.append(indicator)
                analysis['cold_email_score'] += 1
        
        # Check for unsubscribe link (strong marketing indicator)
        if 'unsubscribe' in full_content:
            analysis['marketing_score'] += 3
            analysis['indicators'].append('unsubscribe_link')
        
        # Check for HTML complexity (marketing emails often more complex)
        if html_content:
            html_tags = len(re.findall(r'<[^>]+>', html_content))
            if html_tags > 50:  # Lots of HTML tags suggest marketing
                analysis['marketing_score'] += 2
                analysis['indicators'].append('complex_html')
        
        # Check for personal vs generic greeting
        if re.search(r'\bhi\s+\w+\b|\bhello\s+\w+\b', full_content):
            analysis['cold_email_score'] += 1
            analysis['indicators'].append('personal_greeting')
        
        # Store matched keywords for debugging
        analysis['marketing_keywords'] = marketing_matches
        analysis['cold_keywords'] = cold_matches
        
        return analysis
        
    except Exception as e:
        print(f"❌ Error analyzing email {message_id}: {e}")
        return None

def categorize_email(analysis):
    """Categorize email based on analysis"""
    if not analysis:
        return "unknown"
    
    marketing_score = analysis['marketing_score']
    cold_score = analysis['cold_email_score']
    
    # Simple scoring logic
    if marketing_score >= 3:
        return "marketing"
    elif cold_score >= 2:
        return "cold_email"
    elif 'noreply' in analysis['sender_email'] or 'no-reply' in analysis['sender_email']:
        return "marketing"
    elif marketing_score > cold_score:
        return "marketing"
    elif cold_score > 0:
        return "cold_email"
    else:
        return "warmup"  # Default for low-score emails

def send_slack_notification(total_emails, categories, output_file):
    """Send Slack notification with email analysis results"""
    try:
        # Create summary text
        summary_lines = []
        for category, emails in categories.items():
            percentage = (len(emails) / total_emails) * 100 if total_emails > 0 else 0
            summary_lines.append(f"📁 {category.capitalize()}: {len(emails)} ({percentage:.1f}%)")
        
        summary_text = "\n".join(summary_lines)
        
        message = {
            "text": f"📊 Email Analysis Complete!\n\n📧 **{total_emails} emails analyzed**\n\n{summary_text}\n\n💾 Results saved: `{output_file}`\n\n🕐 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        }
        
        response = requests.post(SLACK_WEBHOOK_URL, json=message, timeout=10)
        
        if response.status_code == 200:
            print("📨 Slack notification sent successfully")
        else:
            print(f"⚠️ Slack notification failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Failed to send Slack notification: {e}")

def main():
    """Main function"""
    print("🚀 Email Analyzer - Marketing vs Cold vs Warmup")
    print("=" * 60)
    
    try:
        # Connect to IMAP
        mail = connect_to_imap()
        
        # Get recent emails
        message_ids = get_recent_emails(mail, days_back=14, limit=50)
        
        if not message_ids:
            print("❌ No emails found")
            return
        
        # Analyze emails
        print("\n🔍 Analyzing emails...")
        results = []
        categories = defaultdict(list)
        
        for i, msg_id in enumerate(message_ids, 1):
            print(f"📧 Processing email {i}/{len(message_ids)}...", end='\r')
            
            analysis = analyze_email(mail, msg_id)
            if analysis:
                category = categorize_email(analysis)
                analysis['category'] = category
                results.append(analysis)
                categories[category].append(analysis)
        
        print("\n" + "=" * 60)
        print("📊 ANALYSIS RESULTS")
        print("=" * 60)
        
        # Summary by category
        for category, emails in categories.items():
            print(f"\n📁 {category.upper()} EMAILS: {len(emails)}")
            print("-" * 40)
            
            for email_data in emails[:5]:  # Show first 5 of each category
                print(f"📧 From: {email_data['sender_email']}")
                print(f"📝 Subject: {email_data['subject'][:60]}...")
                print(f"🏷️ Marketing Score: {email_data['marketing_score']}")
                print(f"🎯 Cold Score: {email_data['cold_email_score']}")
                if email_data['marketing_keywords']:
                    print(f"🔍 Marketing Keywords: {', '.join(email_data['marketing_keywords'][:3])}")
                if email_data['cold_keywords']:
                    print(f"💬 Cold Keywords: {', '.join(email_data['cold_keywords'][:3])}")
                print("---")
            
            if len(emails) > 5:
                print(f"... and {len(emails) - 5} more emails")
        
        # Save detailed results
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = f"email_analysis_{timestamp}.json"
        
        with open(output_file, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        
        print(f"\n💾 Detailed results saved to: {output_file}")
        
        # Summary stats
        print(f"\n📈 SUMMARY:")
        print(f"📧 Total emails analyzed: {len(results)}")
        for category, emails in categories.items():
            percentage = (len(emails) / len(results)) * 100
            print(f"📁 {category.capitalize()}: {len(emails)} ({percentage:.1f}%)")
        
        # Send Slack notification
        send_slack_notification(len(results), categories, output_file)
        
        # Close connection
        mail.close()
        mail.logout()
        print("\n🔒 Connection closed")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main() 