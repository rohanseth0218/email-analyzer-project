/**
 * AUTOMATION MONITOR
 * Tracks progress and provides real-time status updates
 */

const fs = require('fs').promises;
const { spawn } = require('child_process');
const path = require('path');

const CONFIG = {
    PROGRESS_FILE: './logs/progress_slow_debug.json',
    FAILED_DOMAINS_LOG: './logs/failed_domains_slow_debug.jsonl',
    SUCCESS_DOMAINS_LOG: './logs/successful_domains_slow_debug.jsonl',
    SCREENSHOTS_DIR: './logs/screenshots',
    AUTOMATION_SCRIPT: 'restart_batch31_slow.js',
    MONITOR_INTERVAL: 10000, // 10 seconds
    SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/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'
};

let lastProgress = null;
let automationProcess = null;
let monitoringInterval = null;

async function sendSlackUpdate(message) {
    try {
        const axios = require('axios');
        await axios.post(CONFIG.SLACK_WEBHOOK_URL, { text: message });
        console.log('📨 Slack update sent');
    } catch (error) {
        console.error('❌ Slack update failed:', error.message);
    }
}

async function readProgress() {
    try {
        const data = await fs.readFile(CONFIG.PROGRESS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        return null;
    }
}

async function countLogLines(filepath) {
    try {
        const data = await fs.readFile(filepath, 'utf-8');
        return data.split('\n').filter(line => line.trim().length > 0).length;
    } catch (error) {
        return 0;
    }
}

async function countScreenshots() {
    try {
        const files = await fs.readdir(CONFIG.SCREENSHOTS_DIR);
        return files.filter(f => f.endsWith('.png')).length;
    } catch (error) {
        return 0;
    }
}

async function checkAutomationHealth() {
    const progress = await readProgress();
    const failedCount = await countLogLines(CONFIG.FAILED_DOMAINS_LOG);
    const successCount = await countLogLines(CONFIG.SUCCESS_DOMAINS_LOG);
    const screenshotCount = await countScreenshots();
    
    const currentTime = new Date().toISOString();
    
    console.log('\n🔍 AUTOMATION STATUS CHECK');
    console.log('=====================================');
    console.log(`⏰ Time: ${currentTime}`);
    
    if (progress) {
        console.log(`📊 Progress: ${progress.totalProcessed} domains processed`);
        console.log(`✅ Successful: ${progress.totalSuccessful} (${progress.successRate}%)`);
        console.log(`❌ Failed: ${progress.totalFailed}`);
        console.log(`📋 Current Batch: ${progress.currentBatch}`);
        console.log(`📸 Screenshots: ${screenshotCount}`);
        
        if (progress.failureReasons) {
            console.log('📋 Failure Reasons:');
            Object.entries(progress.failureReasons).forEach(([reason, count]) => {
                console.log(`   • ${reason}: ${count}`);
            });
        }
        
        // Check if progress is being made
        if (lastProgress) {
            const progressMade = progress.totalProcessed > lastProgress.totalProcessed;
            const timeDiff = new Date(progress.timestamp) - new Date(lastProgress.timestamp);
            const minutesSinceUpdate = timeDiff / (1000 * 60);
            
            if (progressMade) {
                const domainsProcessed = progress.totalProcessed - lastProgress.totalProcessed;
                console.log(`🚀 Progress made: ${domainsProcessed} domains in ${minutesSinceUpdate.toFixed(1)} minutes`);
            } else if (minutesSinceUpdate > 5) {
                console.log(`⚠️  No progress for ${minutesSinceUpdate.toFixed(1)} minutes - automation may be stuck`);
            }
        }
        
        lastProgress = progress;
    } else {
        console.log('❌ No progress file found - automation may not be running');
    }
    
    // Check if automation process is running
    if (automationProcess && !automationProcess.killed) {
        console.log('✅ Automation process is running');
    } else {
        console.log('❌ Automation process is not running');
    }
    
    console.log('=====================================\n');
    return progress;
}

async function startAutomation() {
    console.log('🚀 Starting automation process...');
    
    try {
        automationProcess = spawn('node', [CONFIG.AUTOMATION_SCRIPT], {
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: false
        });
        
        automationProcess.stdout.on('data', (data) => {
            console.log('📤 AUTOMATION:', data.toString().trim());
        });
        
        automationProcess.stderr.on('data', (data) => {
            console.error('❌ AUTOMATION ERROR:', data.toString().trim());
        });
        
        automationProcess.on('close', (code) => {
            console.log(`🔚 Automation process exited with code ${code}`);
            automationProcess = null;
        });
        
        console.log(`✅ Automation started with PID: ${automationProcess.pid}`);
        
        await sendSlackUpdate(`🤖 AUTOMATION MONITOR STARTED
📱 PID: ${automationProcess.pid}
📊 Monitoring every ${CONFIG.MONITOR_INTERVAL/1000} seconds
🔧 Script: ${CONFIG.AUTOMATION_SCRIPT}`);
        
    } catch (error) {
        console.error('❌ Failed to start automation:', error.message);
    }
}

async function startMonitoring() {
    console.log('👁️  Starting automation monitoring...');
    
    // Initial health check
    await checkAutomationHealth();
    
    // Set up periodic monitoring
    monitoringInterval = setInterval(async () => {
        try {
            const progress = await checkAutomationHealth();
            
            // Send periodic Slack updates
            if (progress && progress.totalProcessed % 50 === 0 && progress.totalProcessed > 0) {
                await sendSlackUpdate(`📊 AUTOMATION UPDATE
🔄 Processed: ${progress.totalProcessed} domains
✅ Success Rate: ${progress.successRate}%
📋 Current Batch: ${progress.currentBatch}
⏰ Last Update: ${new Date(progress.timestamp).toLocaleTimeString()}`);
            }
            
        } catch (error) {
            console.error('❌ Monitoring error:', error.message);
        }
    }, CONFIG.MONITOR_INTERVAL);
    
    console.log(`✅ Monitoring started - checking every ${CONFIG.MONITOR_INTERVAL/1000} seconds`);
}

async function showMenu() {
    console.log('\n🤖 AUTOMATION MONITOR CONTROL PANEL');
    console.log('===================================');
    console.log('1. Start Automation');
    console.log('2. Check Status');
    console.log('3. Start Monitoring');
    console.log('4. Stop Automation');
    console.log('5. View Recent Logs');
    console.log('6. Exit');
    console.log('===================================');
}

async function showRecentLogs() {
    console.log('\n📋 RECENT FAILED DOMAINS:');
    try {
        const failedData = await fs.readFile(CONFIG.FAILED_DOMAINS_LOG, 'utf-8');
        const lines = failedData.split('\n').filter(l => l.trim());
        const recent = lines.slice(-5); // Last 5 failures
        
        recent.forEach(line => {
            try {
                const entry = JSON.parse(line);
                console.log(`❌ ${entry.domain} - ${entry.reason} (${new Date(entry.timestamp).toLocaleTimeString()})`);
            } catch (e) {
                console.log(`❌ ${line}`);
            }
        });
    } catch (error) {
        console.log('No failed domains log found');
    }
    
    console.log('\n✅ RECENT SUCCESSFUL DOMAINS:');
    try {
        const successData = await fs.readFile(CONFIG.SUCCESS_DOMAINS_LOG, 'utf-8');
        const lines = successData.split('\n').filter(l => l.trim());
        const recent = lines.slice(-5); // Last 5 successes
        
        recent.forEach(line => {
            try {
                const entry = JSON.parse(line);
                console.log(`✅ ${entry.domain} - ${entry.reason} (${new Date(entry.timestamp).toLocaleTimeString()})`);
            } catch (e) {
                console.log(`✅ ${line}`);
            }
        });
    } catch (error) {
        console.log('No successful domains log found');
    }
}

function stopAutomation() {
    if (automationProcess && !automationProcess.killed) {
        console.log('🛑 Stopping automation process...');
        automationProcess.kill('SIGTERM');
        automationProcess = null;
        console.log('✅ Automation stopped');
    } else {
        console.log('❌ No automation process running');
    }
}

function cleanup() {
    console.log('\n🧹 Cleaning up...');
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
    }
    stopAutomation();
    process.exit(0);
}

// Handle graceful shutdown
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Auto-start functionality
async function autoStart() {
    console.log('🚀 AUTO-STARTING AUTOMATION MONITOR');
    console.log('==================================');
    
    await startAutomation();
    await startMonitoring();
    
    console.log('\n🎯 AUTOMATION IS RUNNING!');
    console.log('📊 Check Slack for updates');
    console.log('⏸️  Press Ctrl+C to stop');
    
    // Keep the process alive
    setInterval(() => {
        // Just keep alive
    }, 30000);
}

if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('--auto-start') || args.includes('-a')) {
        autoStart().catch(console.error);
    } else {
        console.log('Usage:');
        console.log('  node monitor_automation.js --auto-start    # Start automation and monitoring');
        console.log('  node monitor_automation.js                 # Interactive mode (not implemented yet)');
        console.log('');
        console.log('Starting auto-start mode by default...');
        autoStart().catch(console.error);
    }
}

module.exports = {
    startAutomation,
    startMonitoring,
    checkAutomationHealth,
    stopAutomation
}; 