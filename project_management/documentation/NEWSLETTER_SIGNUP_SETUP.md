# Newsletter Signup Automation Setup

This setup enables automated newsletter signups from your BigQuery domain data using GitHub Actions.

## Overview

The system will:
1. **Fetch domains** from your `storeleads` table in BigQuery
2. **Exclude domains** already sending you emails (from your marketing emails analysis)
3. **Run automated signups** using your existing JavaScript automation
4. **Track results** in BigQuery for analysis

## Quick Start

### 1. Setup BigQuery Tables

First, create the required tables:

```bash
python create_newsletter_signup_table.py
```

### 2. Test Locally (Recommended)

Preview what domains would be processed:
```bash
python newsletter_signup_bigquery.py --preview --limit 10
```

Run a small test batch:
```bash
python newsletter_signup_bigquery.py --dry-run --limit 50
```

Actually run automation on a small batch:
```bash
python newsletter_signup_bigquery.py --limit 50 --batch-size 25 --max-concurrent 10
```

### 3. Configure GitHub Secrets

Add these secrets to your GitHub repository:

#### Required Secrets:
- `BIGQUERY_CREDENTIALS` - Your service account JSON (already configured)
- `MAILBOX_ACCOUNTS` - Your complete mailboxaccounts.csv content

#### Setting up MAILBOX_ACCOUNTS Secret:
1. Copy the entire content of your `mailboxaccounts.csv` file
2. Go to GitHub repository → Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `MAILBOX_ACCOUNTS`
5. Value: Paste the complete CSV content (including headers)

Example format:
```csv
Email,First Name,Last Name,IMAP Username,IMAP Password,IMAP Host,IMAP Port
your.email1@domain.com,First,Last,username1,password1,imap.host.com,993
your.email2@domain.com,First,Last,username2,password2,imap.host.com,993
```

#### Optional Secrets:
- `SLACK_WEBHOOK_URL` - For notifications (uncomment in workflow)

### 4. Run on GitHub Actions

#### Manual Run:
1. Go to Actions tab in your GitHub repo
2. Select "Newsletter Signup Automation"
3. Click "Run workflow"
4. Configure parameters:
   - **Limit**: Number of domains (start with 100-500)
   - **Batch size**: Domains per batch (default: 100)
   - **Max concurrent**: Parallel sessions (default: 15)
   - **Dry run**: Check this to test without running automation

#### Scheduled Run:
- Currently set to run daily at 2 PM UTC
- Processes 500 domains by default
- You can modify the schedule in `.github/workflows/newsletter_signup_automation.yml`

## Your BigQuery Logic

The script uses your specific logic:

```sql
-- Domains from storeleads that we haven't signed up for yet
SELECT DISTINCT sl.domain
FROM `instant-ground-394115.email_analytics.storeleads` sl
WHERE sl.domain IS NOT NULL 
    AND sl.domain != ''
    AND sl.domain NOT LIKE '%test%'
    AND sl.domain NOT LIKE '%example%'
    AND sl.domain NOT LIKE '%localhost%'
    -- Exclude domains already sending us emails
    AND sl.domain NOT IN (
        SELECT DISTINCT sender_domain 
        FROM `instant-ground-394115.email_analytics.marketing_emails_clean_20250612_082945` 
        WHERE subject NOT LIKE '%Confirm%'
        AND sender_domain IS NOT NULL
    )
ORDER BY RAND()
```

## Monitoring & Results

### BigQuery Tables Created:
- `email_analytics.newsletter_signup_results` - Individual signup attempts
- `email_analytics.domain_signup_tracking` - Domain-level tracking

### BigQuery Views Created:
- `email_analytics.daily_signup_summary` - Daily performance summary
- `email_analytics.industry_signup_performance` - Success rates by industry
- `email_analytics.failed_signup_analysis` - Common failure patterns

### Example Queries:

```sql
-- Daily success rate
SELECT * FROM `instant-ground-394115.email_analytics.daily_signup_summary`
ORDER BY signup_date DESC LIMIT 7;

-- Recent failures to investigate
SELECT domain, error_message, COUNT(*) as failure_count
FROM `instant-ground-394115.email_analytics.newsletter_signup_results`
WHERE NOT success AND DATE(signup_timestamp) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
GROUP BY domain, error_message
ORDER BY failure_count DESC;

-- Domains we successfully signed up for recently
SELECT domain, email_used, signup_timestamp
FROM `instant-ground-394115.email_analytics.newsletter_signup_results`
WHERE success AND DATE(signup_timestamp) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
ORDER BY signup_timestamp DESC;
```

## Configuration Options

### Command Line Options:
```bash
python newsletter_signup_bigquery.py \
  --limit 1000 \              # Number of domains to process
  --batch-size 100 \          # Domains per batch
  --max-concurrent 15 \       # Parallel browser sessions
  --dry-run                   # Test without running automation
  --preview                   # Show sample domains only
```

### GitHub Actions Parameters:
- **limit**: Maximum domains to process (default: 500)
- **batch_size**: Batch size for processing (default: 100)
- **max_concurrent**: Max parallel sessions (default: 15)
- **dry_run**: Test mode - prepares domains but doesn't run automation

## Troubleshooting

### Common Issues:

1. **No domains found**: Check that your storeleads table has data
2. **BigQuery permission errors**: Verify your service account has access
3. **JavaScript automation fails**: Check that Browserbase API is working
4. **High failure rate**: Consider reducing concurrent sessions

### Debug Commands:

```bash
# Test BigQuery connection
python -c "from newsletter_signup_bigquery import NewsletterSignupOrchestrator; o = NewsletterSignupOrchestrator(); print('✅ BigQuery connected')"

# Check domain count
python -c "
from newsletter_signup_bigquery import NewsletterSignupOrchestrator
o = NewsletterSignupOrchestrator()
domains = o.fetch_domains_from_bigquery(limit=10)
print(f'Found {len(domains)} domains')
for d in domains[:5]: print(f'  {d[\"domain\"]}')
"
```

## Cost Considerations

- **Browserbase API**: ~$0.01-0.02 per domain signup attempt
- **BigQuery**: Minimal costs for queries and storage
- **GitHub Actions**: Free tier should be sufficient for most usage

## Scaling

Start small and scale up:
1. **Test**: 50 domains, 10 concurrent
2. **Small batch**: 200 domains, 15 concurrent  
3. **Production**: 500+ domains, 15-20 concurrent

Monitor success rates and adjust concurrent sessions if needed.

## Next Steps

1. ✅ Run `python create_newsletter_signup_table.py` to setup BigQuery
2. ✅ Test locally with `--preview` flag
3. ✅ Configure GitHub secrets
4. ✅ Run small test batch manually
5. ✅ Enable daily automation
6. ✅ Monitor results in BigQuery

---

**Need help?** Check the logs in GitHub Actions or run locally with verbose logging. 