#!/usr/bin/env python3
"""
Main entry point for Cloud Run email processing service
"""

import os
import sys
import time
from datetime import datetime, timedelta

# Import the email processor
try:
    from production_screenshot_gpt import EmailScreenshotGPTProcessor, CONFIG
    EmailProcessor = EmailScreenshotGPTProcessor
except ImportError as e:
    print(f"❌ Import error: {e}")
    sys.exit(1)

class BatchEmailProcessor:
    def __init__(self, batch_size: int = 10, max_runtime_minutes: int = 50):
        self.batch_size = batch_size
        self.max_runtime_seconds = max_runtime_minutes * 60
        self.start_time = time.time()
        self.processor = EmailProcessor()
    
    def should_continue(self) -> bool:
        """Check if we have time to process another batch"""
        elapsed = time.time() - self.start_time
        return elapsed < self.max_runtime_seconds
    
    def process_in_batches(self, days_back: int = 3, start_mailbox: int = 0):
        """Process emails in batches with timeout awareness"""
        print(f"🚀 Starting Batch Email Processing")
        print(f"⏱️  Max runtime: {self.max_runtime_seconds//60} minutes")
        print(f"📦 Batch size: {self.batch_size} mailboxes")
        print(f"🎯 Starting from mailbox: {start_mailbox + 1}")
        print("=" * 70)
        
        total_mailboxes = len(CONFIG['mailboxes'])
        current_batch_start = start_mailbox
        
        while current_batch_start < total_mailboxes and self.should_continue():
            # Calculate batch end
            batch_end = min(current_batch_start + self.batch_size, total_mailboxes)
            elapsed_minutes = (time.time() - self.start_time) / 60
            
            print(f"\n📦 Processing batch: mailboxes {current_batch_start + 1}-{batch_end} ({elapsed_minutes:.1f}m elapsed)")
            
            # Process this batch
            try:
                batch_config = CONFIG.copy()
                batch_config['mailboxes'] = CONFIG['mailboxes'][current_batch_start:batch_end]
                
                batch_processor = EmailProcessor(batch_config)
                batch_processor.process_emails(days_back)
                
                print(f"✅ Batch {current_batch_start + 1}-{batch_end} completed successfully")
                
            except Exception as e:
                print(f"❌ Batch {current_batch_start + 1}-{batch_end} failed: {e}")
            
            current_batch_start = batch_end
            
            # Check if we should continue
            if not self.should_continue() and current_batch_start < total_mailboxes:
                remaining = total_mailboxes - current_batch_start
                print(f"\n⏰ Approaching timeout with {remaining} mailboxes remaining")
                print(f"🔄 To continue processing, restart with start_mailbox={current_batch_start}")
                break
        
        if current_batch_start >= total_mailboxes:
            print(f"\n🎉 All {total_mailboxes} mailboxes processed successfully!")
        
        return current_batch_start

def main():
    """Main function for Cloud Run"""
    print("🚀 Starting Cloud Run Email Processing Service")
    
    # Get parameters from environment or defaults
    start_mailbox = int(os.environ.get('START_MAILBOX', '0'))
    batch_size = int(os.environ.get('BATCH_SIZE', '10'))
    days_back = int(os.environ.get('DAYS_BACK', '3'))
    max_runtime = int(os.environ.get('MAX_RUNTIME_MINUTES', '50'))
    
    # Process in batches
    batch_processor = BatchEmailProcessor(batch_size=batch_size, max_runtime_minutes=max_runtime)
    final_mailbox = batch_processor.process_in_batches(days_back=days_back, start_mailbox=start_mailbox)
    
    print(f"✅ Processing completed up to mailbox {final_mailbox}")

if __name__ == "__main__":
    main() 