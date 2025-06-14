#!/usr/bin/env python3
"""
Production Email Analysis Pipeline - Fetch, Screenshot, Analyze, Store (No Engagement)
"""

import os
import json
import re
import base64
import time
import requests
from datetime import datetime, timedelta
import openai
from google.cloud import bigquery
from google.oauth2 import service_account
from typing import Dict, List, Optional, Any
from screenshot_storage import ScreenshotStorage

# Configuration (cleaned up)
CONFIG = {
    'azure_openai': {
        'api_key': os.getenv('AZURE_OPENAI_API_KEY', '13cee442c9ba4f5382ed2781af2be124'),
        'endpoint': os.getenv('AZURE_OPENAI_ENDPOINT', 'https://ripple-gpt.openai.azure.com/'),
        'deployment_name': os.getenv('AZURE_OPENAI_DEPLOYMENT_NAME', 'gpt-4o'),
        'api_version': '2024-02-01'
    },
    'htmlcss_to_image': {
        'api_key': os.getenv('HTMLCSS_TO_IMAGE_API_KEY', ''),
        'user_id': os.getenv('HTMLCSS_TO_IMAGE_USER_ID', ''),
        'base_url': 'https://hcti.io/v1'
    },
    'bigquery': {
        'project_id': 'instant-ground-394115',
        'dataset_id': 'email_analytics',
        'table_id': 'email_analysis_results',
        'credentials_path': './gcp-service-account.json'
    },
    'screenshot_storage': {
        'enabled': True,
        'bucket_name': 'email-screenshots-bucket-394115',
        'project_id': 'instant-ground-394115',
        'credentials_path': './gcp-service-account.json',
        'cleanup_local_files': True,
        'bucket_region': 'us-central1'
    },
    'duplicate_prevention': {
        'enabled': True,
        'check_days_back': 30,
    }
}

