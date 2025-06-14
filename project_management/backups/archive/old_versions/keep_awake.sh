#!/bin/bash

echo "🔋 Preventing laptop sleep during automation..."

# Prevent system sleep on macOS
caffeinate -d -i -m -s &
CAFFEINATE_PID=$!

echo "✅ Sleep prevention active (PID: $CAFFEINATE_PID)"
echo "💻 Your laptop will stay awake during automation"

# Save PID for later cleanup
echo $CAFFEINATE_PID > .caffeinate_pid

echo "🚀 Now run your automation: node run_full_automation.js"
echo "🛑 To stop sleep prevention later: bash stop_awake.sh" 