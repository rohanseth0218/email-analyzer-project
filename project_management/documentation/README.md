# Email Analyzer Project

This project contains tools for analyzing emails, taking screenshots of email content, and processing email data for insights.

## Project Structure

```
email_analyzer_project/
├── src/                    # Main source code
│   ├── email_analyzer.py               # Core email analysis functionality
│   ├── get_recent_emails.py            # Email retrieval from various sources
│   ├── imap_email_screenshot.py        # IMAP email screenshot capture
│   ├── production_screenshot_gpt.py     # AI-powered screenshot analysis
│   └── screenshot_storage.py           # Screenshot storage and management
│
├── scripts/                # Utility scripts
│   └── analyze_api_response.py         # API response analysis tools
│
├── data/                   # Email data and analysis results
│   ├── recent_emails_20250603_170619.json
│   ├── ripple_engagement_test_20250603_171920.json
│   └── ripple_engagement_test_20250603_170856.json
│
├── tests/                  # Test files
│   ├── production_test_lite.py
│   └── production_pipeline_test.py
│
└── logs/                   # Analysis logs
    └── link_click_test.log
```

## Key Features

- **Email Analysis**: Comprehensive email content analysis and insights
- **Screenshot Capture**: Automated email screenshot generation
- **AI Integration**: GPT-powered analysis of email screenshots
- **Data Processing**: Email engagement and interaction tracking

## Getting Started

1. Navigate to the project directory:
   ```bash
   cd email_analyzer_project/
   ```

2. Install dependencies (if using separate virtual environment):
   ```bash
   pip install -r ../requirements.txt
   ```

3. Run email analysis:
   ```bash
   python src/email_analyzer.py
   ```

## Main Components

- **email_analyzer.py**: Primary analysis engine
- **production_screenshot_gpt.py**: Most comprehensive screenshot analysis tool
- **get_recent_emails.py**: Email retrieval and preprocessing
- **screenshot_storage.py**: Screenshot management and storage 