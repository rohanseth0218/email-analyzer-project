#!/usr/bin/env python3
"""
Newsletter Signup vs Email Analysis Comparison
Compare your 8k+ newsletter signups against BigQuery email analysis data
"""

import json
import csv
import re
from datetime import datetime
from typing import List, Dict, Set, Optional
from google.cloud import bigquery


class SignupAnalysisComparator:
    def __init__(self, project_id: str = "instant-ground-394115"):
        self.project_id = project_id
        self.client = bigquery.Client(project=project_id)
    
    def load_signups_from_csv(self, csv_file: str) -> List[Dict]:
        """Load your newsletter signups from CSV file"""
        signups = []
        
        try:
            with open(csv_file, 'r') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    # Adapt these field names to match your CSV structure
                    signup = {
                        'brand_name': row.get('brand_name', '').strip(),
                        'domain': row.get('domain', '').strip(),
                        'signup_email': row.get('signup_email', '').strip(),
                        'signup_date': row.get('signup_date', ''),
                        'category': row.get('category', ''),
                        'notes': row.get('notes', '')
                    }
                    
                    if signup['brand_name'] and signup['domain']:
                        signups.append(signup)
            
            print(f"✅ Loaded {len(signups)} signups from {csv_file}")
            return signups
            
        except Exception as e:
            print(f"❌ Error loading signups: {e}")
            return []
    
    def load_signups_from_json(self, json_file: str) -> List[Dict]:
        """Load signups from JSON file"""
        try:
            with open(json_file, 'r') as f:
                data = json.load(f)
                signups = data if isinstance(data, list) else data.get('signups', [])
            
            print(f"✅ Loaded {len(signups)} signups from {json_file}")
            return signups
            
        except Exception as e:
            print(f"❌ Error loading signups: {e}")
            return []
    
    def get_analyzed_brands_from_bigquery(self) -> List[Dict]:
        """Get all brands that have been analyzed in BigQuery"""
        try:
            query = f"""
            SELECT 
                brand_name,
                sender_domain,
                COUNT(*) as email_count,
                MIN(processing_timestamp) as first_email,
                MAX(processing_timestamp) as last_email,
                AVG(CAST(design_quality_score AS FLOAT64)) as avg_design_score,
                AVG(CAST(professional_score AS FLOAT64)) as avg_professional_score
            FROM `{self.project_id}.email_analytics.marketing_emails`
            WHERE brand_name IS NOT NULL 
                AND brand_name != ''
                AND brand_name != 'unknown'
            GROUP BY brand_name, sender_domain
            ORDER BY email_count DESC
            """
            
            query_job = self.client.query(query)
            results = query_job.result()
            
            analyzed_brands = []
            for row in results:
                analyzed_brands.append({
                    'brand_name': row['brand_name'],
                    'sender_domain': row['sender_domain'],
                    'email_count': row['email_count'],
                    'first_email': row['first_email'].isoformat() if row['first_email'] else '',
                    'last_email': row['last_email'].isoformat() if row['last_email'] else '',
                    'avg_design_score': round(row['avg_design_score'] or 0, 1),
                    'avg_professional_score': round(row['avg_professional_score'] or 0, 1)
                })
            
            print(f"✅ Found {len(analyzed_brands)} brands in BigQuery analysis")
            return analyzed_brands
            
        except Exception as e:
            print(f"❌ Error querying BigQuery: {e}")
            return []
    
    def normalize_brand_name(self, name: str) -> str:
        """Normalize brand names for better matching"""
        if not name:
            return ""
        
        # Convert to lowercase
        name = name.lower().strip()
        
        # Remove common suffixes
        name = re.sub(r'\s+(inc|llc|ltd|corp|company|co\.?)$', '', name)
        
        # Remove special characters
        name = re.sub(r'[^\w\s]', '', name)
        
        # Remove extra whitespace
        name = ' '.join(name.split())
        
        return name
    
    def normalize_domain(self, domain: str) -> str:
        """Normalize domains for better matching"""
        if not domain:
            return ""
        
        domain = domain.lower().strip()
        
        # Remove protocol and www
        domain = re.sub(r'^https?://', '', domain)
        domain = re.sub(r'^www\.', '', domain)
        
        # Remove trailing slash
        domain = domain.rstrip('/')
        
        return domain
    
    def compare_signups_vs_analysis(self, signups: List[Dict], analyzed_brands: List[Dict]) -> Dict:
        """Compare newsletter signups against email analysis data"""
        
        # Normalize analyzed brands for matching
        analyzed_lookup = {}
        for brand in analyzed_brands:
            norm_brand = self.normalize_brand_name(brand['brand_name'])
            norm_domain = self.normalize_domain(brand['sender_domain'])
            
            if norm_brand:
                analyzed_lookup[norm_brand] = brand
            if norm_domain:
                analyzed_lookup[norm_domain] = brand
        
        # Compare signups
        matched_signups = []
        missing_from_analysis = []
        
        for signup in signups:
            norm_brand = self.normalize_brand_name(signup['brand_name'])
            norm_domain = self.normalize_domain(signup['domain'])
            
            # Try to find match
            match = None
            if norm_brand in analyzed_lookup:
                match = analyzed_lookup[norm_brand]
            elif norm_domain in analyzed_lookup:
                match = analyzed_lookup[norm_domain]
            
            if match:
                matched_signups.append({
                    'signup': signup,
                    'analysis': match,
                    'match_type': 'brand_name' if norm_brand in analyzed_lookup else 'domain'
                })
            else:
                missing_from_analysis.append(signup)
        
        # Find brands in analysis but not in signups
        signup_brands = set()
        signup_domains = set()
        for signup in signups:
            signup_brands.add(self.normalize_brand_name(signup['brand_name']))
            signup_domains.add(self.normalize_domain(signup['domain']))
        
        untracked_signups = []
        for brand in analyzed_brands:
            norm_brand = self.normalize_brand_name(brand['brand_name'])
            norm_domain = self.normalize_domain(brand['sender_domain'])
            
            if norm_brand not in signup_brands and norm_domain not in signup_domains:
                untracked_signups.append(brand)
        
        # Generate summary
        total_signups = len(signups)
        total_analyzed = len(analyzed_brands)
        total_matched = len(matched_signups)
        total_missing = len(missing_from_analysis)
        total_untracked = len(untracked_signups)
        
        conversion_rate = (total_matched / total_signups * 100) if total_signups > 0 else 0
        
        return {
            'summary': {
                'total_signups': total_signups,
                'total_analyzed_brands': total_analyzed,
                'matched_signups': total_matched,
                'missing_from_analysis': total_missing,
                'untracked_in_analysis': total_untracked,
                'conversion_rate': round(conversion_rate, 1)
            },
            'matched': matched_signups,
            'missing_from_analysis': missing_from_analysis,
            'untracked_in_analysis': untracked_signups
        }
    
    def generate_report(self, comparison: Dict) -> str:
        """Generate a readable report"""
        summary = comparison['summary']
        
        report = f"""
📊 NEWSLETTER SIGNUP vs EMAIL ANALYSIS COMPARISON
{'='*60}

📈 SUMMARY STATS:
• Total Newsletter Signups: {summary['total_signups']:,}
• Total Brands in Analysis: {summary['total_analyzed_brands']:,}
• Successful Matches: {summary['matched_signups']:,}
• Missing from Analysis: {summary['missing_from_analysis']:,}
• Conversion Rate: {summary['conversion_rate']}%

🎯 ANALYSIS:
• {summary['missing_from_analysis']:,} brands you signed up for but haven't received emails from
• {summary['untracked_in_analysis']:,} brands sending emails but not in your signup list

📋 TOP MISSING BRANDS (signed up but no emails):
"""
        
        # Add top missing brands
        missing = comparison['missing_from_analysis'][:20]
        for i, brand in enumerate(missing, 1):
            report += f"{i:2d}. {brand['brand_name']} ({brand['domain']})\n"
        
        report += f"\n🔍 TOP UNTRACKED BRANDS (sending emails but not signed up):\n"
        
        # Add top untracked brands
        untracked = comparison['untracked_in_analysis'][:20]
        for i, brand in enumerate(untracked, 1):
            report += f"{i:2d}. {brand['brand_name']} ({brand['sender_domain']}) - {brand['email_count']} emails\n"
        
        return report
    
    def save_detailed_results(self, comparison: Dict, filename: str = None):
        """Save detailed results to JSON file"""
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"signup_analysis_comparison_{timestamp}.json"
        
        # Prepare output
        output = {
            'generated_at': datetime.now().isoformat(),
            'summary': comparison['summary'],
            'matched_brands': comparison['matched'],
            'missing_from_analysis': comparison['missing_from_analysis'],
            'untracked_in_analysis': comparison['untracked_in_analysis']
        }
        
        with open(filename, 'w') as f:
            json.dump(output, f, indent=2, default=str)
        
        print(f"✅ Detailed results saved to {filename}")
        return filename


