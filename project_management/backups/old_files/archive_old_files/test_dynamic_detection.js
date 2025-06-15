/**
 * Test Dynamic Form Detection System
 * 
 * Test the new sophisticated dynamic form detection on sites that 
 * have JavaScript-loaded or scroll-triggered forms.
 */

const { chromium } = require('playwright');
const { DynamicFormDetector, attemptDynamicFormSubmission } = require('./dynamic_form_detector');
const axios = require('axios');
const fs = require('fs').promises;

const CONFIG = {
    BROWSERBASE_API_KEY: 'bb_live_FTV11nF0Vs1NR_T_rVBHRmQHv74',
    BROWSERBASE_PROJECT_ID: 'd277f38a-cc07-4af9-8473-83cefed0bfcd'
};

/**
 * Test domains that are known to have dynamic forms
 */
const TEST_DOMAINS = [
    'https://shoplimoni.com',           // Italian site with newsletter form
    'https://skims.com',               // Found forms but couldn't interact
    'https://crystalintuition.com',    // Found 2 forms but 0 email inputs
    'https://chicbirdie.com',          // Found 1 form but 0 email inputs
    'https://graceandlaceboutique.com' // Shopify site
];

async function createBrowserbaseSession() {
    try {
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

        return {
            sessionId: response.data.id,
            connectUrl: response.data.connectUrl
        };
    } catch (error) {
        throw new Error(`Failed to create session: ${error.message}`);
    }
}

