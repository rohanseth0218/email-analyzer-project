#!/usr/bin/env python3
"""
Analyze Storeleads API response to find install date fields
"""

import json
import requests
from datetime import datetime

def analyze_api_response():
    """Analyze the structure of Storeleads API response"""
    print("🔍 ANALYZING STORELEADS API RESPONSE")
    print("=" * 60)
    
    headers = {
        'Authorization': 'Bearer 865bdb6c-98d5-4c64-69a6-a332408f',
        'Content-Type': 'application/json'
    }
    
    params = {
        'bq': '{"must":{"conjuncts":[{"field":"tech","operator":"or","analyzer":"advanced","match":"Klaviyo"}]}}'
    }
    
    try:
        response = requests.get(
            'https://storeleads.app/json/api/v1/all/domain',
            headers=headers,
            params=params,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            
            print(f"📊 Top-level response structure:")
            for key, value in data.items():
                if isinstance(value, list):
                    print(f"  {key}: list with {len(value)} items")
                else:
                    print(f"  {key}: {type(value).__name__} = {value}")
            
            # Analyze first domain record
            if 'domains' in data and data['domains']:
                first_domain = data['domains'][0]
                print(f"\n🏢 First domain record structure:")
                print(f"Domain: {first_domain.get('domain', 'N/A')}")
                
                # Look for all keys in the first record
                print(f"\n📋 All available fields:")
                for key, value in first_domain.items():
                    if isinstance(value, dict):
                        print(f"  {key}: dict with keys {list(value.keys())}")
                    elif isinstance(value, list):
                        print(f"  {key}: list with {len(value)} items")
                        if value and isinstance(value[0], dict):
                            print(f"    First item keys: {list(value[0].keys())}")
                    else:
                        print(f"  {key}: {type(value).__name__} = {str(value)[:100]}")
                
                # Look specifically for date/time fields
                print(f"\n📅 LOOKING FOR DATE/TIME FIELDS:")
                date_keywords = ['date', 'time', 'install', 'added', 'created', 'updated', 'timestamp', 'when', 'since']
                
                def find_date_fields(obj, prefix=""):
                    date_fields = []
                    if isinstance(obj, dict):
                        for key, value in obj.items():
                            full_key = f"{prefix}.{key}" if prefix else key
                            
                            # Check if key suggests a date
                            if any(keyword in key.lower() for keyword in date_keywords):
                                date_fields.append((full_key, value))
                            
                            # Recurse into nested objects
                            if isinstance(value, dict):
                                date_fields.extend(find_date_fields(value, full_key))
                            elif isinstance(value, list) and value and isinstance(value[0], dict):
                                date_fields.extend(find_date_fields(value[0], f"{full_key}[0]"))
                    
                    return date_fields
                
                date_fields = find_date_fields(first_domain)
                
                if date_fields:
                    print("✅ Found potential date fields:")
                    for field_name, field_value in date_fields:
                        print(f"  {field_name}: {field_value}")
                else:
                    print("❌ No obvious date fields found")
                
                # Look specifically for technology/install information
                print(f"\n🔧 TECHNOLOGY INSTALL INFORMATION:")
                tech_keywords = ['tech', 'technology', 'tool', 'service', 'app', 'install']
                
                def find_tech_fields(obj, prefix=""):
                    tech_fields = []
                    if isinstance(obj, dict):
                        for key, value in obj.items():
                            full_key = f"{prefix}.{key}" if prefix else key
                            
                            if any(keyword in key.lower() for keyword in tech_keywords):
                                tech_fields.append((full_key, value))
                            
                            if isinstance(value, dict):
                                tech_fields.extend(find_tech_fields(value, full_key))
                            elif isinstance(value, list) and value and isinstance(value[0], dict):
                                tech_fields.extend(find_tech_fields(value[0], f"{full_key}[0]"))
                    
                    return tech_fields
                
                tech_fields = find_tech_fields(first_domain)
                
                if tech_fields:
                    print("✅ Found technology-related fields:")
                    for field_name, field_value in tech_fields:
                        print(f"  {field_name}: {str(field_value)[:200]}")
                
                # Save detailed first record for inspection
                with open('first_domain_analysis.json', 'w') as f:
                    json.dump(first_domain, f, indent=2, default=str)
                print(f"\n💾 Saved first domain record to first_domain_analysis.json")
                
        else:
            print(f"❌ API Error: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

def suggest_query_modifications():
    """Suggest how to modify the API query for date filtering"""
    print(f"\n💡 QUERY MODIFICATION SUGGESTIONS")
    print("=" * 60)
    
    print("If install dates are available, we could modify the query like this:")
    
    # Example date-based queries
    yesterday = datetime.now().strftime('%Y-%m-%d')
    
    suggested_queries = [
        {
            "name": "Last 7 days installs",
            "query": f'{{"must":{{"conjuncts":[{{"field":"tech","operator":"or","analyzer":"advanced","match":"Klaviyo"}},{{"field":"install_date","operator":"gte","match":"{yesterday}"}}]}}}}'
        },
        {
            "name": "Recent activity filter", 
            "query": f'{{"must":{{"conjuncts":[{{"field":"tech","operator":"or","analyzer":"advanced","match":"Klaviyo"}},{{"field":"updated_at","operator":"gte","match":"{yesterday}"}}]}}}}'
        }
    ]
    
    for suggestion in suggested_queries:
        print(f"\n🔍 {suggestion['name']}:")
        print(f"Query: {suggestion['query']}")

if __name__ == "__main__":
    analyze_api_response()
    suggest_query_modifications() 