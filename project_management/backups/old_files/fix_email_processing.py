#!/usr/bin/env python3
"""
FIXED Email Processor - Processes ALL 68 Mailboxes

This fixes the issue where only 55 emails were found from 1 mailbox
when you should be finding 1500+ emails from 68 mailboxes.
"""

import os
import json
import imaplib
import email
import re
import csv
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any

def load_all_mailboxes() -> List[Dict[str, str]]:
    """Load all 68 mailboxes from CSV file"""
    print("📧 Loading ALL mailboxes from CSV...")
    
    try:
        mailboxes = []
        with open('./mailboxaccounts.csv', 'r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            
            for i, row in enumerate(reader, 1):
                # Handle BOM in first column
                email_address = row.get('﻿Email') or row.get('Email') or row.get('email')
                imap_password = row.get('IMAP Password', '')
                imap_host = row.get('IMAP Host', 'imapn2.mymailsystem.com')
                imap_port = int(row.get('IMAP Port', 993))
                
                if email_address and imap_password and '@' in email_address:
                    mailbox = {
                        'name': f'mailbox_{i}',
                        'email': email_address.strip(),
                        'password': imap_password.strip(),
                        'imap_server': imap_host.strip(),
                        'imap_port': imap_port
                    }
                    mailboxes.append(mailbox)
                    
                    if i <= 5:  # Show first 5 for verification
                        print(f"   ✅ Loaded: {email_address}")
        
        print(f"📧 Successfully loaded {len(mailboxes)} mailboxes from CSV")
        
        if len(mailboxes) < 60:
            print(f"⚠️ Warning: Expected ~68 mailboxes but only found {len(mailboxes)}")
        
        return mailboxes
        
    except Exception as e:
        print(f"❌ Error loading mailboxes from CSV: {e}")
        return []

class FixedEmailProcessor:
    def __init__(self):
        self.mailboxes = load_all_mailboxes()
        
        # Marketing email indicators
        self.marketing_keywords = [
            'unsubscribe', 'newsletter', 'promotion', 'discount', 'offer', 'sale', 'deal',
            'limited time', 'exclusive', 'free shipping', 'thank you for signing up',
            'welcome', 'get started', 'click here', 'shop now', 'learn more',
            'special offer', 'save money', 'don\'t miss', 'act now', 'expires',
            'new arrival', 'collection', 'trending', 'bestseller', 'clearance'
        ]
        
        self.marketing_domains = [
            'noreply', 'newsletter', 'marketing', 'promo', 'offers', 'notifications',
            'hello@', 'hi@', 'team@', 'support@', 'info@', 'news@'
        ]
        
        print(f"✅ Email Processor initialized with {len(self.mailboxes)} mailboxes")
    
    def connect_imap(self, mailbox_config: Dict[str, str]):
        """Connect to IMAP server"""
        try:
            print(f"🔌 Connecting to {mailbox_config['email']}...")
            mail = imaplib.IMAP4_SSL(mailbox_config['imap_server'], mailbox_config['imap_port'])
            mail.login(mailbox_config['email'], mailbox_config['password'])
            mail.select('inbox')
            print("✅ IMAP connection successful")
            return mail
        except Exception as e:
            print(f"❌ IMAP connection failed for {mailbox_config['email']}: {e}")
            return None
    
    def is_marketing_email(self, email_content: str, sender_email: str) -> bool:
        """Enhanced marketing email detection"""
        marketing_score = 0
        full_content = email_content.lower()
        
        # Check for marketing keywords
        for keyword in self.marketing_keywords:
            if keyword in full_content:
                marketing_score += 1
        
        # Check sender domain patterns
        for domain_pattern in self.marketing_domains:
            if domain_pattern in sender_email.lower():
                marketing_score += 2
        
        # Unsubscribe link is strong indicator
        if 'unsubscribe' in full_content:
            marketing_score += 3
        
        # Check for noreply addresses
        if 'noreply' in sender_email.lower() or 'no-reply' in sender_email.lower():
            marketing_score += 3
        
        # Marketing threshold (lowered from 2 to 1 to catch more newsletter signups)
        return marketing_score >= 1
    
    def get_marketing_emails_from_mailbox(self, mailbox_config: Dict[str, str], days_back: int = 1) -> List[Dict]:
        """Get marketing emails from a single mailbox"""
        mail = self.connect_imap(mailbox_config)
        if not mail:
            return []
        
        try:
            # Search for recent emails
            since_date = (datetime.now() - timedelta(days=days_back)).strftime("%d-%b-%Y")
            status, messages = mail.search(None, f'SINCE "{since_date}"')
            
            if status != 'OK':
                print(f"❌ Failed to search emails in {mailbox_config['email']}")
                return []
            
            message_ids = messages[0].split()
            total_emails = len(message_ids)
            print(f"📧 Found {total_emails} total emails in {mailbox_config['email']}")
            
            if total_emails == 0:
                return []
            
            marketing_emails = []
            max_to_check = min(total_emails, 500)  # Increased from 50 to 500 to catch all the new signups!
            
            # Check recent emails
            for i, msg_id in enumerate(message_ids[-max_to_check:], 1):
                try:
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
                    
                    # Check if marketing email
                    if self.is_marketing_email(full_content, sender_email):
                        email_data = {
                            'message_id': msg_id.decode(),
                            'mailbox_email': mailbox_config['email'],
                            'sender_email': sender_email,
                            'sender_domain': sender_email.split('@')[-1] if '@' in sender_email else '',
                            'subject': email_message.get('Subject', ''),
                            'date_received': email_message.get('Date', ''),
                            'has_unsubscribe': 'unsubscribe' in full_content.lower(),
                        }
                        marketing_emails.append(email_data)
                        
                except Exception as e:
                    continue
            
            print(f"✅ Found {len(marketing_emails)} marketing emails in {mailbox_config['email']}")
            return marketing_emails
            
        except Exception as e:
            print(f"❌ Error processing {mailbox_config['email']}: {e}")
            return []
        finally:
            try:
                mail.close()
                mail.logout()
            except:
                pass
    
    def process_all_mailboxes(self, days_back: int = 3):
        """Process ALL mailboxes - this is what was missing!"""
        print("🚀 Starting FIXED Email Processing - ALL MAILBOXES")
        print("=" * 80)
        print(f"📧 Processing {len(self.mailboxes)} mailboxes")
        print(f"📅 Looking back {days_back} days")
        print("=" * 80)
        
        all_marketing_emails = []
        successful_mailboxes = 0
        failed_mailboxes = 0
        
        # Process EACH mailbox (this was the missing piece!)
        for i, mailbox_config in enumerate(self.mailboxes, 1):
            print(f"\n📬 Processing mailbox: {mailbox_config['email']} ({i}/{len(self.mailboxes)})")
            
            try:
                marketing_emails = self.get_marketing_emails_from_mailbox(mailbox_config, days_back)
                
                if marketing_emails:
                    all_marketing_emails.extend(marketing_emails)
                    successful_mailboxes += 1
                    print(f"   ✅ Success: {len(marketing_emails)} emails")
                else:
                    print(f"   ⚠️ No marketing emails found")
                    
            except Exception as e:
                failed_mailboxes += 1
                print(f"   ❌ Failed: {e}")
            
            # Progress update
            if i % 10 == 0:
                print(f"\n📊 Progress: {i}/{len(self.mailboxes)} mailboxes, {len(all_marketing_emails)} emails found so far")
        
        # Final summary
        total_emails = len(all_marketing_emails)
        print(f"\n" + "=" * 80)
        print("📊 FINAL RESULTS")
        print("=" * 80)
        print(f"📬 Mailboxes successfully processed: {successful_mailboxes}/{len(self.mailboxes)}")
        print(f"📧 Total marketing emails found: {total_emails}")
        print(f"❌ Failed mailboxes: {failed_mailboxes}")
        
        if total_emails > 0:
            # Show breakdown by sender domain
            domain_counts = {}
            for email_data in all_marketing_emails:
                domain = email_data['sender_domain']
                domain_counts[domain] = domain_counts.get(domain, 0) + 1
            
            print(f"\n📊 Top 15 sender domains:")
            for domain, count in sorted(domain_counts.items(), key=lambda x: x[1], reverse=True)[:15]:
                print(f"   {domain}: {count} emails")
            
            # Save results
            self.save_results(all_marketing_emails)
        
        print(f"\n🎯 COMPARISON:")
        print(f"   Before (1 mailbox): 55 emails")
        print(f"   After ({successful_mailboxes} mailboxes): {total_emails} emails")
        print(f"   Improvement: {total_emails - 55} more emails found!")
        
        return all_marketing_emails
    
    def save_results(self, all_emails: List[Dict]):
        """Save results to JSON file"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"fixed_marketing_emails_{timestamp}.json"
            
            results = {
                'timestamp': datetime.now().isoformat(),
                'total_emails': len(all_emails),
                'mailboxes_processed': len(self.mailboxes),
                'emails': all_emails
            }
            
            with open(filename, 'w') as f:
                json.dump(results, f, indent=2, default=str)
            
            print(f"💾 Results saved to: {filename}")
            
        except Exception as e:
            print(f"❌ Failed to save results: {e}")

def main():
    """Main function"""
    try:
        # Create fixed processor
        processor = FixedEmailProcessor()
        
        if len(processor.mailboxes) == 0:
            print("❌ No mailboxes loaded! Check mailboxaccounts.csv file")
            return
        
        # Process ALL mailboxes
        emails = processor.process_all_mailboxes(days_back=3)
        
        print(f"\n🎉 FIXED! Found {len(emails)} marketing emails across all mailboxes")
        
        if len(emails) > 100:
            print(f"✅ Success! This is much better than the previous 55 emails")
        elif len(emails) > 55:
            print(f"✅ Improvement! Found {len(emails) - 55} more emails than before")
        else:
            print(f"⚠️ Still only found {len(emails)} emails. May need to check:")
            print(f"   - Email credentials in CSV")
            print(f"   - Look back more days")
            print(f"   - Marketing email detection criteria")
        
    except Exception as e:
        print(f"❌ Processing failed: {e}")

if __name__ == "__main__":
    main() 