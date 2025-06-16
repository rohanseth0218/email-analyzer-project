#!/bin/bash

# Pulse App Deployment Script
echo "🚀 Starting Pulse deployment..."

# Check if commit message provided
if [ -z "$1" ]; then
    echo "❌ Please provide a commit message"
    echo "Usage: ./deploy.sh 'your commit message'"
    exit 1
fi

# Git operations
echo "📝 Committing changes..."
git add .
git commit -m "$1"
git push origin main

# Frontend deployment (Vercel)
echo "🌐 Deploying frontend to Vercel..."
vercel --prod

# Backend deployment (Railway)
echo "🔧 Deploying API to Railway..."
cd api
railway up
cd ..

echo "✅ Deployment complete!"
echo "Frontend: Check Vercel dashboard"
echo "Backend: Check Railway dashboard" 