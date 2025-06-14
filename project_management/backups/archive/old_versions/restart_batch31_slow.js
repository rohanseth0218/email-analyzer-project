/**
 * SLOW RESTART: Batch 31 Email Automation
 * 
 * Ultra-conservative settings for debugging:
 * - Start from batch 31 but process only 10 domains first
 * - Only 3 concurrent sessions (very slow)
 * - Enhanced debugging and error logging
 * - Detailed failure analysis
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const { parse } = require('csv-parse/sync');
const axios = require('axios');

// ULTRA-CONSERVATIVE CONFIGURATION FOR DEBUGGING
const CONFIG = {
    BROWSERBASE_API_KEY: 'bb_live_FTV11nF0Vs1NR_T_rVBHRmQHv74',
    BROWSERBASE_PROJECT_ID: 'd277f38a-cc07-4af9-8473-83cefed0bfcd',
    
    // ULTRA-SLOW SETTINGS FOR DEBUGGING
    MAX_CONCURRENT_SESSIONS: 1,  // Sequential processing for debugging
    BATCH_SIZE: 5,  // Very small batches to debug
    START_FROM_BATCH: 31,
    SESSION_CREATION_DELAY: 3000,  // 3 seconds between sessions
    
    // Extended timeouts for debugging
    NAVIGATION_TIMEOUT: 60000,  // 1 minute
    FORM_INTERACTION_TIMEOUT: 30000,  // 30 seconds
    SESSION_CREATION_TIMEOUT: 30000,
    
    // Slack webhook
    SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/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',
    
    // Logging
    FAILED_DOMAINS_LOG: './logs/failed_domains_slow_debug.jsonl',
    SUCCESS_DOMAINS_LOG: './logs/successful_domains_slow_debug.jsonl',
    PROGRESS_LOG: './logs/progress_slow_debug.json',
    
    // Enhanced debugging
    TAKE_SCREENSHOTS: true,
    SAVE_PAGE_HTML: true,
    VERBOSE_LOGGING: true,
    
    // Retry settings
    MAX_RETRIES: 2,
    RETRY_DELAY: 10000,
};

const STATS = {
    totalProcessed: 3000,  // Starting from batch 31
    totalSuccessful: 1521, // Previous count
    totalFailed: 1479,
    startTime: Date.now(),
    currentBatch: 31,
    failureReasons: {},
    sessionsCreated: 0,
    sessionsReused: 0
};

// Enhanced selectors with more options
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
        
        console.log(`📂 Loaded ${domains.length} domains from CSV`);
        console.log(`✅ Processed ${domains.length} valid domains`);
        return domains;
        
    } catch (error) {
        console.error(`❌ Error loading domains: ${error.message}`);
        throw error;
    }
}

async function loadEmailAccounts() {
    try {
        console.log('📂 Loading email accounts from CSV...');
        const csvContent = await fs.readFile('./mailboxaccounts.csv', 'utf-8');
        const records = parse(csvContent, { 
            columns: true, 
            skip_empty_lines: true 
        });
        
        const emailColumn = Object.keys(records[0]).find(key => 
            key.toLowerCase().includes('email')
        );
        
        const emails = records
            .map(record => record[emailColumn])
            .filter(email => email && email.includes('@') && email.includes('.'));
        
        console.log(`📧 Successfully loaded ${emails.length} email accounts`);
        return emails;
        
    } catch (error) {
        console.error(`❌ Error loading email accounts: ${error.message}`);
        throw error;
    }
}

async function createBrowserbaseSession() {
    try {
        console.log('🆕 Creating new Browserbase session...');
        
        const response = await axios.post(
            'https://api.browserbase.com/v1/sessions',
            {
                projectId: CONFIG.BROWSERBASE_PROJECT_ID,
                browserSettings: {
                    blockAds: false,  // Don't block anything for debugging
                    blockTrackers: false,
                    blockImages: false,
                    blockFonts: false,
                    blockStylesheets: false
                }
            },
            {
                headers: {
                    'X-BB-API-Key': CONFIG.BROWSERBASE_API_KEY,
                    'Content-Type': 'application/json'
                },
                timeout: CONFIG.SESSION_CREATION_TIMEOUT
            }
        );
        
        console.log(`✅ Session created: ${response.data.id}`);
        return {
            id: response.data.id,
            connectUrl: response.data.connectUrl
        };
        
    } catch (error) {
        console.error(`❌ Failed to create session: ${error.message}`);
        throw error;
    }
}

async function tryFormSubmissionEnhanced(page, email, domain) {
    try {
        console.log(`🔍 Looking for email forms on ${domain}...`);
        
        // Wait for page to be ready with longer timeout
        await page.waitForLoadState('domcontentloaded', { timeout: CONFIG.NAVIGATION_TIMEOUT });
        await page.waitForTimeout(3000); // Extra wait for dynamic content
        
        // Take screenshot for debugging
        if (CONFIG.TAKE_SCREENSHOTS) {
            try {
                const screenshotPath = `./logs/screenshots/${domain.replace(/[^a-zA-Z0-9]/g, '_')}_initial.png`;
                await fs.mkdir('./logs/screenshots', { recursive: true });
                await page.screenshot({ path: screenshotPath, fullPage: true });
                console.log(`📸 Screenshot saved: ${screenshotPath}`);
            } catch (e) {
                console.log(`⚠️ Screenshot failed: ${e.message}`);
            }
        }
        
        // Try to find email input using enhanced selectors
        let emailInput = null;
        let foundSelector = null;
        
        for (const selector of ENHANCED_SELECTORS.emailInputs) {
            try {
                const elements = await page.locator(selector).all();
                console.log(`🔍 Checking selector: ${selector} - found ${elements.length} elements`);
                
                for (const element of elements) {
                    if (await element.isVisible({ timeout: 2000 })) {
                        emailInput = element;
                        foundSelector = selector;
                        console.log(`📧 Found visible email input: ${selector}`);
                        break;
                    }
                }
                
                if (emailInput) break;
            } catch (e) {
                console.log(`⚠️ Selector ${selector} failed: ${e.message}`);
            }
        }
        
        if (!emailInput) {
            console.log(`❌ No email input found after checking ${ENHANCED_SELECTORS.emailInputs.length} selectors`);
            return { success: false, reason: 'no_email_input_found' };
        }
        
        // Fill email
        await emailInput.fill(email);
        console.log(`✏️ Filled email: ${email} using selector: ${foundSelector}`);
        
        // Wait for any dynamic form updates
        await page.waitForTimeout(2000);
        
        // Try to find and click submit button
        let submitButton = null;
        let submitSelector = null;
        
        for (const selector of ENHANCED_SELECTORS.submitButtons) {
            try {
                const elements = await page.locator(selector).all();
                console.log(`🔍 Checking submit selector: ${selector} - found ${elements.length} elements`);
                
                for (const element of elements) {
                    if (await element.isVisible({ timeout: 2000 })) {
                        submitButton = element;
                        submitSelector = selector;
                        console.log(`🔘 Found visible submit button: ${selector}`);
                        break;
                    }
                }
                
                if (submitButton) break;
            } catch (e) {
                console.log(`⚠️ Submit selector ${selector} failed: ${e.message}`);
            }
        }
        
        if (!submitButton) {
            console.log(`❌ No submit button found after checking ${ENHANCED_SELECTORS.submitButtons.length} selectors`);
            return { success: false, reason: 'no_submit_button_found' };
        }
        
        // Click submit button
        await submitButton.click();
        console.log(`🚀 Clicked submit button using selector: ${submitSelector}`);
        
        // Wait for form submission to complete
        await page.waitForTimeout(5000);
        
        // Take screenshot after submission
        if (CONFIG.TAKE_SCREENSHOTS) {
            try {
                const screenshotPath = `./logs/screenshots/${domain.replace(/[^a-zA-Z0-9]/g, '_')}_after_submit.png`;
                await page.screenshot({ path: screenshotPath, fullPage: true });
                console.log(`📸 Post-submit screenshot saved: ${screenshotPath}`);
            } catch (e) {
                console.log(`⚠️ Post-submit screenshot failed: ${e.message}`);
            }
        }
        
        // Check for success indicators
        const currentUrl = page.url();
        const pageContent = await page.content();
        
        const successIndicators = [
            'thank you', 'success', 'subscribed', 'confirmation',
            'welcome', 'signed up', 'newsletter', 'registered'
        ];
        
        const hasSuccessIndicator = successIndicators.some(indicator => 
            pageContent.toLowerCase().includes(indicator) ||
            currentUrl.toLowerCase().includes(indicator)
        );
        
        console.log(`🔍 Checking success indicators in URL: ${currentUrl}`);
        
        if (hasSuccessIndicator) {
            console.log('✅ Form submission appears successful');
            return { 
                success: true, 
                reason: 'success', 
                email, 
                url: currentUrl
            };
        } else {
            console.log('⚠️ Form submitted but no clear success indication');
            return { 
                success: true, 
                reason: 'submitted_unclear', 
                email, 
                url: currentUrl
            };
        }
        
    } catch (error) {
        console.log(`❌ Form submission failed: ${error.message}`);
        console.log(`🔍 Error stack: ${error.stack}`);
        return { 
            success: false, 
            reason: 'form_submission_error', 
            error: error.message
        };
    }
}

async function processDomain(domain, email) {
    let sessionData = null;
    
    try {
        console.log(`\n🌐 Starting to process: ${domain}`);
        
        // Create new session for each domain (debugging mode)
        sessionData = await createBrowserbaseSession();
        
        // Connect to browser
        console.log(`🔗 Connecting to browser session: ${sessionData.id}`);
        const browser = await chromium.connect(sessionData.connectUrl);
        const context = browser.contexts()[0] || await browser.newContext();
        const page = context.pages()[0] || await context.newPage();
        
        // Set timeouts and user agent
        page.setDefaultTimeout(CONFIG.NAVIGATION_TIMEOUT);
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        console.log(`🌐 Navigating to: ${domain}`);
        
        // Navigate to domain
        await page.goto(domain, { 
            waitUntil: 'domcontentloaded',
            timeout: CONFIG.NAVIGATION_TIMEOUT 
        });
        
        console.log(`✅ Successfully navigated to: ${domain}`);
        
        // Try form submission
        const result = await tryFormSubmissionEnhanced(page, email, domain);
        
        // Update statistics
        STATS.totalProcessed++;
        if (result.success) {
            STATS.totalSuccessful++;
            console.log(`✅ SUCCESS: ${domain}`);
            await logSuccessfulDomain({ ...result, domain, timestamp: new Date().toISOString() });
        } else {
            STATS.totalFailed++;
            STATS.failureReasons[result.reason] = (STATS.failureReasons[result.reason] || 0) + 1;
            console.log(`❌ FAILED: ${domain} - ${result.reason}`);
            await logFailedDomain({ ...result, domain, timestamp: new Date().toISOString() });
        }
        
        await browser.close();
        console.log(`🔒 Browser closed for: ${domain}`);
        return result;
        
    } catch (error) {
        STATS.totalProcessed++;
        STATS.totalFailed++;
        STATS.failureReasons['processing_error'] = (STATS.failureReasons['processing_error'] || 0) + 1;
        
        console.log(`❌ PROCESSING ERROR: ${domain} - ${error.message}`);
        console.log(`🔍 Error stack: ${error.stack}`);
        
        const result = { 
            success: false, 
            reason: 'processing_error', 
            error: error.message,
            domain,
            timestamp: new Date().toISOString()
        };
        
        await logFailedDomain(result);
        return result;
        
    } finally {
        // Wait between domains for debugging
        console.log('⏸️ Waiting 3 seconds before next domain...');
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
}

async function logFailedDomain(result) {
    try {
        const logEntry = JSON.stringify(result) + '\n';
        await fs.appendFile(CONFIG.FAILED_DOMAINS_LOG, logEntry);
    } catch (error) {
        console.error(`❌ Error logging failed domain: ${error.message}`);
    }
}

async function logSuccessfulDomain(result) {
    try {
        const logEntry = JSON.stringify(result) + '\n';
        await fs.appendFile(CONFIG.SUCCESS_DOMAINS_LOG, logEntry);
    } catch (error) {
        console.error(`❌ Error logging successful domain: ${error.message}`);
    }
}

async function sendSlackNotification(message) {
    if (!CONFIG.SLACK_WEBHOOK_URL) return;
    
    try {
        await axios.post(CONFIG.SLACK_WEBHOOK_URL, {
            text: message
        });
        console.log('📨 Slack notification sent successfully');
    } catch (error) {
        console.error(`❌ Error sending Slack notification: ${error.message}`);
    }
}

async function updateProgress() {
    const progressData = {
        timestamp: new Date().toISOString(),
        currentBatch: STATS.currentBatch,
        totalProcessed: STATS.totalProcessed,
        totalSuccessful: STATS.totalSuccessful,
        totalFailed: STATS.totalFailed,
        successRate: STATS.totalProcessed > 0 ? (STATS.totalSuccessful / STATS.totalProcessed * 100).toFixed(2) : 0,
        failureReasons: STATS.failureReasons
    };
    
    try {
        await fs.writeFile(CONFIG.PROGRESS_LOG, JSON.stringify(progressData, null, 2));
    } catch (error) {
        console.error(`❌ Error updating progress: ${error.message}`);
    }
}

async function runSlowAutomation() {
    console.log('🚀 Starting SLOW DEBUG Email Automation...');
    console.log('================================================================================');
    console.log(`⚡ Max Concurrent Sessions: ${CONFIG.MAX_CONCURRENT_SESSIONS} (DEBUG MODE)`);
    console.log(`📦 Batch Size: ${CONFIG.BATCH_SIZE} (SMALL FOR DEBUGGING)`);
    console.log(`🔧 Features: Enhanced Debugging, Screenshots`);
    console.log('');
    
    try {
        // Create logs directory
        await fs.mkdir('./logs', { recursive: true });
        await fs.mkdir('./logs/screenshots', { recursive: true });
        
        const allDomains = await loadDomains();
        const emails = await loadEmailAccounts();
        
        console.log(`✅ Loaded ${allDomains.length} domains and ${emails.length} email accounts`);
        
        // Get domains from batch 31 onwards
        const startIndex = (CONFIG.START_FROM_BATCH - 1) * 100; // Original batch size was 100
        const remainingDomains = allDomains.slice(startIndex);
        
        // Take only first few domains for debugging
        const debugDomains = remainingDomains.slice(0, CONFIG.BATCH_SIZE);
        
        console.log(`🔄 DEBUG MODE: Testing first ${debugDomains.length} domains from batch ${CONFIG.START_FROM_BATCH}`);
        console.log(`📋 Debug domains:`, debugDomains);
        
        // Send startup notification
        await sendSlackNotification(`:mag: EMAIL AUTOMATION - DEBUG MODE
:gear: Testing ${debugDomains.length} domains from Batch ${CONFIG.START_FROM_BATCH}
:snail: SLOW MODE: Sequential processing, extensive logging
:camera: Screenshots enabled for debugging`);
        
        // Process domains one by one
        const batchResults = [];
        for (let i = 0; i < debugDomains.length; i++) {
            const domain = debugDomains[i];
            const email = emails[i % emails.length];
            
            console.log(`\n--- Processing domain ${i + 1}/${debugDomains.length}: ${domain} ---`);
            
            try {
                const result = await processDomain(domain, email);
                batchResults.push(result);
                
            } catch (error) {
                console.error(`❌ Error processing ${domain}: ${error.message}`);
            }
        }
        
        // Calculate final statistics
        const totalTime = (Date.now() - STATS.startTime) / 1000 / 60;
        const successfulResults = batchResults.filter(r => r.success).length;
        const finalSuccessRate = debugDomains.length > 0 ? 
            (successfulResults / debugDomains.length * 100).toFixed(2) : 0;
        
        console.log('\n🎉 DEBUG RUN COMPLETE!');
        console.log(`📊 Results: ${successfulResults}/${debugDomains.length} successful (${finalSuccessRate}%)`);
        console.log(`⏱️  Total Runtime: ${totalTime.toFixed(2)} minutes`);
        console.log(`📋 Failure breakdown:`, STATS.failureReasons);
        
        await sendSlackNotification(`:tada: DEBUG RUN COMPLETE!
:bar_chart: Success Rate: ${finalSuccessRate}% on ${debugDomains.length} domains
:stopwatch: Runtime: ${totalTime.toFixed(2)} minutes
:file_folder: Check logs for detailed screenshots and analysis`);
        
        await updateProgress();
        
    } catch (error) {
        console.error(`❌ Automation failed: ${error.message}`);
        console.error(`🔍 Error stack: ${error.stack}`);
        await sendSlackNotification(`:x: DEBUG AUTOMATION FAILED: ${error.message}`);
        throw error;
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n⚠️ Received interrupt signal. Saving progress...');
    await updateProgress();
    await sendSlackNotification(`:warning: Debug automation interrupted. Check logs for details.`);
    process.exit(0);
});

// Run automation
if (require.main === module) {
    runSlowAutomation().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { runSlowAutomation, CONFIG }; 