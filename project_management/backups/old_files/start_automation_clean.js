/**
 * Newsletter Automation Launcher - Clean Run
 * 
 * Uses the unprocessed domains list to avoid duplicates
 */

const { spawn } = require('child_process');
const fs = require('fs');

function runCleanAutomation() {
    console.log(`\n🚀 Starting clean automation with unprocessed domains...`);
    
    // Check if unprocessed list exists
    if (!fs.existsSync('./Storedomains_unprocessed.csv')) {
        console.log('❌ Unprocessed domains list not found!');
        console.log('📝 Please run: node create_unprocessed_list.js first');
        process.exit(1);
    }
    
    // Modify the automation to use unprocessed list
    let scriptContent = fs.readFileSync('./full_newsletter_automation.js', 'utf-8');
    
    // Replace the domain file path
    scriptContent = scriptContent.replace(
        /DOMAINS_FILE: '[^']*'/,
        `DOMAINS_FILE: './Storedomains_unprocessed.csv'`
    );
    
    // Set to BATCH mode starting from 1 (since this is a clean list)
    scriptContent = scriptContent.replace(/MODE: '[^']*'/, `MODE: 'BATCH'`);
    scriptContent = scriptContent.replace(/START_FROM_BATCH: \d+/, `START_FROM_BATCH: 1`);
    
    console.log(`📄 Using unprocessed domains file: Storedomains_unprocessed.csv`);
    console.log(`📦 Starting from batch 1 (clean run)`);
    
    // Write the configured script
    fs.writeFileSync('./full_newsletter_automation_clean.js', scriptContent);
    
    console.log(`\n📊 Domain Summary:`);
    const summary = JSON.parse(fs.readFileSync('./unprocessed_summary.json', 'utf-8'));
    console.log(`   📂 Total domains to process: ${summary.unprocessedDomainsRemaining.toLocaleString()}`);
    console.log(`   ✅ Already processed: ${summary.domainsAlreadyProcessed.toLocaleString()}`);
    console.log(`   📈 Previous progress: ${summary.processingRate}`);
    
    console.log(`\n🎯 This run will ONLY process new domains!`);
    console.log(`🚀 Starting automation in 3 seconds...`);
    
    setTimeout(() => {
        // Run the automation
        const child = spawn('node', ['./full_newsletter_automation_clean.js'], {
            stdio: 'inherit'
        });
        
        child.on('close', (code) => {
            console.log(`\n✅ Clean automation finished with exit code: ${code}`);
            process.exit(code);
        });
        
        child.on('error', (error) => {
            console.error(`❌ Failed to start automation: ${error.message}`);
            process.exit(1);
        });
    }, 3000);
}

function showInfo() {
    console.log(`
🤖 Clean Newsletter Automation
===============================

This will start the automation using ONLY unprocessed domains.

✅ Benefits:
   - No duplicate processing
   - Continues from where you left off
   - Uses clean domain list
   - Avoids wasted effort

📊 Will process: 42,161 unprocessed domains
🚫 Will skip: 8,215 already processed domains

🚀 Ready to start clean run? Press any key...
`);
}

function main() {
    showInfo();
    
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', () => {
        runCleanAutomation();
    });
}

// Handle Ctrl+C
process.on('SIGINT', () => {
    console.log(`\n\n👋 Cancelled by user`);
    process.exit(0);
});

// Run the launcher
main(); 