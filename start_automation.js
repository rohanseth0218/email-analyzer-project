/**
 * Newsletter Automation Launcher
 * 
 * Easy launcher with options for different run modes
 */

const { spawn } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function runAutomation(mode, config = {}) {
    console.log(`\n🚀 Starting automation in ${mode} mode...`);
    
    // Modify the config in full_newsletter_automation.js
    const fs = require('fs');
    let scriptContent = fs.readFileSync('./full_newsletter_automation.js', 'utf-8');
    
    if (mode === 'BATCH') {
        const startBatch = config.startBatch || 31;
        scriptContent = scriptContent.replace(/MODE: '[^']*'/, `MODE: 'BATCH'`);
        scriptContent = scriptContent.replace(/START_FROM_BATCH: \d+/, `START_FROM_BATCH: ${startBatch}`);
        console.log(`📦 Configured to start from batch ${startBatch}`);
    } else if (mode === 'RETRY_FAILED') {
        scriptContent = scriptContent.replace(/MODE: '[^']*'/, `MODE: 'RETRY_FAILED'`);
        console.log(`🔄 Configured to retry failed domains`);
    }
    
    // Write the modified script
    fs.writeFileSync('./full_newsletter_automation_configured.js', scriptContent);
    
    // Run the automation
    const child = spawn('node', ['./full_newsletter_automation_configured.js'], {
        stdio: 'inherit'
    });
    
    child.on('close', (code) => {
        console.log(`\n✅ Automation finished with exit code: ${code}`);
        process.exit(code);
    });
    
    child.on('error', (error) => {
        console.error(`❌ Failed to start automation: ${error.message}`);
        process.exit(1);
    });
}

function showMenu() {
    console.log(`
🤖 Newsletter Automation Launcher
==================================

📊 Available Data:
   - 6,691 unique failed domains ready for retry
   - Starting from batch 31 would process remaining domains
   - Test automation achieved 100% success rate (5/5)

🎯 Run Options:

1️⃣  Start from Batch 31 (where it crashed before)
   - Processes remaining domains from batch 31 onwards
   - Continues from where previous run left off

2️⃣  Retry Failed Domains (6,691 domains)
   - Retries all unique domains that failed previously
   - Focuses on domains that had issues

3️⃣  Start from Different Batch
   - Specify a custom batch number to start from

4️⃣  Exit

Choose your option (1-4): `);
}

function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.trim());
        });
    });
}

async function main() {
    showMenu();
    
    const choice = await askQuestion('');
    
    switch (choice) {
        case '1':
            console.log(`\n✅ Selected: Start from Batch 31`);
            runAutomation('BATCH', { startBatch: 31 });
            break;
            
        case '2':
            console.log(`\n✅ Selected: Retry Failed Domains (6,691 domains)`);
            runAutomation('RETRY_FAILED');
            break;
            
        case '3':
            const batchNumber = await askQuestion('Enter batch number to start from: ');
            const batch = parseInt(batchNumber);
            if (isNaN(batch) || batch < 0) {
                console.log(`❌ Invalid batch number: ${batchNumber}`);
                process.exit(1);
            }
            console.log(`\n✅ Selected: Start from Batch ${batch}`);
            runAutomation('BATCH', { startBatch: batch });
            break;
            
        case '4':
            console.log(`\n👋 Exiting...`);
            process.exit(0);
            break;
            
        default:
            console.log(`❌ Invalid choice: ${choice}`);
            process.exit(1);
    }
}

// Handle Ctrl+C
process.on('SIGINT', () => {
    console.log(`\n\n👋 Automation cancelled by user`);
    process.exit(0);
});

// Run the launcher
main().catch((error) => {
    console.error(`❌ Launcher error: ${error.message}`);
    process.exit(1);
}); 