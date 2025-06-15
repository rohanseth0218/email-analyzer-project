/**
 * Test Full Automation - Small Scale Test
 * 
 * Test the full automation system on just 10 domains to verify 
 * everything works before running on all 50k domains.
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const csv = require('csv-parse/sync');
const axios = require('axios');

// Configuration - same as full automation but smaller scale
const CONFIG = {
    BROWSERBASE_API_KEY: 'bb_live_FTV11nF0Vs1NR_T_rVBHRmQHv74',
    BROWSERBASE_PROJECT_ID: 'd277f38a-cc07-4af9-8473-83cefed0bfcd',
    
    // Test settings
    MAX_CONCURRENT_SESSIONS: 5,  // Smaller for testing
    BATCH_SIZE: 10,  // Test with 10 domains
    TEST_DOMAIN_COUNT: 10,  // Only test 10 domains
    
    // Timeouts
    NAVIGATION_TIMEOUT: 30000,
    FORM_INTERACTION_TIMEOUT: 10000,
    
    // Logging
    FAILED_DOMAINS_LOG: './logs/test_failed_domains.jsonl',
    SUCCESS_DOMAINS_LOG: './logs/test_successful_domains.jsonl',
    PROGRESS_LOG: './logs/test_progress.json',
};

// Enhanced selectors for form detection
const ENHANCED_SELECTORS = {
    emailInputs: [
        'input[type="email"]',
        'input[name*="email" i]',
        'input[placeholder*="email" i]',
        'input[id*="email" i]',
        'input[class*="email" i]',
        'input[type="text"][name*="email" i]',
        'input[type="text"][placeholder*="email" i]',
        'input[type="text"][id*="email" i]'
    ],
    
    submitButtons: [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Subscribe")',
        'button:has-text("Sign Up")',
        'button:has-text("Join")',
        'button:has-text("Submit")',
        'button:has-text("Newsletter")',
        'button[class*="subscribe" i]',
        'button[class*="signup" i]',
        'button[class*="newsletter" i]'
    ]
};

// Use some known working domains for testing
const TEST_DOMAINS = [
    'https://americandental.com',
    'https://crystalmaggie.com', 
    'https://skims.com',
    'https://shopify.com',
    'https://example.com',
    'https://mailchimp.com',
    'https://constantcontact.com',
    'https://aweber.com',
    'https://getresponse.com',
    'https://sendinblue.com'
];

/**
 * Load email accounts
 */
async function loadEmailAccounts() {
    try {
        const csvContent = await fs.readFile('./mailboxaccounts.csv', 'utf-8');
        const records = csv.parse(csvContent, { 
            columns: true, 
            skip_empty_lines: true 
        });
        
        const emails = records
            .map(record => record.email || record.Email)
            .filter(email => email && email.includes('@'));
        
        console.log(`📧 Loaded ${emails.length} email accounts`);
        return emails;
        
    } catch (error) {
        console.error(`❌ Error loading email accounts: ${error.message}`);
        throw error;
    }
}

/**
 * Create Browserbase session with proxy
 */
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

/**
 * Enhanced form submission
 */
async function tryFormSubmissionEnhanced(page, email, domain) {
    try {
        // Standard form detection
        for (const emailSelector of ENHANCED_SELECTORS.emailInputs) {
            try {
                const emailInput = page.locator(emailSelector).first();
                
                if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await emailInput.fill(email);
                    console.log(`  ✅ Filled email input: ${emailSelector}`);
                    
                    // Try to submit
                    for (const submitSelector of ENHANCED_SELECTORS.submitButtons) {
                        try {
                            const submitButton = page.locator(submitSelector).first();
                            if (await submitButton.isVisible({ timeout: 1000 }).catch(() => false)) {
                                await submitButton.click({ timeout: 5000 });
                                console.log(`  ✅ Clicked submit: ${submitSelector}`);
                                await page.waitForTimeout(2000);
                                return true;
                            }
                        } catch (submitError) {
                            continue;
                        }
                    }
                    
                    // Try pressing Enter if no submit button found
                    await emailInput.press('Enter');
                    console.log(`  ✅ Pressed Enter on email input`);
                    await page.waitForTimeout(2000);
                    return true;
                }
            } catch (error) {
                continue;
            }
        }
        
        return false;
    } catch (error) {
        console.log(`  ❌ Form submission error: ${error.message}`);
        return false;
    }
}

