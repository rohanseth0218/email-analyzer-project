#!/usr/bin/env node

/**
 * Email Signup Automation Runner
 * 
 * This script starts the MCP-based email automation with configurable options.
 * 
 * Usage:
 * node scripts/run_automation.js              # Run full automation
 * node scripts/run_automation.js --test       # Run with limited domains for testing
 * node scripts/run_automation.js --concurrent 25  # Run with 25 concurrent browsers
 */

const MCPEmailAutomation = require('../src/mcp_email_automation');

// Parse command line arguments
const args = process.argv.slice(2);
const isTest = args.includes('--test');
const concurrentIndex = args.indexOf('--concurrent');
const concurrent = concurrentIndex !== -1 ? parseInt(args[concurrentIndex + 1]) : 50;

// Configuration based on arguments
const config = {
    maxConcurrentBrowsers: concurrent,
    notificationInterval: isTest ? 5 : 100,
    slackChannel: '#email-automation',
    errorChannel: '#automation-errors'
};

// Test mode: limit domains and increase notifications
if (isTest) {
    console.log('🧪 Running in TEST MODE');
    config.testMode = true;
    config.maxTestDomains = 10;
    config.maxConcurrentBrowsers = Math.min(concurrent, 5);
}

console.log(`🚀 Starting Email Signup Automation`);
console.log(`📊 Configuration:`);
console.log(`   - Max Concurrent Browsers: ${config.maxConcurrentBrowsers}`);
console.log(`   - Notification Interval: ${config.notificationInterval}`);
console.log(`   - Slack Channel: ${config.slackChannel}`);
console.log(`   - Test Mode: ${isTest ? 'ENABLED' : 'DISABLED'}`);

// Create and run automation
const automation = new MCPEmailAutomation(config);

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Received interrupt signal. Shutting down gracefully...');
    
    // Close any active browser sessions
    for (const sessionId of automation.stats.activeSessions) {
        try {
            await automation.closeBrowserSession(sessionId);
        } catch (error) {
            console.warn(`Failed to close session ${sessionId}:`, error.message);
        }
    }
    
    // Send final update
    await automation.sendSlackNotification(`⏹️ **Automation Stopped**
**Status:** Manually interrupted
**Processed:** ${automation.stats.processed}
**Successful:** ${automation.stats.successful}
**Runtime:** ${Math.round((new Date() - automation.stats.startTime) / 1000 / 60)} minutes`);
    
    console.log('✅ Shutdown complete');
    process.exit(0);
});

// Handle uncaught errors
process.on('unhandledRejection', async (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    
    await automation.logError('Unhandled rejection', new Error(reason));
    process.exit(1);
});

// Start the automation
automation.run()
    .then((stats) => {
        console.log('\n🎉 Automation completed successfully!');
        console.log('📊 Final Stats:', stats);
        process.exit(0);
    })
    .catch(async (error) => {
        console.error('💥 Automation failed:', error);
        await automation.logError('Fatal automation error', error);
        process.exit(1);
    }); 