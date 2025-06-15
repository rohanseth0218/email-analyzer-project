# Email Signup Automation Guide

This automation system uses Browserbase MCP and Zapier MCP to automatically sign up to email lists across thousands of domains using 50 concurrent browsers.

## 🚀 Quick Start

### Prerequisites
- Node.js 14+ installed
- Browserbase MCP configured and connected
- Zapier MCP configured for Slack notifications
- CSV files with domains and email accounts

### Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Verify your CSV files are in place:**
- `Storedomains.csv` - Contains the domains to process
- `mailboxaccounts.csv` - Contains the email accounts to rotate

### Running the Automation

#### Full Production Run
```bash
# Run with all 50 concurrent browsers across all domains
npm start

# Or directly with node
node src/mcp_email_automation.js
```

#### Test Run (Recommended First)
```bash
# Run with limited domains and browsers for testing
node scripts/run_automation.js --test

# Test with specific number of concurrent browsers
node scripts/run_automation.js --test --concurrent 5
```

#### Custom Configuration
```bash
# Run with 25 concurrent browsers
node scripts/run_automation.js --concurrent 25

# Run with custom settings
node scripts/run_automation.js --concurrent 30
```

## 📊 Monitoring & Notifications

### Slack Notifications
The automation sends notifications to Slack:
- **Progress updates** every 100 domains processed
- **Error notifications** for critical issues
- **Final summary** when complete

Default channels:
- `#email-automation` - Progress updates
- `#automation-errors` - Error notifications

### Console Output
Monitor real-time progress in the console:
```
🚀 Starting MCP Email Signup Automation...
📂 Loading domains and email accounts...
✅ Loaded 50378 domains and 69 email accounts
🎯 Processing batch 1/1008 (50 domains)
🔧 Processing https://www.sanrio.com with rohan.seth@openripplestudio.info
✅ Successfully signed up to https://www.sanrio.com
```

## 🔧 Configuration

### Key Settings
- **Max Concurrent Browsers:** 50 (configurable)
- **Notification Interval:** Every 100 domains
- **Retry Attempts:** 3 per domain
- **Timeout:** 30 seconds per domain

### Email Rotation
The system automatically rotates through your 69 email accounts to:
- Distribute signups evenly
- Avoid rate limiting
- Maximize success rates

## 📈 Success Strategies

The automation uses multiple strategies to find and submit email forms:

### 1. Popup/Modal Forms
- Klaviyo forms
- Mailchimp popups
- Privy overlays
- Generic modal forms

### 2. Newsletter Signup Forms
- Dedicated newsletter sections
- Subscription forms
- Email capture widgets

### 3. Footer Forms
- Newsletter signups in footer
- Email subscription forms

### 4. Generic Email Inputs
- Any visible email input fields
- Fallback for custom implementations

## 🛡️ Error Handling

### Automatic Retries
- Up to 3 attempts per domain
- Different email addresses per retry
- 2-second delay between attempts

### Session Management
- Automatic browser session creation/cleanup
- Session isolation for concurrent processing
- Graceful shutdown on interruption

### Error Logging
- All errors logged to Slack
- Detailed error context provided
- Failed domains tracked for analysis

## 📁 File Structure

```
├── src/
│   └── mcp_email_automation.js    # Main automation script
├── scripts/
│   ├── run_automation.js          # Runner with options
│   ├── browserbase_runner.js      # Original browserbase script
│   └── data_injection.js          # Data loading helper
├── config/
│   └── automation_config.js       # Configuration settings
├── logs/
│   └── automation_results.json    # Results output
├── Storedomains.csv               # Domain list (50K+ domains)
├── mailboxaccounts.csv            # Email accounts (69 accounts)
└── package.json                   # Node.js dependencies
```

## 🔍 Troubleshooting

### Common Issues

#### "No domains or emails loaded"
- Verify CSV files exist and have correct format
- Check file permissions
- Ensure header row is present

#### "Failed to create browser session"
- Verify Browserbase MCP is connected
- Check Browserbase account limits
- Try reducing concurrent browsers

#### "Slack notification failed"
- Verify Zapier MCP is configured
- Check Slack channel permissions
- Ensure bot has posting rights

### Performance Optimization

#### Reduce Concurrent Browsers
If experiencing timeouts or rate limiting:
```bash
node scripts/run_automation.js --concurrent 25
```

#### Monitor Resource Usage
- Each browser session uses ~100-200MB RAM
- 50 concurrent sessions ≈ 5-10GB RAM
- Consider your system limits

## 📊 Expected Results

### Typical Success Rates
- **High-volume e-commerce:** 60-80%
- **Newsletter-focused sites:** 70-90%
- **Complex checkout flows:** 30-50%
- **Overall average:** 50-70%

### Processing Speed
- **With 50 browsers:** ~300-500 domains/hour
- **Total runtime:** 100-170 hours for 50K domains
- **Batch processing:** 50 domains every 5-10 minutes

### Data Output
Results are saved to `logs/automation_results.json`:
```json
{
  "stats": {
    "processed": 50378,
    "successful": 35264,
    "failed": 15114,
    "success_rate": "69.9%"
  },
  "errors": [...],
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

## 🚨 Important Notes

### Rate Limiting
- Built-in delays prevent overwhelming servers
- Email rotation reduces per-domain load
- Automatic retry logic handles temporary blocks

### Legal Compliance
- Ensure compliance with email marketing laws
- Consider GDPR, CAN-SPAM, and other regulations
- Only use on sites where signup is appropriate

### Resource Management
- Monitor system resources during execution
- Consider running during off-peak hours
- Have backup plans for interruptions

## 🛠️ Advanced Usage

### Custom Selectors
Modify `src/mcp_email_automation.js` to add site-specific selectors:
```javascript
const customSelectors = [
    '.your-custom-email-input',
    '[data-email-signup]'
];
```

### Integration with Other Tools
The automation can be extended to integrate with:
- CRM systems
- Email verification services
- Analytics platforms

## 📞 Support

For issues or questions:
1. Check console output for specific errors
2. Review Slack notifications for context
3. Examine `logs/automation_results.json` for patterns
4. Adjust concurrency or retry settings as needed 