/**
 * Process a single domain
 */
async function processDomain(domain, email) {
    let browser = null;
    let sessionData = null;
    
    try {
        console.log(`\n🔍 Processing: ${domain}`);
        
        // Create session
        sessionData = await createBrowserbaseSession();
        console.log(`  📱 Session created: ${sessionData.sessionId}`);
        
        // Connect to browser
        browser = await chromium.connectOverCDP(sessionData.connectUrl);
        const page = (browser.contexts()[0] || await browser.newContext()).pages()[0] || await browser.contexts()[0].newPage();
        
        // Navigation with UTM fallback
        let navigationSuccess = false;
        let finalUrl = domain;
        
        try {
            // Try with UTM parameters first
            const utmUrl = `${domain}?utm_source=test&utm_medium=signup&utm_campaign=test`;
            console.log(`  🌐 Trying with UTM: ${utmUrl}`);
            const response = await page.goto(utmUrl, { 
                waitUntil: 'domcontentloaded', 
                timeout: CONFIG.NAVIGATION_TIMEOUT 
            });
            
            if (response && response.status() >= 400) {
                console.log(`  ⚠️ UTM failed (${response.status()}), trying without UTM...`);
                await page.goto(domain, { 
                    waitUntil: 'domcontentloaded', 
                    timeout: CONFIG.NAVIGATION_TIMEOUT 
                });
                finalUrl = domain;
            } else {
                finalUrl = utmUrl;
            }
            navigationSuccess = true;
            
        } catch (navError) {
            console.log(`  ⚠️ UTM navigation failed, trying without UTM...`);
            try {
                await page.goto(domain, { 
                    waitUntil: 'domcontentloaded', 
                    timeout: CONFIG.NAVIGATION_TIMEOUT 
                });
                finalUrl = domain;
                navigationSuccess = true;
            } catch (fallbackError) {
                throw new Error(`Navigation failed: ${fallbackError.message}`);
            }
        }
        
        if (!navigationSuccess) {
            throw new Error('Navigation failed');
        }
        
        console.log(`  ✅ Navigation successful: ${finalUrl}`);
        
        // Quick form detection
        const formAnalysis = await page.evaluate(() => {
            return {
                forms: document.querySelectorAll('form').length,
                emailInputs: document.querySelectorAll('input[type="email"], input[name*="email" i]').length,
                hasNewsletterText: document.body.textContent.toLowerCase().includes('newsletter'),
                hasSubscribeText: document.body.textContent.toLowerCase().includes('subscribe')
            };
        });
        
        console.log(`  📊 Forms: ${formAnalysis.forms}, Email inputs: ${formAnalysis.emailInputs}`);
        
        if (formAnalysis.emailInputs === 0) {
            return {
                success: false,
                domain,
                reason: 'no_forms_found',
                details: `Forms: ${formAnalysis.forms}, Email inputs: ${formAnalysis.emailInputs}`,
                finalUrl
            };
        }
        
        // Try form submission
        console.log(`  💌 Attempting form submission with email: ${email}`);
        const success = await tryFormSubmissionEnhanced(page, email, domain);
        
        if (success) {
            console.log(`  ✅ SUCCESS!`);
            return {
                success: true,
                domain,
                finalUrl,
                formAnalysis
            };
        } else {
            console.log(`  ❌ Form submission failed`);
            return {
                success: false,
                domain,
                reason: 'form_submission_failed',
                details: `Found ${formAnalysis.emailInputs} email inputs but submission failed`,
                finalUrl,
                formAnalysis
            };
        }
        
    } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
        
        // Classify error
        let reason = 'unknown_error';
        if (error.message.includes('timeout') || error.message.includes('Timeout')) {
            reason = 'navigation_timeout';
        } else if (error.message.includes('net::ERR_')) {
            reason = 'network_error';
        } else if (error.message.includes('Navigation failed')) {
            reason = 'navigation_error';
        }
        
        return {
            success: false,
            domain,
            reason,
            error: error.message,
            finalUrl: domain
        };
        
    } finally {
        if (browser) {
            try {
                await browser.close();
            } catch (e) {}
        }
        
        if (sessionData) {
            try {
                await axios.post(`https://api.browserbase.com/v1/sessions/${sessionData.sessionId}`, 
                    { status: 'COMPLETED' }, 
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'X-BB-API-Key': CONFIG.BROWSERBASE_API_KEY
                        }
                    }
                );
            } catch (e) {}
        }
    }
}

