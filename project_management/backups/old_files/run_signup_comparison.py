#!/usr/bin/env python3
"""
Quick script to compare your 8k newsletter signups vs BigQuery email analysis
"""

import sys
import os
sys.path.append('src')

from signup_vs_analysis_comparison import SignupAnalysisComparator

def main():
    print("🚀 Comparing Newsletter Signups vs Email Analysis Data")
    print("=" * 60)
    
    # Initialize comparator
    comparator = SignupAnalysisComparator()
    
    # Load your 8k signups - UPDATE THIS PATH TO YOUR ACTUAL FILE
    signups_file = "newsletter_signups.csv"  # Change this to your actual file
    
    if os.path.exists(signups_file):
        print(f"📂 Loading signups from {signups_file}...")
        signups = comparator.load_signups_from_csv(signups_file)
    else:
        print(f"❌ File {signups_file} not found!")
        print(f"💡 Please create your signups file or update the path in this script")
        print(f"📝 Use the template: newsletter_signups_template.csv")
        return
    
    if not signups:
        print("❌ No signups loaded. Please check your data file.")
        return
    
    print(f"✅ Loaded {len(signups)} newsletter signups")
    
    # Get analyzed brands from BigQuery
    print("🔍 Querying BigQuery for analyzed brands...")
    analyzed_brands = comparator.get_analyzed_brands_from_bigquery()
    
    if not analyzed_brands:
        print("❌ No analyzed brands found in BigQuery.")
        print("💡 Make sure your email processing has run and data is in BigQuery")
        return
    
    print(f"✅ Found {len(analyzed_brands)} brands in email analysis")
    
    # Compare
    print("🔄 Comparing signups vs analysis...")
    comparison = comparator.compare_signups_vs_analysis(signups, analyzed_brands)
    
    # Generate and print report
    report = comparator.generate_report(comparison)
    print(report)
    
    # Save detailed results
    results_file = comparator.save_detailed_results(comparison)
    
    print(f"\n✅ Analysis complete!")
    print(f"📄 Detailed results saved to: {results_file}")
    print(f"📊 Summary: {comparison['summary']['matched_signups']:,} of {comparison['summary']['total_signups']:,} signups are sending emails ({comparison['summary']['conversion_rate']}%)")

if __name__ == "__main__":
    main() 