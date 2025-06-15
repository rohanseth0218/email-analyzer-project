# Pulse - Deployment Guide

## Frontend Deployment (Netlify)

### Option 1: Manual Deploy
1. Build the project: `cd project && npm run build`
2. Go to [netlify.com](https://netlify.com) and login
3. Click "Add new site" → "Deploy manually"
4. Drag and drop the `dist` folder

### Option 2: Git Deploy (Recommended)
1. Push your code to GitHub
2. Go to [netlify.com](https://netlify.com) and login
3. Click "Add new site" → "Import from Git"
4. Connect your GitHub repo
5. Set build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Base directory: `project`

### Environment Variables (Netlify)
After deployment, set these environment variables in Netlify:
- `VITE_API_URL`: Your deployed API URL (e.g., `https://your-api.railway.app/api`)

## API Deployment (Railway - Recommended)

### Step 1: Prepare for Railway
1. Go to [railway.app](https://railway.app) and sign up
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Set root directory to `api`

### Step 2: Environment Variables (Railway)
Set these in Railway dashboard:
- `PORT`: (Railway sets this automatically)
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anon key
- `GOOGLE_APPLICATION_CREDENTIALS`: Upload your GCP service account JSON

### Step 3: Deploy
Railway will automatically deploy when you push to your main branch.

## Alternative API Deployment (Render)

1. Go to [render.com](https://render.com) and sign up
2. Click "New" → "Web Service"
3. Connect your GitHub repo
4. Set:
   - Root Directory: `api`
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Add environment variables (same as Railway)

## Final Steps

1. Deploy API first and get the URL
2. Update `VITE_API_URL` in Netlify environment variables
3. Redeploy frontend if needed

Your app will be live at:
- Frontend: `https://your-app.netlify.app`
- API: `https://your-api.railway.app` (or render.com) 