#!/bin/bash

echo "⚙️ Setting up PM2 for robust automation management..."

# Install PM2 globally
echo "📦 Installing PM2..."
npm install -g pm2

# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'email-automation',
    script: 'run_full_automation.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '2G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    restart_delay: 10000
  }]
};
EOF

echo "✅ PM2 setup complete!"
echo ""
echo "🚀 To start automation with PM2:"
echo "   pm2 start ecosystem.config.js"
echo ""
echo "📊 To monitor:"
echo "   pm2 monit"
echo ""
echo "📋 To check status:"
echo "   pm2 status"
echo ""
echo "🔄 To restart:"
echo "   pm2 restart email-automation"
echo ""
echo "🛑 To stop:"
echo "   pm2 stop email-automation"
echo ""
echo "🗑️ To delete:"
echo "   pm2 delete email-automation" 