#!/usr/bin/env python3
"""
Email Engagement Bot
Automatically confirms subscriptions and engages with brands via link clicking
"""

import json
import os
import re
import time
import argparse
from datetime import datetime, timedelta
from pathlib import Path
import requests
from google.cloud import bigquery
from google.oauth2 import service_account
from playwright.sync_api import sync_playwright
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class EmailEngagementBot:
    def __init__(self, config=None):
        self.config = config or {}
        self.project_id = "instant-ground-394115"
        self.dataset_id = "email_analytics"
        self.emails_table = "marketing_emails_clean_20250612_082945"
        self.engagement_table = "email_engagement_tracking"
        
        self.client = self.setup_bigquery_client()
        self.engagement_data_file = "engagement_tracking.json"
        self.engagement_state = self.load_engagement_state()
        
        # Browser configuration
        self.browser_config = {
            'headless': self.config.get('headless', True),
            'user_agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        
        # Limits
        self.max_confirmations = self.config.get('max_confirmations', 20)
        self.max_engagements = self.config.get('max_engagements', 30)
        self.dry_run = self.config.get('dry_run', False)
        self.confirmations_only = self.config.get('confirmations_only', False)
        self.engagement_only = self.config.get('engagement_only', False)
    
    def setup_bigquery_client(self):
        """Setup BigQuery client with service account credentials"""
        if not os.path.exists('bigquery_credentials.json'):
            logger.error("❌ bigquery_credentials.json not found")
            return None
        
        try:
            credentials = service_account.Credentials.from_service_account_file('bigquery_credentials.json')
            client = bigquery.Client(credentials=credentials, project=self.project_id)
            logger.info("✅ BigQuery client initialized")
            return client
        except Exception as e:
            logger.error(f"❌ BigQuery setup failed: {e}")
            return None
    
    def load_engagement_state(self):
        """Load engagement tracking state from file"""
        if os.path.exists(self.engagement_data_file):
            try:
                with open(self.engagement_data_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"⚠️ Could not load engagement state: {e}")
        
        return {
            'confirmations': {},  # brand -> {last_confirmed, confirmation_urls}
            'engagements': {},    # brand -> {last_engaged, last_url, engagement_count}
            'last_run': None
        }
    
    def save_engagement_state(self):
        """Save engagement tracking state to file"""
        try:
            with open(self.engagement_data_file, 'w') as f:
                json.dump(self.engagement_state, f, indent=2, default=str)
            logger.info(f"✅ Saved engagement state to {self.engagement_data_file}")
        except Exception as e:
            logger.error(f"❌ Could not save engagement state: {e}")
    
    def get_confirmation_emails(self):
        """Query BigQuery for emails that need subscription confirmation"""
        query = f"""
        SELECT 
            sender_email,
            subject,
            body_html,
            body_text,
            received_date,
            email_id,
            REGEXP_EXTRACT(sender_email, r'@(.+)') as domain
        FROM `{self.project_id}.{self.dataset_id}.{self.emails_table}`
        WHERE (
            LOWER(subject) LIKE '%confirm%subscription%' OR
            LOWER(subject) LIKE '%verify%email%' OR 
            LOWER(subject) LIKE '%activate%account%' OR
            LOWER(subject) LIKE '%complete%signup%' OR
            LOWER(subject) LIKE '%welcome%confirm%' OR
            LOWER(body_text) LIKE '%confirm%subscription%' OR
            LOWER(body_text) LIKE '%click%confirm%' OR
            LOWER(body_html) LIKE '%confirm%subscription%'
        )
        AND received_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        ORDER BY received_date DESC
        LIMIT {self.max_confirmations * 2}
        """
        
        try:
            query_job = self.client.query(query)
            results = list(query_job)
            logger.info(f"📧 Found {len(results)} potential confirmation emails")
            return results
        except Exception as e:
            logger.error(f"❌ Error querying confirmation emails: {e}")
            return []
    
    def get_engagement_emails(self):
        """Query BigQuery for brands that need engagement (haven't been engaged in 7+ days)"""
        query = f"""
        WITH ranked_emails AS (
            SELECT 
                sender_email,
                subject,
                body_html,
                body_text,
                received_date,
                email_id,
                REGEXP_EXTRACT(sender_email, r'@(.+)') as domain,
                ROW_NUMBER() OVER (PARTITION BY REGEXP_EXTRACT(sender_email, r'@(.+)') ORDER BY received_date DESC) as rn
            FROM `{self.project_id}.{self.dataset_id}.{self.emails_table}`
            WHERE received_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
            AND body_html IS NOT NULL
            AND LENGTH(body_html) > 100
            AND NOT (
                LOWER(subject) LIKE '%unsubscribe%' OR
                LOWER(subject) LIKE '%confirm%subscription%' OR
                LOWER(subject) LIKE '%verify%email%'
            )
        )
        SELECT *
        FROM ranked_emails
        WHERE rn = 1  -- One email per domain/brand
        ORDER BY received_date DESC
        LIMIT {self.max_engagements * 2}
        """
        
        try:
            query_job = self.client.query(query)
            results = list(query_job)
            logger.info(f"🎯 Found {len(results)} brands for potential engagement")
            return results
        except Exception as e:
            logger.error(f"❌ Error querying engagement emails: {e}")
            return []
    
    def extract_links_from_email(self, body_html, body_text="", domain=""):
        """Extract clickable links from email content"""
        links = []
        
        if body_html:
            # Extract href links from HTML
            href_pattern = r'href=["\']([^"\']+)["\']'
            html_links = re.findall(href_pattern, body_html, re.IGNORECASE)
            links.extend(html_links)
        
        if body_text:
            # Extract URLs from plain text
            url_pattern = r'https?://[^\s<>"]+[^\s<>".,)]'
            text_links = re.findall(url_pattern, body_text)
            links.extend(text_links)
        
        # Filter and clean links
        filtered_links = []
        for link in links:
            # Skip unsubscribe, email, and other non-engagement links
            if any(skip in link.lower() for skip in [
                'unsubscribe', 'mailto:', 'tel:', '#', 'javascript:',
                'preferences', 'remove', 'opt-out', 'privacy-policy',
                'terms', 'facebook.com', 'twitter.com', 'instagram.com'
            ]):
                continue
            
            # Clean up link
            clean_link = link.strip().rstrip('.,)')
            if clean_link.startswith('http') and len(clean_link) > 10:
                filtered_links.append(clean_link)
        
        # Remove duplicates while preserving order
        seen = set()
        unique_links = []
        for link in filtered_links:
            if link not in seen:
                seen.add(link)
                unique_links.append(link)
        
        # Prioritize brand/product links over generic ones
        priority_links = [link for link in unique_links if domain and domain in link]
        other_links = [link for link in unique_links if not domain or domain not in link]
        
        return priority_links + other_links
    
    def should_engage_with_brand(self, domain):
        """Check if brand needs engagement (7+ days since last engagement)"""
        if domain not in self.engagement_state['engagements']:
            return True
        
        last_engaged = self.engagement_state['engagements'][domain].get('last_engaged')
        if not last_engaged:
            return True
        
        try:
            last_date = datetime.fromisoformat(last_engaged.replace('Z', '+00:00'))
            days_since = (datetime.now() - last_date.replace(tzinfo=None)).days
            return days_since >= 7
        except:
            return True
    
    def should_confirm_subscription(self, domain, email_id):
        """Check if subscription needs confirmation"""
        if domain not in self.engagement_state['confirmations']:
            return True
        
        confirmed_emails = self.engagement_state['confirmations'][domain].get('confirmation_urls', [])
        return email_id not in confirmed_emails
    
    def click_link_with_browser(self, url, link_type="engagement"):
        """Use Playwright to click a link and simulate engagement"""
        if self.dry_run:
            logger.info(f"🔍 DRY RUN: Would click {link_type} link: {url[:100]}...")
            return True
        
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(
                    headless=self.browser_config['headless'],
                    args=['--no-sandbox', '--disable-setuid-sandbox']
                )
                
                context = browser.new_context(
                    user_agent=self.browser_config['user_agent'],
                    viewport={'width': 1280, 'height': 720}
                )
                
                page = context.new_page()
                
                logger.info(f"🔗 Clicking {link_type} link: {url[:100]}...")
                
                # Navigate to the URL
                response = page.goto(url, wait_until='domcontentloaded', timeout=30000)
                
                if response and response.status == 200:
                    # Wait a bit to simulate human behavior
                    time.sleep(2)
                    
                    # Take a screenshot for verification
                    screenshot_name = f"{link_type}_{int(time.time())}.png"
                    page.screenshot(path=f"logs/{screenshot_name}")
                    
                    logger.info(f"✅ Successfully clicked {link_type} link")
                    browser.close()
                    return True
                else:
                    logger.warning(f"⚠️ Link returned status: {response and response.status}")
                    browser.close()
                    return False
                    
        except Exception as e:
            logger.error(f"❌ Error clicking link: {e}")
            return False
    
    def process_confirmation_emails(self):
        """Process and confirm subscription emails"""
        if self.engagement_only:
            logger.info("⏭️ Skipping confirmations (engagement only mode)")
            return 0
            
        logger.info("🔍 Processing confirmation emails...")
        
        confirmation_emails = self.get_confirmation_emails()
        confirmed_count = 0
        
        for email in confirmation_emails:
            if confirmed_count >= self.max_confirmations:
                logger.info(f"📊 Reached max confirmations limit: {self.max_confirmations}")
                break
                
            domain = email.domain
            email_id = email.email_id
            
            if not self.should_confirm_subscription(domain, email_id):
                logger.info(f"⏭️ Already confirmed subscription for {domain}")
                continue
            
            # Extract confirmation links
            links = self.extract_links_from_email(email.body_html, email.body_text, domain)
            
            # Look for confirmation-specific links
            confirmation_links = [
                link for link in links 
                if any(keyword in link.lower() for keyword in [
                    'confirm', 'verify', 'activate', 'complete'
                ])
            ]
            
            if not confirmation_links:
                confirmation_links = links[:1]  # Use first available link
            
            if confirmation_links:
                success = self.click_link_with_browser(confirmation_links[0], "confirmation")
                
                if success:
                    # Update confirmation state
                    if domain not in self.engagement_state['confirmations']:
                        self.engagement_state['confirmations'][domain] = {
                            'confirmation_urls': [],
                            'last_confirmed': None
                        }
                    
                    self.engagement_state['confirmations'][domain]['confirmation_urls'].append(email_id)
                    self.engagement_state['confirmations'][domain]['last_confirmed'] = datetime.now().isoformat()
                    
                    confirmed_count += 1
                    logger.info(f"✅ Confirmed subscription for {domain}")
                    
                    # Wait between confirmations
                    if not self.dry_run:
                        time.sleep(5)
        
        logger.info(f"📊 Confirmed {confirmed_count} subscriptions")
        return confirmed_count
    
    def process_engagement_emails(self):
        """Process brands for engagement (1 link per brand every 7 days)"""
        if self.confirmations_only:
            logger.info("⏭️ Skipping engagements (confirmations only mode)")
            return 0
            
        logger.info("🎯 Processing engagement emails...")
        
        engagement_emails = self.get_engagement_emails()
        engaged_count = 0
        
        for email in engagement_emails:
            if engaged_count >= self.max_engagements:
                logger.info(f"📊 Reached max engagements limit: {self.max_engagements}")
                break
                
            domain = email.domain
            
            if not self.should_engage_with_brand(domain):
                logger.info(f"⏭️ Recently engaged with {domain}, skipping")
                continue
            
            # Extract engagement links
            links = self.extract_links_from_email(email.body_html, email.body_text, domain)
            
            if links:
                success = self.click_link_with_browser(links[0], "engagement")
                
                if success:
                    # Update engagement state
                    if domain not in self.engagement_state['engagements']:
                        self.engagement_state['engagements'][domain] = {
                            'engagement_count': 0
                        }
                    
                    self.engagement_state['engagements'][domain].update({
                        'last_engaged': datetime.now().isoformat(),
                        'last_url': links[0],
                        'engagement_count': self.engagement_state['engagements'][domain].get('engagement_count', 0) + 1
                    })
                    
                    engaged_count += 1
                    logger.info(f"✅ Engaged with {domain}")
                    
                    # Wait between engagements
                    if not self.dry_run:
                        time.sleep(10)
            else:
                logger.warning(f"⚠️ No suitable links found for {domain}")
        
        logger.info(f"📊 Engaged with {engaged_count} brands")
        return engaged_count
    
    def run(self):
        """Main execution function"""
        logger.info("🚀 Starting Email Engagement Bot")
        logger.info(f"🔧 Config: Confirmations={not self.engagement_only}, Engagements={not self.confirmations_only}, Dry Run={self.dry_run}")
        
        # Create logs directory
        os.makedirs("logs", exist_ok=True)
        
        try:
            # Process confirmations first
            confirmed_count = self.process_confirmation_emails()
            
            # Then process engagements
            engaged_count = self.process_engagement_emails()
            
            # Update last run time
            self.engagement_state['last_run'] = datetime.now().isoformat()
            
            # Save state
            self.save_engagement_state()
            
            # Summary
            logger.info("📊 ENGAGEMENT BOT SUMMARY:")
            logger.info(f"  ✅ Confirmations: {confirmed_count}")
            logger.info(f"  🎯 Engagements: {engaged_count}")
            logger.info(f"  📅 Total brands tracked: {len(self.engagement_state['engagements'])}")
            
            return {
                'confirmations': confirmed_count,
                'engagements': engaged_count,
                'success': True
            }
            
        except Exception as e:
            logger.error(f"❌ Error in main execution: {e}")
            return {'success': False, 'error': str(e)}

def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='Email Engagement Bot')
    parser.add_argument('--engagement-only', action='store_true', 
                       help='Only process engagement emails, skip confirmations')
    parser.add_argument('--confirmations-only', action='store_true',
                       help='Only process confirmation emails, skip engagement')
    parser.add_argument('--dry-run', action='store_true',
                       help='Dry run mode - query emails but dont click links')
    parser.add_argument('--max-confirmations', type=int, default=20,
                       help='Maximum number of confirmations to process')
    parser.add_argument('--max-engagements', type=int, default=30,
                       help='Maximum number of brands to engage with')
    parser.add_argument('--headless', action='store_true', default=True,
                       help='Run browser in headless mode')
    
    return parser.parse_args()

def main():
    args = parse_args()
    
    config = {
        'engagement_only': args.engagement_only,
        'confirmations_only': args.confirmations_only,
        'dry_run': args.dry_run,
        'max_confirmations': args.max_confirmations,
        'max_engagements': args.max_engagements,
        'headless': args.headless
    }
    
    bot = EmailEngagementBot(config)
    result = bot.run()
    
    if result['success']:
        print("🎉 Email engagement bot completed successfully!")
    else:
        print(f"❌ Email engagement bot failed: {result.get('error')}")
        exit(1)

if __name__ == "__main__":
    main() 