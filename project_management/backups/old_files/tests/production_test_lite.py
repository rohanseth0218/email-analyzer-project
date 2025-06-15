#!/usr/bin/env python3
"""
Production Email Processor - Lite Test Version
Tests core functionality without heavy cloud dependencies
"""

import os
import json
import imaplib
import email
import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any

# Configuration
CONFIG = {
    'mailboxes': [
        {
            'name': 'primary',
            'imap_server': 'imapn2.mymailsystem.com',
            'imap_port': 993,
            'email': 'rohan.s@openripplestudio.info',
            'password': 'hQ&#vvN2R%&J',
            'instantly_login': 'rohan@getripple.ai',
            'instantly_password': 'Yugioh18!'
        }
    ]
}

class EmailProcessorLite:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        print("✅ Email Processor initialized")
    
    def connect_imap(self, mailbox_config: Dict[str, str]):
        """Connect to IMAP server"""
        try:
            print(f"🔌 Connecting to {mailbox_config['imap_server']}...")
            mail = imaplib.IMAP4_SSL(mailbox_config['imap_server'], mailbox_config['imap_port'])
            mail.login(mailbox_config['email'], mailbox_config['password'])
            mail.select('inbox')
            print("✅ IMAP connection successful")
            return mail
        except Exception as e:
            print(f"❌ IMAP connection failed: {e}")
            return None
    
    def is_marketing_email(self, email_content: str, sender_email: str) -> bool:
        """Simple marketing email detection"""
        marketing_indicators = [
            'unsubscribe',
            'newsletter',
            'promotion',
            'discount',
            'sale',
            'offer',
            'deal',
            'marketing',
            'thank you for signing up'
        ]
        content_lower = email_content.lower()
        return any(indicator in content_lower for indicator in marketing_indicators)
    
    def get_marketing_emails(self, mailbox_config: Dict[str, str], days_back: int = 7) -> List[Dict]:
        """Fetch marketing emails from IMAP"""
        print(f"📫 Fetching emails from {mailbox_config['name']} (last {days_back} days)...")
        
        mail = self.connect_imap(mailbox_config)
        if not mail:
            return []
        
        # Search for recent emails
        since_date = (datetime.now() - timedelta(days=days_back)).strftime("%d-%b-%Y")
        status, messages = mail.search(None, f'SINCE "{since_date}"')
        
        if status != 'OK':
            print("❌ Failed to search emails")
            return []
        
        message_ids = messages[0].split()
        print(f"📧 Found {len(message_ids)} total emails to analyze")
        
        marketing_emails = []
        
        # Process last 20 emails for testing
        for i, msg_id in enumerate(message_ids[-20:], 1):
            try:
                print(f"   Processing email {i}/20...")
                
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
                
                full_content = text_content + " " + html_content
                sender = email_message.get('From', '')
                sender_email = re.search(r'<(.+?)>', sender)
                sender_email = sender_email.group(1) if sender_email else sender.strip()
                
                # Check if it's a marketing email
                if self.is_marketing_email(full_content, sender_email):
                    email_data = {
                        'message_id': msg_id.decode(),
                        'mailbox_name': mailbox_config['name'],
                        'sender_email': sender_email,
                        'sender_domain': sender_email.split('@')[-1] if '@' in sender_email else '',
                        'subject': email_message.get('Subject', ''),
                        'date_received': email_message.get('Date', ''),
                        'content_text': text_content[:500] + "..." if len(text_content) > 500 else text_content,
                        'content_html_length': len(html_content),
                        'has_unsubscribe': 'unsubscribe' in full_content.lower(),
                    }
                    marketing_emails.append(email_data)
                    print(f"   ✅ Marketing email: {sender_email} - {email_message.get('Subject', '')[:50]}")
                    
            except Exception as e:
                print(f"   ❌ Error processing email {i}: {e}")
                continue
        
        mail.close()
        mail.logout()
        
        print(f"✅ Found {len(marketing_emails)} marketing emails")
        return marketing_emails
    
    def analyze_email_simple(self, email_data: Dict[str, Any]) -> Dict[str, Any]:
        """Simple email analysis without GPT-4V"""
        analysis = {
            'timestamp': datetime.now().isoformat(),
            'email_type': 'marketing',
            'sender_domain': email_data['sender_domain'],
            'has_discount_keywords': any(word in email_data.get('subject', '').lower() 
                                       for word in ['discount', 'sale', 'off', '%']),
            'has_urgency_keywords': any(word in email_data.get('subject', '').lower() 
                                      for word in ['limited', 'hurry', 'now', 'today']),
            'content_length': len(email_data.get('content_text', '')),
            'html_content_length': email_data.get('content_html_length', 0),
        }
        return analysis
    
    def save_results(self, marketing_emails: List[Dict], analysis_results: List[Dict]):
        """Save results to JSON file"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        results = {
            'processed_at': datetime.now().isoformat(),
            'total_marketing_emails': len(marketing_emails),
            'emails': []
        }
        
        for email_data, analysis in zip(marketing_emails, analysis_results):
            combined = {
                **email_data,
                'analysis': analysis
            }
            results['emails'].append(combined)
        
        filename = f"production_test_results_{timestamp}.json"
        with open(filename, 'w') as f:
            json.dump(results, f, indent=2)
        
        print(f"✅ Results saved to {filename}")
        return filename
    
    def process_emails(self, days_back: int = 7):
        """Main processing function"""
        print("🚀 Starting Production Email Processing Test")
        print("=" * 60)
        
        all_marketing_emails = []
        all_analysis = []
        
        for mailbox_config in self.config['mailboxes']:
            print(f"\n📬 Processing mailbox: {mailbox_config['name']}")
            
            # Get marketing emails
            marketing_emails = self.get_marketing_emails(mailbox_config, days_back)
            
            if marketing_emails:
                print(f"\n🔍 Analyzing {len(marketing_emails)} marketing emails...")
                
                for i, email_data in enumerate(marketing_emails, 1):
                    print(f"   Analyzing email {i}/{len(marketing_emails)}...")
                    analysis = self.analyze_email_simple(email_data)
                    all_analysis.append(analysis)
                
                all_marketing_emails.extend(marketing_emails)
            
        # Save results
        if all_marketing_emails:
            results_file = self.save_results(all_marketing_emails, all_analysis)
            
            # Print summary
            print("\n" + "=" * 60)
            print("🎯 PRODUCTION TEST SUMMARY")
            print("=" * 60)
            print(f"📧 Total marketing emails found: {len(all_marketing_emails)}")
            print(f"📊 Analysis completed: {len(all_analysis)}")
            print(f"💾 Results saved to: {results_file}")
            
            # Show sample results
            print(f"\n📋 Sample Marketing Emails:")
            for i, email in enumerate(all_marketing_emails[:5], 1):
                print(f"   {i}. {email['sender_email']} - {email['subject'][:50]}...")
            
            print(f"\n🎉 Production test completed successfully!")
            print(f"📋 Next steps:")
            print(f"   1. Install Google Cloud dependencies")
            print(f"   2. Set up BigQuery and GCS")
            print(f"   3. Add GPT-4V analysis")
            print(f"   4. Add screenshot functionality")
            print(f"   5. Run full production pipeline")
            
        else:
            print("\n❌ No marketing emails found in the specified timeframe")

def main():
    """Main function"""
    processor = EmailProcessorLite(CONFIG)
    processor.process_emails(days_back=30)  # Test last 30 days

if __name__ == "__main__":
    main() 