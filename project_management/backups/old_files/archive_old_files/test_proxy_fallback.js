/**
 * Test Proxy Fallback Logic
 * 
 * Test the enhanced proxy fallback on a domain that was getting
 * ERR_TUNNEL_CONNECTION_FAILED errors.
 */

const { runEnhancedAutomation } = require('./enhanced_automation');
const fs = require('fs').promises;

async function testProxyFallback() {
    console.log('🔄 Testing Proxy Fallback Logic');
    
    try {
        // Test with a domain that was getting tunnel connection failures
        const testDomain = {
            domain: 'https://shoplimoni.com',
            email: 'test@example.com',
            error: 'Proxy fallback test',
            timestamp: new Date().toISOString()
        };
        
        await fs.writeFile('./logs/failed_attempts.json', JSON.stringify([testDomain], null, 2));
        console.log('💾 Created test file with shoplimoni.com');
        
        console.log('🚀 Running automation with proxy fallback...');
        const result = await runEnhancedAutomation(1, true);
        
        console.log('🧪 Proxy Fallback Test Complete!');
        console.log('📈 Result:', {
            success: result.successful > 0 ? 'SUCCESS' : 'FAILED',
            domains: result.processed,
            successful: result.successful,
            failed: result.failed,
            details: 'Check logs for proxy configurations tried'
        });
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testProxyFallback().then(() => {
    console.log('🧪 Proxy fallback test complete.');
}).catch(error => {
    console.error('❌ Test error:', error.message);
    process.exit(1);
}); 