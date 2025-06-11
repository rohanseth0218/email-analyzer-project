#!/bin/bash

echo "🚀 QUICK GOOGLE CLOUD DEPLOYMENT"
echo "================================"
echo "This will:"
echo "✅ Create a powerful cloud instance"
echo "✅ Upload all your files"
echo "✅ Resume from batch 31 (3000 domains done)"
echo "✅ Run 50 concurrent sessions (NO PROXIES)"
echo "✅ Send Slack notifications"
echo ""
echo "💰 Cost: ~$20 total to complete all 47k remaining domains"
echo ""

read -p "🚀 Ready to deploy? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

# Make scripts executable
chmod +x deploy_gcp_no_proxy.sh
chmod +x startup_script.sh

# Run deployment
./deploy_gcp_no_proxy.sh

echo ""
echo "🎉 Deployment initiated!"
echo "📱 Check Slack for notifications in 2-3 minutes" 