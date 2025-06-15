const fs = require('fs');
const { execSync } = require('child_process');

async function restartAutomation() {
    console.log('🔄 Restarting automation from domain 501...');
    
    // Kill any existing automation processes
    try {
        execSync('pkill -f "node run_full_automation"', { stdio: 'ignore' });
        console.log('✅ Killed existing automation process');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    } catch (error) {
        console.log('ℹ️ No existing process to kill');
    }
    
    // Check current progress
    let startDomain = 501;
    try {
        const progress = JSON.parse(fs.readFileSync('logs/progress_full_run.json', 'utf8'));
        startDomain = progress.totalProcessed + 1;
        console.log(`📊 Current progress: ${progress.totalProcessed} domains processed (${progress.successRate}% success rate)`);
        console.log(`🎯 Restarting from domain ${startDomain}`);
    } catch (error) {
        console.log('⚠️ Could not read progress file, starting from domain 501');
    }
    
    // Modify the run_full_automation.js to start from the correct domain
    let automationScript = fs.readFileSync('run_full_automation.js', 'utf8');
    
    // Replace the start index
    automationScript = automationScript.replace(
        /let startIndex = \d+/,
        `let startIndex = ${startDomain - 1}` // -1 because array is 0-indexed
    );
    
    fs.writeFileSync('run_full_automation_resumed.js', automationScript);
    console.log(`📝 Created run_full_automation_resumed.js starting from domain ${startDomain}`);
    
    // Start the automation in background
    try {
        const child = execSync('nohup node run_full_automation_resumed.js > automation_output.log 2>&1 &', 
                             { stdio: 'ignore' });
        console.log('🚀 Automation restarted successfully!');
        console.log('📋 You can monitor progress with:');
        console.log('   tail -f logs/progress_full_run.json');
        console.log('   tail -f automation_output.log');
    } catch (error) {
        console.error('❌ Failed to restart automation:', error.message);
    }
}

restartAutomation().catch(console.error); 