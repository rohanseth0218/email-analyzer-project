/**
 * Test Email Automation Runner
 * 
 * This script runs the email automation in test mode with a limited number of domains.
 */

// Load the automation runner
eval(await read_file({
    target_file: 'automation_runner.js',
    explanation: 'Loading the automation runner code',
    should_read_entire_file: true,
    start_line_one_indexed: 1,
    end_line_one_indexed_inclusive: -1
}));

// Enable test mode
CONFIG.testMode = true;
CONFIG.maxTestDomains = 100;
CONFIG.notificationInterval = 20; // Send updates every 20 domains for testing

console.log('🧪 Running Email Automation in TEST MODE');
console.log('📊 Configuration updated for testing:');
console.log(`   - Test Mode: ${CONFIG.testMode}`);
console.log(`   - Notification Interval: ${CONFIG.notificationInterval}`);
console.log(`   - Max domains: ${CONFIG.maxTestDomains}`);

// Start the test automation
runEmailAutomation()
    .then(stats => {
        console.log('🎉 Test automation completed!');
        console.log('📊 Final stats:', stats);
    })
    .catch(error => {
        console.error('❌ Test automation failed:', error);
    }); 