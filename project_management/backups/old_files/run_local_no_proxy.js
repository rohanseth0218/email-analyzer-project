/**
 * Local No-Proxy 50K Domain Email Automation
 * 
 * Optimized for local execution:
 * - No proxy usage to avoid bandwidth limits
 * - Start from batch 31 (where it crashed)
 * - 50 concurrent sessions as requested
 * - Enhanced error handling and logging
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const { parse } = require('csv-parse/sync');
const axios = require('axios');

// Configuration optimized for local execution
const CONFIG = {
    BROWSERBASE_API_KEY: 'bb_live_FTV11nF0Vs1NR_T_rVBHRmQHv74',
    BROWSERBASE_PROJECT_ID: 'd277f38a-cc07-4af9-8473-83cefed0bfcd',
    
    // NO PROXIES, STARTUP PLAN LIMITS (50 concurrent, 50 per minute), START FROM BATCH 31
    MAX_CONCURRENT_SESSIONS: 50,  // Startup plan limit: 50 concurrent sessions
    BATCH_SIZE: 100,
    START_FROM_BATCH: 31,
    SESSION_CREATION_DELAY: 1500,  // 1.5 seconds between sessions (50 per 60s = 1.2s minimum + buffer)
    
    // Timeouts
    NAVIGATION_TIMEOUT: 30000,
    FORM_INTERACTION_TIMEOUT: 10000,
    SESSION_CREATION_TIMEOUT: 15000,
    
    // Slack webhook
    SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/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',
    
    // Logging
    FAILED_DOMAINS_LOG: './logs/failed_domains_local_no_proxy.jsonl',
    SUCCESS_DOMAINS_LOG: './logs/successful_domains_local_no_proxy.jsonl',
    PROGRESS_LOG: './logs/progress_local_no_proxy.json',
    
    // Retry settings
    MAX_RETRIES: 3,
    RETRY_DELAY: 5000,
};

const STATS = {
    totalProcessed: 0,
    totalSuccessful: 0,
    totalFailed: 0,
    startTime: Date.now(),
    currentBatch: 0,
    failureReasons: {},
    sessionsCreated: 0,
    sessionsReused: 0
};

// Session pool for reuse - optimized for Startup plan
const sessionPool = {
    available: [],
    inUse: new Set(),
    maxPoolSize: 80,  // Increased to 80 to safely handle 50 concurrent sessions with buffer
    
    async getSession() {
        // Try to get an available session first
        if (this.available.length > 0) {
            const session = this.available.pop();
            this.inUse.add(session.id);
            STATS.sessionsReused++;
            console.log(`♻️  Reusing session ${session.id} (pool: ${this.available.length} available, ${this.inUse.size} in use)`);
            return session;
        }
        
        // Create new session if pool is empty
        const session = await createBrowserbaseSession();
        this.inUse.add(session.id);
        STATS.sessionsCreated++;
        console.log(`🆕 Created new session ${session.id} (pool: ${this.available.length} available, ${this.inUse.size} in use)`);
        return session;
    },
    
    releaseSession(session) {
        this.inUse.delete(session.id);
        
        // Add back to pool if under max size
        if (this.available.length < this.maxPoolSize) {
            this.available.push(session);
            console.log(`🔄 Session ${session.id} returned to pool (pool: ${this.available.length} available, ${this.inUse.size} in use)`);
        } else {
            console.log(`🗑️  Session ${session.id} discarded (pool full) (pool: ${this.available.length} available, ${this.inUse.size} in use)`);
        }
    }
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
        return emails;
        
    } catch (error) {
        console.error(`❌ Error loading email accounts: ${error.message}`);
        throw error;
    }
}

// Session creation with rate limiting and retry logic
let lastSessionCreation = 0;
let sessionCreationQueue = [];

async function createBrowserbaseSession(retryCount = 0) {
    try {
        // Rate limiting: ensure minimum delay between session creation
        const now = Date.now();
        const timeSinceLastCreation = now - lastSessionCreation;
        if (timeSinceLastCreation < CONFIG.SESSION_CREATION_DELAY) {
            const waitTime = CONFIG.SESSION_CREATION_DELAY - timeSinceLastCreation;
            console.log(`⏳ Rate limiting: waiting ${waitTime}ms before creating session`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        lastSessionCreation = Date.now();
        
        const response = await axios.post(
            'https://api.browserbase.com/v1/sessions',
            {
                projectId: CONFIG.BROWSERBASE_PROJECT_ID,
                browserSettings: {
                    viewport: { width: 1920, height: 1080 },
                    stealth: true
                }
                // NO PROXY CONFIGURATION
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-BB-API-Key': CONFIG.BROWSERBASE_API_KEY
                },
                timeout: CONFIG.SESSION_CREATION_TIMEOUT
            }
        );
        
        return {
            id: response.data.id,
            connectUrl: response.data.connectUrl
        };
        
    } catch (error) {
        if (error.response?.status === 429 && retryCount < CONFIG.MAX_RETRIES) {
            // Rate limit hit, use exponential backoff
            const backoffDelay = CONFIG.RETRY_DELAY * Math.pow(2, retryCount);
            console.log(`⚠️ Rate limit hit (429), retrying in ${backoffDelay}ms... (${retryCount + 1}/${CONFIG.MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
            return createBrowserbaseSession(retryCount + 1);
        }
        
        console.error(`❌ Failed to create Browserbase session: ${error.message}`);
        if (error.response?.status === 429) {
            console.error('🚫 Rate limit exceeded. Consider reducing MAX_CONCURRENT_SESSIONS further.');
        }
        throw error;
    }
}

async function tryFormSubmissionEnhanced(page, email, domain) {
    try {
        // Debug logging
        console.log(`🔍 Processing ${domain} with email: ${email}`);
        if (!email) {
            throw new Error(`Email is undefined for domain ${domain}`);
        }
        // Try Klaviyo form trigger like in playground
        try {
            await page.evaluate(() => {
                window._klOnsite = window._klOnsite || [];
                window._klOnsite.push(['openForm', '']);
            });
            console.log(`✅ Triggered Klaviyo form for ${domain}`);
        } catch (e) {
            console.log(`⚠️ Could not trigger Klaviyo form for ${domain}`);
        }
        
        let submitted = false;
        
        // Try popup form first (like in playground)
        try {
            const popupInput = await page.$('input[type="email"]:visible');
            
            if (popupInput) {
                console.log(`✅ Popup email input found on ${domain}`);
                await popupInput.fill(email);
                
                const submitBtn = await page.$('form button[type="submit"]:visible, form input[type="submit"]:visible');
                if (submitBtn) {
                    try {
                        await submitBtn.click({ timeout: 5000 });
                    } catch {
                        await page.evaluate((el) => el.click(), submitBtn);
                    }
                    submitted = true;
                    console.log(`✅ Popup form submitted for ${domain}`);
                } else {
                    await popupInput.press('Enter');
                    submitted = true;
                    console.log(`✅ Popup submitted via Enter for ${domain}`);
                }
                
                await page.waitForTimeout(2000);
            }
        } catch (e) {
            console.log(`⚠️ Popup form error on ${domain}: ${e.message}`);
        }
        
        // Fallback to footer form if popup didn't work
        if (!submitted) {
            try {
                await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                await page.waitForTimeout(2000);
                
                const footerInput = await page.$('footer input[type="email"]');
                if (footerInput) {
                    console.log(`✅ Footer email input found on ${domain}`);
                    await footerInput.fill(email);
                    
                    const footerBtn = await page.$('footer button[type="submit"], footer input[type="submit"], footer button:has-text("Subscribe"), footer button:has-text("Sign Up")');
                    if (footerBtn) {
                        try {
                            await footerBtn.click({ timeout: 5000 });
                        } catch {
                            await page.evaluate((el) => el.click(), footerBtn);
                        }
                        submitted = true;
                        console.log(`✅ Footer form submitted for ${domain}`);
                    } else {
                        await footerInput.press('Enter');
                        submitted = true;
                        console.log(`✅ Footer form submitted via Enter for ${domain}`);
                    }
                    
                    await page.waitForTimeout(2000);
                }
            } catch (e) {
                console.log(`⚠️ Footer form error on ${domain}: ${e.message}`);
            }
        }
        
        // Enhanced fallback using original selectors if still no success
        if (!submitted) {
            console.log(`🔍 Trying enhanced fallback for ${domain}...`);
            await page.waitForLoadState('networkidle', { timeout: 15000 });
            
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
                    continue;
                }
            }
            
            if (!emailInput || !(await emailInput.isVisible())) {
                console.log(`❌ No email input found on ${domain}`);
                return { success: false, reason: 'no_email_input_found' };
            }
            
            console.log(`✅ Email input found on ${domain}, filling with ${email}`);
            await emailInput.click();
            await emailInput.fill('');
            await page.waitForTimeout(500);
            await emailInput.fill(email);
            
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
                    continue;
                }
            }
            
            if (submitButton && (await submitButton.isVisible())) {
                console.log(`✅ Clicking submit button on ${domain}`);
                await submitButton.click();
                await page.waitForTimeout(3000);
                submitted = true;
                console.log(`✅ Enhanced fallback form submitted for ${domain}`);
            } else {
                console.log(`⚠️ No submit button found on ${domain}, trying Enter key`);
                await emailInput.press('Enter');
                await page.waitForTimeout(3000);
                submitted = true;
                console.log(`✅ Enhanced fallback submitted via Enter for ${domain}`);
            }
        }
        
        // Validate if submission was actually successful
        if (submitted) {
            await page.waitForTimeout(3000); // Wait for any redirects/confirmations
            
            // Check current URL for success indicators
            const currentUrl = page.url().toLowerCase();
            const urlSuccessIndicators = [
                'thank', 'success', 'confirm', 'subscribe', 'welcome',
                'thanks', 'subscribed', 'newsletter', 'signup-success',
                'thank-you', 'subscription', 'email-confirmed'
            ];
            
            const hasUrlSuccess = urlSuccessIndicators.some(indicator => 
                currentUrl.includes(indicator)
            );
            
            // Check page content for success indicators
            let hasContentSuccess = false;
            try {
                const pageContent = await page.content();
                const contentLower = pageContent.toLowerCase();
                const contentSuccessIndicators = [
                    'thank you', 'thanks for', 'successfully subscribed', 
                    'check your email', 'confirmation email', 'welcome to',
                    'you\'re all set', 'subscription confirmed', 'almost there',
                    'please confirm', 'verify your email', 'subscription successful'
                ];
                
                hasContentSuccess = contentSuccessIndicators.some(indicator => 
                    contentLower.includes(indicator)
                );
            } catch (e) {
                console.log(`⚠️ Could not check page content for ${domain}: ${e.message}`);
            }
            
            const actuallySuccessful = hasUrlSuccess || hasContentSuccess;
            
            if (actuallySuccessful) {
                console.log(`🎉 SUCCESS CONFIRMED for ${domain} - URL: ${hasUrlSuccess}, Content: ${hasContentSuccess}`);
                return { 
                    success: true, 
                    reason: 'form_submitted_and_confirmed' 
                };
            } else {
                console.log(`⚠️ Form clicked but no success confirmation for ${domain}`);
                return { 
                    success: false, 
                    reason: 'form_clicked_but_not_confirmed' 
                };
            }
        }
        
        return { 
            success: false, 
            reason: 'no_form_found' 
        };
        
    } catch (error) {
        return { 
            success: false, 
            reason: 'form_submission_error',
            error: error.message 
        };
    }
}

async function processDomain(domain, email) {
    let browser = null;
    let context = null;
    let page = null;
    let sessionData = null;
    
    try {
        sessionData = await sessionPool.getSession();
        
        // Use connectOverCDP like in working playground approach
        browser = await chromium.connectOverCDP(sessionData.connectUrl);
        
        // Create context with proper settings like in playground
        context = await browser.newContext({
            geolocation: { latitude: 40.7128, longitude: -74.0060 },
            locale: 'en-US',
            permissions: ['geolocation']
        });
        page = await context.newPage();
        
        // Performance optimization: block unnecessary resources (as per Browserbase guide)
        await page.route('**/*', route => {
            const resourceType = route.request().resourceType();
            if (resourceType === 'image' || resourceType === 'stylesheet' || resourceType === 'font') {
                route.abort();
            } else {
                route.continue();
            }
        });
        
        // Add UTM parameters like in playground approach
        const UTM_PARAMS = "?utm_source=automation&utm_medium=email&utm_campaign=signup-test";
        const urlWithParams = `${domain}${UTM_PARAMS}`;
        
        // Navigate with load state like in playground
        await page.goto(urlWithParams, { 
            waitUntil: 'load', 
            timeout: CONFIG.NAVIGATION_TIMEOUT 
        });
        
        // Wait for modals to appear like in playground
        await page.waitForTimeout(3000);
        
        const result = await tryFormSubmissionEnhanced(page, email, domain);
        
        const domainResult = {
            domain,
            email,
            success: result.success,
            reason: result.reason,
            error: result.error || null,
            timestamp: new Date().toISOString(),
            sessionId: sessionData.id
        };
        
        // Update stats
        STATS.totalProcessed++;
        if (result.success) {
            STATS.totalSuccessful++;
            await logSuccessfulDomain(domainResult);
        } else {
            STATS.totalFailed++;
            STATS.failureReasons[result.reason] = (STATS.failureReasons[result.reason] || 0) + 1;
            await logFailedDomain(domainResult);
        }
        
        // Send Slack notification every 100 domains
        if (STATS.totalProcessed % 100 === 0) {
            const successRate = ((STATS.totalSuccessful / STATS.totalProcessed) * 100).toFixed(2);
            const message = `📊 Progress Update - ${STATS.totalProcessed} domains processed\n` +
                           `✅ Successful: ${STATS.totalSuccessful} (${successRate}%)\n` +
                           `❌ Failed: ${STATS.totalFailed}\n` +
                           `🔄 Sessions: ${STATS.sessionsCreated} created, ${STATS.sessionsReused} reused`;
            await sendSlackNotification(message);
        }
        
        return domainResult;
        
    } catch (error) {
        const domainResult = {
            domain,
            email,
            success: false,
            reason: 'processing_error',
            error: error.message,
            timestamp: new Date().toISOString(),
            sessionId: sessionData?.id || null
        };
        
        STATS.totalProcessed++;
        STATS.totalFailed++;
        STATS.failureReasons['processing_error'] = (STATS.failureReasons['processing_error'] || 0) + 1;
        
        await logFailedDomain(domainResult);
        return domainResult;
        
    } finally {
        try {
            if (page) await page.close();
            if (browser) await browser.close();
            
            // Return session to pool for reuse
            if (sessionData) {
                sessionPool.releaseSession(sessionData);
            }
        } catch (e) {
            // Ignore cleanup errors
        }
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

async function processBatch(domains, emails, batchNumber, totalBatches) {
    const batchStartTime = Date.now();
    console.log(`\n🚀 Starting Batch ${batchNumber}/${totalBatches} (${domains.length} domains)`);
    
    STATS.currentBatch = batchNumber;
    const batchResults = [];
    
    // Process domains with controlled concurrency
    let domainIndex = 0;
    
    const processNextDomain = async () => {
        while (domainIndex < domains.length) {
            const currentIndex = domainIndex++;
            const domain = domains[currentIndex];
            const email = emails[currentIndex % emails.length];
            
            // Debug logging for email issues
            if (!email) {
                console.error(`❌ CRITICAL: Email is undefined at index ${currentIndex} (${currentIndex % emails.length})`);
                console.error(`   Emails array length: ${emails.length}`);
                console.error(`   Domain: ${domain}`);
                continue;
            }
            
            try {
                const result = await processDomain(domain, email);
                batchResults.push(result);
                
                if (batchResults.length % 25 === 0) {
                    const successCount = batchResults.filter(r => r.success).length;
                    const successRate = (successCount / batchResults.length * 100).toFixed(1);
                    console.log(`   📊 Progress: ${batchResults.length}/${domains.length} | Success: ${successRate}%`);
                }
                
            } catch (error) {
                console.error(`❌ Error processing ${domain}: ${error.message}`);
            }
        }
    };
    
    // Start workers
    const workers = Array.from({ length: CONFIG.MAX_CONCURRENT_SESSIONS }, () => processNextDomain());
    await Promise.all(workers);
    
    // Calculate batch statistics
    const batchEndTime = Date.now();
    const batchProcessingTime = batchEndTime - batchStartTime;
    const successfulInBatch = batchResults.filter(r => r.success).length;
    const batchSuccessRate = (successfulInBatch / batchResults.length * 100).toFixed(2);
    
    console.log(`\n✅ Batch ${batchNumber} Complete!`);
    console.log(`   📊 Results: ${successfulInBatch}/${domains.length} successful (${batchSuccessRate}%)`);
    console.log(`   ⏱️  Time: ${(batchProcessingTime / 1000 / 60).toFixed(2)} minutes`);
    console.log(`   📈 Overall: ${STATS.totalSuccessful}/${STATS.totalProcessed} (${(STATS.totalSuccessful / STATS.totalProcessed * 100).toFixed(2)}%)`);
    console.log(`   🔄 Sessions: ${STATS.sessionsCreated} created, ${STATS.sessionsReused} reused`);
    
    await updateProgress();
    
    // Send Slack update
    const slackMessage = `🤖 Email Automation - Batch ${batchNumber}/${totalBatches}
📊 Batch: ${successfulInBatch}/${domains.length} successful (${batchSuccessRate}%)
📈 Overall: ${STATS.totalSuccessful}/${STATS.totalProcessed} total signups
⏱️  Time: ${(batchProcessingTime / 1000 / 60).toFixed(2)} minutes`;
    
    await sendSlackNotification(slackMessage);
    
    return batchResults;
}

async function runLocalAutomation() {
    console.log('🚀 Starting Local No-Proxy Email Automation...');
    console.log(`📈 Configuration: ${CONFIG.MAX_CONCURRENT_SESSIONS} concurrent sessions, starting from batch ${CONFIG.START_FROM_BATCH}`);
    
    try {
        await fs.mkdir('./logs', { recursive: true });
        
        const allDomains = await loadDomains();
        const emails = await loadEmailAccounts();
        
        console.log(`📊 Loaded ${allDomains.length} domains and ${emails.length} email accounts`);
        
        // Calculate resume point
        const totalBatches = Math.ceil(allDomains.length / CONFIG.BATCH_SIZE);
        const startIndex = (CONFIG.START_FROM_BATCH - 1) * CONFIG.BATCH_SIZE;
        const remainingDomains = allDomains.slice(startIndex);
        const remainingBatches = Math.ceil(remainingDomains.length / CONFIG.BATCH_SIZE);
        
        console.log(`🔄 Resuming from batch ${CONFIG.START_FROM_BATCH}`);
        console.log(`📊 Processing ${remainingDomains.length} remaining domains in ${remainingBatches} batches`);
        
        // Send startup notification
        await sendSlackNotification(`🚀 Email Automation RESUMED - Startup Plan Optimized
📊 Starting from Batch ${CONFIG.START_FROM_BATCH}/${totalBatches}
🎯 Processing ${remainingDomains.length} remaining domains
⚙️  Config: ${CONFIG.MAX_CONCURRENT_SESSIONS} concurrent sessions, NO PROXIES
🏎️  Performance: Resource blocking enabled, fast page loads
⏱️  Session creation delay: ${CONFIG.SESSION_CREATION_DELAY}ms`);
        
        // Process remaining batches
        for (let i = 0; i < remainingBatches; i++) {
            const currentBatchNumber = CONFIG.START_FROM_BATCH + i;
            const startIdx = i * CONFIG.BATCH_SIZE;
            const endIdx = Math.min(startIdx + CONFIG.BATCH_SIZE, remainingDomains.length);
            const batchDomains = remainingDomains.slice(startIdx, endIdx);
            
            await processBatch(batchDomains, emails, currentBatchNumber, totalBatches);
            
            if (i < remainingBatches - 1) {
                console.log('⏸️  Brief pause before next batch...');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
        
        // Final statistics
        const totalTime = (Date.now() - STATS.startTime) / 1000 / 60;
        const finalSuccessRate = (STATS.totalSuccessful / STATS.totalProcessed * 100).toFixed(2);
        
        console.log('\n🎉 AUTOMATION COMPLETE!');
        console.log(`📊 Final Results: ${STATS.totalSuccessful}/${STATS.totalProcessed} successful (${finalSuccessRate}%)`);
        console.log(`⏱️  Total Runtime: ${totalTime.toFixed(2)} minutes`);
        
        await sendSlackNotification(`🎉 EMAIL AUTOMATION COMPLETE! 
📊 Final Results: ${STATS.totalSuccessful}/${STATS.totalProcessed} successful signups (${finalSuccessRate}%)
⏱️  Total Runtime: ${totalTime.toFixed(2)} minutes`);
        
        await updateProgress();
        
    } catch (error) {
        console.error(`❌ Automation failed: ${error.message}`);
        await sendSlackNotification(`❌ EMAIL AUTOMATION FAILED: ${error.message}`);
        throw error;
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n⚠️ Received interrupt signal. Saving progress...');
    await updateProgress();
    await sendSlackNotification(`⚠️ Email automation interrupted. Progress saved. Total processed: ${STATS.totalProcessed}`);
    process.exit(0);
});

// Run automation
if (require.main === module) {
    runLocalAutomation().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
} 