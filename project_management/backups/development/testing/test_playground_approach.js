const { chromium } = require('playwright');
const axios = require('axios');

class PlaygroundApproachTest {
    constructor() {
        this.BROWSERBASE_API_KEY = 'bb_live_FTV11nF0Vs1NR_T_rVBHRmQHv74';
        this.BROWSERBASE_PROJECT_ID = 'd277f38a-cc07-4af9-8473-83cefed0bfcd';
        
        this.testDomains = [
            'https://verabradley.com/',
            'https://www.sanrio.com',
            'https://skims.com',
            'https://soldejaneiro.com',
            'https://thursdayboots.com'
        ];
        
        this.emails = [
            'testemailforapp991@gmail.com',
            'testemailforapp992@gmail.com',
            'testemailforapp993@gmail.com',
            'testemailforapp994@gmail.com',
            'testemailforapp995@gmail.com'
        ];
        
        this.results = [];
    }

    async log(message) {
        const timestamp = new Date().toISOString();
        console.log(`${timestamp} ${message}`);
    }

    async createBrowserbaseSession() {
        try {
            await this.log('🔄 Creating Browserbase session...');
            
            const response = await axios.post('https://api.browserbase.com/v1/sessions', 
                {
                    projectId: this.BROWSERBASE_PROJECT_ID,
                    browserSettings: {
                        viewport: { width: 1920, height: 1080 },
                        stealth: true
                    }
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-BB-API-Key': this.BROWSERBASE_API_KEY
                    },
                    timeout: 15000
                }
            );
            
            const sessionId = response.data.id;
            const connectUrl = response.data.connectUrl;
            await this.log(`✅ Session created: ${sessionId}`);
            
            return { sessionId, connectUrl };
            
        } catch (error) {
            await this.log(`❌ Session creation failed: ${error.message}`);
            throw error;
        }
    }

    async testSingleDomain(domain, email, index) {
        await this.log(`\n🔍 TESTING DOMAIN ${index + 1}/5: ${domain} with ${email}`);
        
        let browser = null;
        try {
            // Create session
            const { sessionId, connectUrl } = await this.createBrowserbaseSession();
            
            // Connect using CDP approach like in playground
            await this.log('🌐 Connecting browser via CDP...');
            browser = await chromium.connectOverCDP(connectUrl);
            await this.log('✅ Browser connected via CDP!');
            
            // Create context with settings like in playground
            const context = await browser.newContext({
                geolocation: { latitude: 40.7128, longitude: -74.0060 },
                locale: 'en-US',
                permissions: ['geolocation']
            });
            const page = await context.newPage();
            await this.log('✅ Context and page created');
            
            // Add UTM parameters like in playground
            const UTM_PARAMS = "?utm_source=test&utm_medium=email&utm_campaign=ripple-test";
            const urlWithParams = `${domain}${UTM_PARAMS}`;
            
            await this.log(`📝 Navigating to ${urlWithParams}...`);
            await page.goto(urlWithParams, { waitUntil: "load", timeout: 30000 });
            await this.log('✅ Page loaded successfully');
            
            // Wait for modals like in playground
            await page.waitForTimeout(3000);
            await this.log('⏱️ Waited for modals to appear');
            
            // Try Klaviyo form trigger like in playground
            try {
                await page.evaluate(() => {
                    window._klOnsite = window._klOnsite || [];
                    window._klOnsite.push(['openForm', '']);
                });
                await this.log('✅ Triggered Klaviyo form manually');
            } catch (e) {
                await this.log('⚠️ Unable to trigger Klaviyo form manually');
            }
            
            let submitted = false;
            
            // Try popup form first (like in playground)
            try {
                await this.log('🔍 Looking for popup email input...');
                const popupInput = await page.$('input[type="email"]:visible');
                
                if (popupInput) {
                    await this.log('✅ Popup email input found. Filling...');
                    await popupInput.fill(email);
                    
                    const submitBtn = await page.$('form button[type="submit"]:visible, form input[type="submit"]:visible');
                    if (submitBtn) {
                        try {
                            await this.log('🚀 Trying native click on popup...');
                            await submitBtn.click({ timeout: 5000 });
                        } catch {
                            await this.log('🔄 Native click failed, trying JS click...');
                            await page.evaluate((el) => el.click(), submitBtn);
                        }
                        submitted = true;
                        await this.log('✅ Popup form submitted!');
                    } else {
                        await popupInput.press('Enter');
                        submitted = true;
                        await this.log('✅ Popup submitted via Enter key!');
                    }
                    
                    await page.waitForTimeout(2000);
                } else {
                    await this.log('ℹ️ No popup input found');
                }
            } catch (e) {
                await this.log(`❌ Error with popup form: ${e.message}`);
            }
            
            // Fallback to footer form (like in playground)
            if (!submitted) {
                try {
                    await this.log('🔍 Trying footer form fallback...');
                    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                    await page.waitForTimeout(2000);
                    await this.log('📜 Scrolled to footer');
                    
                    const footerInput = await page.$('footer input[type="email"]');
                    if (footerInput) {
                        await this.log('✅ Footer email input found. Filling...');
                        await footerInput.fill(email);
                        
                        const footerBtn = await page.$('footer button[type="submit"], footer input[type="submit"], footer button:has-text("Subscribe"), footer button:has-text("Sign Up")');
                        if (footerBtn) {
                            try {
                                await footerBtn.click({ timeout: 5000 });
                            } catch {
                                await page.evaluate((el) => el.click(), footerBtn);
                            }
                            submitted = true;
                            await this.log('✅ Footer form submitted!');
                        } else {
                            await footerInput.press('Enter');
                            submitted = true;
                            await this.log('✅ Footer form submitted via Enter key!');
                        }
                        
                        await page.waitForTimeout(2000);
                    } else {
                        await this.log('⚠️ Footer input not found');
                    }
                } catch (e) {
                    await this.log(`❌ Error with footer fallback: ${e.message}`);
                }
            }
            
            // Take screenshot for debugging
            await page.screenshot({ 
                path: `logs/playground_test_${index}_${domain.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
                fullPage: true 
            });
            await this.log('📸 Screenshot saved');
            
            const result = {
                domain,
                email,
                success: submitted,
                method: submitted ? 'playground_approach' : 'no_form_found',
                timestamp: new Date().toISOString()
            };
            
            if (submitted) {
                await this.log('✅ Email successfully submitted!');
            } else {
                await this.log('❌ Failed to submit email form');
            }
            
            return result;
            
        } catch (error) {
            await this.log(`❌ Domain test failed: ${error.message}`);
            return {
                domain,
                email,
                success: false,
                method: 'error',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        } finally {
            if (browser) {
                try {
                    await browser.close();
                    await this.log('🔚 Browser closed');
                } catch (e) {
                    await this.log(`⚠️ Error closing browser: ${e.message}`);
                }
            }
        }
    }

    async runTest() {
        await this.log('🚀 Starting Playground Approach Test');
        
        for (let i = 0; i < this.testDomains.length; i++) {
            const domain = this.testDomains[i];
            const email = this.emails[i];
            
            const result = await this.testSingleDomain(domain, email, i);
            this.results.push(result);
            
            // Wait between tests
            if (i < this.testDomains.length - 1) {
                await this.log('⏱️ Waiting 5 seconds between tests...');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
        
        // Generate report
        await this.generateReport();
    }

    async generateReport() {
        await this.log('\n📊 PLAYGROUND APPROACH TEST COMPLETE');
        await this.log('===========================================');
        
        const successful = this.results.filter(r => r.success).length;
        const total = this.results.length;
        const successRate = total > 0 ? ((successful / total) * 100).toFixed(2) : 0;
        
        await this.log(`✅ Success rate: ${successful}/${total} (${successRate}%)`);
        
        await this.log('\n📋 DETAILED RESULTS:');
        this.results.forEach((result, index) => {
            const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
            const method = result.method || 'unknown';
            this.log(`  ${index + 1}. ${result.domain}: ${status} (${method})`);
        });
        
        // Determine if approach works
        if (successful > 0) {
            await this.log(`\n🎉 PLAYGROUND APPROACH WORKS! ${successful} successful submissions`);
            await this.log('✅ This confirms the issue was in connection method and form detection');
            await this.log('✅ Your main automation should work with these improvements');
        } else {
            await this.log('\n❌ Playground approach failed on all domains');
            await this.log('🔍 May need further investigation');
        }
        
        await this.log('\n📁 Check screenshots in logs/ directory for visual confirmation');
    }
}

// Run the test
const tester = new PlaygroundApproachTest();
tester.runTest().catch(error => {
    console.error('💥 Test failed:', error);
    process.exit(1);
}); 