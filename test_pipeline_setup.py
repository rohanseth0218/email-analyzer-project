#!/usr/bin/env python3
"""
Test script to validate pipeline setup and dependencies
"""

def test_imports():
    """Test all required imports"""
    print("🔍 Testing imports...")
    
    try:
        import os
        import json
        import re
        import base64
        import time
        import requests
        import sys
        import tempfile
        import shutil
        from datetime import datetime, timedelta
        print("✅ Basic Python modules imported")
    except ImportError as e:
        print(f"❌ Basic Python import failed: {e}")
        return False
    
    try:
        import openai
        from google.cloud import bigquery
        from google.oauth2 import service_account
        print("✅ Cloud services modules imported")
    except ImportError as e:
        print(f"❌ Cloud services import failed: {e}")
        return False
    
    try:
        from playwright.sync_api import sync_playwright
        print("✅ Playwright imported")
    except ImportError as e:
        print(f"❌ Playwright import failed: {e}")
        print("💡 Install with: pip install playwright && playwright install chromium")
        return False
    
    try:
        from PIL import Image, ImageDraw, ImageFont
        print("✅ Pillow imported")
    except ImportError as e:
        print(f"❌ Pillow import failed: {e}")
        print("💡 Install with: pip install Pillow")
        return False
    
    return True

def test_playwright():
    """Test Playwright browser functionality"""
    print("\n🎭 Testing Playwright...")
    
    try:
        from playwright.sync_api import sync_playwright
        
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.set_content("<html><body><h1>Test</h1></body></html>")
            browser.close()
        
        print("✅ Playwright browser test successful")
        return True
    except Exception as e:
        print(f"❌ Playwright test failed: {e}")
        print("💡 Try: playwright install chromium --with-deps")
        return False

def test_image_processing():
    """Test image processing functionality"""
    print("\n🖼️ Testing image processing...")
    
    try:
        from PIL import Image, ImageDraw, ImageFont
        
        # Create a test image
        img = Image.new('RGB', (100, 100), color='white')
        draw = ImageDraw.Draw(img)
        draw.text((10, 10), "Test", fill='black')
        
        # Save to temp file
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            img.save(tmp.name)
            
        # Clean up
        import os
        os.unlink(tmp.name)
        
        print("✅ Image processing test successful")
        return True
    except Exception as e:
        print(f"❌ Image processing test failed: {e}")
        return False

def test_pipeline_init():
    """Test pipeline initialization"""
    print("\n🚀 Testing pipeline initialization...")
    
    try:
        # Add src to path
        import sys
        import os
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))
        
        # Import the pipeline
        from production_email_pipeline import ProductionEmailAnalysisPipeline, CONFIG
        
        # Try to initialize (this will test config and basic setup)
        pipeline = ProductionEmailAnalysisPipeline(CONFIG)
        
        print("✅ Pipeline initialization successful")
        return True
    except Exception as e:
        print(f"❌ Pipeline initialization failed: {e}")
        return False

def main():
    """Run all tests"""
    print("🧪 Running pipeline setup tests...\n")
    
    tests = [
        ("Imports", test_imports),
        ("Playwright", test_playwright),
        ("Image Processing", test_image_processing),
        ("Pipeline Init", test_pipeline_init)
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} test crashed: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "="*50)
    print("🧪 TEST SUMMARY")
    print("="*50)
    
    passed = 0
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name:20} {status}")
        if result:
            passed += 1
    
    print(f"\nPassed: {passed}/{len(results)}")
    
    if passed == len(results):
        print("\n🎉 All tests passed! Pipeline is ready to run.")
        return True
    else:
        print(f"\n⚠️ {len(results) - passed} tests failed. Please fix issues before running pipeline.")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1) 