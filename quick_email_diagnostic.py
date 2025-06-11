#!/usr/bin/env python3
"""
Quick Email Diagnostic - Sample a few mailboxes to understand the email situation
"""

import imaplib
import email
import csv
from datetime import datetime, timedelta

def load_sample_mailboxes(count=5):
    """Load first few mailboxes for quick testing"""
    mailboxes = []
    with open('./mailboxaccounts.csv', 'r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        
        for i, row in enumerate(reader, 1):
            if i > count:
                break
                
            email_address = row.get('﻿Email') or row.get('Email') or row.get('email')
            imap_password = row.get('IMAP Password', '')
            
            if email_address and imap_password:
                mailbox = {
                    'email': email_address.strip(),
                    'password': imap_password.strip(),
                    'imap_server': 'imapn2.mymailsystem.com',
                    'imap_port': 993
                }
                mailboxes.append(mailbox)
    
    return mailboxes

def quick_mailbox_analysis(mailbox_config, days_back=3):
    """Quick analysis of a single mailbox"""
    try:
        print(f"\n📧 Quick analysis of {mailbox_config['email']}...")
        
        # Connect
        mail = imaplib.IMAP4_SSL(mailbox_config['imap_server'], mailbox_config['imap_port'])
        mail.login(mailbox_config['email'], mailbox_config['password'])
        mail.select('inbox')
        
        # Get recent emails
        since_date = (datetime.now() - timedelta(days=days_back)).strftime("%d-%b-%Y")
        status, messages = mail.search(None, f'SINCE "{since_date}"')
        
        if status != 'OK':
            return None
        
        message_ids = messages[0].split()
        total_recent = len(message_ids)
        
        print(f"   📧 Total emails in last {days_back} days: {total_recent}")
        
        # Sample last 20 emails to see what we're getting
        sample_size = min(20, total_recent)
        sample_ids = message_ids[-sample_size:] if message_ids else []
        
        email_types = {
            'welcome_emails': 0,
            'newsletters': 0, 
            'confirmations': 0,
            'promotional': 0,
            'other': 0
        }
        
        unique_domains = set()
        
        for msg_id in sample_ids:
            try:
                status, msg_data = mail.fetch(msg_id, '(RFC822)')
                if status != 'OK':
                    continue
                
                email_body = msg_data[0][1]
                email_message = email.message_from_bytes(email_body)
                
                subject = email_message.get('Subject', '').lower()
                sender = email_message.get('From', '').lower()
                
                # Extract domain
                if '@' in sender:
                    domain = sender.split('@')[-1].split('>')[0]
                    unique_domains.add(domain)
                
                # Categorize
                if 'welcome' in subject or 'thank you for signing up' in subject:
                    email_types['welcome_emails'] += 1
                elif 'newsletter' in subject or 'unsubscribe' in sender:
                    email_types['newsletters'] += 1
                elif 'confirm' in subject or 'verify' in subject:
                    email_types['confirmations'] += 1
                elif any(word in subject for word in ['sale', 'offer', 'discount', 'deal', 'promo']):
                    email_types['promotional'] += 1
                else:
                    email_types['other'] += 1
                    
            except Exception as e:
                continue
        
        mail.close()
        mail.logout()
        
        print(f"   📊 Sample of last {sample_size} emails:")
        for email_type, count in email_types.items():
            if count > 0:
                print(f"      {email_type}: {count}")
        
        print(f"   🌐 Unique sender domains: {len(unique_domains)}")
        if len(unique_domains) <= 10:
            print(f"   🔍 Domains: {', '.join(list(unique_domains)[:10])}")
        
        return {
            'total_recent': total_recent,
            'email_types': email_types,
            'unique_domains': len(unique_domains),
            'sample_domains': list(unique_domains)[:10]
        }
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return None

def main():
    print("🔍 Quick Email Diagnostic - Sampling Mailboxes")
    print("=" * 60)
    
    # Load sample mailboxes
    mailboxes = load_sample_mailboxes(5)
    print(f"📧 Testing {len(mailboxes)} sample mailboxes...")
    
    total_emails_found = 0
    successful_checks = 0
    all_domains = set()
    
    for mailbox in mailboxes:
        result = quick_mailbox_analysis(mailbox, days_back=3)
        if result:
            total_emails_found += result['total_recent']
            successful_checks += 1
            all_domains.update(result['sample_domains'])
    
    print(f"\n" + "=" * 60)
    print("📊 DIAGNOSTIC SUMMARY")
    print("=" * 60)
    print(f"✅ Successful mailbox checks: {successful_checks}/{len(mailboxes)}")
    print(f"📧 Total emails found in sample: {total_emails_found}")
    print(f"📊 Average emails per mailbox: {total_emails_found / successful_checks if successful_checks > 0 else 0:.1f}")
    print(f"🌐 Total unique domains seen: {len(all_domains)}")
    
    # Projection
    if successful_checks > 0:
        avg_per_mailbox = total_emails_found / successful_checks
        projected_total = avg_per_mailbox * 68
        print(f"\n🎯 PROJECTION FOR ALL 68 MAILBOXES:")
        print(f"   Estimated total emails: {projected_total:.0f}")
        
        if projected_total > 1000:
            print(f"   ✅ This looks much better! Should find {projected_total:.0f} emails")
        elif projected_total > 500:
            print(f"   ⚠️ Moderate amount - {projected_total:.0f} emails (expected more for 1500 signups)")
        else:
            print(f"   ❌ Still low - {projected_total:.0f} emails (much less than 1500 expected)")
            print(f"   💡 Suggestions:")
            print(f"      - Check if emails are going to spam/junk folders")
            print(f"      - Look back more days (signups may still be arriving)")
            print(f"      - Some brands may send welcome emails with delay")

if __name__ == "__main__":
    main() 