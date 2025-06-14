# Email Analyzer Project - Organized by Business Function

## 🎯 **Project Overview**

This workspace contains **4 distinct business projects**, each with its own purpose and files:

---

## 📧 **1. NEWSLETTER AUTOMATION** 
*Automated newsletter signup system*

### 🚀 **What it does:**
- Automatically signs up for newsletters from e-commerce domains
- Processes signup results and tracks success/failure rates
- Runs via GitHub Actions with 75% success rate

### 📁 **Project Structure:**
```
newsletter_automation/
├── automation_scripts/
│   ├── full_newsletter_automation_clean.js     # Main automation script
│   └── newsletter_signup_bigquery.py           # Data processor
├── workflows/.github/                           # GitHub Actions
├── logs/                                       # Automation logs & results
├── config/                                     # Configuration files
└── src/                                        # Core automation modules
```

### ▶️ **How to run:**
```bash
cd newsletter_automation/automation_scripts
node full_newsletter_automation_clean.js
```

---

## 📊 **2. EMAIL ANALYTICS**
*Email data analysis and revenue insights*

### 🚀 **What it does:**
- Analyzes email marketing data from collected newsletters
- Generates revenue band analysis (companies by revenue size)
- Exports email data for further analysis

### 📁 **Project Structure:**
```
email_analytics/
├── queries/
│   ├── simple_revenue_analysis.sql             # Revenue analysis query
│   └── revenue_band_analysis.sql               # Revenue band breakdown
├── exports/
│   └── export_emails_to_bigquery.py            # Email export tool
└── data/                                       # Analysis datasets
```

### ▶️ **How to run:**
```bash
cd email_analytics/exports
python export_emails_to_bigquery.py
```

---

## 🗄️ **3. BIGQUERY TOOLS**
*Data warehouse management and uploads*

### 🚀 **What it does:**
- Uploads newsletter signup data to BigQuery
- Manages BigQuery tables and schemas
- Handles large dataset uploads (9,911+ records)

### 📁 **Project Structure:**
```
bigquery_tools/
├── upload_scripts/
│   └── upload_newsletter_signup_to_bigquery.py # Main upload script
├── table_management/                           # Schema management
└── data_files/
    └── bigquery_upload_data.json               # Upload dataset (2.8MB)
```

### ▶️ **How to run:**
```bash
cd bigquery_tools/upload_scripts
python upload_newsletter_signup_to_bigquery.py
```

### 📊 **BigQuery Tables:**
- **Project**: `instant-ground-394115`
- **Tables**: `newsletter_signup_results_v2`, `domain_signup_tracking_v2`

---

## 🛠️ **4. PROJECT MANAGEMENT**
*Documentation, utilities, and backups*

### 🚀 **What it does:**
- Contains all project documentation
- Utility scripts for maintenance
- Backup of old/deprecated files

### 📁 **Project Structure:**
```
project_management/
├── documentation/                              # All project docs
├── utilities/                                  # Helper scripts
└── backups/                                   # Old files & archives
```

---

## 🎯 **Quick Start Guide**

### **Most Common Tasks:**

1. **Run Newsletter Automation:**
   ```bash
   cd newsletter_automation/automation_scripts
   node full_newsletter_automation_clean.js
   ```

2. **Upload Data to BigQuery:**
   ```bash
   cd bigquery_tools/upload_scripts
   python upload_newsletter_signup_to_bigquery.py
   ```

3. **Analyze Email Revenue Data:**
   ```bash
   cd email_analytics/queries
   # Use .sql files in BigQuery console
   ```

4. **Export Email Data:**
   ```bash
   cd email_analytics/exports
   python export_emails_to_bigquery.py
   ```

---

## 📈 **Current Performance Stats**

### Newsletter Automation:
- **Success Rate**: ~75% newsletter signups
- **Processing Speed**: ~215s for 52 domains
- **Total Processed**: 9,911+ domains

### Data Pipeline:
- **BigQuery Records**: 9,677 new records ready
- **Success/Failure Split**: 6,725 successful, 3,186 failed
- **Duplicate Prevention**: 234 duplicates filtered

---

## 🏗️ **Project Dependencies**

### Root Level (Shared):
- `package.json` - Node.js dependencies
- `requirements.txt` - Python dependencies  
- `Dockerfile` - Container configuration
- `.gitignore` - Git ignore rules

### Environment:
- **Python**: BigQuery, data processing
- **Node.js**: Web automation, form filling
- **BigQuery**: Data warehouse
- **GitHub Actions**: CI/CD automation

---

## 🎉 **What Changed**

### ✅ **Before**: 80+ scattered files by file type
### ✅ **After**: 4 clear business projects

**Each project is now self-contained with its own purpose, files, and documentation!**

### **Benefits:**
- 🎯 **Clear purpose** - Each directory has a specific business function
- 🚀 **Easy navigation** - Find what you need by what you're trying to do
- 🔧 **Independent projects** - Each can be worked on separately
- 📚 **Better documentation** - Project-specific READMEs and guides
- 🗄️ **Clean backups** - Old files organized but accessible 