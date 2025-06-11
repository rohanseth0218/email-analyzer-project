/**
 * Full Newsletter Automation - Production Version
 * 
 * Uses the EXACT same method that achieved 100% success rate in testing
 * 
 * Options:
 * 1. Start from specific batch (default: batch 31)
 * 2. Retry failed domains from previous runs
 * 
 * Features:
 * - Multi-strategy email filling (force click, JS injection, typing)
 * - Robust Klaviyo popup handling
 * - Force clicks to bypass interceptions
 * - Email rotation from CSV
 * - Enhanced error logging
 * - Session management and rate limiting
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const { parse } = require('csv-parse/sync');
const axios = require('axios');

// Configuration
const CONFIG = {
    BROWSERBASE_API_KEY: 'bb_live_FTV11nF0Vs1NR_T_rVBHRmQHv74',
    BROWSERBASE_PROJECT_ID: 'd277f38a-cc07-4af9-8473-83cefed0bfcd',
    
    // Execution mode - SET THIS TO CONTROL WHAT TO RUN
    MODE: 'BATCH',  // 'BATCH' for starting from batch X, 'RETRY_FAILED' for failed domains
    START_FROM_BATCH: 31,  // Which batch to start from (if MODE = 'BATCH')
    
    // Session limits - conservative for stability
    MAX_CONCURRENT_SESSIONS: 15,  // Increased from 10 based on success
    BATCH_SIZE: 100,
    SESSION_CREATION_DELAY: 2500,  // 2.5 seconds between sessions
    
    // Timeouts
    NAVIGATION_TIMEOUT: 45000,
    FORM_INTERACTION_TIMEOUT: 15000,
    
    // UTM parameters
    UTM_PARAMS: "?utm_source=email&utm_medium=newsletter&utm_campaign=signup",
    
    // Logging
    SUCCESS_LOG: './logs/successful_submissions_production.jsonl',
    FAILED_LOG: './logs/failed_submissions_production.jsonl',
    PROGRESS_LOG: './logs/progress_production.json',
    
    // Retry settings
    MAX_RETRIES: 2,
    RETRY_DELAY: 3000,
};

// Enhanced selectors - SAME AS WORKING TEST
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
        'input[id*="email_"][class*="kl-private-reset-css"]'
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

// Statistics tracking
const STATS = {
    totalProcessed: 0,
    totalSuccessful: 0,
    totalFailed: 0,
    startTime: Date.now(),
    failureReasons: {},
    emailRotationIndex: 0,
    currentBatch: 0
};

// Email rotation system
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
    
    return email;
}

async function loadDomains() {
    try {
        console.log('📂 Loading domains from CSV...');
        const csvContent = await fs.readFile('./Storedomains.csv', 'utf-8');
        const records = parse(csvContent, { 
            columns: true, 
            skip_empty_lines: true,
            trim: true 
        });
        
        const domains = records
            .map(record => {
                const domain = record.domain || record.Domain || record.url || record.URL;
                if (!domain) return null;
                
                let cleanDomain = domain.trim().toLowerCase();
                cleanDomain = cleanDomain.replace(/^https?:\/\//, '');
                cleanDomain = cleanDomain.replace(/^www\./, '');
                cleanDomain = cleanDomain.split('/')[0];
                cleanDomain = 'https://' + cleanDomain;
                
                if (!cleanDomain.includes('.') || cleanDomain.length < 8) {
                    return null;
                }
                
                return cleanDomain;
            })
            .filter(domain => domain && domain.length > 0);
        
        console.log(`✅ Processed ${domains.length} valid domains`);
        return domains;
        
    } catch (error) {
        console.error(`❌ Error loading domains: ${error.message}`);
        throw error;
    }
}

async function loadFailedDomains() {
    try {
        console.log('🔄 Loading failed domains for retry...');
        
        // Try to load from the processed retry list first
        try {
            const retryListContent = await fs.readFile('./logs/failed_domains_for_retry.json', 'utf-8');
            const retryList = JSON.parse(retryListContent);
            const domains = retryList.map(item => item.domain);
            console.log(`🔄 Loaded ${domains.length} failed domains from processed retry list`);
            return domains;
        } catch (retryError) {
            console.log('⚠️ Retry list not found, parsing from raw logs...');
        }
        
        // Fallback to parsing raw log file
        const fileContent = await fs.readFile('./logs/failed_domains_local_no_proxy.jsonl', 'utf-8');
        const lines = fileContent.trim().split('\n');
        
        const failedDomains = lines
            .map(line => {
                try {
                    const record = JSON.parse(line);
                    return record.domain;
                } catch (e) {
                    return null;
                }
            })
            .filter(domain => domain && domain.length > 0);
        
        // Remove duplicates
        const uniqueDomains = [...new Set(failedDomains)];
        
        console.log(`🔄 Loaded ${uniqueDomains.length} unique failed domains for retry`);
        return uniqueDomains;
        
    } catch (error) {
        console.error(`❌ Error loading failed domains: ${error.message}`);
        throw error;
    }
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

// EXACT SAME FORM SUBMISSION LOGIC AS WORKING TEST
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

async function processDomain(domain, retryCount = 0) {
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
        
        STATS.totalProcessed++;
        
        if (result.success) {
            STATS.totalSuccessful++;
            await logSuccess(domain, email, result);
            return { success: true, domain, email, result };
        } else {
            STATS.totalFailed++;
            STATS.failureReasons[result.reason] = (STATS.failureReasons[result.reason] || 0) + 1;
            await logFailure(domain, email, result);
            
            // Retry logic
            if (retryCount < CONFIG.MAX_RETRIES && result.reason !== 'no_forms_found') {
                console.log(`🔄 Retrying ${domain} (attempt ${retryCount + 1}/${CONFIG.MAX_RETRIES})`);
                await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
                return await processDomain(domain, retryCount + 1);
            }
            
            return { success: false, domain, email, result };
        }
        
    } catch (error) {
        console.error(`❌ Fatal error processing ${domain}: ${error.message}`);
        STATS.totalFailed++;
        STATS.failureReasons['fatal_error'] = (STATS.failureReasons['fatal_error'] || 0) + 1;
        
        await logFailure(domain, email, { 
            success: false, 
            reason: 'fatal_error', 
            error: error.message 
        });
        
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

async function logSuccess(domain, email, result) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        domain,
        email,
        success: true,
        method: result.method,
        batch: STATS.currentBatch
    };
    
    try {
        await fs.appendFile(CONFIG.SUCCESS_LOG, JSON.stringify(logEntry) + '\n');
    } catch (error) {
        console.error(`⚠️ Failed to log success: ${error.message}`);
    }
}

async function logFailure(domain, email, result) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        domain,
        email,
        success: false,
        reason: result.reason,
        error: result.error || null,
        batch: STATS.currentBatch
    };
    
    try {
        await fs.appendFile(CONFIG.FAILED_LOG, JSON.stringify(logEntry) + '\n');
    } catch (error) {
        console.error(`⚠️ Failed to log failure: ${error.message}`);
    }
}

async function updateProgress() {
    const progressData = {
        timestamp: new Date().toISOString(),
        mode: CONFIG.MODE,
        currentBatch: STATS.currentBatch,
        totalProcessed: STATS.totalProcessed,
        totalSuccessful: STATS.totalSuccessful,
        totalFailed: STATS.totalFailed,
        successRate: ((STATS.totalSuccessful / STATS.totalProcessed) * 100).toFixed(2),
        failureReasons: STATS.failureReasons,
        runtime: Math.round((Date.now() - STATS.startTime) / 1000)
    };
    
    try {
        await fs.writeFile(CONFIG.PROGRESS_LOG, JSON.stringify(progressData, null, 2));
    } catch (error) {
        console.error(`⚠️ Failed to update progress: ${error.message}`);
    }
}

async function runFullAutomation() {
    console.log('🚀 Starting Full Newsletter Automation...');
    console.log(`📋 Mode: ${CONFIG.MODE}`);
    
    try {
        // Load email accounts
        await loadEmailAccounts();
        
        // Load domains based on mode
        let domains = [];
        let startBatch = 0;
        
        if (CONFIG.MODE === 'RETRY_FAILED') {
            domains = await loadFailedDomains();
            console.log(`🔄 Retrying ${domains.length} failed domains`);
        } else {
            // BATCH mode
            const allDomains = await loadDomains();
            startBatch = CONFIG.START_FROM_BATCH;
            const startIndex = startBatch * CONFIG.BATCH_SIZE;
            domains = allDomains.slice(startIndex);
            console.log(`📦 Starting from batch ${startBatch} (${domains.length} domains remaining)`);
        }
        
        console.log(`🎯 Processing ${domains.length} domains with ${emailAccounts.length} rotating emails`);
        
        // Create logs directory
        await fs.mkdir('./logs', { recursive: true });
        
        // Process domains in batches
        const totalBatches = Math.ceil(domains.length / CONFIG.BATCH_SIZE);
        
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const actualBatch = CONFIG.MODE === 'BATCH' ? startBatch + batchIndex : batchIndex;
            STATS.currentBatch = actualBatch;
            
            const startIndex = batchIndex * CONFIG.BATCH_SIZE;
            const endIndex = Math.min(startIndex + CONFIG.BATCH_SIZE, domains.length);
            const batchDomains = domains.slice(startIndex, endIndex);
            
            console.log(`\n📦 Processing batch ${actualBatch} (${batchDomains.length} domains)`);
            
            // Process batch with concurrency control
            const batchPromises = [];
            let activePromises = 0;
            
            for (const domain of batchDomains) {
                // Wait if we've hit the concurrent session limit
                while (activePromises >= CONFIG.MAX_CONCURRENT_SESSIONS) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
                activePromises++;
                const promise = processDomain(domain)
                    .finally(() => {
                        activePromises--;
                    });
                
                batchPromises.push(promise);
            }
            
            // Wait for all batch promises to complete
            await Promise.all(batchPromises);
            
            // Update progress
            await updateProgress();
            
            // Print batch statistics
            const successRate = STATS.totalProcessed > 0 ? ((STATS.totalSuccessful / STATS.totalProcessed) * 100).toFixed(1) : '0.0';
            console.log(`\n📊 Batch ${actualBatch} Complete:`);
            console.log(`   ✅ Successful: ${STATS.totalSuccessful}/${STATS.totalProcessed}`);
            console.log(`   📈 Success Rate: ${successRate}%`);
            console.log(`   ⏱️  Runtime: ${Math.round((Date.now() - STATS.startTime) / 1000)}s`);
            
            // Brief pause between batches
            if (batchIndex < totalBatches - 1) {
                console.log(`⏳ Pausing 5 seconds before next batch...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
        
        // Final statistics
        const finalSuccessRate = STATS.totalProcessed > 0 ? ((STATS.totalSuccessful / STATS.totalProcessed) * 100).toFixed(1) : '0.0';
        const totalRuntime = Math.round((Date.now() - STATS.startTime) / 1000);
        
        console.log(`\n🎉 AUTOMATION COMPLETE!`);
        console.log(`📊 FINAL RESULTS:`);
        console.log(`   ✅ Successful: ${STATS.totalSuccessful}/${STATS.totalProcessed}`);
        console.log(`   ❌ Failed: ${STATS.totalFailed}/${STATS.totalProcessed}`);
        console.log(`   📈 Success Rate: ${finalSuccessRate}%`);
        console.log(`   ⏱️  Total Runtime: ${totalRuntime}s`);
        
        if (Object.keys(STATS.failureReasons).length > 0) {
            console.log(`\n❌ Failure Breakdown:`);
            for (const [reason, count] of Object.entries(STATS.failureReasons)) {
                console.log(`   ${reason}: ${count}`);
            }
        }
        
    } catch (error) {
        console.error(`💥 Fatal automation error: ${error.message}`);
        process.exit(1);
    }
}

// Run the automation
if (require.main === module) {
    runFullAutomation().catch(console.error);
}

module.exports = { runFullAutomation, processDomain }; 