async function testDynamicDetectionOnDomain(domain) {
    let browser = null;
    let sessionId = null;
    
    try {
        console.log(`\n🔍 Testing Dynamic Detection on ${domain}`);
        console.log('='.repeat(60));
        
        // Create session
        const session = await createBrowserbaseSession();
        sessionId = session.sessionId;
        console.log(`✅ Created session: ${sessionId}`);
        
        // Connect to browser
        browser = await chromium.connectOverCDP(session.connectUrl);
        const page = (browser.contexts()[0] || await browser.newContext()).pages()[0] || await browser.contexts()[0].newPage();
        
        // Navigate with UTM fallback
        let url = domain;
        try {
            const response = await page.goto(`${domain}?utm_source=test`, { waitUntil: 'domcontentloaded', timeout: 30000 });
            if (response.status() >= 400) {
                console.log(`⚠️ UTM failed (${response.status()}), trying without UTM...`);
                await page.goto(domain, { waitUntil: 'domcontentloaded', timeout: 30000 });
            }
        } catch (navError) {
            console.log(`⚠️ UTM navigation failed, trying without UTM...`);
            await page.goto(domain, { waitUntil: 'domcontentloaded', timeout: 30000 });
        }
        
        console.log(`✅ Navigated to ${domain}`);
        
        // Test standard detection first
        console.log('\n📊 Standard Detection:');
        const standardForms = await page.evaluate(() => {
            return {
                forms: document.querySelectorAll('form').length,
                emailInputs: document.querySelectorAll('input[type="email"], input[name*="email" i]').length,
                hasNewsletterText: document.body.textContent.toLowerCase().includes('newsletter'),
                hasIscrivitiText: document.body.textContent.toLowerCase().includes('iscriviti')
            };
        });
        console.log(`- Forms: ${standardForms.forms}`);
        console.log(`- Email inputs: ${standardForms.emailInputs}`);
        console.log(`- Has newsletter text: ${standardForms.hasNewsletterText}`);
        console.log(`- Has iscriviti text: ${standardForms.hasIscrivitiText}`);
        
        // Test dynamic detection
        console.log('\n🚀 Dynamic Detection:');
        const detector = new DynamicFormDetector(page);
        const detectionResults = await detector.detectForms(domain);
        
        console.log(`📈 Detection Results:`);
        console.log(`- Total forms found: ${detectionResults.totalFormsFound}`);
        console.log(`- Total email inputs: ${detectionResults.totalEmailInputs}`);
        console.log(`- Dynamic forms detected: ${detectionResults.dynamicFormsDetected}`);
        console.log(`- Scroll triggered forms: ${detectionResults.scrollTriggeredForms}`);
        
        console.log(`\n📋 Phase Results:`);
        detectionResults.phases.forEach(phase => {
            console.log(`- ${phase.phase}: ${phase.formsFound} forms, ${phase.emailInputs} email inputs (${phase.mutations} mutations, ${phase.scrollsPerformed} scrolls)`);
        });
        
        console.log(`\n🔍 Detection Summary:`);
        const summary = detectionResults.detectionSummary;
        console.log(`- Has lazy loading: ${summary.hasLazyLoading}`);
        console.log(`- JavaScript frameworks: ${Object.entries(summary.hasJavaScriptFrameworks).filter(([k,v]) => v).map(([k,v]) => k).join(', ') || 'None'}`);
        console.log(`- Modal triggers: ${summary.hasModalTriggers}`);
        console.log(`- Newsletter triggers: ${summary.hasNewsletterTriggers}`);
        console.log(`- Newsletter text: ${summary.hasNewsletterText}`);
        console.log(`- Iscriviti text: ${summary.hasIscrivitiText}`);
        console.log(`- Registrati text: ${summary.hasRegistratiText}`);
        
        // If email inputs found, try submission
        if (detectionResults.totalEmailInputs > 0) {
            console.log('\n💌 Testing Form Submission:');
            const submissionResult = await attemptDynamicFormSubmission(page, 'test@example.com', domain);
            
            if (submissionResult.success) {
                console.log(`✅ Form submission successful!`);
                console.log(`- Input used: ${JSON.stringify(submissionResult.inputUsed, null, 2)}`);
            } else {
                console.log(`❌ Form submission failed: ${submissionResult.reason}`);
            }
        }
        
        // Take screenshots
        await page.screenshot({ path: `./logs/dynamic_test_${domain.replace(/[^a-zA-Z0-9]/g, '_')}.png`, fullPage: true });
        console.log(`📸 Screenshot saved`);
        
        // Save detailed results
        const resultFile = `./logs/dynamic_detection_${domain.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
        await fs.writeFile(resultFile, JSON.stringify({
            domain,
            standardDetection: standardForms,
            dynamicDetection: detectionResults,
            timestamp: new Date().toISOString()
        }, null, 2));
        console.log(`💾 Results saved to ${resultFile}`);
        
        return {
            domain,
            standardForms: standardForms.emailInputs,
            dynamicForms: detectionResults.totalEmailInputs,
            improvement: detectionResults.totalEmailInputs - standardForms.emailInputs,
            success: detectionResults.totalEmailInputs > 0
        };
        
    } catch (error) {
        console.error(`❌ Error testing ${domain}: ${error.message}`);
        return {
            domain,
            error: error.message,
            success: false
        };
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

async function runDynamicDetectionTests() {
    console.log('🚀 Starting Dynamic Form Detection Tests');
    console.log('='.repeat(80));
    console.log(`Testing ${TEST_DOMAINS.length} domains with sophisticated dynamic detection`);
    
    const results = [];
    
    for (const domain of TEST_DOMAINS) {
        const result = await testDynamicDetectionOnDomain(domain);
        results.push(result);
        
        // Wait between tests to avoid rate limiting
        if (TEST_DOMAINS.indexOf(domain) < TEST_DOMAINS.length - 1) {
            console.log('\n⏱️ Waiting 10 seconds before next test...');
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    }
    
    // Summary
    console.log('\n📊 DYNAMIC DETECTION TEST SUMMARY');
    console.log('='.repeat(80));
    
    const successful = results.filter(r => r.success);
    const improved = results.filter(r => r.improvement > 0);
    
    console.log(`✅ Successful detections: ${successful.length}/${results.length}`);
    console.log(`📈 Improved detections: ${improved.length}/${results.length}`);
    
    results.forEach(result => {
        if (result.error) {
            console.log(`❌ ${result.domain}: ERROR - ${result.error}`);
        } else {
            const improvement = result.improvement > 0 ? `(+${result.improvement})` : '';
            console.log(`${result.success ? '✅' : '❌'} ${result.domain}: ${result.standardForms} → ${result.dynamicForms} ${improvement}`);
        }
    });
    
    // Save summary
    await fs.writeFile('./logs/dynamic_detection_summary.json', JSON.stringify({
        testDate: new Date().toISOString(),
        totalTested: results.length,
        successful: successful.length,
        improved: improved.length,
        results
    }, null, 2));
    
    console.log('\n💾 Summary saved to ./logs/dynamic_detection_summary.json');
    console.log('🎯 Dynamic detection tests complete!');
}

// Run the tests
runDynamicDetectionTests().catch(console.error); 