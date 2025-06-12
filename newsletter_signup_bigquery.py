#!/usr/bin/env python3
"""
Newsletter Signup Automation with BigQuery Integration
Fetches domains from BigQuery and runs newsletter signup automation
"""

import os
import json
import subprocess
import sys
from datetime import datetime, timedelta
from google.cloud import bigquery
from google.oauth2 import service_account
import logging
from pathlib import Path
import pandas as pd

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('newsletter_signup.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class NewsletterSignupOrchestrator:
    def __init__(self, credentials_path='bigquery_credentials.json'):
        """Initialize with BigQuery credentials"""
        self.credentials_path = credentials_path
        self.project_id = 'instant-ground-394115'
        self.setup_bigquery_client()
        
    def setup_bigquery_client(self):
        """Setup BigQuery client with credentials"""
        try:
            credentials = service_account.Credentials.from_service_account_file(
                self.credentials_path
            )
            self.client = bigquery.Client(
                credentials=credentials, 
                project=self.project_id
            )
            logger.info("✅ BigQuery client initialized successfully")
        except Exception as e:
            logger.error(f"❌ Failed to initialize BigQuery client: {e}")
            raise
    
    def fetch_domains_from_bigquery(self, limit=None, filters=None, exclude_successful=True):
        """
        Fetch domains from BigQuery that need newsletter signups
        
        Args:
            limit: Maximum number of domains to fetch
            filters: Dictionary of filters to apply
            exclude_successful: If True, exclude domains with successful signups (default: True)
        """
        try:
            # Your specific query - domains from storeleads that we haven't signed up for yet
            base_query = """
            SELECT DISTINCT 
                sl.store_id as domain
            FROM `instant-ground-394115.email_analytics.storeleads` sl
            WHERE sl.store_id IS NOT NULL 
                AND sl.store_id != ''
                AND sl.store_id NOT LIKE '%test%'
                AND sl.store_id NOT LIKE '%example%'
                AND sl.store_id NOT LIKE '%localhost%'
                -- Exclude domains that are already sending us emails
                AND sl.store_id NOT IN (
                    SELECT DISTINCT sender_domain 
                    FROM `instant-ground-394115.email_analytics.marketing_emails_clean_20250612_082945` 
                    WHERE subject NOT LIKE '%Confirm%'
                    AND sender_domain IS NOT NULL
                )
            """
            
            # Optionally exclude domains we've already successfully signed up for
            if exclude_successful:
                base_query += """
                -- Exclude domains we've already successfully signed up for (but allow retrying failed attempts)
                AND sl.store_id NOT IN (
                    SELECT DISTINCT REPLACE(REPLACE(domain, 'https://', ''), 'http://', '')
                    FROM `instant-ground-394115.email_analytics.newsletter_signup_results_v2`
                    WHERE domain IS NOT NULL
                    AND success = true
                )
                """
            
            # Add exclude domains filter if provided
            if filters and 'exclude_domains' in filters:
                exclude_list = "', '".join(filters['exclude_domains'])
                base_query += f" AND sl.store_id NOT IN ('{exclude_list}')"
            
            # Simple random ordering to distribute load
            base_query += " ORDER BY RAND()"
            
            if limit:
                base_query += f" LIMIT {limit}"
            
            logger.info(f"🔍 Executing BigQuery: {base_query}")
            
            # Execute query
            query_job = self.client.query(base_query)
            results = query_job.result()
            
            domains = []
            for row in results:
                domains.append({
                    'domain': row.domain
                })
            
            logger.info(f"✅ Fetched {len(domains)} domains from BigQuery")
            return domains
            
        except Exception as e:
            logger.error(f"❌ Error fetching domains from BigQuery: {e}")
            raise
    
    def prepare_domains_for_automation(self, domains):
        """
        Prepare domains in the format expected by the JavaScript automation
        """
        try:
            # Convert to the format expected by full_newsletter_automation_clean.js
            formatted_domains = []
            
            for domain_info in domains:
                domain = domain_info['domain']
                
                # Clean domain format
                if not domain.startswith('http'):
                    domain = f"https://{domain}"
                
                # Remove www. if present
                domain = domain.replace('https://www.', 'https://')
                
                formatted_domains.append({
                    'domain': domain,
                    'metadata': {}
                })
            
            # Save to CSV format for JavaScript automation
            csv_content = "domain\n"
            for item in formatted_domains:
                csv_content += f"{item['domain']}\n"
            
            with open('Storedomains.csv', 'w') as f:
                f.write(csv_content)
            
            # Also save metadata for tracking
            with open('domain_metadata.json', 'w') as f:
                json.dump(formatted_domains, f, indent=2, default=str)
            
            logger.info(f"✅ Prepared {len(formatted_domains)} domains for automation")
            return formatted_domains
            
        except Exception as e:
            logger.error(f"❌ Error preparing domains: {e}")
            raise
    
    def run_newsletter_automation(self, batch_size=100, max_concurrent=15):
        """
        Run the JavaScript newsletter automation with the fetched domains
        """
        try:
            logger.info("🚀 Starting newsletter signup automation...")
            
            # Check if Node.js and required packages are installed
            subprocess.run(['node', '--version'], check=True, capture_output=True)
            
            # Install required npm packages if not already installed
            if not os.path.exists('node_modules'):
                logger.info("📦 Installing npm dependencies...")
                subprocess.run(['npm', 'init', '-y'], check=True)
                subprocess.run(['npm', 'install', 'playwright', 'csv-parse', 'axios'], check=True)
            
            # Create configuration for the automation
            config = {
                'BATCH_SIZE': batch_size,
                'MAX_CONCURRENT_SESSIONS': max_concurrent,
                'MODE': 'BATCH',
                'START_FROM_BATCH': 1,
                'CSV_FILE': 'Storedomains.csv'
            }
            
            # Update the JavaScript file with our configuration
            self.update_automation_config(config)
            
            # Run the automation
            cmd = ['node', 'full_newsletter_automation_clean.js']
            
            logger.info(f"🎯 Executing: {' '.join(cmd)}")
            
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
                universal_newlines=True
            )
            
            # Stream output in real-time
            while True:
                output = process.stdout.readline()
                if output == '' and process.poll() is not None:
                    break
                if output:
                    logger.info(f"JS: {output.strip()}")
            
            # Get any remaining output
            stdout, stderr = process.communicate()
            
            if stderr:
                logger.warning(f"JS stderr: {stderr}")
            
            if process.returncode == 0:
                logger.info("✅ Newsletter automation completed successfully")
                # Upload results to BigQuery
                self.upload_log_results_to_bigquery()
                return True
            else:
                logger.error(f"❌ Newsletter automation failed with return code {process.returncode}")
                return False
                
        except subprocess.CalledProcessError as e:
            logger.error(f"❌ Command failed: {e}")
            return False
        except Exception as e:
            logger.error(f"❌ Error running automation: {e}")
            return False
    
    def update_automation_config(self, config):
        """
        Update the JavaScript automation file with our configuration
        """
        try:
            # Read the original file
            with open('full_newsletter_automation_clean.js', 'r') as f:
                content = f.read()
            
            # Update CSV file reference
            content = content.replace(
                "await fs.readFile('./Storedomains.csv'", 
                f"await fs.readFile('./{config['CSV_FILE']}'"
            )
            
            # Update batch size
            content = content.replace(
                "BATCH_SIZE: 100,",
                f"BATCH_SIZE: {config['BATCH_SIZE']},"
            )
            
            # Update concurrent sessions
            content = content.replace(
                "MAX_CONCURRENT_SESSIONS: 15,",
                f"MAX_CONCURRENT_SESSIONS: {config['MAX_CONCURRENT_SESSIONS']},"
            )
            
            # Save updated file
            with open('full_newsletter_automation_configured.js', 'w') as f:
                f.write(content)
            
            logger.info("✅ Updated automation configuration")
            
        except Exception as e:
            logger.error(f"❌ Error updating automation config: {e}")
            raise
    
    def read_automation_logs(self):
        """
        Read the JavaScript automation log files and return results for BigQuery upload
        """
        results = []
        
        # Read successful submissions
        success_log = './logs/successful_submissions_production.jsonl'
        failed_log = './logs/failed_submissions_production.jsonl'
        
        logger.info("📤 Reading automation log files...")
        
        # Read successful submissions
        if Path(success_log).exists():
            try:
                with open(success_log, 'r') as f:
                    for line in f:
                        if line.strip():
                            data = json.loads(line.strip())
                            result = {
                                'domain': data.get('domain', ''),
                                'success': True,
                                'email_used': data.get('email', ''),
                                'signup_timestamp': data.get('timestamp', ''),
                                'error_message': None,
                                'batch_id': str(data.get('batch', '')),
                                'method': data.get('method', ''),
                                'industry': None,
                                'country': None,
                                'employee_count': None
                            }
                            results.append(result)
            except Exception as e:
                logger.error(f"❌ Error reading success log: {e}")
        
        # Read failed submissions  
        if Path(failed_log).exists():
            try:
                with open(failed_log, 'r') as f:
                    for line in f:
                        if line.strip():
                            data = json.loads(line.strip())
                            result = {
                                'domain': data.get('domain', ''),
                                'success': False,
                                'email_used': data.get('email', ''),
                                'signup_timestamp': data.get('timestamp', ''),
                                'error_message': data.get('reason', ''),
                                'batch_id': str(data.get('batch', '')),
                                'method': None,
                                'industry': None,
                                'country': None,
                                'employee_count': None
                            }
                            results.append(result)
            except Exception as e:
                logger.error(f"❌ Error reading failed log: {e}")
        
        logger.info(f"📋 Found {len(results)} total results from logs")
        return results

    def upload_log_results_to_bigquery(self):
        """
        Read JavaScript logs and upload results to BigQuery
        """
        try:
            logger.info("📤 Uploading results to BigQuery...")
            
            # Read results from log files
            results = self.read_automation_logs()
            
            if not results:
                logger.warning("⚠️ No results found in log files")
                return
            
            # Upload to BigQuery
            self.log_results_to_bigquery(results)
            
        except Exception as e:
            logger.error(f"❌ Error uploading results to BigQuery: {e}")

    def log_results_to_bigquery(self, results):
        """
        Log automation results back to BigQuery for tracking
        """
        try:
            table_id = f"{self.project_id}.email_analytics.newsletter_signup_results_v2"
            
            # Prepare rows for insertion
            rows_to_insert = []
            
            for result in results:
                row = {
                    'domain': result.get('domain', ''),
                    'success': result.get('success', False),
                    'email_used': result.get('email_used', ''),
                    'signup_timestamp': result.get('signup_timestamp', ''),
                    'error_message': result.get('error_message', ''),
                    'batch_id': result.get('batch_id', ''),
                    'method': result.get('method', ''),
                    'industry': result.get('industry'),
                    'country': result.get('country'),  
                    'employee_count': result.get('employee_count')
                }
                rows_to_insert.append(row)
            
            # Insert rows
            errors = self.client.insert_rows_json(table_id, rows_to_insert)
            
            if errors:
                logger.error(f"❌ Errors inserting to BigQuery: {errors}")
            else:
                logger.info(f"✅ Logged {len(rows_to_insert)} results to BigQuery")
                
        except Exception as e:
            logger.error(f"❌ Error logging results to BigQuery: {e}")

