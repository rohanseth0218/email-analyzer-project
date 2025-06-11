#!/usr/bin/env python3
"""
Quick Fix for Cloud Run Email Service

Since your local fix found 872 emails (vs 55), this script can trigger your 
Cloud Run service to process emails with the same improved settings.
"""

import requests
import json
import time

def trigger_cloud_run_processing():
    """Trigger the Cloud Run service to process emails"""
    
    service_url = "https://email-analytics-pipeline-1050868696595.us-central1.run.app"
    
    print("🚀 TRIGGERING CLOUD RUN EMAIL PROCESSING")
    print("=" * 60)
    print(f"🔗 Service URL: {service_url}")
    print("📧 Will request processing of ALL mailboxes")
    print("=" * 60)
    
    # Test if service is reachable
    try:
        print("🔍 Testing service availability...")
        response = requests.get(service_url, timeout=10)
        print(f"✅ Service is reachable (Status: {response.status_code})")
        
        if response.status_code == 200:
            print("✅ Service is running and ready!")
        else:
            print(f"⚠️ Service returned status {response.status_code}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Error reaching service: {e}")
        return False
    
    # Try to trigger email processing
    try:
        print("\n🚀 Triggering email processing...")
        
        # Trigger the email processing endpoint
        process_response = requests.post(f"{service_url}/process", 
                                       timeout=300,  # 5 minutes
                                       json={"all_mailboxes": True})
        
        if process_response.status_code == 200:
            print("✅ Email processing triggered successfully!")
            result = process_response.json()
            print(f"📊 Result: {result}")
            return True
        else:
            print(f"⚠️ Processing request returned status {process_response.status_code}")
            print(f"Response: {process_response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Error triggering processing: {e}")
        return False
    
    return False

def check_service_logs():
    """Check the service logs"""
    print("\n📝 Checking service logs...")
    
    import subprocess
    
    try:
        result = subprocess.run([
            "gcloud", "logs", "tail", "email-analytics-pipeline", 
            "--region=us-central1", "--limit=20"
        ], capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0:
            print("📝 Recent logs:")
            print(result.stdout)
        else:
            print(f"❌ Error getting logs: {result.stderr}")
            
    except Exception as e:
        print(f"❌ Error checking logs: {e}")

def manual_fix_approach():
    """Provide manual fix instructions"""
    
    print("\n" + "=" * 80)
    print("🛠️  MANUAL FIX APPROACH")
    print("=" * 80)
    
    print("""
Since Cloud Run deployment is having issues, here's what you can do:

📋 OPTION 1: Manual File Update
1. Go to Google Cloud Console: https://console.cloud.google.com
2. Navigate to Cloud Run > email-analytics-pipeline 
3. Click 'Edit & Deploy New Revision'
4. Update the source code with the fixed production_screenshot_gpt.py
5. Include the mailboxaccounts.csv file

📋 OPTION 2: Local Processing (Recommended)
Your local fix already works perfectly! You found 872 emails vs 55.
You can run the fixed script locally and get the same results:

    python3 fix_email_processing.py

📊 EXPECTED RESULTS FROM FIX:
- Before: 55 emails from 1 mailbox
- After: 800-1,500 emails from 68 mailboxes
- Improvement: 15-20x more emails!

🔑 KEY FIXES IMPLEMENTED:
✅ ALL 68 mailboxes (vs 1)
✅ ALL folders (INBOX + Spam + Junk + Promotions)
✅ 500 emails per folder (vs 50)
✅ 3-day lookback (vs 1 day)
✅ Lowered detection threshold (score ≥1 vs ≥3)
""")

def main():
    """Main function"""
    
    print("🔧 Cloud Run Email Service Quick Fix")
    print("=" * 50)
    
    # Try to trigger the service
    if trigger_cloud_run_processing():
        print("\n🎉 SUCCESS! Processing triggered on Cloud Run")
        
        # Wait and check logs
        print("\n⏳ Waiting 30 seconds for processing to start...")
        time.sleep(30)
        check_service_logs()
        
    else:
        print("\n⚠️ Cloud Run triggering failed")
        manual_fix_approach()
        
        # Still show how to check logs
        check_service_logs()

if __name__ == "__main__":
    main() 