#!/usr/bin/env node

/**
 * MCP Test Script
 * 
 * This script tests that Browserbase MCP and Zapier MCP are properly configured
 * before running the full automation.
 */

console.log('🧪 Testing MCP connections...');

async function testBrowserbaseMCP() {
    console.log('\n🌐 Testing Browserbase MCP...');
    
    try {
        // Test session creation
        console.log('   Creating browser session...');
        const sessionResponse = await mcp_Browserbase_browserbase_session_create({});
        const sessionId = sessionResponse.sessionId;
        console.log(`   ✅ Session created: ${sessionId}`);
        
        // Test navigation
        console.log('   Testing navigation...');
        await mcp_Browserbase_browserbase_navigate({
            url: 'https://httpbin.org/html'
        });
        console.log('   ✅ Navigation successful');
        
        // Test snapshot
        console.log('   Taking snapshot...');
        await mcp_Browserbase_browserbase_snapshot({
            random_string: 'test'
        });
        console.log('   ✅ Snapshot taken');
        
        // Test wait
        console.log('   Testing wait...');
        await mcp_Browserbase_browserbase_wait({ time: 1 });
        console.log('   ✅ Wait function works');
        
        // Clean up
        console.log('   Closing session...');
        await mcp_Browserbase_browserbase_session_close({
            random_string: sessionId
        });
        console.log('   ✅ Session closed');
        
        return true;
        
    } catch (error) {
        console.error('   ❌ Browserbase MCP test failed:', error.message);
        return false;
    }
}

async function testZapierMCP() {
    console.log('\n📨 Testing Zapier MCP...');
    
    try {
        // Test Slack notification
        console.log('   Sending test Slack message...');
        await mcp_Zapier_slack_send_channel_message({
            instructions: 'Send test message to #email-automation',
            channel: '#email-automation',
            text: '🧪 **MCP Test Message**\nThis is a test message from the email automation system.\nIf you see this, Zapier MCP is working correctly!',
            username: 'Email Automation Test Bot',
            as_bot: 'true'
        });
        console.log('   ✅ Slack message sent successfully');
        
        return true;
        
    } catch (error) {
        console.error('   ❌ Zapier MCP test failed:', error.message);
        console.error('   💡 Make sure Zapier MCP is configured and Slack integration is set up');
        return false;
    }
}

async function testDataFiles() {
    console.log('\n📁 Testing data files...');
    
    try {
        const fs = require('fs').promises;
        
        // Test domains file
        console.log('   Checking Storedomains.csv...');
        const domainsContent = await fs.readFile('Storedomains.csv', 'utf-8');
        const domainLines = domainsContent.split('\n').filter(line => line.trim());
        console.log(`   ✅ Found ${domainLines.length - 1} domains (excluding header)`);
        
        // Test emails file
        console.log('   Checking mailboxaccounts.csv...');
        const emailsContent = await fs.readFile('mailboxaccounts.csv', 'utf-8');
        const emailLines = emailsContent.split('\n').filter(line => line.trim());
        console.log(`   ✅ Found ${emailLines.length - 1} email accounts (excluding header)`);
        
        // Sample the data
        const sampleDomain = domainLines[1]?.split(',')[0].trim();
        const sampleEmail = emailLines[1]?.split(',')[0].trim();
        
        if (sampleDomain && sampleEmail) {
            console.log(`   📝 Sample domain: ${sampleDomain}`);
            console.log(`   📧 Sample email: ${sampleEmail}`);
        }
        
        return true;
        
    } catch (error) {
        console.error('   ❌ Data files test failed:', error.message);
        console.error('   💡 Make sure Storedomains.csv and mailboxaccounts.csv exist in the project root');
        return false;
    }
}

async function runTests() {
    console.log('🚀 Starting MCP Test Suite...\n');
    
    const results = {
        dataFiles: false,
        browserbase: false,
        zapier: false
    };
    
    // Test data files first
    results.dataFiles = await testDataFiles();
    
    // Test Browserbase MCP
    results.browserbase = await testBrowserbaseMCP();
    
    // Test Zapier MCP
    results.zapier = await testZapierMCP();
    
    // Summary
    console.log('\n📊 Test Results Summary:');
    console.log(`   Data Files: ${results.dataFiles ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Browserbase MCP: ${results.browserbase ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Zapier MCP: ${results.zapier ? '✅ PASS' : '❌ FAIL'}`);
    
    const allPassed = Object.values(results).every(result => result);
    
    if (allPassed) {
        console.log('\n🎉 All tests passed! Ready to run email automation.');
        console.log('\n🚀 To start the automation:');
        console.log('   npm start                              # Full automation');
        console.log('   node scripts/run_automation.js --test  # Test with 10 domains');
    } else {
        console.log('\n⚠️ Some tests failed. Please fix the issues before running automation.');
        console.log('\n🔧 Troubleshooting:');
        if (!results.dataFiles) {
            console.log('   - Ensure CSV files are in the project root');
            console.log('   - Check file format and permissions');
        }
        if (!results.browserbase) {
            console.log('   - Verify Browserbase MCP is connected');
            console.log('   - Check Browserbase account and API limits');
        }
        if (!results.zapier) {
            console.log('   - Verify Zapier MCP is configured');
            console.log('   - Check Slack app permissions and channel access');
        }
    }
    
    process.exit(allPassed ? 0 : 1);
}

// Handle errors gracefully
process.on('unhandledRejection', (reason, promise) => {
    console.error('\n💥 Unhandled rejection during test:', reason);
    process.exit(1);
});

// Run the tests
runTests().catch(error => {
    console.error('\n💥 Test suite failed:', error);
    process.exit(1);
}); 