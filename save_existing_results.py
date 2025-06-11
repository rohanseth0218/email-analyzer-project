#!/usr/bin/env python3
"""
Save the existing brand analysis results to JSON and CSV files
Based on the previous analysis that found 1680 unique brands
"""

import json
import csv
from datetime import datetime

def create_summary_results():
    """Create files based on the previous analysis results"""
    
    # Summary data from the previous analysis
    analysis_summary = {
        'analysis_metadata': {
            'timestamp': datetime.now().isoformat(),
            'days_analyzed': 30,
            'mailboxes_analyzed': 68,
            'total_unique_brands': 1680,
            'total_marketing_emails': 2618,
            'average_emails_per_brand': 1.6
        },
        'distribution_stats': {
            'brands_with_1_email': 1115,
            'brands_with_2_5_emails': 537,
            'brands_with_6_10_emails': 26,
            'brands_with_10_plus_emails': 2,
            'top_brand_email_count': 12
        },
        'top_30_brands': [
            {'rank': 1, 'brand_name': 'Paramountpeptides', 'domain': 'paramountpeptides.com', 'total_emails': 12, 'mailbox_count': 2, 'example': 'Hi there! SAVE 20% This Memorial Day Weekend!'},
            {'rank': 2, 'brand_name': 'Teeter', 'domain': 'teeter.com', 'total_emails': 11, 'mailbox_count': 2, 'example': 'Your discount code has arrived'},
            {'rank': 3, 'brand_name': 'Ucogear', 'domain': 'ucogear.com', 'total_emails': 9, 'mailbox_count': 1, 'example': 'Memorial Day Sale ends tonight- 20% off'},
            {'rank': 4, 'brand_name': 'Us', 'domain': 'us.happystaffyco.com', 'total_emails': 9, 'mailbox_count': 1, 'example': 'Welcome to Happy Staffy Co Rewards Program!'},
            {'rank': 5, 'brand_name': 'Ivycityco', 'domain': 'ivycityco.com', 'total_emails': 9, 'mailbox_count': 1, 'example': 'welcome to the family! ✨'},
            {'rank': 6, 'brand_name': 'Editorialist', 'domain': 'editorialist.com', 'total_emails': 9, 'mailbox_count': 1, 'example': 'Welcome to Editorialist'},
            {'rank': 7, 'brand_name': 'G', 'domain': 'g.shopifyemail.com', 'total_emails': 9, 'mailbox_count': 7, 'example': 'Confirm you want to receive email marketing'},
            {'rank': 8, 'brand_name': 'Carmensol', 'domain': 'carmensol.com', 'total_emails': 8, 'mailbox_count': 1, 'example': 'Welcome to Carmen Sol + 10% OFF!'},
            {'rank': 9, 'brand_name': 'Harrisseeds', 'domain': 'harrisseeds.com', 'total_emails': 7, 'mailbox_count': 3, 'example': 'Welcome to the Harris Seeds Community'},
            {'rank': 10, 'brand_name': 'Hello', 'domain': 'hello.happystaffyco.com', 'total_emails': 7, 'mailbox_count': 1, 'example': 'Your mystery discount...'},
            {'rank': 11, 'brand_name': 'None', 'domain': 'mail.bloomscape.com', 'total_emails': 7, 'mailbox_count': 2, 'example': 'Hi ! $20 Off Your First Plant Purchase is here 🪴'},
            {'rank': 12, 'brand_name': 'Drivelinebaseball', 'domain': 'drivelinebaseball.com', 'total_emails': 7, 'mailbox_count': 2, 'example': 'Train Like You Compete With Leather Weighted Baseballs'},
            {'rank': 13, 'brand_name': 'Thebeardclub', 'domain': 'thebeardclub.com', 'total_emails': 7, 'mailbox_count': 2, 'example': 'You unlocked 35% off + a free mystery item!'},
            {'rank': 14, 'brand_name': 'Aweinspired', 'domain': 'aweinspired.com', 'total_emails': 6, 'mailbox_count': 2, 'example': 'Discover the World of Awe 💫'},
            {'rank': 15, 'brand_name': 'Kemimoto', 'domain': 'kemimoto.com', 'total_emails': 6, 'mailbox_count': 1, 'example': 'Welcome to Kemimoto!'},
            {'rank': 16, 'brand_name': 'Gosomega', 'domain': 'gosomega.com', 'total_emails': 6, 'mailbox_count': 1, 'example': 'Confirm Your Subscription'},
            {'rank': 17, 'brand_name': 'Gundrymd', 'domain': 'gundrymd.com', 'total_emails': 6, 'mailbox_count': 1, 'example': 'Welcome to GundryMD!'},
            {'rank': 18, 'brand_name': 'Theouai', 'domain': 'theouai.com', 'total_emails': 6, 'mailbox_count': 2, 'example': 'Welcome to the yes OUAI'},
            {'rank': 19, 'brand_name': 'Blackstoneproducts', 'domain': 'blackstoneproducts.com', 'total_emails': 6, 'mailbox_count': 3, 'example': 'Welcome to Blackstone 🥩'},
            {'rank': 20, 'brand_name': 'Goodr', 'domain': 'goodr.com', 'total_emails': 6, 'mailbox_count': 3, 'example': 'Welcome to goodr 😎'},
            {'rank': 21, 'brand_name': 'Kevynaucoin', 'domain': 'kevynaucoin.com', 'total_emails': 6, 'mailbox_count': 3, 'example': 'Welcome — Your 15% OFF Awaits'},
            {'rank': 22, 'brand_name': 'Shopmicas', 'domain': 'shopmicas.com', 'total_emails': 6, 'mailbox_count': 2, 'example': 'Welcome to MICAS 💖'},
            {'rank': 23, 'brand_name': 'None', 'domain': 'email.dcshoes.com', 'total_emails': 6, 'mailbox_count': 4, 'example': 'Welcome to DC Shoes'},
            {'rank': 24, 'brand_name': 'Calpaktravel', 'domain': 'calpaktravel.com', 'total_emails': 6, 'mailbox_count': 3, 'example': 'Welcome to CALPAK'},
            {'rank': 25, 'brand_name': 'Em', 'domain': 'em.boandtee.com', 'total_emails': 6, 'mailbox_count': 3, 'example': 'Welcome to Bo+Tee!'},
            {'rank': 26, 'brand_name': 'Clean', 'domain': 'clean.4ocean.com', 'total_emails': 6, 'mailbox_count': 2, 'example': 'Hey, this is Alex'},
            {'rank': 27, 'brand_name': 'Pupford', 'domain': 'pupford.com', 'total_emails': 6, 'mailbox_count': 3, 'example': 'Customer account activation'},
            {'rank': 28, 'brand_name': 'Smackpetfood', 'domain': 'smackpetfood.com', 'total_emails': 6, 'mailbox_count': 1, 'example': 'Three Reasons Pawrents LOVE Artisanal Bits1️⃣2️⃣3️⃣'},
            {'rank': 29, 'brand_name': 'Legionathletics', 'domain': 'legionathletics.com', 'total_emails': 5, 'mailbox_count': 2, 'example': 'Welcome to Legion! Enjoy BOGO 50% off'},
            {'rank': 30, 'brand_name': 'Hatclub', 'domain': 'hatclub.com', 'total_emails': 5, 'mailbox_count': 2, 'example': '👋 Welcome! Your 10% off is here'}
        ]
    }
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    # Save to JSON
    json_filename = f'brand_analysis_summary_{timestamp}.json'
    with open(json_filename, 'w', encoding='utf-8') as f:
        json.dump(analysis_summary, f, indent=2, ensure_ascii=False)
    
    print(f"💾 JSON summary saved to: {json_filename}")
    
    # Save top 30 to CSV
    csv_filename = f'top_30_brands_{timestamp}.csv'
    with open(csv_filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Rank', 'Brand Name', 'Domain', 'Total Emails', 'Mailbox Count', 'Example Subject'])
        
        for brand in analysis_summary['top_30_brands']:
            writer.writerow([
                brand['rank'],
                brand['brand_name'],
                brand['domain'],
                brand['total_emails'],
                brand['mailbox_count'],
                brand['example']
            ])
    
    print(f"💾 Top 30 brands CSV saved to: {csv_filename}")
    
    # Save summary stats to CSV
    summary_csv = f'brand_analysis_stats_{timestamp}.csv'
    with open(summary_csv, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Metric', 'Value'])
        writer.writerow(['Analysis Date', datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
        writer.writerow(['Days Analyzed', analysis_summary['analysis_metadata']['days_analyzed']])
        writer.writerow(['Mailboxes Analyzed', analysis_summary['analysis_metadata']['mailboxes_analyzed']])
        writer.writerow(['Total Unique Brands', analysis_summary['analysis_metadata']['total_unique_brands']])
        writer.writerow(['Total Marketing Emails', analysis_summary['analysis_metadata']['total_marketing_emails']])
        writer.writerow(['Average Emails per Brand', analysis_summary['analysis_metadata']['average_emails_per_brand']])
        writer.writerow(['', ''])
        writer.writerow(['DISTRIBUTION BREAKDOWN', ''])
        writer.writerow(['Brands with 1 email', analysis_summary['distribution_stats']['brands_with_1_email']])
        writer.writerow(['Brands with 2-5 emails', analysis_summary['distribution_stats']['brands_with_2_5_emails']])
        writer.writerow(['Brands with 6-10 emails', analysis_summary['distribution_stats']['brands_with_6_10_emails']])
        writer.writerow(['Brands with 10+ emails', analysis_summary['distribution_stats']['brands_with_10_plus_emails']])
        writer.writerow(['Top brand email count', analysis_summary['distribution_stats']['top_brand_email_count']])
    
    print(f"💾 Summary stats CSV saved to: {summary_csv}")
    
    return json_filename, csv_filename, summary_csv

def main():
    print("📊 SAVING EXISTING BRAND ANALYSIS RESULTS")
    print("=" * 50)
    print("Based on previous analysis of 68 mailboxes over 30 days")
    print("Found 1680 unique brands with 2618 total marketing emails")
    print("=" * 50)
    
    json_file, csv_file, summary_file = create_summary_results()
    
    print(f"\n✅ RESULTS SAVED:")
    print(f"📋 Complete JSON: {json_file}")
    print(f"🏆 Top 30 CSV: {csv_file}")
    print(f"📈 Stats CSV: {summary_file}")
    
    print(f"\n🎯 KEY FINDINGS:")
    print(f"• Total unique brands: 1,680")
    print(f"• Total marketing emails: 2,618")
    print(f"• Average emails per brand: 1.6")
    print(f"• Top brand (Paramountpeptides): 12 emails")
    print(f"• 66% of brands (1,115) sent only 1 email")
    print(f"• Only 28 brands sent 6+ emails")

if __name__ == "__main__":
    main() 