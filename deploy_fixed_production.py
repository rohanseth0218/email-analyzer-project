#!/usr/bin/env python3
"""
Deploy Fixed Production Script to Google Cloud

This script uploads the fixed email processing script that:
1. Uses ALL 68 mailboxes from CSV
2. Checks ALL folders (inbox, spam, junk, promotions)
3. Uses improved detection criteria
4. Processes 500 emails per folder (vs 50)
5. Looks back 3 days (vs 1 day)
"""

import subprocess
import os
import sys

def run_command(command, description):
    """Run a shell command and print results"""
    print(f"\n🚀 {description}")
    print(f"Running: {command}")
    
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True)
        
        if result.returncode == 0:
            print(f"✅ Success!")
            if result.stdout:
                print(f"Output: {result.stdout.strip()}")
        else:
            print(f"❌ Failed!")
            if result.stderr:
                print(f"Error: {result.stderr.strip()}")
            return False
            
        return True
        
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False

def deploy_to_gcloud():
    """Deploy the fixed script to Google Cloud"""
    
    print("🚀 DEPLOYING FIXED EMAIL PROCESSING TO GOOGLE CLOUD")
    print("=" * 70)
    print("📧 Will now process ALL 68 mailboxes")
    print("📁 Will check ALL folders (inbox, spam, junk, promotions)")
    print("🔍 Will use improved detection (score >= 1)")
    print("📊 Will check 500 emails per folder (vs 50)")
    print("📅 Will look back 3 days (vs 1 day)")
    print("=" * 70)
    
    # Check if we're authenticated with gcloud
    if not run_command("gcloud auth list --filter=status:ACTIVE --format='value(account)'", 
                      "Checking Google Cloud authentication"):
        print("\n❌ Please run: gcloud auth login")
        return False
    
    # Set the project (update this to your actual project ID)
    project_id = input("\n📝 Enter your Google Cloud Project ID: ").strip()
    if not project_id:
        print("❌ Project ID required")
        return False
    
    if not run_command(f"gcloud config set project {project_id}", 
                      f"Setting project to {project_id}"):
        return False
    
    # Upload the fixed production script
    print(f"\n📤 Uploading fixed production script...")
    
    # Copy the fixed script to a cloud storage bucket or directly to compute instance
    vm_name = input("📝 Enter your VM instance name: ").strip()
    zone = input("📝 Enter your VM zone (e.g., us-central1-a): ").strip()
    
    if not vm_name or not zone:
        print("❌ VM name and zone required")
        return False
    
    # Upload the fixed production script
    if not run_command(
        f"gcloud compute scp ./src/production_screenshot_gpt.py {vm_name}:~/email_analyzer_project/src/ --zone={zone}",
        "Uploading fixed production script"
    ):
        return False
    
    # Upload the mailbox CSV file
    if not run_command(
        f"gcloud compute scp ./mailboxaccounts.csv {vm_name}:~/email_analyzer_project/ --zone={zone}",
        "Uploading mailbox accounts CSV"
    ):
        return False
    
    # Restart the email processing service
    restart_command = f"""gcloud compute ssh {vm_name} --zone={zone} --command="
        cd ~/email_analyzer_project && 
        pkill -f production_screenshot_gpt.py;
        sleep 2;
        nohup python3 src/production_screenshot_gpt.py > email_processing_fixed.log 2>&1 &
        echo 'Fixed email processing started with PID:' \$(pgrep -f production_screenshot_gpt.py)
    \""""
    
    if not run_command(restart_command, "Restarting email processing with fixed script"):
        return False
    
    # Show status
    status_command = f"""gcloud compute ssh {vm_name} --zone={zone} --command="
        cd ~/email_analyzer_project && 
        echo '📊 Process status:' && ps aux | grep production_screenshot_gpt.py | grep -v grep;
        echo '📝 Last 10 log lines:' && tail -n 10 email_processing_fixed.log 2>/dev/null || echo 'Log not ready yet'
    \""""
    
    run_command(status_command, "Checking deployment status")
    
    print(f"\n🎉 DEPLOYMENT COMPLETE!")
    print(f"✅ Fixed production script deployed to {vm_name}")
    print(f"✅ Now processing ALL 68 mailboxes")
    print(f"✅ Now checking ALL folders (spam, junk, etc.)")
    print(f"✅ Should find 10-15x more emails!")
    
    print(f"\n📋 Next steps:")
    print(f"1. Monitor logs: gcloud compute ssh {vm_name} --zone={zone} --command='tail -f ~/email_analyzer_project/email_processing_fixed.log'")
    print(f"2. Check progress in ~10 minutes")
    print(f"3. Should see 1000+ emails instead of 55!")
    
    return True

def verify_files():
    """Verify required files exist"""
    required_files = [
        './src/production_screenshot_gpt.py',
        './mailboxaccounts.csv'
    ]
    
    for file_path in required_files:
        if not os.path.exists(file_path):
            print(f"❌ Required file missing: {file_path}")
            return False
        else:
            print(f"✅ Found: {file_path}")
    
    return True

def main():
    """Main deployment function"""
    print("🔍 Verifying files...")
    if not verify_files():
        print("❌ Missing required files. Please run from project root.")
        return
    
    print("✅ All files found!")
    
    # Confirm deployment
    print(f"\n⚠️  This will deploy the fixed email processing script to Google Cloud.")
    print(f"⚠️  It will replace the current script and restart the service.")
    confirm = input(f"\n📝 Continue? (y/N): ").strip().lower()
    
    if confirm != 'y':
        print("❌ Deployment cancelled")
        return
    
    # Deploy
    if deploy_to_gcloud():
        print(f"\n🎉 SUCCESS! Fixed email processing deployed to Google Cloud")
    else:
        print(f"\n❌ FAILED! Deployment unsuccessful")

if __name__ == "__main__":
    main() 