#!/bin/bash

echo "🛑 Stopping sleep prevention..."

if [ -f .caffeinate_pid ]; then
    PID=$(cat .caffeinate_pid)
    kill $PID 2>/dev/null
    rm .caffeinate_pid
    echo "✅ Sleep prevention stopped (PID: $PID)"
    echo "💤 Your laptop can now sleep normally"
else
    echo "⚠️ No sleep prevention process found"
fi 