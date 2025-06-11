#!/bin/bash

# Automation Manager - Complete solution for uninterrupted automation

show_menu() {
    echo ""
    echo "🤖 Email Automation Manager"
    echo "=========================="
    echo "1. 🚀 Start automation (with sleep prevention)"
    echo "2. 📊 Check status"
    echo "3. 🔄 Resume automation"
    echo "4. 🛑 Stop automation"
    echo "5. 💤 Stop sleep prevention"
    echo "6. ☁️  Deploy to Google Cloud"
    echo "7. 📱 Test Slack notifications"
    echo "8. 📋 View logs"
    echo "9. ❌ Exit"
    echo ""
    read -p "Choose option (1-9): " choice
}

start_automation() {
    echo "🔋 Starting automation with sleep prevention..."
    
    # Prevent sleep
    caffeinate -d -i -m -s &
    CAFFEINATE_PID=$!
    echo $CAFFEINATE_PID > .caffeinate_pid
    echo "✅ Sleep prevention active (PID: $CAFFEINATE_PID)"
    
    # Start automation in background
    nohup node run_full_automation.js > automation_output.log 2>&1 &
    AUTOMATION_PID=$!
    echo $AUTOMATION_PID > .automation_pid
    echo "🚀 Automation started (PID: $AUTOMATION_PID)"
    echo "📱 You'll receive Slack notifications every 100 domains"
    echo "📄 Logs: tail -f automation_output.log"
}

check_status() {
    echo "📊 Checking automation status..."
    
    if [ -f .automation_pid ]; then
        PID=$(cat .automation_pid)
        if ps -p $PID > /dev/null 2>&1; then
            echo "✅ Automation is running (PID: $PID)"
            
            # Show recent progress
            if [ -f logs/progress_full_run.json ]; then
                echo "📈 Latest progress:"
                node -e "
                    const progress = JSON.parse(require('fs').readFileSync('logs/progress_full_run.json', 'utf-8'));
                    console.log(\`   Processed: \${progress.totalProcessed}\`);
                    console.log(\`   Successful: \${progress.totalSuccessful}\`);
                    console.log(\`   Success Rate: \${progress.successRate}%\`);
                    console.log(\`   Current Batch: \${progress.currentBatch}\`);
                    console.log(\`   Runtime: \${Math.floor(progress.runtime / 60)} minutes\`);
                "
            fi
        else
            echo "❌ Automation is not running"
            rm .automation_pid
        fi
    else
        echo "❌ No automation process found"
    fi
    
    if [ -f .caffeinate_pid ]; then
        PID=$(cat .caffeinate_pid)
        if ps -p $PID > /dev/null 2>&1; then
            echo "🔋 Sleep prevention is active (PID: $PID)"
        else
            echo "💤 Sleep prevention is not active"
            rm .caffeinate_pid
        fi
    else
        echo "💤 Sleep prevention is not active"
    fi
}

resume_automation() {
    echo "🔄 Resuming automation..."
    
    if [ -f logs/resume_point.json ]; then
        echo "📊 Resume point found:"
        node -e "
            const resume = JSON.parse(require('fs').readFileSync('logs/resume_point.json', 'utf-8'));
            console.log(\`   Next batch: \${resume.nextBatch}\`);
            console.log(\`   Processed so far: \${resume.processedSoFar}\`);
            console.log(\`   Last update: \${resume.timestamp}\`);
        "
        start_automation
    else
        echo "⚠️ No resume point found. Starting from beginning..."
        start_automation
    fi
}

stop_automation() {
    echo "🛑 Stopping automation..."
    
    if [ -f .automation_pid ]; then
        PID=$(cat .automation_pid)
        kill $PID 2>/dev/null
        rm .automation_pid
        echo "✅ Automation stopped (PID: $PID)"
    else
        echo "ℹ️ No automation process found"
    fi
    
    if [ -f .caffeinate_pid ]; then
        PID=$(cat .caffeinate_pid)
        kill $PID 2>/dev/null
        rm .caffeinate_pid
        echo "✅ Sleep prevention stopped (PID: $PID)"
    fi
}

deploy_cloud() {
    echo "☁️ Google Cloud deployment guide:"
    echo "   1. Follow instructions in deploy-to-gcp.md"
    echo "   2. Or run: gcloud compute instances create email-automation --zone=us-central1-a --machine-type=e2-standard-4 --image-family=ubuntu-2004-lts --image-project=ubuntu-os-cloud --boot-disk-size=50GB --preemptible"
    echo "   3. Upload files: gcloud compute scp --recurse ./* email-automation:~/email-automation/ --zone=us-central1-a"
    echo "   4. SSH and run: gcloud compute ssh email-automation --zone=us-central1-a"
}

test_slack() {
    echo "📱 Testing Slack notifications..."
    node test_slack_notification.js
}

view_logs() {
    echo "📋 Available logs:"
    echo "   1. automation_output.log - Full automation output"
    echo "   2. logs/progress_full_run.json - Current progress"
    echo "   3. logs/failed_domains_full_run.jsonl - Failed domains"
    echo "   4. logs/successful_domains_full_run.jsonl - Successful domains"
    echo ""
    read -p "Enter log number to view (1-4): " log_choice
    
    case $log_choice in
        1) tail -f automation_output.log ;;
        2) cat logs/progress_full_run.json | jq . 2>/dev/null || cat logs/progress_full_run.json ;;
        3) tail -20 logs/failed_domains_full_run.jsonl ;;
        4) tail -20 logs/successful_domains_full_run.jsonl ;;
        *) echo "Invalid choice" ;;
    esac
}

# Main loop
while true; do
    show_menu
    
    case $choice in
        1) start_automation ;;
        2) check_status ;;
        3) resume_automation ;;
        4) stop_automation ;;
        5) bash stop_awake.sh ;;
        6) deploy_cloud ;;
        7) test_slack ;;
        8) view_logs ;;
        9) echo "👋 Goodbye!"; exit 0 ;;
        *) echo "❌ Invalid option. Please choose 1-9." ;;
    esac
    
    echo ""
    read -p "Press Enter to continue..."
done 