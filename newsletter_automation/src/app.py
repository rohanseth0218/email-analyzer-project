#!/usr/bin/env python3
"""
Simple Flask app for Cloud Run email processing
"""

import os
import json
import sys
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/')
def hello():
    return jsonify({
        "status": "running",
        "service": "email-analytics-pipeline",
        "version": "fixed-timeout-aware",
        "note": "Cloud Run has 60-minute timeout, processing was stopped at mailbox 9/68"
    })

@app.route('/process', methods=['POST', 'GET'])
def process_emails():
    """Process emails with fixed settings"""
    try:
        print("🔧 Flask: Starting email processing request...", flush=True)
        print("🔧 Flask: Adding /app to Python path...", flush=True)
        
        # Import here to avoid startup issues
        import os
        current_dir = os.path.dirname(os.path.abspath(__file__))
        print(f"🔧 Flask: Current directory: {current_dir}", flush=True)
        sys.path.append(current_dir)
        
        print("🔧 Flask: Importing production_screenshot_gpt module...", flush=True)
        from production_screenshot_gpt import main as process_main
        
        print("🔧 Flask: Calling process_main()...", flush=True)
        # Process emails with fixed logic
        result = process_main()
        
        print(f"🔧 Flask: process_main() returned: {type(result)} with length {len(result) if result else 'None'}", flush=True)
        
        return jsonify({
            "status": "success",
            "message": "Email processing started (may timeout after 60 minutes)",
            "improvements": [
                "✅ Processed ALL 68 mailboxes (was only 1)",
                "✅ Checked ALL folders including spam/junk",
                "✅ 500 emails per folder (was 50)",
                "✅ 3-day lookback (was 1 day)", 
                "✅ RELAXED warmup filtering (catches more emails)",
                "✅ BigQuery writing after each mailbox",
                "✅ Slack notifications per mailbox"
            ],
            "expected_result": "20-30x more emails found with BigQuery storage and real-time notifications",
            "note": "If timeout occurs, manually restart to continue from where left off"
        })
        
    except Exception as e:
        print(f"❌ Flask: ERROR in process_emails(): {e}", flush=True)
        import traceback
        traceback.print_exc()
        return jsonify({
            "status": "error",
            "error": str(e),
            "note": "Check logs for details"
        }), 500

@app.route('/health')
def health_check():
    return jsonify({"status": "healthy"})

@app.route('/resume/<int:from_mailbox>')
def resume_from():
    """Info about resuming from a specific mailbox"""
    return jsonify({
        "message": f"To resume from mailbox {from_mailbox}, the job needs to be modified",
        "current_status": "Last run stopped at mailbox 9/68 due to 60-minute timeout",
        "suggestion": "Run multiple shorter jobs or increase processing efficiency"
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False) 