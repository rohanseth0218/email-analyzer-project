#!/usr/bin/env python3
"""
Setup Supabase database schema for EmailScope
"""

import psycopg2
import sys

def setup_schema():
    """Set up the database schema in Supabase"""
    
    # Connection string
    conn_string = "postgresql://postgres:2nUMS5DRqlPct0JQ@db.xlvfjdvjfywkjhmkaevp.supabase.co:5432/postgres"
    
    try:
        # Connect to database
        print("🔌 Connecting to Supabase...")
        conn = psycopg2.connect(conn_string)
        cursor = conn.cursor()
        
        # Read SQL file
        print("📖 Reading schema file...")
        with open('supabase_setup.sql', 'r') as f:
            sql_content = f.read()
        
        # Execute SQL
        print("🏗️  Creating tables and indexes...")
        cursor.execute(sql_content)
        conn.commit()
        
        # Verify tables were created
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('email_campaigns', 'campaign_stats')
        """)
        tables = cursor.fetchall()
        
        print(f"✅ Successfully created {len(tables)} tables:")
        for table in tables:
            print(f"   - {table[0]}")
        
        cursor.close()
        conn.close()
        print("🎉 Schema setup complete!")
        
    except Exception as e:
        print(f"❌ Error setting up schema: {e}")
        sys.exit(1)

if __name__ == "__main__":
    setup_schema() 