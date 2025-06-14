#!/usr/bin/env python3
"""
Verification script to ensure all critical files are properly organized
and accessible in the new structure.
"""

import os
from pathlib import Path

def check_file_exists(file_path, description):
    """Check if a file exists and report status."""
    if Path(file_path).exists():
        print(f"  ✅ {description}: {file_path}")
        return True
    else:
        print(f"  ❌ MISSING {description}: {file_path}")
        return False

def main():
    print("🔍 Email Analyzer Project Organization Verification")
    print("=" * 55)
    
    all_good = True
    
    # Check Production Files
    print("\n🚀 PRODUCTION FILES:")
    production_files = [
        ("production/automation/full_newsletter_automation_clean.js", "Main Automation Script"),
        ("production/bigquery/newsletter_signup_bigquery.py", "Newsletter BigQuery Processor"),
        ("production/bigquery/upload_newsletter_signup_to_bigquery.py", "BigQuery Upload Script"),
        ("production/bigquery/export_emails_to_bigquery.py", "Email Export Script"),
        ("production/workflows/.github/workflows/newsletter_signup_automation.yml", "GitHub Actions Workflow"),
        ("production/src/", "Source Code Directory"),
        ("production/config/automation_config.js", "Automation Config"),
        ("production/logs/", "Production Logs Directory")
    ]
    
    for file_path, description in production_files:
        if not check_file_exists(file_path, description):
            all_good = False
    
    # Check Development Files
    print("\n🔬 DEVELOPMENT FILES:")
    dev_files = [
        ("development/testing/", "Testing Directory"),
        ("development/tests/", "Test Suites Directory"),
        ("development/experimental/scripts/", "Experimental Scripts")
    ]
    
    for file_path, description in dev_files:
        if not check_file_exists(file_path, description):
            all_good = False
    
    # Check Analysis Files
    print("\n📊 ANALYSIS FILES:")
    analysis_files = [
        ("analysis/queries/simple_revenue_analysis.sql", "Revenue Analysis Query"),
        ("analysis/queries/revenue_band_analysis.sql", "Revenue Band Query"),
        ("analysis/data/", "Data Directory")
    ]
    
    for file_path, description in analysis_files:
        if not check_file_exists(file_path, description):
            all_good = False
    
    # Check Documentation
    print("\n📚 DOCUMENTATION:")
    doc_files = [
        ("documentation/", "Documentation Directory"),
        ("README.md", "Main README")
    ]
    
    for file_path, description in doc_files:
        if not check_file_exists(file_path, description):
            all_good = False
    
    # Check Archive
    print("\n🗄️ ARCHIVE:")
    archive_files = [
        ("archive/old_versions/", "Old Versions Directory")
    ]
    
    for file_path, description in archive_files:
        if not check_file_exists(file_path, description):
            all_good = False
    
    # Summary
    print("\n" + "=" * 55)
    if all_good:
        print("🎉 VERIFICATION PASSED!")
        print("   All critical files are properly organized.")
        print("   You can safely use the organized structure.")
        print("\n💡 Next steps:")
        print("   1. Test running automation from organized_project/production/")
        print("   2. Update any scripts that reference old file paths")
        print("   3. Run cleanup_root.py to remove redundant files")
    else:
        print("⚠️  VERIFICATION FAILED!")
        print("   Some critical files are missing from the organized structure.")
        print("   Please check the missing files before proceeding.")
    
    return all_good

if __name__ == "__main__":
    main() 