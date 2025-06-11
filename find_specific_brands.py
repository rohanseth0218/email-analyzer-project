#!/usr/bin/env python3
import imaplib
import ssl
import email
from datetime import datetime, timedelta

# Target brands from Instantly screenshot
target_brands = [
    'aweinspired.com',
    'legionathletics.com', 
    'usagundamstore.com',
    'harrisseeds.com',
    'purple-brand.com',
    'takeyausa.com'
]

# Connect
mail = imaplib.IMAP4_SSL('imapn2.mymailsystem.com', 993, ssl_context=ssl.create_default_context())
mail.login('rohan.seth@openripplestudio.info', 'lnfkG$4!MFPH')
mail.select('INBOX')

# Search last 30 days
since_date = (datetime.now() - timedelta(days=30)).strftime('%d-%b-%Y')
status, message_ids = mail.search(None, f'SINCE {since_date}')

print(f"Found {len(message_ids[0].split())} emails in last 30 days")
print("Searching for specific brands...")

found_emails = []

for msg_id in message_ids[0].split():
    try:
        status, msg_data = mail.fetch(msg_id, '(RFC822)')
        email_body = msg_data[0][1]
        email_message = email.message_from_bytes(email_body)
        
        sender = email_message.get('From', '').lower()
        subject = email_message.get('Subject', '')
        date = email_message.get('Date', '')
        
        # Check if any target brand is in sender
        for brand in target_brands:
            if brand.lower() in sender:
                found_emails.append({
                    'brand': brand,
                    'sender': sender,
                    'subject': subject,
                    'date': date
                })
                print(f"\n✅ FOUND: {brand}")
                print(f"   From: {sender}")
                print(f"   Subject: {subject}")
                print(f"   Date: {date}")
                
    except Exception as e:
        continue

mail.logout()

print(f"\n📊 SUMMARY:")
print(f"Total brands found: {len(found_emails)}")
for brand in target_brands:
    count = sum(1 for email in found_emails if email['brand'] == brand)
    status = "✅" if count > 0 else "❌"
    print(f"{status} {brand}: {count} emails") 