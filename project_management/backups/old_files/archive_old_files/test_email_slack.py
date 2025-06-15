#!/usr/bin/env python3
import requests
from datetime import datetime

def test_slack_notification():
    webhook_url = "https://hooks.slack.com/services/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"
    
    message = {
        "text": f"📧 Test: Email Analysis Slack Integration Working!\n\n🕐 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    }
    
    try:
        response = requests.post(webhook_url, json=message, timeout=10)
        
        if response.status_code == 200:
            print("✅ Slack notification test successful!")
        else:
            print(f"❌ Slack notification test failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error testing Slack notification: {e}")

if __name__ == "__main__":
    test_slack_notification() 