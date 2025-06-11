#!/usr/bin/env python3
"""
Deploy Fixed Email Processing to Cloud Run Service

This script updates your Cloud Run service with the fixed email processing that:
1. Uses ALL 68 mailboxes from CSV
2. Checks ALL folders (inbox, spam, junk, promotions)  
3. Uses improved detection criteria
4. Processes 500 emails per folder (vs 50)
5. Looks back 3 days (vs 1 day)
"""

import subprocess
import os
import sys
import shutil
import tempfile

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

def create_deployment_package():
    """Create a deployment package with fixed code"""
    
    print("📦 Creating deployment package with fixed code...")
    
    # Create temporary deployment directory
    deploy_dir = tempfile.mkdtemp(prefix="email_deploy_")
    print(f"📁 Deployment directory: {deploy_dir}")
    
    try:
        # Copy source files
        src_dir = os.path.join(deploy_dir, "src")
        os.makedirs(src_dir, exist_ok=True)
        
        # Copy the fixed production script
        shutil.copy2("./src/production_screenshot_gpt.py", src_dir)
        print("✅ Copied fixed production_screenshot_gpt.py")
        
        # Copy mailbox accounts
        shutil.copy2("./mailboxaccounts.csv", deploy_dir)
        print("✅ Copied mailboxaccounts.csv")
        
        # Create/update requirements.txt if needed
        requirements = """
playwright==1.40.0
openai==1.3.0
requests==2.31.0
Pillow==10.0.1
google-cloud-storage==2.10.0
google-cloud-secretmanager==2.16.4
"""
        
        with open(os.path.join(deploy_dir, "requirements.txt"), "w") as f:
            f.write(requirements.strip())
        print("✅ Created requirements.txt")
        
        # Create Dockerfile if it doesn't exist
        dockerfile_content = """
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    wget \\
    gnupg \\
    && rm -rf /var/lib/apt/lists/*

# Install Playwright
RUN pip install playwright==1.40.0
RUN playwright install chromium
RUN playwright install-deps chromium

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Set environment variables
ENV PYTHONPATH=/app
ENV PORT=8080

# Run the application
CMD ["python", "src/production_screenshot_gpt.py"]
"""
        
        with open(os.path.join(deploy_dir, "Dockerfile"), "w") as f:
            f.write(dockerfile_content.strip())
        print("✅ Created Dockerfile")
        
        # Create .gcloudignore
        gcloudignore_content = """
.git
.gitignore
README.md
*.log
__pycache__/
*.pyc
.env
.venv
node_modules/
"""
        
        with open(os.path.join(deploy_dir, ".gcloudignore"), "w") as f:
            f.write(gcloudignore_content.strip())
        print("✅ Created .gcloudignore")
        
        return deploy_dir
        
    except Exception as e:
        print(f"❌ Error creating deployment package: {e}")
        return None

def deploy_to_cloud_run():
    """Deploy the fixed service to Cloud Run"""
    
    print("🚀 DEPLOYING FIXED EMAIL PROCESSING TO CLOUD RUN")
    print("=" * 70)
    print("📧 Will now process ALL 68 mailboxes")
    print("📁 Will check ALL folders (inbox, spam, junk, promotions)")
    print("🔍 Will use improved detection (score >= 1)")
    print("📊 Will check 500 emails per folder (vs 50)")
    print("📅 Will look back 3 days (vs 1 day)")
    print("=" * 70)
    
    # Check authentication
    if not run_command("gcloud auth list --filter=status:ACTIVE --format='value(account)'", 
                      "Checking Google Cloud authentication"):
        print("\n❌ Please run: gcloud auth login")
        return False
    
    # Set project
    project_id = "instant-ground-394115"  # From your service description
    if not run_command(f"gcloud config set project {project_id}", 
                      f"Setting project to {project_id}"):
        return False
    
    # Create deployment package
    deploy_dir = create_deployment_package()
    if not deploy_dir:
        return False
    
    try:
        # Change to deployment directory
        original_dir = os.getcwd()
        os.chdir(deploy_dir)
        
        # Deploy to Cloud Run
        deploy_command = f"""gcloud run deploy email-analytics-pipeline \\
            --source . \\
            --region us-central1 \\
            --platform managed \\
            --allow-unauthenticated \\
            --memory 4Gi \\
            --cpu 2 \\
            --timeout 3600 \\
            --max-instances 1 \\
            --concurrency 1"""
        
        if not run_command(deploy_command, "Deploying fixed service to Cloud Run"):
            return False
        
        # Get service URL
        if not run_command("gcloud run services describe email-analytics-pipeline --region=us-central1 --format='value(status.url)'", 
                          "Getting service URL"):
            return False
        
        print(f"\n🎉 DEPLOYMENT COMPLETE!")
        print(f"✅ Fixed email processing deployed to Cloud Run")
        print(f"✅ Now processing ALL 68 mailboxes")
        print(f"✅ Now checking ALL folders (spam, junk, etc.)")
        print(f"✅ Should find 10-15x more emails!")
        
        print(f"\n📋 Next steps:")
        print(f"1. Service will auto-start processing emails")
        print(f"2. Check logs: gcloud logs tail email-analytics-pipeline --region=us-central1")
        print(f"3. Should see 1000+ emails instead of 55!")
        
        return True
        
    except Exception as e:
        print(f"❌ Deployment error: {e}")
        return False
    finally:
        # Cleanup
        os.chdir(original_dir)
        shutil.rmtree(deploy_dir, ignore_errors=True)

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
    print(f"\n⚠️  This will deploy the fixed email processing to Cloud Run.")
    print(f"⚠️  It will replace the current service with the improved version.")
    confirm = input(f"\n📝 Continue? (y/N): ").strip().lower()
    
    if confirm != 'y':
        print("❌ Deployment cancelled")
        return
    
    # Deploy
    if deploy_to_cloud_run():
        print(f"\n🎉 SUCCESS! Fixed email processing deployed to Cloud Run")
        print(f"\n🔗 Your service: https://email-analytics-pipeline-1050868696595.us-central1.run.app")
    else:
        print(f"\n❌ FAILED! Deployment unsuccessful")

if __name__ == "__main__":
    main() 