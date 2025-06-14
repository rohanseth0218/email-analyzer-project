#!/usr/bin/env python3
"""
Test script for Email Engagement Bot
Tests the bot functionality without actually clicking links
"""

import json
import os
from email_engagement_bot import EmailEngagementBot

def test_bot():
    """Test the email engagement bot in dry run mode"""
    print("🧪 Testing Email Engagement Bot")
    print("=" * 50)
    
    # Test configuration
    config = {
        'dry_run': True,
        'max_confirmations': 5,
        'max_engagements': 5,
        'headless': True
    }
    
    try:
        # Initialize bot
        bot = EmailEngagementBot(config)
        
        if not bot.client:
            print("❌ Cannot test without BigQuery credentials")
            return False
        
        # Test BigQuery queries
        print("📧 Testing confirmation email query...")
        confirmation_emails = bot.get_confirmation_emails()
        print(f"   Found {len(confirmation_emails)} confirmation emails")
        
        print("🎯 Testing engagement email query...")
        engagement_emails = bot.get_engagement_emails()
        print(f"   Found {len(engagement_emails)} engagement emails")
        
        # Test link extraction
        if confirmation_emails:
            print("🔗 Testing link extraction...")
            sample_email = confirmation_emails[0]
            links = bot.extract_links_from_email(
                sample_email.body_html, 
                sample_email.body_text, 
                sample_email.domain
            )
            print(f"   Extracted {len(links)} links from sample email")
            if links:
                print(f"   Sample link: {links[0][:100]}...")
        
        # Test engagement state
        print("💾 Testing engagement state...")
        bot.save_engagement_state()
        print(f"   State saved with {len(bot.engagement_state['engagements'])} tracked brands")
        
        # Test dry run
        print("🏃 Running bot in dry run mode...")
        result = bot.run()
        
        if result['success']:
            print("✅ Bot test completed successfully!")
            print(f"   Would confirm: {result['confirmations']} subscriptions")
            print(f"   Would engage with: {result['engagements']} brands")
            return True
        else:
            print(f"❌ Bot test failed: {result.get('error')}")
            return False
            
    except Exception as e:
        print(f"❌ Test error: {e}")
        return False

def show_engagement_stats():
    """Show current engagement statistics"""
    print("\n📊 Current Engagement Statistics")
    print("=" * 40)
    
    if os.path.exists('engagement_tracking.json'):
        with open('engagement_tracking.json', 'r') as f:
            state = json.load(f)
        
        confirmations = state.get('confirmations', {})
        engagements = state.get('engagements', {})
        
        print(f"📅 Last run: {state.get('last_run', 'Never')}")
        print(f"✅ Brands with confirmations: {len(confirmations)}")
        print(f"🎯 Brands with engagements: {len(engagements)}")
        
        if engagements:
            print("\n🔥 Recent Engagements:")
            sorted_engagements = sorted(
                engagements.items(), 
                key=lambda x: x[1].get('last_engaged', ''), 
                reverse=True
            )
            
            for brand, data in sorted_engagements[:10]:
                last_engaged = data.get('last_engaged', 'Never')[:10]
                count = data.get('engagement_count', 0)
                print(f"   🎯 {brand}: {count} engagements (last: {last_engaged})")
    else:
        print("⚠️ No engagement tracking file found")

if __name__ == "__main__":
    # Show current stats
    show_engagement_stats()
    
    # Run test
    success = test_bot()
    
    if success:
        print("\n🎉 All tests passed! Bot is ready for deployment.")
    else:
        print("\n❌ Tests failed. Please check configuration and credentials.") 