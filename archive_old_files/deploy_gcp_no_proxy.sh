#!/bin/bash

echo "🚀 Deploying Email Automation to Google Cloud"
echo "=============================================="
echo "⚡ 50 concurrent sessions (no proxies)"
echo "📊 Resuming from batch 31 (3000 domains processed)"
echo "🎯 ~47k domains remaining"
echo ""

# Configuration
INSTANCE_NAME="email-automation-no-proxy"
ZONE="us-central1-a"
MACHINE_TYPE="e2-standard-8"  # 8 vCPUs, 32GB RAM for 50 sessions

echo "🔧 Creating Google Cloud instance..."
gcloud compute instances create $INSTANCE_NAME \
    --zone=$ZONE \
    --machine-type=$MACHINE_TYPE \
    --image-family=ubuntu-2004-lts \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size=50GB \
    --boot-disk-type=pd-ssd \
    --tags=email-automation \
    --metadata-from-file startup-script=startup_script.sh

echo "✅ Instance created: $INSTANCE_NAME"
echo ""

echo "📤 Uploading files to cloud instance..."
# Wait for instance to be ready
sleep 30

# Upload project files
gcloud compute scp --recurse \
    Storedomains.csv \
    mailboxaccounts.csv \
    run_full_automation_cloud.js \
    package.json \
    logs/ \
    $INSTANCE_NAME:~/email-automation/ \
    --zone=$ZONE

echo "✅ Files uploaded"
echo ""

echo "🔧 Setting up environment on cloud instance..."
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="
    cd ~/email-automation
    
    # Install dependencies
    npm install
    
    # Set environment variables
    export BROWSERBASE_API_KEY='bb_live_FTV11nF0Vs1NR_T_rVBHRmQHv74'
    export BROWSERBASE_PROJECT_ID='d277f38a-cc07-4af9-8473-83cefed0bfcd'
    export SLACK_WEBHOOK_URL='https://hooks.slack.com/services/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'
    
    # Make environment variables persistent
    echo 'export BROWSERBASE_API_KEY=\"bb_live_FTV11nF0Vs1NR_T_rVBHRmQHv74\"' >> ~/.bashrc
    echo 'export BROWSERBASE_PROJECT_ID=\"d277f38a-cc07-4af9-8473-83cefed0bfcd\"' >> ~/.bashrc
    echo 'export SLACK_WEBHOOK_URL=\"https://hooks.slack.com/services/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\"' >> ~/.bashrc
    
    echo '✅ Environment setup complete'
"

echo "🚀 Starting automation in screen session..."
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="
    cd ~/email-automation
    source ~/.bashrc
    
    # Start in screen session
    screen -dmS automation node run_full_automation_cloud.js
    
    echo '🎉 Automation started in background!'
    echo '📊 Monitor with: screen -r automation'
    echo '📋 Or check logs: tail -f logs/progress_cloud_run.json'
"

echo ""
echo "🎉 DEPLOYMENT COMPLETE!"
echo "========================"
echo "📍 Instance: $INSTANCE_NAME"
echo "🌐 Zone: $ZONE"
echo "⚡ Sessions: 50 concurrent (no proxies)"
echo "📊 Status: Resuming from batch 31"
echo ""
echo "📋 Monitor commands:"
echo "  gcloud compute ssh $INSTANCE_NAME --zone=$ZONE"
echo "  screen -r automation"
echo "  tail -f logs/progress_cloud_run.json"
echo ""
echo "💰 Estimated cost: ~\$0.80/hour (~\$20 total for completion)"
echo "📨 Slack notifications will resume shortly!" 