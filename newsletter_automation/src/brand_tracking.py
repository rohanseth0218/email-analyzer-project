#!/usr/bin/env python3
"""
Brand Tracking System
Monitors newsletter signups vs actual emails received for gap analysis
"""

import json
import re
from datetime import datetime, timedelta
from google.cloud import bigquery
from typing import List, Dict, Set, Optional
import requests


class BrandTracker:
    def __init__(self, project_id: str):
        self.project_id = project_id
        self.client = bigquery.Client(project=project_id)
        
        # Create signup tracking table if doesn't exist
        self.setup_signup_table()
    
    def setup_signup_table(self):
        """Create signup tracking table in BigQuery"""
        try:
            table_id = f"{self.project_id}.email_analytics.newsletter_signups"
            
            schema = [
                bigquery.SchemaField("signup_id", "STRING"),
                bigquery.SchemaField("brand_name", "STRING"),
                bigquery.SchemaField("brand_domain", "STRING"), 
                bigquery.SchemaField("signup_email", "STRING"),
                bigquery.SchemaField("signup_date", "TIMESTAMP"),
                bigquery.SchemaField("signup_method", "STRING"),  # manual, automation, etc
                bigquery.SchemaField("expected_sender_domains", "STRING"),  # JSON array
                bigquery.SchemaField("first_email_received", "TIMESTAMP"),
                bigquery.SchemaField("total_emails_received", "INTEGER"),
                bigquery.SchemaField("last_email_received", "TIMESTAMP"),
                bigquery.SchemaField("signup_status", "STRING"),  # pending, receiving, inactive
                bigquery.SchemaField("notes", "STRING")
            ]
            
            table = bigquery.Table(table_id, schema=schema)
            table = self.client.create_table(table, exists_ok=True)
            print(f"✅ Signup tracking table ready: {table_id}")
            
        except Exception as e:
            print(f"⚠️ Signup table setup failed: {e}")
    
    def log_signup(self, brand_name: str, brand_domain: str, signup_email: str, 
                   signup_method: str = "manual", expected_domains: List[str] = None):
        """Log a new newsletter signup"""
        try:
            table_id = f"{self.project_id}.email_analytics.newsletter_signups"
            
            signup_id = f"{brand_domain}_{signup_email}_{datetime.now().strftime('%Y%m%d')}"
            
            row = {
                'signup_id': signup_id,
                'brand_name': brand_name,
                'brand_domain': brand_domain,
                'signup_email': signup_email,
                'signup_date': datetime.now().isoformat(),
                'signup_method': signup_method,
                'expected_sender_domains': json.dumps(expected_domains or [brand_domain]),
                'total_emails_received': 0,
                'signup_status': 'pending'
            }
            
            errors = self.client.insert_rows_json(table_id, [row])
            
            if errors:
                print(f"❌ Signup logging error: {errors}")
            else:
                print(f"✅ Logged signup: {brand_name} ({brand_domain})")
                
        except Exception as e:
            print(f"❌ Signup logging failed: {e}")
    
    def get_brand_from_email(self, sender_email: str, sender_domain: str, gpt_analysis: Dict) -> str:
        """Extract brand name from email data and GPT analysis"""
        # Priority order: GPT analysis > domain parsing > sender name
        
        # 1. From GPT analysis
        if gpt_analysis and gpt_analysis.get('brand_name'):
            return gpt_analysis['brand_name'].strip()
        
        # 2. From domain parsing
        domain_brand = self.extract_brand_from_domain(sender_domain)
        if domain_brand:
            return domain_brand
        
        # 3. From sender email prefix
        email_prefix = sender_email.split('@')[0]
        if email_prefix not in ['no-reply', 'noreply', 'info', 'hello', 'hi', 'team', 'support']:
            return email_prefix.replace('.', ' ').replace('_', ' ').title()
        
        return sender_domain
    
    def extract_brand_from_domain(self, domain: str) -> Optional[str]:
        """Extract brand name from domain"""
        # Remove common prefixes/suffixes
        domain = domain.lower()
        domain = re.sub(r'^(www\.|mail\.|email\.|newsletter\.)', '', domain)
        domain = re.sub(r'\.(com|org|net|io|co\.uk|gov)$', '', domain)
        
        # Handle common patterns
        if '.' in domain:
            parts = domain.split('.')
            # Take the main part (usually second-to-last for subdomains)
            main_part = parts[-2] if len(parts) > 1 else parts[0]
        else:
            main_part = domain
        
        # Clean up and format
        brand = main_part.replace('-', ' ').replace('_', ' ')
        return brand.title() if len(brand) > 2 else None
    
    def update_email_received(self, sender_email: str, sender_domain: str, gpt_analysis: Dict):
        """Update signup record when email is received"""
        try:
            brand_name = self.get_brand_from_email(sender_email, sender_domain, gpt_analysis)
            
            # Find matching signup record
            query = f"""
            UPDATE `{self.project_id}.email_analytics.newsletter_signups`
            SET 
                total_emails_received = total_emails_received + 1,
                last_email_received = CURRENT_TIMESTAMP(),
                first_email_received = COALESCE(first_email_received, CURRENT_TIMESTAMP()),
                signup_status = 'receiving'
            WHERE 
                (brand_name = @brand_name OR brand_domain = @sender_domain)
                AND signup_status != 'inactive'
            """
            
            job_config = bigquery.QueryJobConfig(
                query_parameters=[
                    bigquery.ScalarQueryParameter("brand_name", "STRING", brand_name),
                    bigquery.ScalarQueryParameter("sender_domain", "STRING", sender_domain)
                ]
            )
            
            query_job = self.client.query(query, job_config=job_config)
            query_job.result()  # Wait for completion
            
            print(f"✅ Updated email tracking for {brand_name}")
            
        except Exception as e:
            print(f"⚠️ Email tracking update failed: {e}")
    
    def get_gap_analysis(self) -> Dict:
        """Get comprehensive gap analysis report"""
        try:
            # Query for signup vs email analysis
            query = f"""
            WITH signup_stats AS (
                SELECT 
                    brand_name,
                    brand_domain,
                    signup_date,
                    total_emails_received,
                    first_email_received,
                    last_email_received,
                    signup_status,
                    DATE_DIFF(CURRENT_DATE(), DATE(signup_date), DAY) as days_since_signup
                FROM `{self.project_id}.email_analytics.newsletter_signups`
            ),
            email_brands AS (
                SELECT 
                    brand_name,
                    sender_domain,
                    COUNT(*) as emails_analyzed,
                    MIN(processing_timestamp) as first_email_analyzed,
                    MAX(processing_timestamp) as last_email_analyzed
                FROM `{self.project_id}.email_analytics.marketing_emails`
                WHERE brand_name IS NOT NULL AND brand_name != ''
                GROUP BY brand_name, sender_domain
            )
            
            SELECT 
                -- Signups with no emails
                'no_emails_received' as category,
                s.brand_name,
                s.brand_domain,
                s.signup_date,
                s.days_since_signup,
                0 as emails_analyzed
            FROM signup_stats s
            LEFT JOIN email_brands e ON (
                s.brand_name = e.brand_name OR 
                s.brand_domain = e.sender_domain
            )
            WHERE e.brand_name IS NULL AND s.total_emails_received = 0
            
            UNION ALL
            
            SELECT 
                -- Emails received but not analyzed
                'emails_not_in_analysis' as category,
                e.brand_name,
                e.sender_domain as brand_domain,
                NULL as signup_date,
                NULL as days_since_signup,
                e.emails_analyzed
            FROM email_brands e
            LEFT JOIN signup_stats s ON (
                e.brand_name = s.brand_name OR 
                e.sender_domain = s.brand_domain
            )
            WHERE s.brand_name IS NULL
            
            UNION ALL
            
            SELECT 
                -- Successfully matched
                'matched' as category,
                s.brand_name,
                s.brand_domain,
                s.signup_date,
                s.days_since_signup,
                COALESCE(e.emails_analyzed, 0) as emails_analyzed
            FROM signup_stats s
            JOIN email_brands e ON (
                s.brand_name = e.brand_name OR 
                s.brand_domain = e.sender_domain
            )
            
            ORDER BY category, brand_name
            """
            
            query_job = self.client.query(query)
            results = query_job.result()
            
            # Process results
            gap_analysis = {
                'no_emails_received': [],
                'emails_not_in_analysis': [], 
                'matched': [],
                'summary': {}
            }
            
            for row in results:
                category = row['category']
                gap_analysis[category].append(dict(row))
            
            # Calculate summary stats
            gap_analysis['summary'] = {
                'total_signups': len(gap_analysis['no_emails_received']) + len(gap_analysis['matched']),
                'signups_receiving_emails': len(gap_analysis['matched']),
                'signups_no_emails': len(gap_analysis['no_emails_received']),
                'brands_not_signed_up': len(gap_analysis['emails_not_in_analysis']),
                'conversion_rate': (len(gap_analysis['matched']) / max(1, len(gap_analysis['no_emails_received']) + len(gap_analysis['matched']))) * 100
            }
            
            return gap_analysis
            
        except Exception as e:
            print(f"❌ Gap analysis failed: {e}")
            return {}
    
    def send_gap_analysis_to_slack(self, webhook_url: str):
        """Send gap analysis report to Slack"""
        try:
            analysis = self.get_gap_analysis()
            summary = analysis.get('summary', {})
            
            message = {
                "text": f"📊 **Brand Tracking Gap Analysis**\n\n"
                       f"🎯 **Summary:**\n"
                       f"• Total Signups: {summary.get('total_signups', 0)}\n"
                       f"• Receiving Emails: {summary.get('signups_receiving_emails', 0)}\n"
                       f"• No Emails Yet: {summary.get('signups_no_emails', 0)}\n"
                       f"• Conversion Rate: {summary.get('conversion_rate', 0):.1f}%\n"
                       f"• Untracked Brands: {summary.get('brands_not_signed_up', 0)}\n\n"
                       f"📋 Top Missing Brands:\n"
            }
            
            # Add top missing brands
            no_emails = analysis.get('no_emails_received', [])[:5]
            for brand in no_emails:
                days = brand.get('days_since_signup', 0)
                message['text'] += f"• {brand['brand_name']} ({days} days ago)\n"
            
            response = requests.post(webhook_url, json=message, timeout=10)
            
            if response.status_code == 200:
                print("📨 Gap analysis sent to Slack")
            else:
                print(f"⚠️ Slack notification failed: {response.status_code}")
                
        except Exception as e:
            print(f"❌ Slack notification failed: {e}")


def main():
    """Example usage"""
    PROJECT_ID = "instant-ground-394115"
    SLACK_WEBHOOK = "https://hooks.slack.com/services/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"
    
    tracker = BrandTracker(PROJECT_ID)
    
    # Example: Log some signups
    tracker.log_signup("Nike", "nike.com", "rohan@test.com", "automation")
    tracker.log_signup("Adidas", "adidas.com", "rohan@test.com", "manual")
    
    # Get gap analysis
    analysis = tracker.get_gap_analysis()
    print(json.dumps(analysis, indent=2, default=str))
    
    # Send to Slack
    tracker.send_gap_analysis_to_slack(SLACK_WEBHOOK)


if __name__ == "__main__":
    main() 