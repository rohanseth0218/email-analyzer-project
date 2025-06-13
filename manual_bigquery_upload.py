#!/usr/bin/env python3
"""
Manual BigQuery Upload Script
Uploads the complete log data to BigQuery to prevent re-signup attempts
"""

import json
import logging
from datetime import datetime
from pathlib import Path

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def read_log_files():
    """Read and process the log files"""
    results = []
    seen_domains = set()
    
    # Read successful submissions
    success_log = './logs/successful_submissions_production.jsonl'
    failed_log = './logs/failed_submissions_production.jsonl'
    
    logger.info("📤 Reading automation log files...")
    
    # Read successful submissions
    if Path(success_log).exists():
        try:
            with open(success_log, 'r') as f:
                for line_num, line in enumerate(f, 1):
                    if line.strip():
                        try:
                            data = json.loads(line.strip())
                            
                            # Skip entries without email or timestamp
                            if not data.get('email') or not data.get('timestamp'):
                                logger.warning(f"⚠️ Skipping incomplete success entry: {data}")
                                continue
                            
                            # Skip duplicates (keep first complete entry per domain)
                            domain = data.get('domain', '')
                            if domain in seen_domains:
                                logger.debug(f"🔄 Skipping duplicate domain: {domain}")
                                continue
                            seen_domains.add(domain)
                            
                            # Convert timestamp to BigQuery format
                            timestamp = data.get('timestamp', '')
                            try:
                                dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                                bq_timestamp = dt.strftime('%Y-%m-%d %H:%M:%S')
                            except:
                                bq_timestamp = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
                            
                            result = {
                                'domain': domain,
                                'success': True,
                                'email_used': data.get('email', ''),
                                'signup_timestamp': bq_timestamp,
                                'error_message': None,
                                'batch_id': str(data.get('batch', '')),
                                'industry': None,
                                'country': None,
                                'employee_count': None
                            }
                            
                            results.append(result)
                            
                        except json.JSONDecodeError as e:
                            logger.error(f"❌ Invalid JSON on line {line_num}: {line.strip()}")
        except Exception as e:
            logger.error(f"❌ Error reading success log: {e}")
    
    # Read failed submissions
    if Path(failed_log).exists():
        try:
            with open(failed_log, 'r') as f:
                for line_num, line in enumerate(f, 1):
                    if line.strip():
                        try:
                            data = json.loads(line.strip())
                            
                            # Skip entries without email or timestamp
                            if not data.get('email') or not data.get('timestamp'):
                                logger.warning(f"⚠️ Skipping incomplete failed entry: {data}")
                                continue
                            
                            # Skip duplicates for failed entries
                            domain = data.get('domain', '')
                            domain_key = f"{domain}_failed"
                            if domain_key in seen_domains:
                                logger.debug(f"🔄 Skipping duplicate failed domain: {domain}")
                                continue
                            seen_domains.add(domain_key)
                            
                            # Convert timestamp to BigQuery format
                            timestamp = data.get('timestamp', '')
                            try:
                                dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                                bq_timestamp = dt.strftime('%Y-%m-%d %H:%M:%S')
                            except:
                                bq_timestamp = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
                            
                            result = {
                                'domain': domain,
                                'success': False,
                                'email_used': data.get('email', ''),
                                'signup_timestamp': bq_timestamp,
                                'error_message': data.get('reason', ''),
                                'batch_id': str(data.get('batch', '')),
                                'industry': None,
                                'country': None,
                                'employee_count': None
                            }
                            
                            results.append(result)
                            
                        except json.JSONDecodeError as e:
                            logger.error(f"❌ Invalid JSON on line {line_num}: {line.strip()}")
        except Exception as e:
            logger.error(f"❌ Error reading failed log: {e}")
    
    logger.info(f"📋 Found {len(results)} complete, unique results from logs")
    return results

def upload_to_bigquery(results):
    """Upload results to BigQuery"""
    try:
        from google.cloud import bigquery
        from google.oauth2 import service_account
        
        # Initialize BigQuery client
        credentials = service_account.Credentials.from_service_account_file('bigquery_credentials.json')
        client = bigquery.Client(credentials=credentials, project='instant-ground-394115')
        
        table_id = "instant-ground-394115.email_analytics.newsletter_signup_results_v2"
        
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
                'industry': result.get('industry'),
                'country': result.get('country'),
                'employee_count': result.get('employee_count')
            }
            rows_to_insert.append(row)
        
        logger.info(f"📤 Uploading {len(rows_to_insert)} rows to BigQuery...")
        
        # Insert rows
        errors = client.insert_rows_json(table_id, rows_to_insert)
        
        if errors:
            logger.error(f"❌ BigQuery upload errors: {errors}")
            return False
        else:
            logger.info(f"✅ Successfully uploaded {len(rows_to_insert)} rows to BigQuery")
            return True
            
    except Exception as e:
        logger.error(f"❌ Error uploading to BigQuery: {e}")
        return False

def create_upload_json(results):
    """Create a JSON file for manual upload if BigQuery credentials aren't available"""
    output_file = 'bigquery_upload_data.json'
    
    try:
        with open(output_file, 'w') as f:
            json.dump(results, f, indent=2)
        
        logger.info(f"📄 Created {output_file} with {len(results)} records")
        logger.info(f"💡 You can upload this file manually to BigQuery or use it with the GitHub Actions workflow")
        
        # Show summary
        successful = sum(1 for r in results if r['success'])
        failed = len(results) - successful
        
        logger.info(f"📊 Summary:")
        logger.info(f"   ✅ Successful signups: {successful}")
        logger.info(f"   ❌ Failed attempts: {failed}")
        logger.info(f"   📝 Total records: {len(results)}")
        
        return output_file
        
    except Exception as e:
        logger.error(f"❌ Error creating upload file: {e}")
        return None

def main():
    """Main function"""
    logger.info("🚀 Starting manual BigQuery upload...")
    
    # Read log files
    results = read_log_files()
    
    if not results:
        logger.warning("⚠️ No results found in log files")
        return
    
    # Try to upload to BigQuery directly
    try:
        success = upload_to_bigquery(results)
        if success:
            logger.info("✅ Manual BigQuery upload completed successfully!")
            return
    except ImportError:
        logger.info("📝 BigQuery libraries not available locally, creating upload file...")
    except Exception as e:
        logger.warning(f"⚠️ Direct BigQuery upload failed: {e}")
        logger.info("📝 Creating upload file as fallback...")
    
    # Create JSON file for manual upload
    output_file = create_upload_json(results)
    
    if output_file:
        logger.info(f"✅ Created {output_file} for manual upload")
        logger.info("💡 Next steps:")
        logger.info("   1. Use the GitHub Actions 'Upload JSON to BigQuery' workflow")
        logger.info("   2. Or upload this file directly to BigQuery")

if __name__ == "__main__":
    main() 