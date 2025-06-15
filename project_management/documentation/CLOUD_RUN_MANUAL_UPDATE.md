# 🚀 Manual Cloud Run Update Instructions

Since the automated deployment has build issues, here's how to manually update your Cloud Run service with the fixed code:

## 📋 **Step-by-Step Manual Update**

### **1. Go to Google Cloud Console**
- Open: https://console.cloud.google.com
- Navigate to **Cloud Run** > **email-analytics-pipeline**

### **2. Edit & Deploy New Revision**
- Click **"Edit & Deploy New Revision"**
- In the **Code** section, click **"Upload"**

### **3. Upload Fixed Files**
Upload these files from your local `src/` directory:
- ✅ `production_screenshot_gpt.py` (the fixed version)
- ✅ `mailboxaccounts.csv` (all 68 mailboxes)
- ✅ `requirements.txt`
- ✅ `app.py` (Flask wrapper)

### **4. Update Settings**
- **Memory**: 4 GiB
- **CPU**: 2
- **Timeout**: 3600 seconds
- **Max instances**: 1
- **Port**: 8080

### **5. Deploy**
- Click **"Deploy"**
- Wait for deployment to complete

## 🎯 **Expected Results After Update**

Your Cloud Run service will then:
- ✅ Process ALL 68 mailboxes (vs 1)
- ✅ Check ALL folders (INBOX + Spam + Junk + Promotions)
- ✅ Check 500 emails per folder (vs 50)
- ✅ Look back 3 days (vs 1 day)
- ✅ Use lowered detection threshold (score ≥1 vs ≥3)
- ✅ Find 800-1,500 emails (vs 55)

## 🔗 **Test the Fixed Service**

After deployment, test it:
```bash
curl -X POST https://email-analytics-pipeline-1050868696595.us-central1.run.app/process
```

## ⭐ **RECOMMENDED: Keep Using Local Fix**

Since your local fix already works perfectly:
```bash
python3 fix_email_processing.py
```

This gives you the same 15-20x improvement (872 emails vs 55) without deployment complexity! 