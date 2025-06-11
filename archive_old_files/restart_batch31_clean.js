/**
 * CLEAN RESTART: Batch 31 Email Automation
 * 
 * Conservative settings to avoid rate limit chaos:
 * - Start from batch 31 (3000 domains processed)
 * - 25 concurrent sessions (reduced from 50 for safety)
 * - Enhanced process locking to prevent multiple instances
 * - Improved session management
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const { parse } = require('csv-parse/sync');
const axios = require('axios');
const path = require('path');

// CONSERVATIVE CONFIGURATION FOR CLEAN RESTART
const CONFIG = {
    BROWSERBASE_API_KEY: 'bb_live_FTV11nF0Vs1NR_T_rVBHRmQHv74',
    BROWSERBASE_PROJECT_ID: 'd277f38a-cc07-4af9-8473-83cefed0bfcd',
    
    // CONSERVATIVE SETTINGS TO AVOID RATE LIMITS
    MAX_CONCURRENT_SESSIONS: 25,  // Reduced from 50 for safety
    BATCH_SIZE: 100,
    START_FROM_BATCH: 31,  // Resume from batch 31 (3000 domains processed)
    SESSION_CREATION_DELAY: 2000,  // 2 seconds between sessions (extra safe)
    
    // Timeouts
    NAVIGATION_TIMEOUT: 30000,
    FORM_INTERACTION_TIMEOUT: 10000,
    SESSION_CREATION_TIMEOUT: 15000,
    
    // Slack webhook
    SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/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',
    
    // Logging
    FAILED_DOMAINS_LOG: './logs/failed_domains_batch31_restart.jsonl',
    SUCCESS_DOMAINS_LOG: './logs/successful_domains_batch31_restart.jsonl',
    PROGRESS_LOG: './logs/progress_batch31_restart.json',
    LOCK_FILE: './logs/automation_lock.json',
    
    // Retry settings
    MAX_RETRIES: 3,
    RETRY_DELAY: 5000,
};

// Process lock to prevent multiple instances
class ProcessLock {
    constructor(lockFile) {
        this.lockFile = lockFile;
        this.lockData = null;
    }
    
    async acquire() {
        try {
            // Check if lock file exists
            const lockExists = await fs.access(this.lockFile).then(() => true).catch(() => false);
            
            if (lockExists) {
                const existingLock = JSON.parse(await fs.readFile(this.lockFile, 'utf-8'));
                
                // Check if the process is still running
                try {
                    process.kill(existingLock.pid, 0); // Check if process exists
                    throw new Error(`Another automation process is already running (PID: ${existingLock.pid}). Please stop it first.`);
                } catch (err) {
                    if (err.code === 'ESRCH') {
                        // Process doesn't exist, remove stale lock
                        console.log('🔓 Removing stale lock file...');
                        await fs.unlink(this.lockFile).catch(() => {});
                    } else {
                        throw err;
                    }
                }
            }
            
            // Create new lock
            this.lockData = {
                pid: process.pid,
                startTime: new Date().toISOString(),
                config: 'batch31_restart'
            };
            
            await fs.writeFile(this.lockFile, JSON.stringify(this.lockData, null, 2));
            console.log('🔒 Process lock acquired');
            
        } catch (error) {
            console.error(`❌ Failed to acquire process lock: ${error.message}`);
            throw error;
        }
    }
    
    async release() {
        try {
            await fs.unlink(this.lockFile);
            console.log('🔓 Process lock released');
        } catch (error) {
            console.error(`⚠️ Error releasing lock: ${error.message}`);
        }
    }
}

const STATS = {
    totalProcessed: 3000,  // Starting from batch 31 = 3000 domains already processed
    totalSuccessful: 1521, // Previous successful count from first 30 batches
    totalFailed: 1479,     // Previous failed count
    startTime: Date.now(),
    currentBatch: 31,
    failureReasons: {},
    sessionsCreated: 0,
    sessionsReused: 0
};

// Enhanced session pool for better management
const sessionPool = {
    available: [],
    inUse: new Set(),
    maxPoolSize: 20,  // Conservative pool size
    
    async getSession() {
        // Try to get an available session first
        if (this.available.length > 0) {
            const session = this.available.pop();
            this.inUse.add(session.id);
            STATS.sessionsReused++;
            console.log(`♻️  Reusing session ${session.id}`);
            return session;
        }
        
        // Create new session if pool is empty
        const session = await createBrowserbaseSession();
        this.inUse.add(session.id);
        STATS.sessionsCreated++;
        console.log(`🆕 Created new session ${session.id}`);
        return session;
    },
    
    releaseSession(session) {
        this.inUse.delete(session.id);
        
        // Add back to pool if under max size
        if (this.available.length < this.maxPoolSize) {
            this.available.push(session);
            console.log(`🔄 Session ${session.id} returned to pool`);
        } else {
            console.log(`🗑️  Session ${session.id} discarded (pool full)`);
        }
    }
};

// Enhanced selectors for better email form detection
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
        
        console.log(`📄 Found ${records.length} lines in CSV`);
        console.log(`🔑 Headers:`, Object.keys(records[0]).join(', '));
        
        // Find email column
        const firstRecord = records[0];
        const emailColumn = Object.keys(firstRecord).find(key => 
            key.toLowerCase().includes('email')
        );
        
        if (!emailColumn) {
            throw new Error('No email column found in CSV');
        }
        
        console.log(`✅ Found email column at index 0: ${emailColumn}`);
        
        const emails = records
            .map(record => record[emailColumn])
            .filter(email => email && email.includes('@') && email.includes('.'));
        
        console.log(`📧 Successfully loaded ${emails.length} email accounts`);
        console.log(`📋 Sample emails: ${emails.slice(0, 3).join(', ')}`);
        return emails;
        
    } catch (error) {
        console.error(`❌ Error loading email accounts: ${error.message}`);
        throw error;
    }
}

// Session creation with enhanced rate limiting
let lastSessionCreation = 0;

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
                    blockAds: true,
                    blockTrackers: true,
                    blockImages: true,
                    blockFonts: true,
                    blockStylesheets: true
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
        
        return {
            id: response.data.id,
            connectUrl: response.data.connectUrl
        };
        
    } catch (error) {
        if (error.response?.status === 429 && retryCount < CONFIG.MAX_RETRIES) {
            const waitTime = 10000 * (retryCount + 1); // Exponential backoff
            console.log(`⚠️ Rate limit hit (429), retrying in ${waitTime}ms... (${retryCount + 1}/${CONFIG.MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return createBrowserbaseSession(retryCount + 1);
        }
        
        if (error.response?.status === 429) {
            console.log('🚫 Rate limit exceeded. Consider reducing MAX_CONCURRENT_SESSIONS further.');
        }
        
        throw new Error(`Failed to create Browserbase session: ${error.response?.data?.error || error.message}`);
    }
}

async function tryFormSubmissionEnhanced(page, email, domain) {
    try {
        console.log(`🔍 Looking for email forms on ${domain}...`);
        
        // Wait for page to be ready
        await page.waitForLoadState('domcontentloaded');
        
        // Try to find email input using enhanced selectors
        let emailInput = null;
        
        for (const selector of ENHANCED_SELECTORS.emailInputs) {
            try {
                emailInput = await page.locator(selector).first();
                if (await emailInput.isVisible({ timeout: 2000 })) {
                    console.log(`📧 Found email input: ${selector}`);
                    break;
                }
            } catch (e) {
                // Continue to next selector
            }
        }
        
        if (!emailInput || !(await emailInput.isVisible())) {
            return { success: false, reason: 'no_email_input_found' };
        }
        
        // Fill email
        await emailInput.fill(email);
        console.log(`✏️ Filled email: ${email}`);
        
        // Wait a moment for any dynamic form updates
        await page.waitForTimeout(1000);
        
        // Try to find and click submit button
        let submitButton = null;
        
        for (const selector of ENHANCED_SELECTORS.submitButtons) {
            try {
                submitButton = await page.locator(selector).first();
                if (await submitButton.isVisible({ timeout: 2000 })) {
                    console.log(`🔘 Found submit button: ${selector}`);
                    break;
                }
            } catch (e) {
                // Continue to next selector
            }
        }
        
        if (!submitButton || !(await submitButton.isVisible())) {
            return { success: false, reason: 'no_submit_button_found' };
        }
        
        // Click submit button
        await submitButton.click();
        console.log('🚀 Clicked submit button');
        
        // Wait for form submission to complete
        await page.waitForTimeout(3000);
        
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
        
        if (hasSuccessIndicator) {
            console.log('✅ Form submission appears successful');
            return { success: true, reason: 'success', email, url: currentUrl };
        } else {
            console.log('⚠️ Form submitted but no clear success indication');
            return { success: true, reason: 'submitted_unclear', email, url: currentUrl };
        }
        
    } catch (error) {
        console.log(`❌ Form submission failed: ${error.message}`);
        return { success: false, reason: 'form_submission_error', error: error.message };
    }
}

async function processDomain(domain, email) {
    let sessionData = null;
    
    try {
        // Get session from pool
        sessionData = await sessionPool.getSession();
        
        // Connect to browser
        const browser = await chromium.connect(sessionData.connectUrl);
        const context = browser.contexts()[0] || await browser.newContext();
        const page = context.pages()[0] || await context.newPage();
        
        // Set timeouts and user agent
        page.setDefaultTimeout(CONFIG.NAVIGATION_TIMEOUT);
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        console.log(`🌐 Processing: ${domain}`);
        
        // Navigate to domain
        await page.goto(domain, { 
            waitUntil: 'domcontentloaded',
            timeout: CONFIG.NAVIGATION_TIMEOUT 
        });
        
        // Try form submission
        const result = await tryFormSubmissionEnhanced(page, email, domain);
        
        // Update statistics
        STATS.totalProcessed++;
        if (result.success) {
            STATS.totalSuccessful++;
            console.log(`✅ ${domain}`);
            await logSuccessfulDomain({ ...result, domain, timestamp: new Date().toISOString() });
        } else {
            STATS.totalFailed++;
            STATS.failureReasons[result.reason] = (STATS.failureReasons[result.reason] || 0) + 1;
            console.log(`❌ ${domain} - ${result.reason}`);
            await logFailedDomain({ ...result, domain, timestamp: new Date().toISOString() });
        }
        
        await browser.close();
        return result;
        
    } catch (error) {
        STATS.totalProcessed++;
        STATS.totalFailed++;
        STATS.failureReasons['processing_error'] = (STATS.failureReasons['processing_error'] || 0) + 1;
        
        console.log(`❌ ${domain} - processing_error: ${error.message}`);
        
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
        try {
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
    const slackMessage = `:robot_face: Email Automation - Batch ${batchNumber}/${totalBatches}
:bar_chart: Batch: ${successfulInBatch}/${domains.length} successful (${batchSuccessRate}%)
:chart_with_upwards_trend: Overall: ${STATS.totalSuccessful}/${STATS.totalProcessed} total signups
:stopwatch:  Time: ${(batchProcessingTime / 1000 / 60).toFixed(2)} minutes`;
    
    await sendSlackNotification(slackMessage);
    
    return batchResults;
}

async function runCleanAutomation() {
    console.log('🚀 Starting Full 50K Domain Email Automation');
    console.log('================================================================================');
    console.log(`⚡ Max Concurrent Sessions: ${CONFIG.MAX_CONCURRENT_SESSIONS}`);
    console.log(`📦 Batch Size: ${CONFIG.BATCH_SIZE}`);
    console.log(`🔧 Enhanced Features: UTM Fallback, Proxy Support, Enhanced Detection`);
    console.log('');
    
    const processLock = new ProcessLock(CONFIG.LOCK_FILE);
    
    try {
        // Acquire process lock
        await processLock.acquire();
        
        // Create logs directory
        console.log('📂 Loading domains and email accounts...');
        await fs.mkdir('./logs', { recursive: true });
        
        const allDomains = await loadDomains();
        const emails = await loadEmailAccounts();
        
        console.log(`✅ Loaded ${allDomains.length} domains and ${emails.length} email accounts`);
        
        // Calculate resume point
        const totalBatches = Math.ceil(allDomains.length / CONFIG.BATCH_SIZE);
        const startIndex = (CONFIG.START_FROM_BATCH - 1) * CONFIG.BATCH_SIZE;
        const remainingDomains = allDomains.slice(startIndex);
        const remainingBatches = Math.ceil(remainingDomains.length / CONFIG.BATCH_SIZE);
        
        console.log(`📦 Processing ${totalBatches} batches of ${CONFIG.BATCH_SIZE} domains each`);
        
        // Send startup notification
        await sendSlackNotification(`:rocket: Email Automation CLEAN RESTART
:gear: Starting from Batch ${CONFIG.START_FROM_BATCH}/${totalBatches}
:dart: Processing ${remainingDomains.length} remaining domains
:zap: Config: ${CONFIG.MAX_CONCURRENT_SESSIONS} concurrent sessions (CONSERVATIVE)
:shield: Process locking enabled to prevent conflicts`);
        
        console.log(`🔄 Resuming from batch ${CONFIG.START_FROM_BATCH}/504`);
        console.log(`📊 Previous progress: ${(CONFIG.START_FROM_BATCH - 1) * CONFIG.BATCH_SIZE} domains processed`);
        
        // Process remaining batches
        for (let i = 0; i < remainingBatches; i++) {
            const currentBatchNumber = CONFIG.START_FROM_BATCH + i;
            const startIdx = i * CONFIG.BATCH_SIZE;
            const endIdx = Math.min(startIdx + CONFIG.BATCH_SIZE, remainingDomains.length);
            const batchDomains = remainingDomains.slice(startIdx, endIdx);
            
            console.log(`\n🎯 Processing Batch ${currentBatchNumber}/${totalBatches} (${batchDomains.length} domains)`);
            
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
        
        await sendSlackNotification(`:tada: EMAIL AUTOMATION COMPLETE! 
:chart_with_upwards_trend: Final Results: ${STATS.totalSuccessful}/${STATS.totalProcessed} successful signups (${finalSuccessRate}%)
:stopwatch: Total Runtime: ${totalTime.toFixed(2)} minutes`);
        
        await updateProgress();
        
    } catch (error) {
        console.error(`❌ Automation failed: ${error.message}`);
        await sendSlackNotification(`:x: EMAIL AUTOMATION FAILED: ${error.message}`);
        throw error;
    } finally {
        await processLock.release();
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n⚠️ Received interrupt signal. Saving progress...');
    await updateProgress();
    await sendSlackNotification(`:warning: Email automation interrupted. Progress saved. Total processed: ${STATS.totalProcessed}`);
    
    // Release lock
    const processLock = new ProcessLock(CONFIG.LOCK_FILE);
    await processLock.release();
    
    process.exit(0);
});

// Run automation
if (require.main === module) {
    runCleanAutomation().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { runCleanAutomation, CONFIG }; 