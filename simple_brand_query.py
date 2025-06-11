#!/usr/bin/env python3
"""
Simple script to see what brands you have email analysis for in BigQuery
"""

from google.cloud import bigquery

def get_analyzed_brands():
    """Get all brands from BigQuery email analysis"""
    try:
        client = bigquery.Client(project="instant-ground-394115")
        
        query = """
        SELECT 
            brand_name,
            sender_domain,
            COUNT(*) as email_count,
            MIN(DATE(processing_timestamp)) as first_email_date,
            MAX(DATE(processing_timestamp)) as last_email_date,
            AVG(CAST(design_quality_score AS FLOAT64)) as avg_design_score
        FROM `instant-ground-394115.email_analytics.marketing_emails`
        WHERE brand_name IS NOT NULL 
            AND brand_name != ''
            AND brand_name != 'unknown'
        GROUP BY brand_name, sender_domain
        ORDER BY email_count DESC
        """
        
        query_job = client.query(query)
        results = query_job.result()
        
        brands = []
        for row in results:
            brands.append({
                'brand_name': row['brand_name'],
                'sender_domain': row['sender_domain'], 
                'email_count': row['email_count'],
                'first_email_date': str(row['first_email_date']) if row['first_email_date'] else '',
                'last_email_date': str(row['last_email_date']) if row['last_email_date'] else '',
                'avg_design_score': round(row['avg_design_score'] or 0, 1)
            })
        
        return brands
        
    except Exception as e:
        print(f"❌ Error querying BigQuery: {e}")
        return []

def main():
    print("📊 BRANDS IN EMAIL ANALYSIS DATABASE")
    print("=" * 50)
    
    brands = get_analyzed_brands()
    
    if not brands:
        print("❌ No brands found in BigQuery")
        return
    
    print(f"✅ Found {len(brands)} brands with email analysis data\n")
    
    # Show top brands by email count
    print("🏆 TOP BRANDS BY EMAIL COUNT:")
    print("Rank | Brand Name | Domain | Emails | Avg Design Score")
    print("-" * 65)
    
    for i, brand in enumerate(brands[:50], 1):  # Top 50
        print(f"{i:2d}. | {brand['brand_name'][:20]:20} | {brand['sender_domain'][:20]:20} | {brand['email_count']:6} | {brand['avg_design_score']:4}")
    
    if len(brands) > 50:
        print(f"\n... and {len(brands) - 50} more brands")
    
    # Summary stats
    total_emails = sum(b['email_count'] for b in brands)
    avg_emails_per_brand = total_emails / len(brands) if brands else 0
    
    print(f"\n📈 SUMMARY:")
    print(f"• Total Brands: {len(brands):,}")
    print(f"• Total Emails Analyzed: {total_emails:,}")
    print(f"• Average Emails per Brand: {avg_emails_per_brand:.1f}")
    
    # Save to file for reference
    import json
    with open('analyzed_brands.json', 'w') as f:
        json.dump(brands, f, indent=2)
    
    print(f"\n💾 Full results saved to: analyzed_brands.json")
    print(f"\n💡 Now you can manually check which of these {len(brands)} brands you remember signing up for!")

if __name__ == "__main__":
    main() 