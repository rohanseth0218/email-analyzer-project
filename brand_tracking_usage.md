# Brand Tracking System Usage Guide

## 🎯 **Overview**
Track newsletter signups vs actual emails received to identify gaps in your lead generation funnel.

## 📊 **What This Tracks:**
- **Signups**: Brands you've signed up for newsletters 
- **Emails**: Brands actually sending you emails
- **Gap Analysis**: Which brands are missing from either side

## 🚀 **Quick Start**

### 1. **Log Newsletter Signups**
```bash
# Single signup
curl -X POST http://localhost:8080/signup \
  -H "Content-Type: application/json" \
  -d '{
    "brand_name": "Nike",
    "brand_domain": "nike.com", 
    "signup_email": "your@email.com",
    "signup_method": "manual"
  }'

# Bulk signups
curl -X POST http://localhost:8080/signup/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "signups": [
      {
        "brand_name": "Nike",
        "brand_domain": "nike.com",
        "signup_email": "your@email.com",
        "signup_method": "automation"
      },
      {
        "brand_name": "Adidas", 
        "brand_domain": "adidas.com",
        "signup_email": "your@email.com",
        "signup_method": "manual"
      }
    ]
  }'
```

### 2. **Get Gap Analysis**
```bash
# Full analysis
curl http://localhost:8080/gap-analysis

# Just missing brands
curl http://localhost:8080/brands/missing

# Just untracked brands
curl http://localhost:8080/brands/untracked

# Dashboard view
curl http://localhost:8080/dashboard
```

### 3. **Send Reports to Slack**
```bash
curl -X POST http://localhost:8080/gap-analysis/slack
```

## 📋 **API Endpoints**

### **POST /signup**
Log a single newsletter signup
- `brand_name`: Name of the brand
- `brand_domain`: Domain (e.g., nike.com)
- `signup_email`: Email you used to sign up
- `signup_method`: manual/automation/bulk

### **POST /signup/bulk** 
Log multiple signups at once

### **GET /gap-analysis**
Get complete gap analysis with all categories

### **GET /brands/missing**
Get brands you signed up for but haven't received emails from

### **GET /brands/untracked**
Get brands sending emails but not in your signup list

### **GET /dashboard**
Get summary dashboard with recommendations

### **POST /gap-analysis/slack**
Send gap analysis report to Slack

## 📈 **Example Automation Scripts**

### **Signup Tracking Script**
```python
#!/usr/bin/env python3
import requests
import json

def log_signup(brand_name, domain, email="your@email.com"):
    """Log a newsletter signup"""
    data = {
        "brand_name": brand_name,
        "brand_domain": domain,
        "signup_email": email,
        "signup_method": "automation"
    }
    
    response = requests.post(
        "http://localhost:8080/signup",
        json=data
    )
    
    if response.status_code == 200:
        print(f"✅ Logged signup: {brand_name}")
    else:
        print(f"❌ Failed to log {brand_name}: {response.text}")

# Log some signups
brands = [
    ("Nike", "nike.com"),
    ("Adidas", "adidas.com"), 
    ("Patagonia", "patagonia.com"),
    ("REI", "rei.com"),
    ("Lululemon", "lululemon.com")
]

for brand_name, domain in brands:
    log_signup(brand_name, domain)
```

### **Daily Gap Analysis Script**
```python
#!/usr/bin/env python3
import requests
import json

def get_daily_report():
    """Get and display daily gap analysis"""
    
    # Get dashboard data
    response = requests.get("http://localhost:8080/dashboard")
    
    if response.status_code == 200:
        dashboard = response.json()['dashboard']
        overview = dashboard['overview']
        
        print("📊 DAILY BRAND TRACKING REPORT")
        print("=" * 40)
        print(f"Total Signups: {overview['total_signups']}")
        print(f"Receiving Emails: {overview['signups_receiving_emails']}")
        print(f"Conversion Rate: {overview['conversion_rate']}%")
        print(f"Missing Emails: {overview['signups_no_emails']}")
        print(f"Untracked Brands: {overview['untracked_brands']}")
        
        print("\n📋 RECOMMENDATIONS:")
        for rec in dashboard['recommendations']:
            print(f"• {rec}")
        
        print(f"\n🚨 TOP MISSING BRANDS:")
        for brand in dashboard['top_missing_brands'][:5]:
            days = brand.get('days_since_signup', 0)
            print(f"• {brand['brand_name']} ({days} days ago)")
        
        # Send to Slack
        requests.post("http://localhost:8080/gap-analysis/slack")
        print("\n📨 Report sent to Slack")
        
if __name__ == "__main__":
    get_daily_report()
```

## 🔄 **Integration with Email Processing**

The system automatically updates when new emails are processed:
1. **Email Processor** finds marketing emails
2. **Brand Tracker** extracts brand names from emails/domains
3. **Signup Database** gets updated with email counts
4. **Gap Analysis** shows real-time conversion rates

## 💡 **Use Cases**

### **Lead Generation Teams**
- Track which brands respond to signup campaigns
- Identify high-converting vs low-converting targets
- Focus efforts on responsive brands

### **Email Marketers**
- Monitor competitor email frequency
- Find new brands to analyze
- Track industry email trends

### **Growth Teams**
- Measure signup campaign effectiveness
- Identify gaps in funnel conversion
- Optimize signup targeting

## 📊 **BigQuery Tables**

### **newsletter_signups**
- `signup_id`: Unique signup identifier
- `brand_name`: Brand name
- `brand_domain`: Signup domain
- `signup_email`: Email used for signup
- `signup_date`: When you signed up
- `total_emails_received`: Running count
- `signup_status`: pending/receiving/inactive

### **marketing_emails** 
- All your processed marketing emails
- Linked to signups via brand matching
- Used for gap analysis queries

## 🚀 **Next Steps**

1. **Start logging signups** for brands you're targeting
2. **Run email processing** to capture incoming emails
3. **Check gap analysis** weekly to see conversion rates
4. **Set up daily reports** to track progress automatically

The system will automatically match signups to incoming emails and show you exactly which brands are responding to your campaigns! 