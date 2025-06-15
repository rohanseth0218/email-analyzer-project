/**
 * Test Script for Improved Newsletter Automation
 * Tests with just 5 domains to validate the approach
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const { parse } = require('csv-parse/sync');
const axios = require('axios');

// Configuration for testing
const CONFIG = {
    BROWSERBASE_API_KEY: 'bb_live_FTV11nF0Vs1NR_T_rVBHRmQHv74',
    BROWSERBASE_PROJECT_ID: 'd277f38a-cc07-4af9-8473-83cefed0bfcd',
    
    // Conservative settings for testing
    MAX_CONCURRENT_SESSIONS: 3,
    SESSION_CREATION_DELAY: 3000,  // 3 seconds between sessions
    
    // Timeouts
    NAVIGATION_TIMEOUT: 45000,
    FORM_INTERACTION_TIMEOUT: 15000,
    
    // UTM parameters
    UTM_PARAMS: "?utm_source=email&utm_medium=newsletter&utm_campaign=signup",
    
    // Test domains
    TEST_DOMAINS: [
        'https://verabradley.com',
        'https://waldenfarms.com',
        'https://sanrio.com',
        'https://rexspecs.com',
        'https://pinkysirondoors.com'
    ]
};

// Enhanced selectors
const SELECTORS = {
    emailInputs: [
        'input[type="email"]',
        'input[name*="email" i]',
        'input[placeholder*="email" i]',
        'input[id*="email" i]',
        'input[class*="email" i]',
        'input[type="text"][name*="email" i]',
        'input[type="text"][placeholder*="email" i]',
        'input[name="EMAIL"]',
        'input[name="Email"]',
        'input.needsclick[type="email"]',
        'input[id*="email_"]',
        'footer input[type="email"]',
        'footer input[name*="email" i]'
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
        'button[id="Subscribe"]',
        'button.needsclick[type="submit"]',
        'footer button[type="submit"]',
        'footer button:has-text("Subscribe")'
    ]
};

// Email rotation
let emailAccounts = [];
let currentEmailIndex = 0;

async function loadEmailAccounts() {
    try {
        console.log('📧 Loading email accounts...');
        const csvContent = await fs.readFile('./mailboxaccounts.csv', 'utf-8');
        const records = parse(csvContent, { 
            columns: true, 
            skip_empty_lines: true 
        });
        
        emailAccounts = records
            .map(record => record['﻿Email'] || record.Email || record.email)
            .filter(email => email && email.includes('@') && email.includes('.'));
        
        console.log(`📧 Loaded ${emailAccounts.length} valid email accounts`);
        return emailAccounts;
        
    } catch (error) {
        console.error(`❌ Error loading email accounts: ${error.message}`);
        throw error;
    }
}

function getNextEmail() {
    if (emailAccounts.length === 0) {
        throw new Error('No email accounts loaded');
    }
    
    const email = emailAccounts[currentEmailIndex];
    currentEmailIndex = (currentEmailIndex + 1) % emailAccounts.length;
    
    console.log(`📧 Using email: ${email}`);
    return email;
}

async function createBrowserbaseSession() {
    try {
        const response = await axios.post(
            'https://api.browserbase.com/v1/sessions',
            {
                projectId: CONFIG.BROWSERBASE_PROJECT_ID,
                browserSettings: {
                    viewport: { width: 1920, height: 1080 },
                    stealth: true,
                    geolocation: { latitude: 40.7128, longitude: -74.0060 },
                    locale: 'en-US',
                    permissions: ['geolocation']
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

async function handleKlaviyoPopups(page) {
    try {
        await page.evaluate(() => {
            if (window._klOnsite) {
                window._klOnsite = window._klOnsite || [];
                window._klOnsite.push(['openForm', '']);
            }
        });
        console.log("🎯 Attempted to trigger Klaviyo form manually");
    } catch (e) {
        console.log("⚠️ Could not trigger Klaviyo form manually");
    }
}

async function tryFormSubmission(page, email, domain) {
    try {
        console.log(`🔍 Processing ${domain} with email: ${email}`);
        
        // Navigate to the site
        const urlWithUTM = `${domain}${CONFIG.UTM_PARAMS}`;
        console.log(`🌐 Navigating to ${urlWithUTM}`);
        
        await page.goto(urlWithUTM, { 
            waitUntil: "load", 
            timeout: CONFIG.NAVIGATION_TIMEOUT 
        });
        
        // Wait for page to settle and popups to appear
        await page.waitForTimeout(3000);
        
        // Try to handle Klaviyo popups
        await handleKlaviyoPopups(page);
        await page.waitForTimeout(2000);
        
        let submitted = false;
        let submissionMethod = '';
        
        // Strategy 1: Target Klaviyo popup forms specifically (they're overlaying)
        console.log(`🎯 Strategy 1: Looking for Klaviyo popup forms on ${domain}`);
        
        // Look for Klaviyo popup email inputs specifically
        const klaviyoSelectors = [
            'div[role="dialog"] input[type="email"]',
            'div[aria-label="POPUP Form"] input[type="email"]',
            '.kl-private-reset-css-Xuajs1 input[type="email"]',
            'input.needsclick[type="email"]',
            'input[id*="email_"][class*="kl-private-reset-css"]'
        ];
        
        let klaviyoEmailInput = null;
        for (const selector of klaviyoSelectors) {
            try {
                const element = await page.locator(selector).first();
                if (await element.isVisible({ timeout: 2000 })) {
                    klaviyoEmailInput = element;
                    console.log(`✅ Found Klaviyo popup email input with selector: ${selector} on ${domain}`);
                    break;
                }
            } catch (e) {
                // Continue to next selector
            }
        }
        
        if (klaviyoEmailInput) {
            try {
                console.log(`✅ Found Klaviyo popup email input on ${domain}`);
                
                // Multiple strategies to fill the email
                let emailFilled = false;
                
                // Strategy 1: Force click and fill
                try {
                    await klaviyoEmailInput.click({ force: true });
                    await page.waitForTimeout(500);
                    await klaviyoEmailInput.clear();
                    await page.waitForTimeout(500);
                    await klaviyoEmailInput.fill(email);
                    
                    // Verify the email was filled
                    const inputValue = await klaviyoEmailInput.inputValue();
                    if (inputValue === email) {
                        emailFilled = true;
                        console.log(`✅ Email filled successfully using force click method for ${domain}`);
                    } else {
                        console.log(`⚠️ Email not filled correctly using force click, trying JS method for ${domain}`);
                    }
                } catch (e) {
                    console.log(`⚠️ Force click method failed for ${domain}: ${e.message}`);
                }
                
                // Strategy 2: JavaScript injection
                if (!emailFilled) {
                    try {
                        await page.evaluate((emailElement, emailValue) => {
                            emailElement.value = emailValue;
                            emailElement.dispatchEvent(new Event('input', { bubbles: true }));
                            emailElement.dispatchEvent(new Event('change', { bubbles: true }));
                        }, klaviyoEmailInput, email);
                        
                        // Verify the email was filled
                        const inputValue = await klaviyoEmailInput.inputValue();
                        if (inputValue === email) {
                            emailFilled = true;
                            console.log(`✅ Email filled successfully using JavaScript injection for ${domain}`);
                        } else {
                            console.log(`⚠️ Email not filled correctly using JS injection for ${domain}`);
                        }
                    } catch (e) {
                        console.log(`⚠️ JavaScript injection method failed for ${domain}: ${e.message}`);
                    }
                }
                
                // Strategy 3: Type character by character
                if (!emailFilled) {
                    try {
                        await klaviyoEmailInput.click({ force: true });
                        await page.waitForTimeout(500);
                        await klaviyoEmailInput.clear();
                        await page.waitForTimeout(500);
                        await klaviyoEmailInput.type(email, { delay: 100 });
                        
                        // Verify the email was filled
                        const inputValue = await klaviyoEmailInput.inputValue();
                        if (inputValue === email) {
                            emailFilled = true;
                            console.log(`✅ Email filled successfully using type method for ${domain}`);
                        } else {
                            console.log(`⚠️ Email not filled correctly using type method for ${domain}. Expected: ${email}, Got: ${inputValue}`);
                        }
                    } catch (e) {
                        console.log(`⚠️ Type method failed for ${domain}: ${e.message}`);
                    }
                }
                
                if (!emailFilled) {
                    console.log(`❌ Failed to fill email for ${domain} using all methods`);
                    throw new Error('Failed to fill email field');
                }
                
                console.log(`🎯 Email successfully filled for ${domain}, now looking for submit button`);
                
                // Look for Klaviyo submit buttons
                const klaviyoSubmitSelectors = [
                    'div[role="dialog"] button[type="submit"]',
                    'div[aria-label="POPUP Form"] button[type="submit"]',
                    '.kl-private-reset-css-Xuajs1 button[type="submit"]',
                    'button.needsclick[type="submit"]',
                    'button[id="Subscribe"]',
                    'div[role="dialog"] button:has-text("Subscribe")',
                    'div[aria-label="POPUP Form"] button:has-text("Sign Up")',
                    'div[role="dialog"] button:has-text("Continue")',
                    'div[aria-label="POPUP Form"] button:has-text("Continue")',
                    'button:has-text("Continue")',
                    'button:has-text("Get 10% off")',
                    'button:has-text("Stay updated")'
                ];
                
                let klaviyoSubmitButton = null;
                for (const selector of klaviyoSubmitSelectors) {
                    try {
                        const element = await page.locator(selector).first();
                        if (await element.isVisible({ timeout: 2000 })) {
                            klaviyoSubmitButton = element;
                            console.log(`✅ Found Klaviyo submit button with selector: ${selector} on ${domain}`);
                            break;
                        }
                    } catch (e) {
                        // Continue to next selector
                    }
                }
                
                if (klaviyoSubmitButton) {
                    // Multiple strategies to click the submit button
                    let buttonClicked = false;
                    
                    // Strategy 1: Force click
                    try {
                        console.log(`🎯 Attempting force click on Klaviyo submit button for ${domain}`);
                        await klaviyoSubmitButton.click({ force: true, timeout: CONFIG.FORM_INTERACTION_TIMEOUT });
                        buttonClicked = true;
                        submissionMethod = 'klaviyo_popup_force_click';
                        console.log(`✅ Force click successful for ${domain}`);
                    } catch (clickError) {
                        console.log(`⚠️ Force click failed for ${domain}: ${clickError.message}`);
                    }
                    
                    // Strategy 2: JavaScript click
                    if (!buttonClicked) {
                        try {
                            console.log(`🎯 Attempting JS click on Klaviyo submit button for ${domain}`);
                            await page.evaluate((el) => el.click(), klaviyoSubmitButton);
                            buttonClicked = true;
                            submissionMethod = 'klaviyo_popup_js_click';
                            console.log(`✅ JS click successful for ${domain}`);
                        } catch (jsError) {
                            console.log(`⚠️ JS click failed for ${domain}: ${jsError.message}`);
                        }
                    }
                    
                    // Strategy 3: Enter key on email input
                    if (!buttonClicked) {
                        try {
                            console.log(`🎯 Attempting Enter key on email input for ${domain}`);
                            await klaviyoEmailInput.press('Enter');
                            buttonClicked = true;
                            submissionMethod = 'klaviyo_popup_enter_key';
                            console.log(`✅ Enter key successful for ${domain}`);
                        } catch (enterError) {
                            console.log(`⚠️ Enter key failed for ${domain}: ${enterError.message}`);
                        }
                    }
                    
                    if (buttonClicked) {
                        submitted = true;
                    }
                } else {
                    console.log(`⚠️ No Klaviyo submit button found, trying Enter key for ${domain}`);
                    try {
                        await klaviyoEmailInput.press('Enter');
                        submitted = true;
                        submissionMethod = 'klaviyo_popup_enter_only';
                        console.log(`✅ Enter key fallback successful for ${domain}`);
                    } catch (enterError) {
                        console.log(`⚠️ Enter key fallback failed for ${domain}: ${enterError.message}`);
                    }
                }
                
                if (submitted) {
                    await page.waitForTimeout(3000);
                    console.log(`🎉 SUCCESS: Klaviyo popup form submitted for ${domain} via ${submissionMethod}`);
                    return { success: true, method: submissionMethod };
                }
                
            } catch (klaviyoError) {
                console.log(`⚠️ Klaviyo popup form submission failed for ${domain}: ${klaviyoError.message}`);
            }
        }
        
        // Strategy 2: Try to dismiss popups and access underlying forms
        if (!submitted) {
            console.log(`🎯 Strategy 2: Trying to dismiss popups and access underlying forms on ${domain}`);
            
            // Try to close Klaviyo popups
            const closeSelectors = [
                'div[role="dialog"] button[aria-label="Close"]',
                'div[aria-label="POPUP Form"] button[aria-label="Close"]',
                '.kl-private-reset-css-Xuajs1 button[aria-label="Close"]',
                'button:has-text("×")',
                'button:has-text("✕")',
                '.close',
                '[data-dismiss="modal"]'
            ];
            
            for (const selector of closeSelectors) {
                try {
                    const closeButton = await page.locator(selector).first();
                    if (await closeButton.isVisible({ timeout: 1000 })) {
                        await closeButton.click({ force: true });
                        console.log(`✅ Closed popup with selector: ${selector} on ${domain}`);
                        await page.waitForTimeout(1000);
                        break;
                    }
                } catch (e) {
                    // Continue to next selector
                }
            }
            
            // Also try pressing Escape to close popups
            try {
                await page.keyboard.press('Escape');
                await page.waitForTimeout(1000);
                console.log(`✅ Pressed Escape to close popups on ${domain}`);
            } catch (e) {
                // Continue
            }
            
            // Now try to find underlying email inputs
            let emailInput = null;
            let foundSelector = null;
            
            for (const selector of SELECTORS.emailInputs) {
                try {
                    const elements = await page.locator(selector).all();
                    for (const element of elements) {
                        if (await element.isVisible({ timeout: 1000 })) {
                            // Skip Klaviyo elements
                            const className = await element.getAttribute('class') || '';
                            if (className.includes('kl-private-reset-css')) {
                                continue;
                            }
                            
                            emailInput = element;
                            foundSelector = selector;
                            console.log(`✅ Found underlying email input with selector: ${selector} on ${domain}`);
                            break;
                        }
                    }
                    if (emailInput) break;
                } catch (e) {
                    // Continue to next selector
                }
            }
            
            if (emailInput) {
                try {
                    console.log(`✅ Found underlying email input on ${domain}`);
                    
                    // Use force click to bypass any remaining overlays
                    await emailInput.click({ force: true });
                    await emailInput.fill('');
                    await page.waitForTimeout(500);
                    await emailInput.fill(email);
                    
                    // Try to find submit button
                    let submitButton = null;
                    for (const selector of SELECTORS.submitButtons) {
                        try {
                            const elements = await page.locator(selector).all();
                            for (const element of elements) {
                                if (await element.isVisible({ timeout: 1000 })) {
                                    // Skip Klaviyo elements
                                    const className = await element.getAttribute('class') || '';
                                    if (className.includes('kl-private-reset-css')) {
                                        continue;
                                    }
                                    
                                    submitButton = element;
                                    console.log(`✅ Found underlying submit button with selector: ${selector} on ${domain}`);
                                    break;
                                }
                            }
                            if (submitButton) break;
                        } catch (e) {
                            // Continue to next selector
                        }
                    }
                    
                    if (submitButton) {
                        try {
                            console.log(`🎯 Attempting force click on underlying submit button for ${domain}`);
                            await submitButton.click({ force: true, timeout: CONFIG.FORM_INTERACTION_TIMEOUT });
                            submitted = true;
                            submissionMethod = 'underlying_form_force_click';
                        } catch (clickError) {
                            console.log(`⚠️ Force click failed, trying JS click for ${domain}`);
                            try {
                                await page.evaluate((el) => el.click(), submitButton);
                                submitted = true;
                                submissionMethod = 'underlying_form_js_click';
                            } catch (jsError) {
                                console.log(`⚠️ JS click failed, trying Enter key for ${domain}`);
                                await emailInput.press('Enter');
                                submitted = true;
                                submissionMethod = 'underlying_form_enter_key';
                            }
                        }
                    } else {
                        console.log(`⚠️ No underlying submit button found, trying Enter key for ${domain}`);
                        await emailInput.press('Enter');
                        submitted = true;
                        submissionMethod = 'underlying_form_enter_only';
                    }
                    
                    if (submitted) {
                        await page.waitForTimeout(3000);
                        console.log(`🎉 SUCCESS: Underlying form submitted for ${domain} via ${submissionMethod}`);
                        return { success: true, method: submissionMethod };
                    }
                    
                } catch (formError) {
                    console.log(`⚠️ Underlying form submission failed for ${domain}: ${formError.message}`);
                }
            }
        }
        
        // Strategy 3: Footer fallback
        if (!submitted) {
            console.log(`🎯 Strategy 3: Trying footer forms on ${domain}`);
            
            // Scroll to footer
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(2000);
            
            const footerEmailInput = await page.locator('footer input[type="email"]').first();
            
            if (await footerEmailInput.isVisible().catch(() => false)) {
                try {
                    console.log(`✅ Found footer email input on ${domain}`);
                    
                    // Use force click for footer too
                    await footerEmailInput.click({ force: true });
                    await footerEmailInput.fill('');
                    await page.waitForTimeout(500);
                    await footerEmailInput.fill(email);
                    
                    const footerButton = await page.locator('footer button[type="submit"], footer button:has-text("Subscribe")').first();
                    
                    if (await footerButton.isVisible().catch(() => false)) {
                        await footerButton.click({ force: true, timeout: CONFIG.FORM_INTERACTION_TIMEOUT });
                        submitted = true;
                        submissionMethod = 'footer_force_click';
                    } else {
                        await footerEmailInput.press('Enter');
                        submitted = true;
                        submissionMethod = 'footer_enter';
                    }
                    
                    if (submitted) {
                        await page.waitForTimeout(3000);
                        console.log(`🎉 SUCCESS: Footer form submitted for ${domain} via ${submissionMethod}`);
                        return { success: true, method: submissionMethod };
                    }
                    
                } catch (footerError) {
                    console.log(`⚠️ Footer form submission failed for ${domain}: ${footerError.message}`);
                }
            }
        }
        
        if (!submitted) {
            console.log(`❌ No forms found or all submission attempts failed for ${domain}`);
            return { success: false, reason: 'no_forms_found' };
        }
        
    } catch (error) {
        console.error(`❌ Error processing ${domain}: ${error.message}`);
        return { success: false, reason: 'processing_error', error: error.message };
    }
}

async function processDomain(domain) {
    let sessionData = null;
    let browser = null;
    let page = null;
    
    const email = getNextEmail();
    
    try {
        // Create session with rate limiting
        await new Promise(resolve => setTimeout(resolve, CONFIG.SESSION_CREATION_DELAY));
        sessionData = await createBrowserbaseSession();
        
        // Connect to browser
        browser = await chromium.connectOverCDP(sessionData.connectUrl);
        const context = await browser.newContext({
            geolocation: { latitude: 40.7128, longitude: -74.0060 },
            locale: 'en-US',
            permissions: ['geolocation']
        });
        
        page = await context.newPage();
        
        // Set longer timeouts
        page.setDefaultTimeout(CONFIG.FORM_INTERACTION_TIMEOUT);
        page.setDefaultNavigationTimeout(CONFIG.NAVIGATION_TIMEOUT);
        
        // Try form submission
        const result = await tryFormSubmission(page, email, domain);
        
        return { success: result.success, domain, email, result };
        
    } catch (error) {
        console.error(`❌ Fatal error processing ${domain}: ${error.message}`);
        return { success: false, domain, email, error: error.message };
        
    } finally {
        // Cleanup
        try {
            if (page) await page.close();
            if (browser) await browser.close();
        } catch (cleanupError) {
            console.error(`⚠️ Cleanup error: ${cleanupError.message}`);
        }
    }
}

async function runTest() {
    console.log('🚀 Starting Test of Improved Newsletter Automation...');
    
    try {
        // Load email accounts
        await loadEmailAccounts();
        
        console.log(`🎯 Testing ${CONFIG.TEST_DOMAINS.length} domains with ${emailAccounts.length} rotating emails`);
        
        const results = [];
        
        // Process domains sequentially for testing
        for (let i = 0; i < CONFIG.TEST_DOMAINS.length; i++) {
            const domain = CONFIG.TEST_DOMAINS[i];
            console.log(`\n--- Processing ${i + 1}/${CONFIG.TEST_DOMAINS.length}: ${domain} ---`);
            
            const result = await processDomain(domain);
            results.push(result);
            
            if (result.success) {
                console.log(`✅ SUCCESS: ${domain}`);
            } else {
                console.log(`❌ FAILED: ${domain} - ${result.result?.reason || result.error}`);
            }
        }
        
        // Final statistics
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        const successRate = ((successful / results.length) * 100).toFixed(1);
        
        console.log(`\n🎉 TEST COMPLETE!`);
        console.log(`📊 RESULTS:`);
        console.log(`   ✅ Successful: ${successful}/${results.length}`);
        console.log(`   ❌ Failed: ${failed}/${results.length}`);
        console.log(`   📈 Success Rate: ${successRate}%`);
        
        // Show detailed results
        console.log(`\n📋 DETAILED RESULTS:`);
        results.forEach((result, index) => {
            const status = result.success ? '✅' : '❌';
            const method = result.result?.method || 'N/A';
            const reason = result.result?.reason || result.error || 'N/A';
            console.log(`   ${status} ${result.domain} | Email: ${result.email} | Method: ${method} | Reason: ${reason}`);
        });
        
    } catch (error) {
        console.error(`💥 Fatal test error: ${error.message}`);
        process.exit(1);
    }
}

// Run the test
if (require.main === module) {
    runTest().catch(console.error);
}

module.exports = { runTest, processDomain }; 