def main():
    """Main execution function"""
    try:
        # Parse command line arguments
        import argparse
        parser = argparse.ArgumentParser(description='Newsletter Signup Automation')
        parser.add_argument('--limit', type=int, default=500, help='Limit number of domains')

        parser.add_argument('--batch-size', type=int, default=100, help='Batch size for processing')
        parser.add_argument('--max-concurrent', type=int, default=15, help='Max concurrent sessions')
        parser.add_argument('--dry-run', action='store_true', help='Fetch domains but dont run automation')
        parser.add_argument('--preview', action='store_true', help='Show sample domains that would be processed')
        parser.add_argument('--include-successful', action='store_true', help='Include domains with previous successful signups (allows re-subscribing)')
        
        args = parser.parse_args()
        
        # Initialize orchestrator
        orchestrator = NewsletterSignupOrchestrator()
        
        # Prepare filters (currently just exclude domains if needed)
        filters = None
        
        # Fetch domains from BigQuery
        logger.info("🔍 Fetching domains from BigQuery...")
        domains = orchestrator.fetch_domains_from_bigquery(
            limit=args.limit,
            filters=filters,
            exclude_successful=not args.include_successful
        )
        
        if not domains:
            logger.error("❌ No domains found matching criteria")
            return 1
        
        # Prepare domains for automation
        formatted_domains = orchestrator.prepare_domains_for_automation(domains)
        
        logger.info(f"📊 Summary:")
        logger.info(f"   Total domains: {len(formatted_domains)}")
        logger.info(f"   Batch size: {args.batch_size}")
        logger.info(f"   Max concurrent: {args.max_concurrent}")
        
        # Show preview if requested
        if args.preview or args.dry_run:
            logger.info(f"\n🔍 Sample domains to be processed:")
            for i, domain_info in enumerate(formatted_domains[:10]):
                logger.info(f"   {i+1}. {domain_info['domain']}")
            
            if len(formatted_domains) > 10:
                logger.info(f"   ... and {len(formatted_domains) - 10} more domains")
        
        if args.preview:
            logger.info("👀 Preview completed - use --dry-run to prepare files or remove --preview to run automation")
            return 0
        
        if args.dry_run:
            logger.info("🏃‍♂️ Dry run completed - domains prepared but automation not executed")
            return 0
        
        # Run automation
        success = orchestrator.run_newsletter_automation(
            batch_size=args.batch_size,
            max_concurrent=args.max_concurrent
        )
        
        if success:
            logger.info("🎉 Newsletter signup automation completed successfully!")
            return 0
        else:
            logger.error("❌ Newsletter signup automation failed")
            return 1
            
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}")
        return 1

if __name__ == "__main__":
    exit(main()) 