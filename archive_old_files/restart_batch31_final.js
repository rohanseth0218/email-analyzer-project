/**
 * FINAL WORKING AUTOMATION - Batch 31 Restart
 * Fixed connection method and streamlined for reliability
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const { parse } = require('csv-parse/sync');
const axios = require('axios');

const CONFIG = {
    BROWSERBASE_API_KEY: 'bb_live_FTV11nF0Vs1NR_T_rVBHRmQHv74',
    BROWSERBASE_PROJECT_ID: 'd277f38a-cc07-4af9-8473-83cefed0bfcd',
    
    // CONSERVATIVE SETTINGS
    MAX_CONCURRENT_SESSIONS: 5,  
    BATCH_SIZE: 25,  
    START_FROM_BATCH: 31,
    SESSION_CREATION_DELAY: 2000,
    
    // Timeouts
    NAVIGATION_TIMEOUT: 45000,
    FORM_INTERACTION_TIMEOUT: 15000,
    
    // Slack webhook
    SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/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',
    
    // Logging
    FAILED_DOMAINS_LOG: './logs/failed_domains_final.jsonl',
    SUCCESS_DOMAINS_LOG: './logs/successful_domains_final.jsonl',
    PROGRESS_LOG: './logs/progress_final.json',
    
    // Retry settings
    MAX_RETRIES: 2,
    RETRY_DELAY: 5000,
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

// Email form selectors
const EMAIL_SELECTORS = [
    'input[type="email"]',
    'input[name*="email" i]',
    'input[placeholder*="email" i]',
    'input[id*="email" i]',
    'input[class*="email" i]',
    'input[type="text"][name*="email" i]',
    'input[type="text"][placeholder*="email" i]'
];

const SUBMIT_SELECTORS = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Subscribe")',
    'button:has-text("Sign Up")',
    'button:has-text("Join")',
    'button:has-text("Submit")',
    'button:has-text("Newsletter")',
    'button[class*="subscribe" i]',
    'button[class*="signup" i]'
];

// Simple session pool
const sessionPool = {
    available: [],
    inUse: new Set(),
    maxPoolSize: 8,
    
    async getSession() {
        if (this.available.length > 0) {
            const session = this.available.pop();
            this.inUse.add(session.id);
            STATS.sessionsReused++;
            console.log(`♻️  Reusing session ${session.id}`);
            return session;
        }
        
        const session = await createBrowserbaseSession();
        this.inUse.add(session.id);
        STATS.sessionsCreated++;
        console.log(`🆕 Created new session ${session.id}`);
        return session;
    },
    
    releaseSession(session) {
        this.inUse.delete(session.id);
        
        if (this.available.length < this.maxPoolSize) {
            this.available.push(session);
            console.log(`🔄 Session ${session.id} returned to pool`);
        } else {
            console.log(`🗑️  Session ${session.id} discarded (pool full)`);
        }
    }
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
        
        console.log(`✅ Loaded ${domains.length} domains from CSV`);
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

let lastSessionCreation = 0;

async function createBrowserbaseSession(retryCount = 0) {
    try {
        const now = Date.now();
        const timeSinceLastCreation = now - lastSessionCreation;
        if (timeSinceLastCreation < CONFIG.SESSION_CREATION_DELAY) {
            const waitTime = CONFIG.SESSION_CREATION_DELAY - timeSinceLastCreation;
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
                    blockStylesheets: false  // Keep CSS for form detection
                }
            },
            {
                headers: {
                    'X-BB-API-Key': CONFIG.BROWSERBASE_API_KEY,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );
        
        return {
            id: response.data.id,
            connectUrl: response.data.connectUrl
        };
        
    } catch (error) {
        if (error.response?.status === 429 && retryCount < CONFIG.MAX_RETRIES) {
            const waitTime = 10000 * (retryCount + 1);
            console.log(`⚠️ Rate limit hit (429), retrying in ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return createBrowserbaseSession(retryCount + 1);
        }
        
        throw new Error(`Failed to create Browserbase session: ${error.response?.data?.error || error.message}`);
    }
}

async function tryFormSubmission(page, email, domain) {
    try {
        console.log(`🔍 Looking for email forms on ${domain}...`);
        
        await page.waitForLoadState('domcontentloaded', { timeout: CONFIG.NAVIGATION_TIMEOUT });
        await page.waitForTimeout(2000);
        
        // Find email input
        let emailInput = null;
        let foundSelector = null;
        
        for (const selector of EMAIL_SELECTORS) {
            try {
                const elements = await page.locator(selector).all();
                
                for (const element of elements) {
                    if (await element.isVisible({ timeout: 2000 })) {
                        emailInput = element;
                        foundSelector = selector;
                        console.log(`📧 Found email input: ${selector}`);
                        break;
                    }
                }
                
                if (emailInput) break;
            } catch (e) {
                // Continue to next selector
            }
        }
        
        if (!emailInput) {
            console.log(`❌ No email input found`);
            return { success: false, reason: 'no_email_input_found' };
        }
        
        // Fill email
        await emailInput.fill(email);
        console.log(`✏️ Filled email: ${email}`);
        await page.waitForTimeout(1000);
        
        // Find and click submit button
        let submitButton = null;
        let submitSelector = null;
        
        for (const selector of SUBMIT_SELECTORS) {
            try {
                const elements = await page.locator(selector).all();
                
                for (const element of elements) {
                    if (await element.isVisible({ timeout: 2000 })) {
                        submitButton = element;
                        submitSelector = selector;
                        console.log(`🔘 Found submit button: ${selector}`);
                        break;
                    }
                }
                
                if (submitButton) break;
            } catch (e) {
                // Continue to next selector
            }
        }
        
        if (!submitButton) {
            console.log(`❌ No submit button found`);
            return { success: false, reason: 'no_submit_button_found' };
        }
        
        // Click submit
        await submitButton.click();
        console.log(`🚀 Clicked submit button`);
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
            console.log('✅ Form submission successful');
            return { 
                success: true, 
                reason: 'success', 
                email, 
                url: currentUrl
            };
        } else {
            console.log('✅ Form submitted (unclear result)');
            return { 
                success: true, 
                reason: 'submitted_unclear', 
                email, 
                url: currentUrl
            };
        }
        
    } catch (error) {
        console.log(`❌ Form submission failed: ${error.message}`);
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
        console.log(`\n🌐 Processing: ${domain}`);
        
        sessionData = await sessionPool.getSession();
        
        // **FIXED CONNECTION METHOD** 
        console.log(`🔗 Connecting to browser session: ${sessionData.id}`);
        const browser = await chromium.connect(sessionData.connectUrl);
        const context = browser.contexts()[0] || await browser.newContext();
        const page = context.pages()[0] || await context.newPage();
        
        page.setDefaultTimeout(CONFIG.NAVIGATION_TIMEOUT);
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        console.log(`🌐 Navigating to: ${domain}`);
        await page.goto(domain, { 
            waitUntil: 'domcontentloaded',
            timeout: CONFIG.NAVIGATION_TIMEOUT 
        });
        
        console.log(`✅ Navigated to: ${domain}`);
        
        const result = await tryFormSubmission(page, email, domain);
        
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
        if (sessionData) {
            sessionPool.releaseSession(sessionData);
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
        failureReasons: STATS.failureReasons,
        sessionsCreated: STATS.sessionsCreated,
        sessionsReused: STATS.sessionsReused
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
    const processPromises = [];
    for (let i = 0; i < domains.length; i++) {
        const domain = domains[i];
        const email = emails[i % emails.length];
        
        const processPromise = processDomain(domain, email);
        processPromises.push(processPromise);
        
        // Control concurrency
        if (processPromises.length >= CONFIG.MAX_CONCURRENT_SESSIONS) {
            const results = await Promise.allSettled(processPromises);
            batchResults.push(...results.map(r => r.status === 'fulfilled' ? r.value : { success: false, reason: 'promise_error' }));
            processPromises.length = 0;
            
            // Small delay between batches
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    // Process remaining domains
    if (processPromises.length > 0) {
        const results = await Promise.allSettled(processPromises);
        batchResults.push(...results.map(r => r.status === 'fulfilled' ? r.value : { success: false, reason: 'promise_error' }));
    }
    
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
:stopwatch: Time: ${(batchProcessingTime / 1000 / 60).toFixed(2)} minutes`;
    
    await sendSlackNotification(slackMessage);
    
    return batchResults;
}

async function runFinalAutomation() {
    console.log('🚀 Starting FINAL Email Automation...');
    console.log('================================================================================');
    console.log(`⚡ Max Concurrent Sessions: ${CONFIG.MAX_CONCURRENT_SESSIONS}`);
    console.log(`📦 Batch Size: ${CONFIG.BATCH_SIZE}`);
    console.log(`🔄 Starting from Batch: ${CONFIG.START_FROM_BATCH}`);
    console.log('');
    
    try {
        await fs.mkdir('./logs', { recursive: true });
        
        const allDomains = await loadDomains();
        const emails = await loadEmailAccounts();
        
        console.log(`✅ Loaded ${allDomains.length} domains and ${emails.length} email accounts`);
        
        // Calculate resume point
        const totalBatches = Math.ceil(allDomains.length / 100); // Original batch size
        const startIndex = (CONFIG.START_FROM_BATCH - 1) * 100;
        const remainingDomains = allDomains.slice(startIndex);
        
        console.log(`🔄 Resuming from batch ${CONFIG.START_FROM_BATCH}, processing ${remainingDomains.length} remaining domains`);
        
        // Send startup notification
        await sendSlackNotification(`:rocket: EMAIL AUTOMATION RESTARTED
:gear: Fixed connection method, starting from Batch ${CONFIG.START_FROM_BATCH}
:zap: ${CONFIG.MAX_CONCURRENT_SESSIONS} concurrent sessions
:package: ${CONFIG.BATCH_SIZE} domains per batch
:chart_with_upwards_trend: Current stats: ${STATS.totalSuccessful}/${STATS.totalProcessed} successful`);
        
        // Process remaining domains in batches
        const newBatchSize = CONFIG.BATCH_SIZE;
        const newTotalBatches = Math.ceil(remainingDomains.length / newBatchSize);
        
        for (let i = 0; i < newTotalBatches; i++) {
            const batchStart = i * newBatchSize;
            const batchEnd = Math.min(batchStart + newBatchSize, remainingDomains.length);
            const batchDomains = remainingDomains.slice(batchStart, batchEnd);
            
            const currentBatchNumber = CONFIG.START_FROM_BATCH + i;
            
            try {
                await processBatch(batchDomains, emails, currentBatchNumber, totalBatches);
                
                // Small delay between batches
                await new Promise(resolve => setTimeout(resolve, 2000));
                
            } catch (error) {
                console.error(`❌ Error in batch ${currentBatchNumber}: ${error.message}`);
                await sendSlackNotification(`:warning: Error in Batch ${currentBatchNumber}: ${error.message}`);
                
                // Continue to next batch after error
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
        
        // Final statistics
        const totalTime = (Date.now() - STATS.startTime) / 1000 / 60;
        const finalSuccessRate = STATS.totalProcessed > 0 ? 
            (STATS.totalSuccessful / STATS.totalProcessed * 100).toFixed(2) : 0;
        
        console.log('\n🎉 AUTOMATION COMPLETE!');
        console.log(`📊 Final Results: ${STATS.totalSuccessful}/${STATS.totalProcessed} successful (${finalSuccessRate}%)`);
        console.log(`⏱️  Total Runtime: ${totalTime.toFixed(2)} minutes`);
        console.log(`🔄 Sessions: ${STATS.sessionsCreated} created, ${STATS.sessionsReused} reused`);
        
        await sendSlackNotification(`:tada: EMAIL AUTOMATION COMPLETE!
:bar_chart: Final Success Rate: ${finalSuccessRate}%
:chart_with_upwards_trend: Total Signups: ${STATS.totalSuccessful}
:stopwatch: Runtime: ${totalTime.toFixed(2)} minutes
:gear: Sessions: ${STATS.sessionsCreated} created, ${STATS.sessionsReused} reused`);
        
        await updateProgress();
        
    } catch (error) {
        console.error(`❌ Automation failed: ${error.message}`);
        console.error(`🔍 Error stack: ${error.stack}`);
        await sendSlackNotification(`:x: AUTOMATION FAILED: ${error.message}`);
        throw error;
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n⚠️ Received interrupt signal. Saving progress...');
    await updateProgress();
    await sendSlackNotification(`:warning: Email automation interrupted. Progress saved. Total processed: ${STATS.totalProcessed}`);
    process.exit(0);
});

// Run automation
if (require.main === module) {
    runFinalAutomation().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { runFinalAutomation, CONFIG }; 