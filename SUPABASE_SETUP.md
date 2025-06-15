# 🚀 EmailScope Supabase Migration Guide

This guide will help you migrate from BigQuery to Supabase PostgreSQL for **10x faster** performance.

## 📊 Performance Comparison

| Database | Response Time | Cost | Scalability |
|----------|---------------|------|-------------|
| BigQuery | 1.3+ seconds | High per query | Good for analytics |
| Supabase | 50-100ms | Low monthly cost | Perfect for web apps |

## 🏗️ Step 1: Set Up Supabase Project

1. **Go to [Supabase](https://supabase.com)** and create a new project
2. **Choose a region** close to your users
3. **Set a strong database password**
4. **Wait for project to be ready** (~2 minutes)

## 🗄️ Step 2: Create Database Schema

1. **Go to SQL Editor** in your Supabase dashboard
2. **Copy and paste** the contents of `supabase_setup.sql`
3. **Run the query** to create tables and indexes
4. **Verify** the `email_campaigns` table was created

## 🔑 Step 3: Get Connection Details

In your Supabase project dashboard:

1. **Go to Settings → Database**
2. **Copy the connection details:**
   - Host: `db.xxx.supabase.co`
   - Port: `5432`
   - Database: `postgres`
   - User: `postgres`
   - Password: `[your password]`

## 🌍 Step 4: Set Environment Variables

Create a `.env` file in your project root:

```bash
# Supabase PostgreSQL Connection
SUPABASE_HOST=db.xxx.supabase.co
SUPABASE_PORT=5432
SUPABASE_DB=postgres
SUPABASE_USER=postgres
SUPABASE_PASSWORD=your_password_here

# Supabase API (for sync job)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**To get your service role key:**
1. Go to **Settings → API**
2. Copy the **service_role** key (not anon key)

## 📦 Step 5: Install Dependencies

```bash
# Install Python dependencies for sync job
pip install -r requirements.txt

# Install Node.js dependencies for API
cd api
npm install
```

## 🔄 Step 6: Run Initial Data Sync

```bash
# Test with 10 campaigns first
python sync_bigquery_to_supabase.py \
  --supabase-url "https://xxx.supabase.co" \
  --supabase-key "your_service_role_key" \
  --limit 10

# If successful, sync all data (this may take 5-10 minutes)
python sync_bigquery_to_supabase.py \
  --supabase-url "https://xxx.supabase.co" \
  --supabase-key "your_service_role_key"
```

## 🚀 Step 7: Start the New API Server

```bash
cd api
npm run supabase
```

You should see:
```
🚀 EmailScope API server running on port 3001
🐘 Connected to Supabase PostgreSQL
🔍 Health check: http://localhost:3001/health
```

## ⚡ Step 8: Test Performance

```bash
# Test the new API speed
curl -w "Total time: %{time_total}s\n" http://localhost:3001/api/campaigns?limit=50
```

You should see response times under **100ms** instead of 1.3+ seconds!

## 🔄 Step 9: Set Up Daily Sync (Optional)

Create a cron job to sync data daily:

```bash
# Edit crontab
crontab -e

# Add this line to sync every day at 2 AM
0 2 * * * cd /path/to/your/project && python sync_bigquery_to_supabase.py --supabase-url "https://xxx.supabase.co" --supabase-key "your_service_role_key" >> sync.log 2>&1
```

## 🎯 Step 10: Update Frontend (if needed)

The API endpoints remain the same, so your frontend should work without changes. But if you want to switch:

1. **Stop the old BigQuery server**
2. **Start the new Supabase server** with `npm run supabase`
3. **Test the frontend** at `http://localhost:5173`

## 🔍 Troubleshooting

### Connection Issues
- **Check your .env file** has correct Supabase credentials
- **Verify your IP is allowed** in Supabase (should be automatic)
- **Test connection** with: `psql "postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"`

### Sync Issues
- **Check BigQuery permissions** are still working
- **Verify the sync script** can connect to both databases
- **Run with --limit 1** to test with minimal data

### Performance Issues
- **Check indexes** were created properly in Supabase
- **Monitor query performance** in Supabase dashboard
- **Consider adding more indexes** for specific filter combinations

## 📈 Expected Results

After migration, you should see:

✅ **50-100ms API response times** (vs 1.3+ seconds)  
✅ **Instant search and filtering**  
✅ **Lower database costs**  
✅ **Better user experience**  
✅ **Real-time data updates** (with daily sync)

## 🎉 Success!

Your EmailScope platform is now running on Supabase with **10x faster** performance! 

The BigQuery data pipeline continues to work for analytics, while Supabase handles the fast web app queries. 