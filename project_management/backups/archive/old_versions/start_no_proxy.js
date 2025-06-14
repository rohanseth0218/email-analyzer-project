const { spawn } = require('child_process');
const fs = require('fs');

console.log('🚀 Starting automation without proxies...');
console.log('📊 Previous progress: 3000 domains processed, resuming from batch 31');
console.log('⚡ Reduced to 10 concurrent sessions (no bandwidth issues)');
console.log('🚫 No proxies (eliminates bandwidth consumption)');

// Start the automation
const automation = spawn('node', ['run_full_automation_resumed.js'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
    cwd: process.cwd()
});

// Log output to file
const logStream = fs.createWriteStream('automation_no_proxy.log', { flags: 'w' });

automation.stdout.on('data', (data) => {
    logStream.write(data);
    process.stdout.write(data);
});

automation.stderr.on('data', (data) => {
    logStream.write(data);
    process.stderr.write(data);
});

automation.on('error', (error) => {
    console.error(`❌ Failed to start automation: ${error.message}`);
});

automation.on('close', (code) => {
    console.log(`🏁 Automation finished with code ${code}`);
    logStream.end();
});

// Unref so parent can exit
automation.unref();

console.log(`✅ Automation started with PID: ${automation.pid}`);
console.log('📋 Monitor with:');
console.log('   tail -f automation_no_proxy.log');
console.log('   ps aux | grep run_full_automation');

// Exit after starting
setTimeout(() => {
    console.log('👋 Parent process exiting, automation continues in background');
    process.exit(0);
}, 2000); 