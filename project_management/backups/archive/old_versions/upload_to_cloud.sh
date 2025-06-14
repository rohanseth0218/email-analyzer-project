#!/bin/bash

echo "Uploading essential files to cloud instance..."

# Upload the main automation file
gcloud compute scp run_full_automation_cloud.js email-automation-no-proxy:~ --zone=us-central1-a

# Upload package.json for dependencies
gcloud compute scp package.json email-automation-no-proxy:~ --zone=us-central1-a

# Upload the domain and email data files
gcloud compute scp Storedomains.csv email-automation-no-proxy:~ --zone=us-central1-a
gcloud compute scp mailboxaccounts.csv email-automation-no-proxy:~ --zone=us-central1-a

# Upload logs directory if it exists
if [ -d "logs" ]; then
    gcloud compute scp --recurse logs/ email-automation-no-proxy:~/logs/ --zone=us-central1-a
fi

echo "Files uploaded successfully!"
echo "Now SSH into the instance and run:"
echo "cd ~"
echo "npm install"
echo "node run_full_automation_cloud.js" 