/**
 * Main test function
 */
async function runTestAutomation() {
    console.log('🧪 Starting Test Automation (10 domains)');
    console.log('='.repeat(60));
    
    const startTime = Date.now();
    let totalSuccessful = 0;
    let totalFailed = 0;
    const results = [];
    
    try {
        // Initialize log directories
        await fs.mkdir('./logs', { recursive: true });
        
        // Load email accounts
        console.log('\n📧 Loading email accounts...');
        const emails = await loadEmailAccounts();
        
        console.log(`✅ Using ${TEST_DOMAINS.length} test domains and ${emails.length} email accounts`);
        
        // Process each domain
        for (let i = 0; i < TEST_DOMAINS.length; i++) {
            const domain = TEST_DOMAINS[i];
            const email = emails[i % emails.length];
            
            console.log(`\n[${i + 1}/${TEST_DOMAINS.length}] Processing: ${domain}`);
            
            const result = await processDomain(domain, email);
            results.push(result);
            
            if (result.success) {
                totalSuccessful++;
                console.log(`✅ ${domain} - SUCCESS`);
            } else {
                totalFailed++;
                console.log(`❌ ${domain} - FAILED (${result.reason})`);
            }
            
            // Brief pause between domains
            if (i < TEST_DOMAINS.length - 1) {
                console.log('⏱️ Brief pause...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        // Summary
        const totalRuntime = Math.round((Date.now() - startTime) / 1000);
        const successRate = (totalSuccessful / TEST_DOMAINS.length * 100).toFixed(1);
        
        console.log('\n🎉 TEST AUTOMATION COMPLETE!');
        console.log('='.repeat(60));
        console.log(`📊 Results:`);
        console.log(`   - Total Processed: ${TEST_DOMAINS.length}`);
        console.log(`   - Successful: ${totalSuccessful}`);
        console.log(`   - Failed: ${totalFailed}`);
        console.log(`   - Success Rate: ${successRate}%`);
        console.log(`   - Total Runtime: ${totalRuntime} seconds`);
        
        console.log(`\n📋 Detailed Results:`);
        results.forEach((result, i) => {
            const status = result.success ? '✅' : '❌';
            const reason = result.success ? 'SUCCESS' : result.reason;
            console.log(`   ${i + 1}. ${status} ${result.domain} - ${reason}`);
        });
        
        // Save results
        await fs.writeFile('./logs/test_automation_results.json', JSON.stringify({
            testDate: new Date().toISOString(),
            totalProcessed: TEST_DOMAINS.length,
            successful: totalSuccessful,
            failed: totalFailed,
            successRate: successRate,
            runtime: totalRuntime,
            results
        }, null, 2));
        
        console.log(`\n💾 Results saved to ./logs/test_automation_results.json`);
        
        if (successRate >= 50) {
            console.log(`\n🚀 SUCCESS RATE GOOD (${successRate}%) - Ready for full 50K run!`);
        } else {
            console.log(`\n⚠️ SUCCESS RATE LOW (${successRate}%) - Review and fix issues before full run`);
        }
        
    } catch (error) {
        console.error(`❌ Test automation failed: ${error.message}`);
    }
}

// Run the test
runTestAutomation().catch(console.error); 