#!/usr/bin/env python3
"""
Quick diagnostic script to identify what's hanging
"""

import os
import sys
import time
from datetime import datetime

def test_step(step_name, func):
    """Test a step with timing"""
    print(f"🔍 Testing: {step_name}")
    start_time = time.time()
    try:
        result = func()
        elapsed = time.time() - start_time
        print(f"✅ {step_name} completed in {elapsed:.2f}s")
        return result
    except Exception as e:
        elapsed = time.time() - start_time
        print(f"❌ {step_name} failed after {elapsed:.2f}s: {e}")
        return None

def test_imports():
    """Test if imports work"""
    import imaplib
    import ssl
    import email
    import csv
    import json
    from google.cloud import bigquery
    from google.oauth2 import service_account
    print("   All imports successful")
    return True

def test_credentials():
    """Test BigQuery credentials"""
    from google.oauth2 import service_account
    credentials = service_account.Credentials.from_service_account_file('bigquery_credentials.json')
    print(f"   Credentials loaded for project: {credentials.project_id}")
    return credentials

def test_bigquery():
    """Test BigQuery connection"""
    from google.cloud import bigquery
    from google.oauth2 import service_account
    
    credentials = service_account.Credentials.from_service_account_file('bigquery_credentials.json')
    client = bigquery.Client(credentials=credentials, project='instant-ground-394115')
    
    # Try a simple query
    query = 'SELECT 1 as test'
    query_job = client.query(query)
    results = query_job.result()
    count = sum(1 for _ in results)
    print(f"   BigQuery test query returned {count} row")
    return client

def test_mailbox_file():
    """Test loading mailboxes"""
    if not os.path.exists('mailboxaccounts.csv'):
        raise Exception("mailboxaccounts.csv not found")
    
    with open('mailboxaccounts.csv', 'r') as f:
        lines = f.readlines()
    
    print(f"   Found {len(lines)-1} mailboxes in CSV")
    return len(lines) - 1

def test_first_mailbox():
    """Test connecting to first mailbox"""
    import imaplib
    import ssl
    
    with open('mailboxaccounts.csv', 'r') as f:
        lines = f.readlines()
    
    if len(lines) < 2:
        raise Exception("No mailboxes in CSV")
    
    # Parse first mailbox
    values = lines[1].split(',')
    mailbox = {
        'email': values[0].strip(),
        'password': values[4].strip(),
        'host': values[5].strip(),
        'port': int(values[6].strip())
    }
    
    print(f"   Connecting to {mailbox['email']} on {mailbox['host']}:{mailbox['port']}")
    
    # Try connection with short timeout
    mail = imaplib.IMAP4_SSL(mailbox['host'], mailbox['port'], 
                            ssl_context=ssl.create_default_context())
    mail.login(mailbox['email'], mailbox['password'])
    mail.select('INBOX')
    
    # Quick search
    status, message_ids = mail.search(None, 'ALL')
    total_emails = len(message_ids[0].split()) if message_ids[0] else 0
    
    mail.logout()
    print(f"   Connected successfully, found {total_emails} total emails")
    return True

def main():
    print("🚀 DIAGNOSTIC MODE")
    print("=" * 50)
    print(f"Starting at: {datetime.now()}")
    print("=" * 50)
    
    # Test each component
    test_step("Python Imports", test_imports)
    test_step("Credentials File", test_credentials)
    test_step("BigQuery Connection", test_bigquery)
    test_step("Mailbox CSV File", test_mailbox_file)
    test_step("First Mailbox Connection", test_first_mailbox)
    
    print("\n" + "=" * 50)
    print("🎉 ALL DIAGNOSTICS PASSED!")
    print("=" * 50)

if __name__ == "__main__":
    main() 