/**
 * Test Dynamic Form Detection on Skims.com
 * 
 * Test the sophisticated dynamic detection on skims.com
 * which we know has working forms from our previous tests.
 */

const { chromium } = require('playwright');
const { DynamicFormDetector, attemptDynamicFormSubmission } = require('./dynamic_form_detector');
const axios = require('axios');

const CONFIG = {
    BROWSERBASE_API_KEY: 'bb_live_FTV11nF0Vs1NR_T_rVBHRmQHv74',
    BROWSERBASE_PROJECT_ID: 'd277f38a-cc07-4af9-8473-83cefed0bfcd'
};

async function testSkimsDynamic() {
    let browser = null;
    let sessionId = null;
    
    try {
        console.log('🔍 Testing Dynamic Detection on Skims.com');
        console.log('='.repeat(60));
        
        // Create session
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
        console.log(`✅ Created session: ${sessionId}`);
        
        // Connect to browser
        browser = await chromium.connectOverCDP(response.data.connectUrl);
        const page = (browser.contexts()[0] || await browser.newContext()).pages()[0] || await browser.contexts()[0].newPage();
        
        // Navigate to skims.com
        console.log('🌐 Navigating to skims.com...');
        await page.goto('https://skims.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
        console.log('✅ Navigation successful');
        
        // Standard detection baseline
        console.log('\n📊 Baseline Standard Detection:');
        const baseline = await page.evaluate(() => {
            return {
                forms: document.querySelectorAll('form').length,
                emailInputs: document.querySelectorAll('input[type="email"], input[name*="email" i]').length,
                allInputs: document.querySelectorAll('input').length,
                hasNewsletterText: document.body.textContent.toLowerCase().includes('newsletter'),
                hasSubscribeText: document.body.textContent.toLowerCase().includes('subscribe'),
                hasSignupText: document.body.textContent.toLowerCase().includes('sign up') || document.body.textContent.toLowerCase().includes('signup'),
                bodyTextSample: document.body.textContent.substring(0, 200)
            };
        });
        
        console.log(`- Forms found: ${baseline.forms}`);
        console.log(`- Email inputs: ${baseline.emailInputs}`);
        console.log(`- All inputs: ${baseline.allInputs}`);
        console.log(`- Newsletter text: ${baseline.hasNewsletterText}`);
        console.log(`- Subscribe text: ${baseline.hasSubscribeText}`);
        console.log(`- Signup text: ${baseline.hasSignupText}`);
        console.log(`- Body text sample: "${baseline.bodyTextSample.replace(/\s+/g, ' ')}"`);
        
        // Dynamic detection
        console.log('\n🚀 Starting Dynamic Detection:');
        const detector = new DynamicFormDetector(page);
        const results = await detector.detectForms('https://skims.com');
        
        console.log('\n📈 Dynamic Detection Results:');
        console.log(`- Total forms: ${results.totalFormsFound}`);
        console.log(`- Total email inputs: ${results.totalEmailInputs}`);
        console.log(`- Dynamic forms detected: ${results.dynamicFormsDetected}`);
        
        console.log('\n📋 Detection Phase Summary:');
        results.phases.forEach((phase, index) => {
            console.log(`${index + 1}. ${phase.phase}: ${phase.formsFound} forms, ${phase.emailInputs} email inputs (${phase.duration}ms, ${phase.scrollsPerformed} scrolls, ${phase.mutations} mutations)`);
            
            if (phase.emailInputDetails && phase.emailInputDetails.length > 0) {
                console.log(`   📝 Email inputs found:`);
                phase.emailInputDetails.forEach((input, i) => {
                    console.log(`      ${i + 1}. ${input.type} input - name:"${input.name}" id:"${input.id}" placeholder:"${input.placeholder}" visible:${input.visible}`);
                });
            }
        });
        
        console.log('\n🔍 Page Analysis:');
        const summary = results.detectionSummary;
        console.log(`- Has lazy loading: ${summary.hasLazyLoading}`);
        console.log(`- JavaScript frameworks: ${Object.entries(summary.hasJavaScriptFrameworks).filter(([k,v]) => v).map(([k]) => k).join(', ') || 'None detected'}`);
        console.log(`- Modal triggers: ${summary.hasModalTriggers}`);
        console.log(`- Newsletter triggers: ${summary.hasNewsletterTriggers}`);
        console.log(`- Newsletter text: ${summary.hasNewsletterText}`);
        console.log(`- Subscribe text: ${summary.hasSubscribeText}`);
        console.log(`- Signup text: ${summary.hasSignupText}`);
        
        // Test form submission if inputs found
        if (results.totalEmailInputs > 0) {
            console.log('\n💌 Testing Dynamic Form Submission:');
            const submissionResult = await attemptDynamicFormSubmission(page, 'test@example.com', 'https://skims.com');
            
            if (submissionResult.success) {
                console.log('✅ SUCCESS! Dynamic form submission worked!');
                console.log(`📝 Form details: ${JSON.stringify(submissionResult.inputUsed, null, 2)}`);
            } else {
                console.log(`❌ Submission failed: ${submissionResult.reason}`);
            }
        } else {
            console.log('\n❌ No email inputs detected - testing form triggers...');
            
            // Try to trigger newsletter modals/popups
            const popupResults = await page.evaluate(() => {
                const triggers = [];
                // Look for common newsletter triggers
                const newsletterTriggers = document.querySelectorAll('[class*="newsletter" i], [id*="newsletter" i], [data-*="newsletter" i]');
                newsletterTriggers.forEach(trigger => {
                    triggers.push({
                        element: trigger.tagName,
                        className: trigger.className,
                        id: trigger.id,
                        text: trigger.textContent?.substring(0, 50)
                    });
                });
                return triggers;
            });
            
            console.log(`🔍 Found ${popupResults.length} potential newsletter triggers`);
            popupResults.forEach((trigger, i) => {
                console.log(`   ${i + 1}. ${trigger.element} - "${trigger.text}"`);
            });
        }
        
        // Take final screenshot
        await page.screenshot({ path: './logs/skims_dynamic_test.png', fullPage: true });
        console.log('\n📸 Screenshot saved to ./logs/skims_dynamic_test.png');
        
        // Summary
        console.log('\n📊 SUMMARY:');
        console.log(`Standard Detection: ${baseline.emailInputs} email inputs`);
        console.log(`Dynamic Detection: ${results.totalEmailInputs} email inputs`);
        const improvement = results.totalEmailInputs - baseline.emailInputs;
        console.log(`Improvement: ${improvement > 0 ? '+' : ''}${improvement} email inputs`);
        console.log(`Success: ${results.totalEmailInputs > 0 ? '✅ YES' : '❌ NO'}`);
        
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        console.error(error.stack);
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

console.log('🧪 Starting Skims Dynamic Detection Test...');
testSkimsDynamic().then(() => {
    console.log('🎯 Test complete!');
}).catch(error => {
    console.error('❌ Test failed:', error.message);
}); 