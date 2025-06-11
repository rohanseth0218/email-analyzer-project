#!/bin/bash

# Startup script for Google Cloud email automation instance
echo "🚀 Setting up email automation environment..."

# Update system
apt-get update -y
apt-get upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install additional dependencies
apt-get install -y git screen htop

# Create automation directory
mkdir -p /home/$USER/email-automation
chown -R $USER:$USER /home/$USER/email-automation

# Install global npm packages that might be needed
npm install -g npm@latest

echo "✅ Environment setup complete - ready for automation files" 