/**
 * Improved Newsletter Automation with Browserbase
 * 
 * Features:
 * - Email rotation from CSV
 * - Better popup handling (Klaviyo, etc.)
 * - Enhanced error logging
 * - Multiple fallback strategies
 * - Rate limiting and session management
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const { parse } = require('csv-parse/sync');
const axios = require('axios');

// Configuration
const CONFIG = {
    BROWSERBASE_API_KEY: 'bb_live_FTV11nF0Vs1NR_T_rVBHRmQHv74',
    BROWSERBASE_PROJECT_ID: 'd277f38a-cc07-4af9-8473-83cefed0bfcd',
    
    // Session limits
    MAX_CONCURRENT_SESSIONS: 10,  // Conservative for testing
    BATCH_SIZE: 50,
    SESSION_CREATION_DELAY: 2000,  // 2 seconds between sessions
    
    // Timeouts
    NAVIGATION_TIMEOUT: 45000,
    FORM_INTERACTION_TIMEOUT: 15000,
    POPUP_WAIT_TIMEOUT: 5000,
    
    // UTM parameters
    UTM_PARAMS: "?utm_source=email&utm_medium=newsletter&utm_campaign=signup",
    
    // Logging
    SUCCESS_LOG: './logs/successful_submissions.jsonl',
    FAILED_LOG: './logs/failed_submissions.jsonl',
    DETAILED_LOG: './logs/detailed_automation.log',
    
    // Retry settings
    MAX_RETRIES: 2,
    RETRY_DELAY: 3000,
};

// Enhanced selectors for better form detection
const SELECTORS = {
    emailInputs: [
        // Standard email inputs
        'input[type="email"]',
        'input[name*="email" i]',
        'input[placeholder*="email" i]',
        'input[id*="email" i]',
        'input[class*="email" i]',
        
        // Text inputs that might be email fields
        'input[type="text"][name*="email" i]',
        'input[type="text"][placeholder*="email" i]',
        'input[type="text"][id*="email" i]',
        'input[type="text"][class*="email" i]',
        
        // Common newsletter form patterns
        'input[name="EMAIL"]',
        'input[name="Email"]',
        'input[name="newsletter"]',
        'input[name="subscribe"]',
        
        // Klaviyo specific
        'input.needsclick[type="email"]',
        'input[id*="email_"]',
        
        // Footer forms
        'footer input[type="email"]',
        'footer input[name*="email" i]',
        
        // Newsletter sections
        '[class*="newsletter"] input[type="email"]',
        '[class*="subscribe"] input[type="email"]',
        '[id*="newsletter"] input[type="email"]',
        '[id*="subscribe"] input[type="email"]'
    ],
    
    submitButtons: [
        // Standard submit buttons
        'button[type="submit"]',
        'input[type="submit"]',
        
        // Text-based buttons
        'button:has-text("Subscribe")',
        'button:has-text("Sign Up")',
        'button:has-text("Join")',
        'button:has-text("Submit")',
        'button:has-text("Newsletter")',
        'button:has-text("Get Updates")',
        'button:has-text("Stay Updated")',
        
        // Class-based buttons
        'button[class*="subscribe" i]',
        'button[class*="signup" i]',
        'button[class*="newsletter" i]',
        'button[class*="submit" i]',
        
        // ID-based buttons
        'button[id*="subscribe" i]',
        'button[id*="signup" i]',
        'button[id*="newsletter" i]',
        
        // Klaviyo specific
        'button.needsclick[type="submit"]',
        'button[id="Subscribe"]',
        
        // Footer buttons
        'footer button[type="submit"]',
        'footer button:has-text("Subscribe")',
        'footer button:has-text("Sign Up")'
    ],
    
    popupCloseButtons: [
        'button[aria-label="Close"]',
        'button[aria-label="close"]',
        'button.close',
        '[class*="close"]',
        '[class*="dismiss"]',
        'button:has-text("×")',
        'button:has-text("✕")',
        '[data-dismiss="modal"]'
    ]
};

// Statistics tracking
const STATS = {
    totalProcessed: 0,
    totalSuccessful: 0,
    totalFailed: 0,
    startTime: Date.now(),
    failureReasons: {},
    emailRotationIndex: 0
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
        console.log(`📧 Sample emails: ${emailAccounts.slice(0, 3).join(', ')}`);
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
    
    console.log(`📧 Using email: ${email} (${currentEmailIndex}/${emailAccounts.length})`);
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
        // Try to manually trigger Klaviyo forms
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

async function findEmailInput(page, domain) {
    let emailInput = null;
    let foundSelector = null;
    
    for (const selector of SELECTORS.emailInputs) {
        try {
            const elements = await page.locator(selector).all();
            for (const element of elements) {
                if (await element.isVisible({ timeout: 1000 })) {
                    emailInput = element;
                    foundSelector = selector;
                    console.log(`✅ Found email input with selector: ${selector} on ${domain}`);
                    return { emailInput, foundSelector };
                }
            }
        } catch (e) {
            // Continue to next selector
        }
    }
    
    return { emailInput: null, foundSelector: null };
}

async function findSubmitButton(page, domain, emailInput) {
    let submitButton = null;
    let foundSelector = null;
    
    // First try to find submit button in the same form as the email input
    if (emailInput) {
        try {
            const form = await emailInput.locator('xpath=ancestor-or-self::form').first();
            if (await form.isVisible()) {
                for (const selector of SELECTORS.submitButtons) {
                    try {
                        const button = form.locator(selector).first();
                        if (await button.isVisible({ timeout: 1000 })) {
                            submitButton = button;
                            foundSelector = `form ${selector}`;
                            console.log(`✅ Found submit button in form with selector: ${foundSelector} on ${domain}`);
                            return { submitButton, foundSelector };
                        }
                    } catch (e) {
                        // Continue
                    }
                }
            }
        } catch (e) {
            // Continue to global search
        }
    }
    
    // Global search for submit buttons
    for (const selector of SELECTORS.submitButtons) {
        try {
            const elements = await page.locator(selector).all();
            for (const element of elements) {
                if (await element.isVisible({ timeout: 1000 })) {
                    submitButton = element;
                    foundSelector = selector;
                    console.log(`✅ Found submit button with selector: ${selector} on ${domain}`);
                    return { submitButton, foundSelector };
                }
            }
        } catch (e) {
            // Continue to next selector
        }
    }
    
    return { submitButton: null, foundSelector: null };
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
        
        // Strategy 1: Try popup forms first (most common for newsletters)
        console.log(`🎯 Strategy 1: Looking for popup forms on ${domain}`);
        const { emailInput: popupEmailInput } = await findEmailInput(page, domain);
        
        if (popupEmailInput) {
            try {
                console.log(`✅ Found popup email input on ${domain}`);
                
                // Clear and fill email
                await popupEmailInput.click();
                await popupEmailInput.fill('');
                await page.waitForTimeout(500);
                await popupEmailInput.fill(email);
                
                // Find submit button
                const { submitButton } = await findSubmitButton(page, domain, popupEmailInput);
                
                if (submitButton) {
                    try {
                        console.log(`🎯 Attempting native click on popup submit button for ${domain}`);
                        await submitButton.click({ timeout: CONFIG.FORM_INTERACTION_TIMEOUT });
                        submitted = true;
                        submissionMethod = 'popup_native_click';
                    } catch (clickError) {
                        console.log(`⚠️ Native click failed, trying JS click for ${domain}`);
                        try {
                            await page.evaluate((el) => el.click(), submitButton);
                            submitted = true;
                            submissionMethod = 'popup_js_click';
                        } catch (jsError) {
                            console.log(`⚠️ JS click failed, trying Enter key for ${domain}`);
                            await popupEmailInput.press('Enter');
                            submitted = true;
                            submissionMethod = 'popup_enter_key';
                        }
                    }
                } else {
                    console.log(`⚠️ No submit button found, trying Enter key for ${domain}`);
                    await popupEmailInput.press('Enter');
                    submitted = true;
                    submissionMethod = 'popup_enter_only';
                }
                
                if (submitted) {
                    await page.waitForTimeout(3000);
                    console.log(`🎉 SUCCESS: Popup form submitted for ${domain} via ${submissionMethod}`);
                    return { success: true, method: submissionMethod, type: 'popup' };
                }
                
            } catch (popupError) {
                console.log(`⚠️ Popup form submission failed for ${domain}: ${popupError.message}`);
            }
        }
        
        // Strategy 2: Footer forms fallback
        if (!submitted) {
            console.log(`🎯 Strategy 2: Looking for footer forms on ${domain}`);
            
            // Scroll to footer
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(2000);
            
            // Look for footer email inputs specifically
            const footerEmailInput = await page.locator('footer input[type="email"]').first();
            
            if (await footerEmailInput.isVisible().catch(() => false)) {
                try {
                    console.log(`✅ Found footer email input on ${domain}`);
                    
                    await footerEmailInput.click();
                    await footerEmailInput.fill('');
                    await page.waitForTimeout(500);
                    await footerEmailInput.fill(email);
                    
                    // Look for footer submit button
                    const footerSubmitSelectors = [
                        'footer button[type="submit"]',
                        'footer input[type="submit"]',
                        'footer button:has-text("Subscribe")',
                        'footer button:has-text("Sign Up")',
                        'footer button:has-text("Join")'
                    ];
                    
                    let footerSubmitted = false;
                    for (const selector of footerSubmitSelectors) {
                        try {
                            const footerButton = await page.locator(selector).first();
                            if (await footerButton.isVisible({ timeout: 2000 })) {
                                await footerButton.click({ timeout: CONFIG.FORM_INTERACTION_TIMEOUT });
                                footerSubmitted = true;
                                submissionMethod = 'footer_button_click';
                                break;
                            }
                        } catch (e) {
                            // Continue to next selector
                        }
                    }
                    
                    if (!footerSubmitted) {
                        await footerEmailInput.press('Enter');
                        footerSubmitted = true;
                        submissionMethod = 'footer_enter_key';
                    }
                    
                    if (footerSubmitted) {
                        submitted = true;
                        await page.waitForTimeout(3000);
                        console.log(`🎉 SUCCESS: Footer form submitted for ${domain} via ${submissionMethod}`);
                        return { success: true, method: submissionMethod, type: 'footer' };
                    }
                    
                } catch (footerError) {
                    console.log(`⚠️ Footer form submission failed for ${domain}: ${footerError.message}`);
                }
            }
        }
        
        // Strategy 3: General page forms
        if (!submitted) {
            console.log(`🎯 Strategy 3: Looking for general page forms on ${domain}`);
            
            // Scroll back to top
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.waitForTimeout(1000);
            
            const { emailInput: generalEmailInput } = await findEmailInput(page, domain);
            
            if (generalEmailInput) {
                try {
                    console.log(`✅ Found general email input on ${domain}`);
                    
                    await generalEmailInput.click();
                    await generalEmailInput.fill('');
                    await page.waitForTimeout(500);
                    await generalEmailInput.fill(email);
                    
                    const { submitButton: generalSubmitButton } = await findSubmitButton(page, domain, generalEmailInput);
                    
                    if (generalSubmitButton) {
                        await generalSubmitButton.click({ timeout: CONFIG.FORM_INTERACTION_TIMEOUT });
                        submitted = true;
                        submissionMethod = 'general_form_click';
                    } else {
                        await generalEmailInput.press('Enter');
                        submitted = true;
                        submissionMethod = 'general_form_enter';
                    }
                    
                    if (submitted) {
                        await page.waitForTimeout(3000);
                        console.log(`🎉 SUCCESS: General form submitted for ${domain} via ${submissionMethod}`);
                        return { success: true, method: submissionMethod, type: 'general' };
                    }
                    
                } catch (generalError) {
                    console.log(`⚠️ General form submission failed for ${domain}: ${generalError.message}`);
                }
            }
        }
        
        if (!submitted) {
            console.log(`❌ No forms found or all submission attempts failed for ${domain}`);
            return { success: false, reason: 'no_forms_found_or_submission_failed' };
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
            if (retryCount < CONFIG.MAX_RETRIES && result.reason !== 'no_forms_found_or_submission_failed') {
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
        type: result.type
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
        error: result.error || null
    };
    
    try {
        await fs.appendFile(CONFIG.FAILED_LOG, JSON.stringify(logEntry) + '\n');
    } catch (error) {
        console.error(`⚠️ Failed to log failure: ${error.message}`);
    }
}

async function runAutomation() {
    console.log('🚀 Starting Improved Newsletter Automation...');
    
    try {
        // Load data
        await loadEmailAccounts();
        const domains = await loadDomains();
        
        console.log(`🎯 Processing ${domains.length} domains with ${emailAccounts.length} rotating emails`);
        
        // Create logs directory
        await fs.mkdir('./logs', { recursive: true });
        
        // Process domains in batches
        const totalBatches = Math.ceil(domains.length / CONFIG.BATCH_SIZE);
        
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const startIndex = batchIndex * CONFIG.BATCH_SIZE;
            const endIndex = Math.min(startIndex + CONFIG.BATCH_SIZE, domains.length);
            const batchDomains = domains.slice(startIndex, endIndex);
            
            console.log(`\n📦 Processing batch ${batchIndex + 1}/${totalBatches} (${batchDomains.length} domains)`);
            
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
            
            // Print batch statistics
            const successRate = ((STATS.totalSuccessful / STATS.totalProcessed) * 100).toFixed(1);
            console.log(`\n📊 Batch ${batchIndex + 1} Complete:`);
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
        const finalSuccessRate = ((STATS.totalSuccessful / STATS.totalProcessed) * 100).toFixed(1);
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
    runAutomation().catch(console.error);
}

module.exports = { runAutomation, processDomain }; 