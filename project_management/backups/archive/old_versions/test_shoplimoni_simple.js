/**
 * Simple Shoplimoni Test - No UTM Parameters
 * 
 * Test if the 400 error is caused by UTM parameters
 */

const { chromium } = require('playwright');
const axios = require('axios');

const CONFIG = {
    BROWSERBASE_API_KEY: 'bb_live_FTV11nF0Vs1NR_T_rVBHRmQHv74',
    BROWSERBASE_PROJECT_ID: 'd277f38a-cc07-4af9-8473-83cefed0bfcd'
};

async function testShoplimoniSimple() {
    let browser = null;
    let sessionId = null;
    
    try {
        console.log('🔍 Creating session without UTM parameters...');
        
        // Create session with proxy
        const response = await axios.post(
            'https://api.browserbase.com/v1/sessions',
            {
                projectId: CONFIG.BROWSERBASE_PROJECT_ID,
                browserSettings: {
                    viewport: { width: 1920, height: 1080 },
                    stealth: true
                },
                proxies: [{
                    type: "browserbase",
                    geolocation: { country: "US", state: "NY", city: "NEW_YORK" }
                }]
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-BB-API-Key': CONFIG.BROWSERBASE_API_KEY
                }
            }
        );
        
        sessionId = response.data.id;
        console.log('✅ Session created:', sessionId);
        
        browser = await chromium.connectOverCDP(response.data.connectUrl);
        const page = (browser.contexts()[0] || await browser.newContext()).pages()[0] || await browser.contexts()[0].newPage();
        
        console.log('🌐 Testing shoplimoni.com WITHOUT UTM parameters...');
        const response1 = await page.goto('https://shoplimoni.com', { waitUntil: 'domcontentloaded' });
        console.log('Response status:', response1.status());
        
        if (response1.status() === 200) {
            console.log('✅ SUCCESS! Page loaded without UTM parameters');
            
            await page.waitForTimeout(3000);
            
            // Quick form analysis
            const analysis = await page.evaluate(() => ({
                forms: document.querySelectorAll('form').length,
                emailInputs: document.querySelectorAll('input[type="email"]').length,
                textInputs: document.querySelectorAll('input[type="text"]').length,
                inputsWithEmailPlaceholder: document.querySelectorAll('input[placeholder*="email" i]').length,
                newsletterText: document.body.textContent.toLowerCase().includes('newsletter'),
                iscrivitiText: document.body.textContent.toLowerCase().includes('iscriviti'),
                registratiText: document.body.textContent.toLowerCase().includes('registrati')
            }));
            
            console.log('📊 Quick Analysis:');
            console.log('- Forms:', analysis.forms);
            console.log('- Email inputs:', analysis.emailInputs);
            console.log('- Text inputs:', analysis.textInputs);
            console.log('- Inputs with email placeholder:', analysis.inputsWithEmailPlaceholder);
            console.log('- Contains "newsletter":', analysis.newsletterText);
            console.log('- Contains "iscriviti":', analysis.iscrivitiText);
            console.log('- Contains "registrati":', analysis.registratiText);
            
            await page.screenshot({ path: './logs/shoplimoni_simple_test.png' });
            console.log('📸 Screenshot saved to ./logs/shoplimoni_simple_test.png');
            
        } else {
            console.log('❌ Still getting error. Status:', response1.status());
        }
        
        console.log('\n🧪 Testing WITH UTM parameters...');
        const response2 = await page.goto('https://shoplimoni.com?utm_source=automation&utm_medium=signup&utm_campaign=bulk-signup', { waitUntil: 'domcontentloaded' });
        console.log('UTM Response status:', response2.status());
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (browser) await browser.close();
        if (sessionId) {
            try {
                await axios.post(`https://api.browserbase.com/v1/sessions/${sessionId}`, { status: 'COMPLETED' }, {
                    headers: { 'Content-Type': 'application/json', 'X-BB-API-Key': CONFIG.BROWSERBASE_API_KEY }
                });
            } catch (e) {}
        }
    }
}

testShoplimoniSimple(); 