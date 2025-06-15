#!/usr/bin/env python3
"""
Brand Tracking Endpoints
Flask endpoints for managing newsletter signups and gap analysis
"""

from flask import Flask, request, jsonify
from brand_tracking import BrandTracker
import json
from datetime import datetime

app = Flask(__name__)

# Configuration
PROJECT_ID = "instant-ground-394115"
SLACK_WEBHOOK = "https://hooks.slack.com/services/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"

# Initialize brand tracker
brand_tracker = BrandTracker(PROJECT_ID)

@app.route('/signup', methods=['POST'])
def log_signup():
    """Log a new newsletter signup"""
    try:
        data = request.json
        
        # Required fields
        brand_name = data.get('brand_name')
        brand_domain = data.get('brand_domain')
        signup_email = data.get('signup_email')
        
        if not all([brand_name, brand_domain, signup_email]):
            return jsonify({
                'error': 'Missing required fields: brand_name, brand_domain, signup_email'
            }), 400
        
        # Optional fields
        signup_method = data.get('signup_method', 'manual')
        expected_domains = data.get('expected_domains', [])
        
        # Log the signup
        brand_tracker.log_signup(
            brand_name=brand_name,
            brand_domain=brand_domain, 
            signup_email=signup_email,
            signup_method=signup_method,
            expected_domains=expected_domains
        )
        
        return jsonify({
            'status': 'success',
            'message': f'Signup logged for {brand_name}',
            'signup_date': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/signup/bulk', methods=['POST'])
def log_bulk_signups():
    """Log multiple newsletter signups at once"""
    try:
        data = request.json
        signups = data.get('signups', [])
        
        if not signups:
            return jsonify({
                'error': 'No signups provided'
            }), 400
        
        results = []
        for signup in signups:
            try:
                brand_tracker.log_signup(
                    brand_name=signup.get('brand_name'),
                    brand_domain=signup.get('brand_domain'),
                    signup_email=signup.get('signup_email'),
                    signup_method=signup.get('signup_method', 'bulk'),
                    expected_domains=signup.get('expected_domains', [])
                )
                results.append({
                    'brand_name': signup.get('brand_name'),
                    'status': 'success'
                })
            except Exception as e:
                results.append({
                    'brand_name': signup.get('brand_name'),
                    'status': 'error',
                    'error': str(e)
                })
        
        return jsonify({
            'status': 'completed',
            'total_signups': len(signups),
            'results': results
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/gap-analysis', methods=['GET'])
def get_gap_analysis():
    """Get brand tracking gap analysis"""
    try:
        analysis = brand_tracker.get_gap_analysis()
        
        return jsonify({
            'status': 'success',
            'analysis': analysis,
            'generated_at': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/gap-analysis/slack', methods=['POST'])
def send_gap_analysis_slack():
    """Send gap analysis to Slack"""
    try:
        brand_tracker.send_gap_analysis_to_slack(SLACK_WEBHOOK)
        
        return jsonify({
            'status': 'success',
            'message': 'Gap analysis sent to Slack'
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/brands/missing', methods=['GET'])
def get_missing_brands():
    """Get brands that signed up but haven't sent emails"""
    try:
        analysis = brand_tracker.get_gap_analysis()
        missing_brands = analysis.get('no_emails_received', [])
        
        # Sort by days since signup (most recent first)
        missing_brands.sort(key=lambda x: x.get('days_since_signup', 0))
        
        return jsonify({
            'status': 'success',
            'missing_brands': missing_brands,
            'total_missing': len(missing_brands),
            'summary': analysis.get('summary', {})
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/brands/untracked', methods=['GET'])
def get_untracked_brands():
    """Get brands sending emails but not in signup database"""
    try:
        analysis = brand_tracker.get_gap_analysis()
        untracked_brands = analysis.get('emails_not_in_analysis', [])
        
        return jsonify({
            'status': 'success',
            'untracked_brands': untracked_brands,
            'total_untracked': len(untracked_brands),
            'message': 'These brands are sending emails but you haven\'t logged signups for them'
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/dashboard', methods=['GET'])
def get_dashboard():
    """Get complete brand tracking dashboard"""
    try:
        analysis = brand_tracker.get_gap_analysis()
        summary = analysis.get('summary', {})
        
        dashboard = {
            'overview': {
                'total_signups': summary.get('total_signups', 0),
                'signups_receiving_emails': summary.get('signups_receiving_emails', 0),
                'conversion_rate': round(summary.get('conversion_rate', 0), 1),
                'signups_no_emails': summary.get('signups_no_emails', 0),
                'untracked_brands': summary.get('brands_not_signed_up', 0)
            },
            'top_missing_brands': analysis.get('no_emails_received', [])[:10],
            'top_untracked_brands': analysis.get('emails_not_in_analysis', [])[:10],
            'successful_matches': len(analysis.get('matched', [])),
            'recommendations': []
        }
        
        # Add recommendations
        if dashboard['overview']['signups_no_emails'] > 0:
            dashboard['recommendations'].append(
                f"Follow up on {dashboard['overview']['signups_no_emails']} brands that haven't sent emails yet"
            )
        
        if dashboard['overview']['untracked_brands'] > 0:
            dashboard['recommendations'].append(
                f"Add {dashboard['overview']['untracked_brands']} sending brands to your signup tracking"
            )
        
        if dashboard['overview']['conversion_rate'] < 70:
            dashboard['recommendations'].append(
                "Consider improving signup quality - conversion rate is below 70%"
            )
        
        return jsonify({
            'status': 'success',
            'dashboard': dashboard,
            'last_updated': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

if __name__ == '__main__':
    print("🚀 Starting Brand Tracking API server...")
    app.run(host='0.0.0.0', port=8080, debug=True) 