class ProductionEmailAnalysisPipeline:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.setup_openai()
        self.setup_bigquery()
        self.setup_screenshot_storage()
        self.marketing_keywords = [
            'unsubscribe', 'newsletter', 'promotion', 'discount', 'offer', 'sale', 'deal',
            'limited time', 'exclusive', 'free shipping', 'thank you for signing up',
            'welcome', 'get started', 'click here', 'shop now', 'learn more',
            'special offer', 'save money', 'don\'t miss', 'act now', 'expires'
        ]
        self.marketing_domains = [
            'noreply', 'newsletter', 'marketing', 'promo', 'offers', 'notifications',
            'hello@', 'hi@', 'team@', 'support@'
        ]
        print("✅ Production Email Analysis Pipeline initialized")

    def setup_openai(self):
        from openai import AzureOpenAI
        import httpx
        
        # Create HTTP client without proxies
        http_client = httpx.Client(proxies=None)
        
        self.openai_client = AzureOpenAI(
            api_key=self.config['azure_openai']['api_key'],
            azure_endpoint=self.config['azure_openai']['endpoint'],
            api_version=self.config['azure_openai']['api_version'],
            http_client=http_client
        )
        print("✅ Azure OpenAI client configured")

    def setup_bigquery(self):
        try:
            if os.path.exists(self.config['bigquery']['credentials_path']):
                credentials = service_account.Credentials.from_service_account_file(
                    self.config['bigquery']['credentials_path']
                )
                self.bq_client = bigquery.Client(
                    credentials=credentials,
                    project=self.config['bigquery']['project_id']
                )
                print("✅ BigQuery client configured with service account")
            else:
                self.bq_client = bigquery.Client(project=self.config['bigquery']['project_id'])
                print("✅ BigQuery client configured with default credentials")
            self.ensure_bigquery_setup()
        except Exception as e:
            print(f"⚠️ BigQuery setup failed: {e}")
            self.bq_client = None

    def setup_screenshot_storage(self):
        try:
            if self.config['screenshot_storage']['enabled']:
                self.screenshot_storage = ScreenshotStorage(
                    project_id=self.config['screenshot_storage']['project_id'],
                    bucket_name=self.config['screenshot_storage']['bucket_name'],
                    credentials_path=self.config['screenshot_storage']['credentials_path'],
                    bucket_region=self.config['screenshot_storage']['bucket_region']
                )
                print("✅ Screenshot storage configured")
            else:
                self.screenshot_storage = None
                print("⚠️ Screenshot storage disabled")
        except Exception as e:
            print(f"⚠️ Screenshot storage setup failed: {e}")
            self.screenshot_storage = None

    def ensure_bigquery_setup(self):
        """Ensure BigQuery dataset and table exist with proper schema"""
        dataset_id = self.config['bigquery']['dataset_id']
        table_id = self.config['bigquery']['table_id']
        dataset_ref = self.bq_client.dataset(dataset_id)
        try:
            self.bq_client.get_dataset(dataset_ref)
            print(f"✅ Dataset {dataset_id} exists")
        except:
            dataset = bigquery.Dataset(dataset_ref)
            dataset.location = "US"
            self.bq_client.create_dataset(dataset)
            print(f"✅ Created dataset {dataset_id}")
        table_ref = dataset_ref.table(table_id)
        try:
            self.bq_client.get_table(table_ref)
            print(f"✅ Table {table_id} exists")
        except:
            schema = [
                bigquery.SchemaField("email_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("sender_email", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("subject", "STRING", mode="NULLABLE"),
                bigquery.SchemaField("date_received", "TIMESTAMP", mode="NULLABLE"),
                bigquery.SchemaField("sender_domain", "STRING", mode="NULLABLE"),
                bigquery.SchemaField("screenshot_path", "STRING", mode="NULLABLE"),
                bigquery.SchemaField("screenshot_url", "STRING", mode="NULLABLE"),
                bigquery.SchemaField("gpt_analysis", "JSON", mode="NULLABLE"),
                bigquery.SchemaField("num_products_featured", "INTEGER", mode="NULLABLE"),
                bigquery.SchemaField("processing_status", "STRING", mode="NULLABLE"),
                bigquery.SchemaField("errors", "STRING", mode="NULLABLE"),
                bigquery.SchemaField("raw_email_data", "JSON", mode="NULLABLE"),
                bigquery.SchemaField("analysis_timestamp", "TIMESTAMP", mode="NULLABLE"),
            ]
            table = bigquery.Table(table_ref, schema=schema)
            self.bq_client.create_table(table)
            print(f"✅ Created table {table_id}")

    def connect_imap(self, mailbox_config: Dict[str, str]):
        """Connect to IMAP server"""
        try:
            print(f"🔌 Connecting to {mailbox_config['name']} ({mailbox_config['imap_server']})...")
            mail = imaplib.IMAP4_SSL(mailbox_config['imap_server'], mailbox_config['imap_port'])
            mail.login(mailbox_config['email'], mailbox_config['password'])
            mail.select('inbox')
            print("✅ IMAP connection successful")
            return mail
        except Exception as e:
            print(f"❌ IMAP connection failed: {e}")
            return None
    
    def is_marketing_email(self, email_content: str, sender_email: str) -> int:
        """Enhanced marketing email detection with scoring system"""
        marketing_score = 0
        full_content = email_content.lower()
        
        # Check for marketing keywords (+1 each)
        for keyword in self.marketing_keywords:
            if keyword in full_content:
                marketing_score += 1
        
        # Check sender domain patterns (+2 each)
        for domain_pattern in self.marketing_domains:
            if domain_pattern in sender_email.lower():
                marketing_score += 2
        
        # Unsubscribe link is a strong indicator (+3 points)
        if 'unsubscribe' in full_content:
            marketing_score += 3
        
        # Check for HTML complexity (marketing emails often more complex)
        html_tags = len(re.findall(r'<[^>]+>', email_content))
        if html_tags > 50:
            marketing_score += 2
        
        # Check for noreply addresses (strong marketing indicator)
        if 'noreply' in sender_email.lower() or 'no-reply' in sender_email.lower():
            marketing_score += 3
        
        return marketing_score
    
    def should_exclude_email(self, subject: str, sender_email: str, content: str) -> bool:
        """Filter out warmup emails, tracking emails, and other unwanted emails"""
        
        subject_lower = subject.lower()
        content_lower = content.lower()
        sender_lower = sender_email.lower()
        
        # Exclude emails with "Ripple" in subject (warmup emails)
        if 'ripple' in subject_lower:
            print(f"   ❌ Excluded warmup email (Ripple): {subject[:50]}...")
            return True
        
        # Exclude emails with tracking codes in subject (pattern: | CODE1 CODE2)
        tracking_pattern = r'\|\s*[A-Z0-9]{3,}\s+[A-Z0-9]{3,}'
        if re.search(tracking_pattern, subject):
            print(f"   ❌ Excluded tracking email: {subject[:50]}...")
            return True
        
        # Exclude emails that start with "Re:" (replies/conversations)
        if subject_lower.startswith('re:'):
            print(f"   ❌ Excluded reply email: {subject[:50]}...")
            return True
        
        # Exclude emails that start with "Fwd:" (forwards)
        if subject_lower.startswith('fwd:') or subject_lower.startswith('fw:'):
            print(f"   ❌ Excluded forwarded email: {subject[:50]}...")
            return True
        
        # Exclude warmup domain patterns (common warmup services)
        warmup_domains = [
            'warmup', 'warm-up', 'emailwarmup', 'mailwarm', 
            'warmy', 'lemwarm', 'instantly.ai'
        ]
        
        for warmup_domain in warmup_domains:
            if warmup_domain in sender_lower:
                print(f"   ❌ Excluded warmup service email: {sender_email}")
                return True
        
        # Exclude emails with common warmup subject patterns
        warmup_subjects = [
            'test email', 'warmup', 'warm up', 'connectivity test',
            'delivery test', 'inbox test'
        ]
        
        for warmup_subject in warmup_subjects:
            if warmup_subject in subject_lower:
                print(f"   ❌ Excluded warmup subject: {subject[:50]}...")
                return True
        
        # Exclude emails with excessive tracking codes (more than 2 codes in subject)
        code_count = len(re.findall(r'[A-Z0-9]{5,}', subject))
        if code_count > 2:
            print(f"   ❌ Excluded excessive tracking codes: {subject[:50]}...")
            return True
        
        # Exclude auto-responders and system emails
        auto_responder_indicators = [
            'auto', 'automated', 'system', 'daemon', 'mailer',
            'postmaster', 'admin', 'root'
        ]
        
        for indicator in auto_responder_indicators:
            if indicator in sender_lower and 'reply' in sender_lower:
                print(f"   ❌ Excluded auto-responder: {sender_email}")
                return True
        
        return False
    
    def extract_links_from_html(self, html_content: str) -> List[Dict[str, str]]:
        """Extract all links from HTML content with tracking detection"""
        links = []
        
        # Find all href attributes
        href_pattern = r'href=["\']([^"\']+)["\']'
        matches = re.findall(href_pattern, html_content, re.IGNORECASE)
        
        for url in matches:
            # Skip mailto, tel, and anchor links
            if url.startswith(('#', 'mailto:', 'tel:')):
                continue
            
            # Try to find the link text
            link_text_pattern = rf'<a[^>]*href=["\']' + re.escape(url) + r'["\'][^>]*>([^<]*)</a>'
            text_match = re.search(link_text_pattern, html_content, re.IGNORECASE | re.DOTALL)
            
            link_text = "Unknown"
            if text_match:
                link_text = text_match.group(1).strip()
                link_text = re.sub(r'<[^>]+>', '', link_text).strip()
            
            # Detect tracking links
            is_tracking = any(tracker in url.lower() for tracker in [
                'klclick', 'klaviyo', 'ctrk', 'click', 'track', 'utm_', 'email',
                'sendgrid', 'mailchimp', 'constantcontact'
            ])
            
            links.append({
                'url': url,
                'text': link_text,
                'is_tracking': is_tracking
            })
        
        return links
    
    def get_marketing_emails(self, mailbox_config: Dict[str, str], days_back: int = 7) -> List[Dict]:
        """Fetch marketing emails from IMAP with enhanced detection"""
        print(f"📫 Fetching marketing emails from {mailbox_config['name']} (last {days_back} days)...")
        
        mail = self.connect_imap(mailbox_config)
        if not mail:
            return []
        
        # Search for recent emails
        since_date = (datetime.now() - timedelta(days=days_back)).strftime("%d-%b-%Y")
        status, messages = mail.search(None, f'SINCE "{since_date}"')
        
        if status != 'OK':
            print("❌ Failed to search emails")
            return []
        
        message_ids = messages[0].split()
        print(f"📧 Found {len(message_ids)} total emails to analyze")
        
        marketing_emails = []
        
        # Process recent emails
        for i, msg_id in enumerate(message_ids[-50:], 1):  # Last 50 emails
            try:
                print(f"   Processing email {i}/50...")
                
                # Fetch email
                status, msg_data = mail.fetch(msg_id, '(RFC822)')
                if status != 'OK' or not msg_data or not msg_data[0] or not msg_data[0][1]:
                    print(f"   ❌ Failed to fetch email {i}: Invalid response")
                    continue
                
                # Parse email
                email_body = msg_data[0][1]
                email_message = email.message_from_bytes(email_body)
                
                # Check if email_message is valid
                if not email_message:
                    print(f"   ❌ Failed to parse email {i}: Invalid email format")
                    continue
                
                # Extract content
                text_content = ""
                html_content = ""
                
                if email_message.is_multipart():
                    for part in email_message.walk():
                        content_type = part.get_content_type()
                        if content_type == "text/plain":
                            payload = part.get_payload(decode=True)
                            if payload:
                                text_content = payload.decode('utf-8', errors='ignore')
                        elif content_type == "text/html":
                            payload = part.get_payload(decode=True)
                            if payload:
                                html_content = payload.decode('utf-8', errors='ignore')
                else:
                    payload = email_message.get_payload(decode=True)
                    if payload:
                        if email_message.get_content_type() == "text/html":
                            html_content = payload.decode('utf-8', errors='ignore')
                        else:
                            text_content = payload.decode('utf-8', errors='ignore')
                
                full_content = text_content + " " + html_content
                sender = email_message.get('From', '')
                sender_email = re.search(r'<(.+?)>', sender)
                sender_email = sender_email.group(1) if sender_email else sender.strip()
                
                subject = email_message.get('Subject', '')
                
                # First check if we should exclude this email (warmup, tracking, etc.)
                if self.should_exclude_email(subject, sender_email, full_content):
                    continue
                
                # Marketing detection with scoring
                marketing_score = self.is_marketing_email(full_content, sender_email)
                
                # Only process if it's a marketing email (score >= 3) and has HTML
                if marketing_score >= 3 and html_content:
                    # Extract links
                    links = self.extract_links_from_html(html_content)
                    
                    email_data = {
                        'message_id': msg_id.decode(),
                        'mailbox_name': mailbox_config['name'],
                        'sender_email': sender_email,
                        'sender_domain': sender_email.split('@')[-1] if '@' in sender_email else '',
                        'subject': subject,
                        'date_received': email_message.get('Date', ''),
                        'content_text': text_content,
                        'content_html': html_content,
                        'marketing_score': marketing_score,
                        'links': links,
                        'total_links': len(links),
                        'tracking_links': len([l for l in links if l['is_tracking']]),
                        'has_unsubscribe': 'unsubscribe' in full_content.lower(),
                    }
                    marketing_emails.append(email_data)
                    print(f"   ✅ Marketing email: {sender_email} - {subject[:50]}")
                    
            except Exception as e:
                print(f"   ❌ Error processing email {i}: {e}")
                continue
        
        mail.close()
        mail.logout()
        
        print(f"✅ Found {len(marketing_emails)} marketing emails")
        return marketing_emails
    
    def create_screenshot_with_upload(self, email_data: Dict[str, Any]) -> Optional[tuple]:
        """Create screenshot and upload to GCP, return (local_path, cloud_url)"""
        print(f"📸 Creating screenshot for email from {email_data['sender_email']}")
        
        # First create the local screenshot
        local_path = self.create_screenshot(email_data)
        
        if not local_path:
            return None, None
        
        # Upload to GCP if storage is configured
        cloud_url = None
        if self.screenshot_storage:
            print(f"☁️ Uploading screenshot to GCP with signed URL...")
            # Use signed URL method for secure access (valid for 7 days)
            cloud_url = self.screenshot_storage.upload_screenshot_with_signed_url(
                local_path, 
                email_data, 
                expiration_hours=168  # 7 days
            )
            
            # Clean up local file if configured and upload successful
            if cloud_url and self.config['screenshot_storage']['cleanup_local_files']:
                try:
                    os.remove(local_path)
                    print(f"🗑️ Cleaned up local screenshot: {local_path}")
                    # Return only cloud URL since local file is deleted
                    return None, cloud_url
                except Exception as e:
                    print(f"⚠️ Failed to delete local screenshot: {e}")
        
        return local_path, cloud_url
    
    def create_screenshot(self, email_data: Dict[str, Any]) -> Optional[str]:
        """Create screenshot using HTML/CSS to Image API"""
        print(f"📸 Creating screenshot via HTML/CSS to Image API for email from {email_data['sender_email']}")
        
        # Check if HTML/CSS to Image credentials are available
        if not self.config['htmlcss_to_image']['api_key']:
            print("❌ HTML/CSS to Image API key not found in environment variables")
            return None
        if not self.config['htmlcss_to_image']['user_id']:
            print("❌ HTML/CSS to Image User ID not found in environment variables")
            return None
        
        try:
            # Create HTML content for the email
            html_content = email_data.get('content_html', '')
            if not html_content:
                print("❌ No HTML content available for screenshot")
                return None
            
            # Create clean HTML template optimized for email rendering
            clean_html = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Email Content</title>
                <style>
                    body {{
                        margin: 0;
                        padding: 20px;
                        font-family: Arial, sans-serif;
                        background: white;
                        max-width: 800px;
                        line-height: 1.4;
                    }}
                    img {{
                        max-width: 100%;
                        height: auto;
                        display: block;
                    }}
                    table {{
                        max-width: 100%;
                        border-collapse: collapse;
                    }}
                    .email-container {{
                        max-width: 800px;
                        margin: 0 auto;
                        background: white;
                    }}
                </style>
            </head>
            <body>
                <div class="email-container">
                    {html_content}
                </div>
            </body>
            </html>
            """
            
            # Prepare the API request
            api_data = {
                'html': clean_html,
                'viewport_width': 800,
                'viewport_height': 1200,
                'device_scale_factor': 2,
                'format': 'png',
                'ms_delay': 1000,  # Wait 1 second for images to load
                'google_fonts': 'Roboto|Open Sans'  # Common email fonts
            }
            
            # Make API request to HTML/CSS to Image
            response = requests.post(
                f"{self.config['htmlcss_to_image']['base_url']}/image",
                json=api_data,
                auth=(self.config['htmlcss_to_image']['user_id'], self.config['htmlcss_to_image']['api_key']),
                timeout=30
            )
            
            print(f"🔍 HTML/CSS to Image API response: {response.status_code}")
            
            if response.status_code != 200:
                print(f"❌ Failed to create screenshot: {response.status_code}")
                print(f"❌ Response text: {response.text}")
                return None
            
            # Get the image URL from response
            response_data = response.json()
            image_url = response_data.get('url')
            
            if not image_url:
                print("❌ No image URL returned from API")
                return None
            
            print(f"✅ Screenshot created successfully: {image_url}")
            
            # Download the image
            image_response = requests.get(image_url, timeout=30)
            if image_response.status_code != 200:
                print(f"❌ Failed to download screenshot: {image_response.status_code}")
                return None
            
            # Save the image locally
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            sender_clean = re.sub(r'[^a-zA-Z0-9]', '_', email_data['sender_email'])
            filename = f"email_screenshot_{sender_clean}_{timestamp}.png"
            
            with open(filename, 'wb') as f:
                f.write(image_response.content)
            
            print(f"✅ Screenshot saved locally: {filename}")
            return filename
            
        except json.JSONDecodeError as e:
            print(f"❌ HTML/CSS to Image API returned invalid JSON: {e}")
            return None
        except Exception as e:
            print(f"❌ HTML/CSS to Image screenshot failed: {e}")
            return None
    
    def analyze_with_gpt4v(self, screenshot_path: str, email_data: Dict[str, Any]) -> Optional[Dict]:
        """
        Analyze the email screenshot and HTML using GPT-4V, extracting only the required fields with detailed, explicit instructions.
        """
        try:
            # Read screenshot as base64
            with open(screenshot_path, "rb") as img_file:
                base64_image = base64.b64encode(img_file.read()).decode("utf-8")

            # DETAILED PROMPT FOR GPT-4V
            prompt = f"""
You are an expert email analyst. Analyze the provided email screenshot and HTML. Return ONLY valid JSON with the following fields:

"flow_vs_campaign": "string: Is this a flow (automated sequence) or a campaign (one-off blast)? Use only 'flow' or 'campaign'.",
"flow_type": "string or null: If a flow, specify the type (e.g., Welcome, Winback, Abandon Cart, Browse Abandonment, Post-Purchase, Birthday, etc.). If not a flow, return null.",
"campaign_theme": "string or null: What is the main campaign theme? (e.g., holiday, product launch, clearance, new arrival, etc.). If not clear, return null.",
"event_or_seasonality": "string or null: Is there a specific event or seasonality referenced? (e.g., Black Friday, Summer Sale, Back to School, Mother's Day, etc.). If not present, return null.",
"discount_percent": "string or null: What is the discount percent, if any? (e.g., '20%', '50% off'). If not present, return null.",

"design_level": "string: Rate the design complexity as one of the following, based on the entire email:\n- Basic: Could be designed in a simple HTML editor, no text over images, mostly plain text and basic buttons, minimal or no images.\n- Intermediate: Contains 1-2 images (e.g., a hero image or banner), but most of the layout is built in an HTML editor (like Klaviyo). May have some text over images, but not complex. Some visual hierarchy, but still simple.\n- Advanced: Most of the email is made up of images (e.g., banners, product blocks), likely designed outside an HTML editor (e.g., in Canva or Photoshop), but not highly bespoke. May have text over images, custom backgrounds, and more complex layouts.\n- Super Advanced: Highly bespoke, custom design, likely made by a professional designer. Complex layouts, custom illustrations, advanced visual effects, heavy use of images, and unique branding. Looks expensive and unique.\nBe explicit and use only one of these four options.",

"image_vs_text_ratio": "float: Ratio of image content to text content in the email (0.0 = all text, 1.0 = all images). Estimate based on the visible layout and HTML structure.",

"unsubscribe_visible": "boolean: Is an unsubscribe link or button clearly visible in the email?",
"personalization_used": "boolean: Is any personalization used, such as the recipient's first name, location, or other personal details?",
"social_proof_used": "boolean: Is there any social proof present, such as customer reviews, testimonials, ratings, influencer mentions, or user-generated content?",

"num_products_featured": "integer or null: How many distinct products are featured in the email? Count all unique products shown, whether in a grid, list, or individually. If not applicable, return null.",

"visual_content": [
  {
    "block_index": "integer: The order of the block in the email, starting from 0 at the top.",
    "role": "string: The type of block. Use one of: Text, Button, Image, Banner, Collection, Content, Footer, Hero, Infographic, List, Logo, Navigation, Products, Review, Transition, CTA, or Other.",
    "style": "string: Highly specific visual description of the block's layout, color, placement, and any distinguishing features. Be as detailed as possible (e.g., 'full-width blue banner with white bold headline, left-aligned button below').",
    "desc": "string: 1-sentence visual summary of the block's purpose and content.",
    "copy": "string: The exact copy/text shown in the block. If the block contains multiple text elements, concatenate them with line breaks.",
    "cta": "string or null: Button label if present, otherwise null.",
    "has_image": "boolean: Does this block contain an image?",
    "has_button": "boolean: Does this block contain a button or clickable element?",
    "columns": "integer or null: Number of columns in this block, if applicable (e.g., product grid). Otherwise null."
  }
],

"emotional_tone": "string: What is the overall emotional tone of the email? Use one or more of: urgent, friendly, exclusive, informative, celebratory, instructional, luxury, playful, sincere, bold, casual, or other (specify). Be explicit."

Email context:
- Sender: {email_data.get('sender_email', 'Unknown')}
- Subject: {email_data.get('subject', 'No subject')}
- Domain: {email_data.get('sender_domain', 'Unknown')}

REMEMBER: Only return JSON. No commentary. Fill in all fields with either a value, empty array, or null. Be explicit and detailed in your analysis, especially for design_level, num_products_featured, and visual_content.
            """

            # Call GPT-4V API
            response = self.openai_client.chat.completions.create(
                model=self.config['azure_openai']['deployment_name'],
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/png;base64,{base64_image}",
                                    "detail": "high"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=1500,  # Increased for more comprehensive analysis
                temperature=0.1
            )
            
            analysis_text = response.choices[0].message.content.strip()
            
            # Parse JSON response
            try:
                # Remove potential code block markers
                if analysis_text.startswith('```json'):
                    analysis_text = analysis_text[7:]
                if analysis_text.endswith('```'):
                    analysis_text = analysis_text[:-3]
                analysis_text = analysis_text.strip()
                
                gpt_analysis = json.loads(analysis_text)
                
                # Add technical data that we know
                if 'technical_data' in gpt_analysis:
                    gpt_analysis['technical_data']['screenshot_path'] = screenshot_path
                    gpt_analysis['technical_data']['model_used'] = self.config['azure_openai']['deployment_name']
                    gpt_analysis['technical_data']['raw_gpt_analysis'] = analysis_text
                
                print("✅ Enhanced GPT-4V analysis completed successfully")
                return gpt_analysis
                
            except json.JSONDecodeError as e:
                print(f"⚠️ JSON parsing failed: {e}")
                print(f"Raw response: {analysis_text[:300]}...")
                # Return fallback structure with new schema
                return {
                    "metadata": {
                        "brand_name": "Unknown",
                        "sender_email": email_data.get('sender_email', 'Unknown'),
                        "sender_domain": email_data.get('sender_domain', 'Unknown'),
                        "industry": "Unknown",
                        "email_flow_type": "campaign",
                        "campaign_type": "newsletter",
                        "subject_line": email_data.get('subject', 'No subject'),
                        "target_audience": "Unknown"
                    },
                    "design_analysis": {
                        "design_quality_score": 5,
                        "professional_score": 5,
                        "layout_type": "other",
                        "design_complexity": 3,
                        "color_scheme": "unknown",
                        "colors_used": [],
                        "typography_style": "unknown",
                        "visual_hierarchy_strength": 3,
                        "padding_density": "balanced",
                        "is_mobile_optimized": None,
                        "animation_elements": [],
                        "image_vs_text_ratio": 0.5
                    },
                    "engagement_estimates": {
                        "engagement_likelihood": "medium",
                        "conversion_potential": "medium"
                    },
                    "technical_data": {
                        "screenshot_path": screenshot_path,
                        "model_used": self.config['azure_openai']['deployment_name'],
                        "raw_gpt_analysis": analysis_text,
                        "raw_html_path": None,
                        "image_url": None
                    }
                }
                
        except Exception as e:
            print(f"❌ GPT-4V analysis failed: {e}")
            return None
    
    def save_to_bigquery(self, processed_emails: list):
        """Save processed email analysis results to the new analysis table"""
        table_id = f"{self.config['bigquery']['project_id']}.{self.config['bigquery']['dataset_id']}.{self.config['bigquery']['table_id']}"
        rows_to_insert = []
        for result in processed_emails:
            email_data = result['email_data']
            gpt_analysis = result.get('gpt_analysis') or {}
            row = {
                'email_id': email_data['email_id'],
                'sender_email': email_data['sender_email'],
                'subject': email_data['subject'],
                'date_received': email_data['date_received'],
                'sender_domain': email_data['sender_domain'],
                'screenshot_path': result.get('screenshot_path'),
                'screenshot_url': result.get('screenshot_url'),
                'gpt_analysis': json.dumps(gpt_analysis) if gpt_analysis else None,
                'num_products_featured': gpt_analysis.get('num_products_featured'),
                'processing_status': result.get('processing_status'),
                'errors': json.dumps(result.get('errors')) if result.get('errors') else None,
                'raw_email_data': json.dumps(email_data),
                'analysis_timestamp': datetime.utcnow().isoformat(),
            }
            rows_to_insert.append(row)
        errors = self.bq_client.insert_rows_json(table_id, rows_to_insert)
        if errors:
            print(f"❌ Errors while inserting to BigQuery: {errors}")
        else:
            print(f"✅ Successfully inserted {len(rows_to_insert)} rows to {table_id}")
    
    def check_for_existing_emails(self, email_ids: List[str]) -> List[str]:
        """Check which email IDs already exist in BigQuery to prevent duplicates"""
        if not self.bq_client or not self.config['duplicate_prevention']['enabled']:
            return []
        
        if not email_ids:
            return []
        
        try:
            # Format email IDs for SQL IN clause
            formatted_ids = "', '".join(email_ids)
            
            query = f"""
            SELECT email_id 
            FROM `{self.config['bigquery']['project_id']}.{self.config['bigquery']['dataset_id']}.{self.config['bigquery']['table_id']}`
            WHERE email_id IN ('{formatted_ids}')
            """
            
            query_job = self.bq_client.query(query)
            results = query_job.result()
            
            existing_ids = [row['email_id'] for row in results]
            print(f"🔍 Found {len(existing_ids)} existing emails in BigQuery")
            return existing_ids
            
        except Exception as e:
            print(f"⚠️ Error checking for duplicates: {e}")
            return []
    
    def filter_new_emails(self, marketing_emails: List[Dict]) -> List[Dict]:
        """Filter out emails that already exist in BigQuery"""
        if not self.config['duplicate_prevention']['enabled']:
            return marketing_emails
        
        print(f"🔍 Checking for duplicates among {len(marketing_emails)} emails...")
        
        # Generate email IDs for all emails - use email_id from BigQuery data
        email_ids = []
        for email_data in marketing_emails:
            email_id = email_data['email_id']  # Use the email_id from BigQuery
            email_ids.append(email_id)
        
        # Check which ones already exist
        existing_ids = self.check_for_existing_emails(email_ids)
        
        # Filter out existing emails
        new_emails = []
        for email_data in marketing_emails:
            email_id = email_data['email_id']  # Use the email_id from BigQuery
            if email_id not in existing_ids:
                new_emails.append(email_data)
            else:
                print(f"   ⚠️ Skipping duplicate: {email_data['sender_email']} - {email_data['subject'][:50]}")
        
        print(f"✅ {len(new_emails)} new emails to process (filtered out {len(marketing_emails) - len(new_emails)} duplicates)")
        return new_emails
    
    def fetch_emails_from_bigquery(self, days_back: int = 7, limit: int = None) -> list:
        """Fetch only unanalyzed emails from the cleaned BigQuery table, with optional limit"""
        raw_table = "instant-ground-394115.email_analytics.marketing_emails_clean_20250612_082945"
        analysis_table = f"{self.config['bigquery']['project_id']}.{self.config['bigquery']['dataset_id']}.{self.config['bigquery']['table_id']}"
        limit_clause = f"LIMIT {limit}" if limit else ""
        query = f"""
        SELECT email_id, sender_email, subject, html_content, text_content, date_received, sender_domain
        FROM `{raw_table}`
        WHERE date_received >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {days_back} DAY)
        AND email_id NOT IN (
            SELECT email_id FROM `{analysis_table}`
        )
        {limit_clause}
        """
        try:
            query_job = self.bq_client.query(query)
            results = list(query_job)
            print(f"📧 Fetched {len(results)} unanalyzed emails from BigQuery")
            emails = []
            for row in results:
                emails.append({
                    'email_id': row['email_id'],
                    'sender_email': row['sender_email'],
                    'subject': row['subject'],
                    'content_html': row['html_content'],
                    'content_text': row['text_content'],
                    'date_received': row['date_received'],
                    'sender_domain': row['sender_domain'],
                })
            return emails
        except Exception as e:
            print(f"❌ Error fetching emails from BigQuery: {e}")
            return []

    def process_all_emails(self, days_back: int = 7, limit: int = None):
        print("🚀 Starting Email Analysis Pipeline (BigQuery Source)")
        print("=" * 70)
        all_results = []
        emails = self.fetch_emails_from_bigquery(days_back, limit=limit)
        if not emails:
            print("❌ No emails found in BigQuery")
            return
        emails = self.filter_new_emails(emails)
        if not emails:
            print("❌ No new emails to process (all were duplicates)")
            return
        for i, email_data in enumerate(emails, 1):
            print(f"\n🔄 Processing email {i}/{len(emails)}")
            print(f"   📧 From: {email_data['sender_email']}")
            print(f"   📝 Subject: {email_data['subject'][:60]}...")
            result = {
                'email_data': email_data,
                'screenshot_path': None,
                'screenshot_url': None,
                'gpt_analysis': None,
                'processing_status': 'started',
                'errors': []
            }
            screenshot_result = self.create_screenshot_with_upload(email_data)
            if screenshot_result:
                screenshot_path, cloud_url = screenshot_result
                result['screenshot_path'] = screenshot_path
                result['screenshot_url'] = cloud_url
                analysis_path = screenshot_path if screenshot_path else cloud_url
                if analysis_path:
                    gpt_analysis = self.analyze_with_gpt4v(analysis_path, email_data)
                    if gpt_analysis:
                        result['gpt_analysis'] = gpt_analysis
                        result['processing_status'] = 'completed'
                        print(f"   ✅ Complete processing successful")
                        if cloud_url:
                            print(f"   🌐 Screenshot URL: {cloud_url}")
                    else:
                        result['errors'].append('GPT analysis failed')
                        result['processing_status'] = 'partial'
                        print(f"   ⚠️ Screenshot created, GPT analysis failed")
                else:
                    result['errors'].append('No valid screenshot path')
                    result['processing_status'] = 'failed'
                    print(f"   ❌ No valid screenshot path available")
            else:
                result['errors'].append('Screenshot creation failed')
                result['processing_status'] = 'failed'
                print(f"   ❌ Screenshot creation failed")
            all_results.append(result)
        if all_results:
            successful_results = [r for r in all_results if r['processing_status'] in ['completed', 'partial']]
            if successful_results:
                self.save_to_bigquery(successful_results)
            print("\n" + "=" * 70)
            print("🎯 EMAIL ANALYSIS PIPELINE SUMMARY")
            print("=" * 70)
            successful = len([r for r in all_results if r['processing_status'] == 'completed'])
            partial = len([r for r in all_results if r['processing_status'] == 'partial'])
            failed = len([r for r in all_results if r['processing_status'] == 'failed'])
            print(f"📧 Total emails processed: {len(all_results)}")
            print(f"✅ Fully successful: {successful}")
            print(f"⚠️ Partial success: {partial}")
            print(f"❌ Failed: {failed}")
            if successful > 0:
                print(f"\n🎉 Email analysis pipeline working! {successful} emails fully processed")
                print(f"💾 Data saved to BigQuery for analysis")
        else:
            print("\n❌ No emails were processed successfully")

def main():
    import os
    limit_env = os.getenv("EMAIL_ANALYSIS_LIMIT")
    limit = int(limit_env) if limit_env and limit_env.isdigit() else None
    pipeline = ProductionEmailAnalysisPipeline(CONFIG)
    pipeline.process_all_emails(days_back=7, limit=limit)

if __name__ == "__main__":
    main() 