# Cloud Run Trigger

This file is used to trigger the GitHub Actions workflow manually.

## Last Run
- Date: 2025-06-12
- Status: Ready to run with new BigQuery credentials
- Trigger: Manual workflow dispatch

## How to Trigger
1. Go to: https://github.com/rohanseth0218/email-analyzer-project/actions
2. Click on "Daily Email Analysis" workflow
3. Click "Run workflow" button
4. Click the green "Run workflow" button

## Expected Results
- Process all 68 mailboxes
- Filter out warmup emails (W51Q0NG, 2MAX439 patterns)  
- Store results in BigQuery table: `marketing_emails_clean`
- Run time: ~10-15 minutes for all mailboxes 