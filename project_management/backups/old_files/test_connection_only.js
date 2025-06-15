const { chromium } = require('playwright');
const axios = require('axios');

async function testBrowserbaseConnection() {
    console.log('🔍 Testing Browserbase Connection Only...');
    
    try {
        // Create session
        console.log('🔄 Creating session...');
        const response = await axios.post('https://api.browserbase.com/v1/sessions', 
            {
                projectId: 'd277f38a-cc07-4af9-8473-83cefed0bfcd',
                browserSettings: {
                    viewport: { width: 1920, height: 1080 },
                    stealth: true
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-BB-API-Key': 'bb_live_FTV11nF0Vs1NR_T_rVBHRmQHv74'
                },
                timeout: 15000
            }
        );
        
        const sessionId = response.data.id;
        const connectUrl = response.data.connectUrl;
        console.log(`✅ Session created: ${sessionId}`);
        console.log(`🔗 Connect URL: ${connectUrl}`);
        
        // Connect browser
        console.log('🌐 Connecting to browser...');
        const browser = await chromium.connect(connectUrl);
        console.log('✅ Browser connected');
        
        // Create page
        console.log('📄 Creating page...');
        const context = await browser.newContext();
        const page = await context.newPage();
        console.log('✅ Page created');
        
        // Test simple navigation
        console.log('🔍 Testing navigation to Google...');
        await page.goto('https://www.google.com', { 
            waitUntil: 'domcontentloaded', 
            timeout: 15000 
        });
        console.log('✅ Navigation successful!');
        
        // Get page title to confirm
        const title = await page.title();
        console.log(`📰 Page title: ${title}`);
        
        // Take screenshot
        await page.screenshot({ path: 'connection_test.png' });
        console.log('📸 Screenshot saved: connection_test.png');
        
        // Clean up
        await browser.close();
        console.log('🔚 Browser closed');
        
        console.log('\n🎉 CONNECTION TEST SUCCESSFUL!');
        console.log('✅ Sessions are creating properly');
        console.log('✅ Browser connections work');
        console.log('✅ Page navigation works');
        console.log('✅ This means the issue is likely in form detection/interaction');
        
    } catch (error) {
        console.error('❌ Connection test failed:', error.message);
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(`Data:`, error.response.data);
        }
    }
}

testBrowserbaseConnection(); 