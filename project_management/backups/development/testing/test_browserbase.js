const axios = require('axios');

// Get config from the main script
const CONFIG = {
    BROWSERBASE_API_KEY: 'bb_live_FTV11nF0Vs1NR_T_rVBHRmQHv74',
    BROWSERBASE_PROJECT_ID: 'd277f38a-cc07-4af9-8473-83cefed0bfcd'
};

async function testBrowserbaseConnection() {
    console.log('🔍 Testing Browserbase connection...');
    console.log(`Project ID: ${CONFIG.BROWSERBASE_PROJECT_ID}`);
    console.log(`API Key: ${CONFIG.BROWSERBASE_API_KEY ? 'Present' : 'Missing'}`);
    
    try {
        console.log('\n📡 Creating test session...');
        const response = await axios.post(
            'https://api.browserbase.com/v1/sessions',
            {
                projectId: CONFIG.BROWSERBASE_PROJECT_ID,
                browserSettings: {
                    viewport: { width: 1920, height: 1080 },
                    stealth: true
                }
                // Removed proxies to avoid bandwidth limits
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-BB-API-Key': CONFIG.BROWSERBASE_API_KEY
                }
            }
        );

        console.log('✅ Session created successfully!');
        console.log(`Session ID: ${response.data.id}`);
        console.log(`Connect URL: ${response.data.connectUrl}`);
        
        // Try to close the session
        try {
            await axios.post(`https://api.browserbase.com/v1/sessions/${response.data.id}`, 
                { status: 'COMPLETED' }, 
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-BB-API-Key': CONFIG.BROWSERBASE_API_KEY
                    }
                }
            );
            console.log('✅ Session closed successfully!');
        } catch (closeError) {
            console.log('⚠️ Could not close session (this is OK)');
        }
        
        console.log('\n🎉 Browserbase connection test PASSED!');
        return true;
        
    } catch (error) {
        console.error('❌ Browserbase connection test FAILED!');
        console.error(`Error: ${error.message}`);
        
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
        }
        
        return false;
    }
}

testBrowserbaseConnection().catch(console.error); 