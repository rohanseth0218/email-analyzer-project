/**
 * Test Single Domain - americandental.com
 * 
 * Test the enhanced form detection on just americandental.com
 * to see if we can make the hidden form visible.
 */

const { runEnhancedAutomation } = require('./enhanced_automation');
const fs = require('fs').promises;

async function testSingleDomain() {
    console.log('🧪 Testing Enhanced Form Detection on americandental.com');
    
    try {
        // Create a test failed attempts file with just americandental.com
        const testDomain = {
            domain: 'https://americandental.com',
            email: 'test@example.com',
            error: 'Test run',
            timestamp: new Date().toISOString()
        };
        
        await fs.writeFile('./logs/failed_attempts.json', JSON.stringify([testDomain], null, 2));
        console.log('💾 Created test file with americandental.com');
        
        // Run enhanced automation in retry mode
        const result = await runEnhancedAutomation(null, true);
        
        console.log('\n🧪 Single Domain Test Complete!');
        console.log('📈 Result:', {
            success: result.stats.successful > 0 ? 'SUCCESS' : 'FAILED',
            attempts: result.stats.processed,
            details: result.stats.successful > 0 ? 'Form was found and submitted!' : 'Form still not accessible'
        });
        
        return result;
        
    } catch (error) {
        console.error('❌ Single domain test failed:', error);
        throw error;
    }
}

// Run the test
if (require.main === module) {
    testSingleDomain()
        .then(() => {
            console.log('\n🧪 Single domain test complete.');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Test failed:', error);
            process.exit(1);
        });
}

module.exports = { testSingleDomain }; 