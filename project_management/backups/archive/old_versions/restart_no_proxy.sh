#!/bin/bash

echo "🚀 Restarting Email Automation WITHOUT PROXIES"
echo "=================================="
echo "📊 Previous: 3000 domains processed (1521 successful)"
echo "🎯 Resuming: From batch 31"
echo "⚡ Sessions: 10 concurrent (reduced from 50)"
echo "🚫 Proxies: DISABLED (no bandwidth issues)"
echo ""

# Kill any existing automation
pkill -f "run_full_automation" 2>/dev/null || echo "No existing automation to kill"

# Wait a moment
sleep 2

# Start the new automation
echo "🚀 Starting automation..."
nohup node run_full_automation_resumed.js > automation_no_proxy.log 2>&1 &
AUTOMATION_PID=$!

echo "✅ Automation started with PID: $AUTOMATION_PID"
echo "📋 Monitor progress with:"
echo "   tail -f automation_no_proxy.log"
echo "   tail -f logs/progress_full_run.json"
echo ""
echo "🎯 Expected timeline:"
echo "   - No proxy bandwidth limits"
echo "   - ~47k domains remaining"
echo "   - 10 concurrent sessions = ~2-3 hours per 100 domains"
echo "   - Total estimated time: ~24-36 hours"
echo ""
echo "📨 Slack notifications will continue every batch"
echo "🚀 Automation is now running in background!" 