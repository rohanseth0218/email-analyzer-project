#!/usr/bin/env node

/**
 * High-Performance Email Automation Test Runner
 * 
 * This script runs the Playwright + Browserbase automation with 50 concurrent sessions
 */

require('dotenv').config();
const { runPlaywrightAutomation } = require('./playwright_automation');

// Configuration check
function checkEnvironment() {
    const required = ['BROWSERBASE_API_KEY', 'BROWSERBASE_PROJECT_ID'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        console.error('❌ Missing required environment variables:');
        missing.forEach(key => console.error(`   - ${key}`));
        console.log('\n📝 Please set these in your .env file or environment variables');
        process.exit(1);
    }
    
    console.log('✅ Environment variables configured');
}

// Main execution
async function main() {
    console.log('🚀 High-Performance Email Automation Test Runner');
    console.log('⚡ Using Playwright + Browserbase for 50 concurrent sessions\n');
    
    checkEnvironment();
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    const isTest = args.includes('--test');
    const maxDomains = isTest ? 100 : null;
    
    if (isTest) {
        console.log('🧪 Running in TEST MODE (100 domains)');
    } else {
        console.log('🎯 Running FULL AUTOMATION (50K+ domains)');
    }
    
    console.log('📊 Configuration:');
    console.log(`   - API Key: ${process.env.BROWSERBASE_API_KEY.substring(0, 8)}...`);
    console.log(`   - Project ID: ${process.env.BROWSERBASE_PROJECT_ID}`);
    console.log(`   - Concurrent Sessions: 50`);
    console.log(`   - Domains: ${maxDomains || 'All (~50K)'}`);
    console.log('');
    
    try {
        const stats = await runPlaywrightAutomation(maxDomains);
        
        console.log('\n🎉 Automation completed successfully!');
        console.log('📊 Final Statistics:');
        console.log(`   - Total Processed: ${stats.processed}`);
        console.log(`   - Successful: ${stats.successful}`);
        console.log(`   - Failed: ${stats.failed}`);
        console.log(`   - Success Rate: ${((stats.successful / stats.processed) * 100).toFixed(1)}%`);
        console.log(`   - Runtime: ${Math.round((new Date() - stats.startTime) / 1000 / 60)} minutes`);
        
    } catch (error) {
        console.error('\n❌ Automation failed:', error.message);
        process.exit(1);
    }
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

// Run the automation
main(); 