def main():
    """Main function - modify paths as needed"""
    comparator = SignupAnalysisComparator()
    
    # OPTION 1: Load signups from CSV
    # signups = comparator.load_signups_from_csv('newsletter_signups.csv')
    
    # OPTION 2: Load signups from JSON
    # signups = comparator.load_signups_from_json('newsletter_signups.json')
    
    # OPTION 3: Manually create sample data for testing
    signups = [
        {'brand_name': 'Nike', 'domain': 'nike.com', 'signup_email': 'test@example.com'},
        {'brand_name': 'Adidas', 'domain': 'adidas.com', 'signup_email': 'test@example.com'},
        {'brand_name': 'Patagonia', 'domain': 'patagonia.com', 'signup_email': 'test@example.com'},
    ]
    
    if not signups:
        print("❌ No signups loaded. Please check your data file.")
        return
    
    # Get analyzed brands from BigQuery
    analyzed_brands = comparator.get_analyzed_brands_from_bigquery()
    
    if not analyzed_brands:
        print("❌ No analyzed brands found in BigQuery.")
        return
    
    # Compare
    comparison = comparator.compare_signups_vs_analysis(signups, analyzed_brands)
    
    # Generate and print report
    report = comparator.generate_report(comparison)
    print(report)
    
    # Save detailed results
    results_file = comparator.save_detailed_results(comparison)
    
    print(f"\n✅ Analysis complete! Check {results_file} for detailed results.")


if __name__ == "__main__":
    main() 