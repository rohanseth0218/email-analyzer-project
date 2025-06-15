/**
 * Focused debugging test - run 5 domains only to identify issues
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const { parse } = require('csv-parse/sync');

// Configuration for debugging
const CONFIG = {
    BROWSERBASE_API_KEY: 'bb_live_FTV11nF0Vs1NR_T_rVBHRmQHv74',
    BROWSERBASE_PROJECT_ID: 'd277f38a-cc07-4af9-8473-83cefed0bfcd',
    MAX_CONCURRENT_SESSIONS: 2,  // Just 2 for debugging
    BATCH_SIZE: 5,
    NAVIGATION_TIMEOUT: 30000,
    FORM_INTERACTION_TIMEOUT: 10000,
};

// Enhanced selectors
const ENHANCED_SELECTORS = {
    emailInputs: [
        'input[type="email"]',
        'input[name*="email" i]',
        'input[placeholder*="email" i]',
        'input[id*="email" i]',
        'input[class*="email" i]',
        'input[type="text"][name*="email" i]',
        'input[type="text"][placeholder*="email" i]',
        'input[type="text"][id*="email" i]',
        'input[name="EMAIL"]',
        'input[name="Email"]'
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

async function loadEmailAccounts() {
    try {
        console.log('📧 Loading email accounts...');
        const csvContent = await fs.readFile('./mailboxaccounts.csv', 'utf-8');
        const records = parse(csvContent, { 
            columns: true, 
            skip_empty_lines: true 
        });
        
        const emails = records
            .map(record => record['﻿Email'] || record.Email || record.email)
            .filter(email => email && email.includes('@') && email.includes('.'));
        
        console.log(`📧 Loaded ${emails.length} valid email accounts`);
        console.log(`📧 First 3 emails: ${emails.slice(0, 3).join(', ')}`);
        return emails;
        
    } catch (error) {
        console.error(`❌ Error loading email accounts: ${error.message}`);
        throw error;
    }
}

async function createBrowserbaseSession() {
    try {
        const axios = require('axios');
        const response = await axios.post(
            'https://api.browserbase.com/v1/sessions',
            {
                projectId: CONFIG.BROWSERBASE_PROJECT_ID,
                browserSettings: {
                    viewport: { width: 1920, height: 1080 },
                    stealth: true
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-BB-API-Key': CONFIG.BROWSERBASE_API_KEY
                },
                timeout: 15000
            }
        );
        
        console.log(`✅ Created session: ${response.data.id}`);
        return {
            id: response.data.id,
            connectUrl: response.data.connectUrl
        };
        
    } catch (error) {
        console.error(`❌ Failed to create session: ${error.message}`);
        throw error;
    }
}

async function tryFormSubmission(page, email, domain) {
    try {
        console.log(`🔍 Processing ${domain} with email: ${email}`);
        
        if (!email) {
            throw new Error(`Email is undefined for domain ${domain}`);
        }
        
        // Wait for page to fully load
        await page.waitForLoadState('networkidle', { timeout: 15000 });
        
        let submitted = false;
        
        // Try to find email input
        let emailInput = null;
        let foundSelector = null;
        
        for (const selector of ENHANCED_SELECTORS.emailInputs) {
            try {
                emailInput = await page.locator(selector).first();
                if (await emailInput.isVisible({ timeout: 2000 })) {
                    foundSelector = selector;
                    console.log(`✅ Found email input with selector: ${selector} on ${domain}`);
                    break;
                }
            } catch (e) {
                // Continue to next selector
            }
        }
        
        if (!emailInput || !(await emailInput.isVisible())) {
            console.log(`❌ No email input found on ${domain}`);
            return { success: false, reason: 'no_email_input_found' };
        }
        
        console.log(`✅ Filling email input on ${domain} with ${email}`);
        await emailInput.click();
        await emailInput.fill('');
        await page.waitForTimeout(500);
        await emailInput.fill(email);
        
        // Try to find submit button
        let submitButton = null;
        let submitSelector = null;
        
        for (const selector of ENHANCED_SELECTORS.submitButtons) {
            try {
                submitButton = await page.locator(selector).first();
                if (await submitButton.isVisible({ timeout: 2000 })) {
                    submitSelector = selector;
                    console.log(`✅ Found submit button with selector: ${selector} on ${domain}`);
                    break;
                }
            } catch (e) {
                // Continue to next selector
            }
        }
        
        if (submitButton && (await submitButton.isVisible())) {
            console.log(`✅ Clicking submit button on ${domain}`);
            await submitButton.click();
            await page.waitForTimeout(3000);
            submitted = true;
        } else {
            console.log(`⚠️ No submit button found on ${domain}, trying Enter key`);
            await emailInput.press('Enter');
            await page.waitForTimeout(3000);
            submitted = true;
        }
        
        if (submitted) {
            console.log(`🎉 SUCCESS: Form submitted for ${domain}`);
            return { success: true, reason: 'form_submitted_successfully' };
        } else {
            return { success: false, reason: 'form_submission_failed' };
        }
        
    } catch (error) {
        console.error(`❌ Error processing ${domain}: ${error.message}`);
        return { success: false, reason: 'processing_error', error: error.message };
    }
}

async function processDomain(domain, email) {
    let sessionData = null;
    let browser = null;
    let page = null;
    
    try {
        // Create session
        sessionData = await createBrowserbaseSession();
        
        // Connect to browser
        browser = await chromium.connectOverCDP(sessionData.connectUrl);
        const context = await browser.newContext({
            geolocation: { latitude: 40.7128, longitude: -74.0060 },
            locale: 'en-US',
            permissions: ['geolocation']
        });
        
        page = await context.newPage();
        
        // Navigate to domain with UTM parameters
        const urlWithUtm = `${domain}?utm_source=email&utm_medium=newsletter&utm_campaign=signup`;
        console.log(`🌐 Navigating to ${urlWithUtm}`);
        
        await page.goto(urlWithUtm, { 
            waitUntil: 'domcontentloaded',
            timeout: CONFIG.NAVIGATION_TIMEOUT 
        });
        
        // Try form submission
        const result = await tryFormSubmission(page, email, domain);
        
        return {
            ...result,
            domain,
            email,
            timestamp: new Date().toISOString(),
            sessionId: sessionData.id
        };
        
    } catch (error) {
        console.error(`❌ Error processing ${domain}: ${error.message}`);
        return {
            domain,
            email,
            success: false,
            reason: 'processing_error',
            error: error.message,
            timestamp: new Date().toISOString(),
            sessionId: sessionData?.id
        };
    } finally {
        try {
            if (page) await page.close();
            if (browser) await browser.close();
        } catch (e) {
            // Ignore cleanup errors
        }
    }
}

async function runFocusedTest() {
    console.log('🚀 Starting Focused Debug Test...');
    
    try {
        const emails = await loadEmailAccounts();
        
        if (emails.length === 0) {
            throw new Error('No emails loaded!');
        }
        
        // Test domains
        const testDomains = [
            'https://waldenfarms.com',
            'https://pinkysirondoors.com',
            'https://verabradley.com',
            'https://sanrio.com',
            'https://rexspecs.com'
        ];
        
        console.log(`\n🎯 Testing ${testDomains.length} domains with ${emails.length} email accounts`);
        
        const results = [];
        
        for (let i = 0; i < testDomains.length; i++) {
            const domain = testDomains[i];
            const email = emails[i % emails.length];
            
            console.log(`\n--- Processing ${i + 1}/${testDomains.length}: ${domain} ---`);
            
            const result = await processDomain(domain, email);
            results.push(result);
            
            console.log(`Result: ${result.success ? '✅ SUCCESS' : '❌ FAILED'} - ${result.reason}`);
            
            // Brief pause between domains
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Summary
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => r.success === false).length;
        
        console.log(`\n📊 FINAL RESULTS:`);
        console.log(`✅ Successful: ${successful}/${testDomains.length}`);
        console.log(`❌ Failed: ${failed}/${testDomains.length}`);
        console.log(`📈 Success Rate: ${(successful / testDomains.length * 100).toFixed(1)}%`);
        
        // Show failure reasons
        const failureReasons = {};
        results.filter(r => !r.success).forEach(r => {
            failureReasons[r.reason] = (failureReasons[r.reason] || 0) + 1;
        });
        
        if (Object.keys(failureReasons).length > 0) {
            console.log(`\n❌ Failure Breakdown:`);
            Object.entries(failureReasons).forEach(([reason, count]) => {
                console.log(`   ${reason}: ${count}`);
            });
        }
        
    } catch (error) {
        console.error(`❌ Test failed: ${error.message}`);
        throw error;
    }
}

if (require.main === module) {
    runFocusedTest().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
} 