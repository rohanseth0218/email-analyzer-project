# Deploy 50K Email Automation to Google Cloud

## 🚀 Quick Setup Guide

### **1. Create Google Cloud Instance**

```bash
# Create a high-performance VM instance
gcloud compute instances create email-automation \
    --zone=us-central1-a \
    --machine-type=e2-standard-4 \
    --image-family=ubuntu-2004-lts \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size=50GB \
    --boot-disk-type=pd-standard \
    --preemptible \
    --tags=email-automation
```

**Instance Specs:**
- **Machine Type**: `e2-standard-4` (4 vCPUs, 16GB RAM)
- **Disk**: 50GB SSD
- **OS**: Ubuntu 20.04 LTS
- **Preemptible**: 80% cost savings (~$0.10/hour vs $0.50/hour)

### **2. Connect and Setup Environment**

```bash
# SSH into the instance
gcloud compute ssh email-automation --zone=us-central1-a

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Git
sudo apt install git -y

# Verify installations
node --version
npm --version
```

### **3. Deploy Your Code**

```bash
# Clone your repository or create project directory
mkdir email-automation && cd email-automation

# Copy your files (use one of these methods):

# Method A: Git clone (if you have a repo)
git clone <your-repo-url> .

# Method B: SCP files from local machine
# (Run this from your local machine)
gcloud compute scp --recurse ./email_analyzer_project/* email-automation:~/email-automation/ --zone=us-central1-a
```

### **4. Install Dependencies**

```bash
# Install npm packages
npm install

# Install additional packages if needed
npm install playwright axios csv-parse
```

### **5. Configure for Production**

Create a production configuration file:

```bash
nano production-config.js
```

```javascript
// production-config.js
module.exports = {
    // Use environment variables for sensitive data
    BROWSERBASE_API_KEY: process.env.BROWSERBASE_API_KEY,
    BROWSERBASE_PROJECT_ID: process.env.BROWSERBASE_PROJECT_ID,
    SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL,
    
    // Optimized settings for cloud
    MAX_CONCURRENT_SESSIONS: 75,  // Higher concurrency in cloud
    BATCH_SIZE: 100,
    
    // Enable production logging
    DEBUG_MODE: false,
    SCREENSHOTS: false,
    
    // Cloud-optimized timeouts
    NAVIGATION_TIMEOUT: 45000,
    FORM_INTERACTION_TIMEOUT: 15000
};
```

### **6. Set Environment Variables**

```bash
# Set your API keys (replace with actual values)
export BROWSERBASE_API_KEY="bb_live_FTV11nF0Vs1NR_T_rVBHRmQHv74"
export BROWSERBASE_PROJECT_ID="d277f38a-cc07-4af9-8473-83cefed0bfcd"
export SLACK_WEBHOOK_URL="your-slack-webhook-url-here"

# Make them persistent
echo 'export BROWSERBASE_API_KEY="bb_live_FTV11nF0Vs1NR_T_rVBHRmQHv74"' >> ~/.bashrc
echo 'export BROWSERBASE_PROJECT_ID="d277f38a-cc07-4af9-8473-83cefed0bfcd"' >> ~/.bashrc
echo 'export SLACK_WEBHOOK_URL="your-slack-webhook-url"' >> ~/.bashrc
source ~/.bashrc
```

### **7. Run the Automation**

```bash
# Create a screen session (so it continues running if you disconnect)
screen -S email-automation

# Run the automation
node run_full_automation.js

# Detach from screen (Ctrl+A, then D)
# You can now safely disconnect from SSH
```

### **8. Monitor Progress**

```bash
# Reconnect to check progress
gcloud compute ssh email-automation --zone=us-central1-a

# Reattach to screen session
screen -r email-automation

# Or check logs
tail -f logs/progress_full_run.json
tail -f logs/failed_domains_full_run.jsonl
```

## 💰 **Cost Estimation**

### **Preemptible Instance (Recommended)**
- **e2-standard-4**: ~$0.10/hour
- **50k domains @ 20 domains/minute**: ~42 hours
- **Total Cost**: ~$4.20

### **Regular Instance**
- **e2-standard-4**: ~$0.50/hour  
- **Total Cost**: ~$21.00

### **Additional Costs**
- **Storage**: $2-3/month (negligible for short runs)
- **Network**: Minimal (outbound data)

## 🔧 **Advanced Setup Options**

### **Option 1: Docker Deployment**

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

CMD ["node", "run_full_automation.js"]
```

Deploy with Cloud Run:
```bash
gcloud builds submit --tag gcr.io/[PROJECT-ID]/email-automation
gcloud run deploy --image gcr.io/[PROJECT-ID]/email-automation --platform managed
```

### **Option 2: Kubernetes Deployment**

For massive scale (100k+ domains):
```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: email-automation
spec:
  template:
    spec:
      containers:
      - name: automation
        image: gcr.io/[PROJECT-ID]/email-automation
        resources:
          requests:
            memory: "8Gi"
            cpu: "2"
      restartPolicy: Never
```

## 📊 **Monitoring & Alerts**

### **Set up Slack Notifications**
1. Create Slack webhook URL
2. Add to environment variables
3. Receive updates every 100 domains

### **Cloud Monitoring**
```bash
# Install monitoring agent
curl -sSO https://dl.google.com/cloudagents/add-google-cloud-ops-agent-repo.sh
sudo bash add-google-cloud-ops-agent-repo.sh --also-install
```

### **Custom Alerts**
- CPU usage > 90%
- Memory usage > 90%  
- Instance preemption (if using preemptible)

## 🛡️ **Security & Best Practices**

### **Firewall Rules**
```bash
# Only allow SSH (port 22)
gcloud compute firewall-rules create email-automation-ssh \
    --allow tcp:22 \
    --source-ranges 0.0.0.0/0 \
    --target-tags email-automation
```

### **Service Account**
```bash
# Create service account with minimal permissions
gcloud iam service-accounts create email-automation-sa
```

### **Backup & Recovery**
```bash
# Create disk snapshot before running
gcloud compute disks snapshot email-automation \
    --snapshot-names=email-automation-backup \
    --zone=us-central1-a
```

## 🚀 **Quick Start Commands**

```bash
# 1. Create instance
gcloud compute instances create email-automation --zone=us-central1-a --machine-type=e2-standard-4 --image-family=ubuntu-2004-lts --image-project=ubuntu-os-cloud --boot-disk-size=50GB --preemptible

# 2. SSH in
gcloud compute ssh email-automation --zone=us-central1-a

# 3. Setup (run these in the VM)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs git
mkdir email-automation && cd email-automation

# 4. Upload your files and run
# (Upload files via SCP or git clone)
npm install
screen -S automation
node run_full_automation.js
```

## 📞 **Support Commands**

```bash
# Check instance status
gcloud compute instances list

# Stop instance
gcloud compute instances stop email-automation --zone=us-central1-a

# Delete instance (when done)
gcloud compute instances delete email-automation --zone=us-central1-a

# View logs
gcloud logging read "resource.type=gce_instance AND resource.labels.instance_id=[INSTANCE-ID]"
```

---

## 💡 **Recommendation**

**Deploy to Google Cloud with preemptible instance** for:
- 💰 Cost-effective (~$4 total)
- 🔒 Reliable 24/7 operation  
- 📱 Remote monitoring via Slack
- ⚡ Better performance than local laptop

The automation is perfectly suited for cloud deployment with its comprehensive logging, error handling, and Slack notifications! 