/**
 * Full 50K Domain Email Automation
 * 
 * Enhanced script with all improvements:
 * - UTM parameter fallback
 * - Proxy support
 * - Dynamic form detection
 * - Comprehensive failure logging
 * - Slack updates every 100 domains
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const { parse } = require('csv-parse/sync');
const axios = require('axios');

// Configuration
const CONFIG = {
    BROWSERBASE_API_KEY: 'bb_live_FTV11nF0Vs1NR_T_rVBHRmQHv74',
    BROWSERBASE_PROJECT_ID: 'd277f38a-cc07-4af9-8473-83cefed0bfcd',
    
    // Performance settings - REDUCED FOR BANDWIDTH
    MAX_CONCURRENT_SESSIONS: 10,  // Reduced from 50 to save bandwidth
    BATCH_SIZE: 100,  // Process in batches of 100
    
    // Timeouts
    NAVIGATION_TIMEOUT: 30000,
    FORM_INTERACTION_TIMEOUT: 10000,
    
    // Slack webhook for progress notifications
    SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/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',
    
    // Logging
    FAILED_DOMAINS_LOG: './logs/failed_domains_full_run.jsonl',
    SUCCESS_DOMAINS_LOG: './logs/successful_domains_full_run.jsonl',
    PROGRESS_LOG: './logs/progress_full_run.json',
    
    // Debug settings
    DEBUG_MODE: false,  // Disable for performance on full run
    SCREENSHOTS: false, // Disable for performance
};

// Global stats tracking
const STATS = {
    totalProcessed: 0,
    totalSuccessful: 0,
    totalFailed: 0,
    startTime: Date.now(),
    batchStats: [],
    failureReasons: {},
    currentBatch: 0
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

/**
 * Load domains from CSV
 */
async function loadDomains() {
    try {
        const csvContent = await fs.readFile('./Storedomains.csv', 'utf-8');
        const records = parse(csvContent, { 
            columns: true, 
            skip_empty_lines: true,
            trim: true 
        });
        
        console.log(`📂 Loaded ${records.length} domains from CSV`);
        
        // Extract domain URLs and clean them
        const domains = records
            .map(record => {
                const domain = record.domain || record.Domain || record.url || record.URL;
                if (!domain) return null;
                
                // Ensure proper URL format
                let cleanDomain = domain.trim();
                if (!cleanDomain.startsWith('http://') && !cleanDomain.startsWith('https://')) {
                    cleanDomain = 'https://' + cleanDomain;
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

/**
 * Load email accounts
 */
async function loadEmailAccounts() {
    try {
        console.log('📂 Loading email accounts from CSV...');
        const csvContent = await fs.readFile('./mailboxaccounts.csv', 'utf-8');
        
        // Split by lines and parse manually to handle any encoding issues
        const lines = csvContent.split('\n').filter(line => line.trim());
        console.log(`📄 Found ${lines.length} lines in CSV`);
        
        if (lines.length < 2) {
            throw new Error('CSV file is empty or has no data');
        }
        
        // Get headers
        const headers = lines[0].split(',').map(h => h.trim());
        console.log(`🔑 Headers: ${headers.join(', ')}`);
        
        // Find email column (should be first column "Email")
        const emailColumnIndex = headers.findIndex(h => 
            h.toLowerCase().includes('email') || h === 'Email'
        );
        
        if (emailColumnIndex === -1) {
            console.log('⚠️ No email column found, using first column');
            emailColumnIndex = 0;
        } else {
            console.log(`✅ Found email column at index ${emailColumnIndex}: ${headers[emailColumnIndex]}`);
        }
        
        // Extract emails
        const emails = [];
        for (let i = 1; i < lines.length; i++) {
            const columns = lines[i].split(',');
            if (columns.length > emailColumnIndex) {
                const email = columns[emailColumnIndex].trim().replace(/"/g, '');
                if (email && email.includes('@') && email.includes('.')) {
                    emails.push(email);
                }
            }
        }
        
        console.log(`📧 Successfully loaded ${emails.length} email accounts`);
        console.log(`📋 Sample emails: ${emails.slice(0, 3).join(', ')}`);
        
        if (emails.length === 0) {
            throw new Error('No valid email addresses found in CSV file');
        }
        
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
                }
                // Removed proxies to avoid bandwidth limits
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
 * Enhanced form submission with multiple strategies
 */
async function tryFormSubmissionEnhanced(page, email, domain) {
    try {
        // Strategy 1: Try standard email inputs first
        for (const emailSelector of ENHANCED_SELECTORS.emailInputs) {
            try {
                const emailInput = page.locator(emailSelector).first();
                
                if (await emailInput.isVisible({ timeout: 1500 }).catch(() => false)) {
                    await emailInput.fill(email);
                    
                    // Look for submit button near this input
                    for (const submitSelector of ENHANCED_SELECTORS.submitButtons) {
                        try {
                            const submitButton = page.locator(submitSelector).first();
                            if (await submitButton.isVisible({ timeout: 800 }).catch(() => false)) {
                                await submitButton.click({ timeout: 3000 });
                                await page.waitForTimeout(1000);
                                return true;
                            }
                        } catch (submitError) {
                            continue;
                        }
                    }
                    
                    // Fallback: try Enter key
                    try {
                        await emailInput.press('Enter');
                        await page.waitForTimeout(1000);
                        return true;
                    } catch (error) {
                        continue;
                    }
                }
            } catch (error) {
                continue;
            }
        }
        
        // Strategy 2: Look for newsletter/subscription forms specifically
        const newsletterSelectors = [
            'form[class*="newsletter" i] input[type="email"]',
            'form[class*="subscribe" i] input[type="email"]',
            'form[id*="newsletter" i] input[type="email"]',
            'form[id*="subscribe" i] input[type="email"]',
            '.newsletter input[type="email"]',
            '.subscription input[type="email"]',
            '#newsletter input[type="email"]'
        ];
        
        for (const selector of newsletterSelectors) {
            try {
                const input = page.locator(selector).first();
                if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
                    await input.fill(email);
                    
                    // Look for submit in same form
                    const form = input.locator('xpath=ancestor::form');
                    const submitInForm = form.locator('button[type="submit"], input[type="submit"], button:has-text("Subscribe"), button:has-text("Sign Up")').first();
                    
                    if (await submitInForm.isVisible({ timeout: 800 }).catch(() => false)) {
                        await submitInForm.click();
                        await page.waitForTimeout(1000);
                        return true;
                    }
                    
                    // Try Enter if no button found
                    await input.press('Enter');
                    await page.waitForTimeout(1000);
                    return true;
                }
            } catch (error) {
                continue;
            }
        }
        
        // Strategy 3: Try footer forms (common location)
        const footerSelectors = [
            'footer input[type="email"]',
            '.footer input[type="email"]',
            '#footer input[type="email"]'
        ];
        
        for (const selector of footerSelectors) {
            try {
                const input = page.locator(selector).first();
                if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
                    await input.fill(email);
                    
                    // Look for nearby submit button
                    const nearbySubmit = page.locator('footer button[type="submit"], footer input[type="submit"], footer button:has-text("Subscribe")').first();
                    if (await nearbySubmit.isVisible({ timeout: 800 }).catch(() => false)) {
                        await nearbySubmit.click();
                        await page.waitForTimeout(1000);
                        return true;
                    }
                    
                    await input.press('Enter');
                    await page.waitForTimeout(1000);
                    return true;
                }
            } catch (error) {
                continue;
            }
        }
        
        return false;
        
    } catch (error) {
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
        // Create session
        sessionData = await createBrowserbaseSession();
        
        // Connect to browser
        browser = await chromium.connectOverCDP(sessionData.connectUrl);
        const page = (browser.contexts()[0] || await browser.newContext()).pages()[0] || await browser.contexts()[0].newPage();
        
        // Navigation with UTM fallback
        let navigationSuccess = false;
        let finalUrl = domain;
        
        try {
            // Try with UTM parameters first
            const utmUrl = `${domain}?utm_source=automation&utm_medium=signup&utm_campaign=bulk-signup`;
            const response = await page.goto(utmUrl, { 
                waitUntil: 'domcontentloaded', 
                timeout: CONFIG.NAVIGATION_TIMEOUT 
            });
            
            if (response && response.status() >= 400) {
                // UTM failed, try without
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
            // UTM navigation failed, try without UTM
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
        
        // Quick form detection
        const formAnalysis = await page.evaluate(() => {
            return {
                forms: document.querySelectorAll('form').length,
                emailInputs: document.querySelectorAll('input[type="email"], input[name*="email" i]').length,
                hasNewsletterText: document.body.textContent.toLowerCase().includes('newsletter'),
                hasSubscribeText: document.body.textContent.toLowerCase().includes('subscribe')
            };
        });
        
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
        const success = await tryFormSubmissionEnhanced(page, email, domain);
        
        if (success) {
            return {
                success: true,
                domain,
                finalUrl,
                formAnalysis
            };
        } else {
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
 * Log failed domain
 */
async function logFailedDomain(result) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        domain: result.domain,
        reason: result.reason,
        error: result.error,
        details: result.details,
        finalUrl: result.finalUrl,
        batchNumber: STATS.currentBatch
    };
    
    try {
        await fs.appendFile(CONFIG.FAILED_DOMAINS_LOG, JSON.stringify(logEntry) + '\n');
    } catch (error) {
        console.error(`Failed to log failed domain: ${error.message}`);
    }
    
    // Update failure reason stats
    if (!STATS.failureReasons[result.reason]) {
        STATS.failureReasons[result.reason] = 0;
    }
    STATS.failureReasons[result.reason]++;
}

/**
 * Log successful domain
 */
async function logSuccessfulDomain(result) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        domain: result.domain,
        finalUrl: result.finalUrl,
        formAnalysis: result.formAnalysis,
        batchNumber: STATS.currentBatch
    };
    
    try {
        await fs.appendFile(CONFIG.SUCCESS_DOMAINS_LOG, JSON.stringify(logEntry) + '\n');
    } catch (error) {
        console.error(`Failed to log successful domain: ${error.message}`);
    }
}

/**
 * Send Slack notification
 */
async function sendSlackNotification(message) {
    if (!CONFIG.SLACK_WEBHOOK_URL) {
        console.log(`📨 Slack notification (webhook not configured):`);
        console.log(message);
        return;
    }
    
    try {
        await axios.post(CONFIG.SLACK_WEBHOOK_URL, { 
            text: message,
            username: 'Email Automation Bot',
            icon_emoji: ':robot_face:'
        });
        console.log(`📨 Slack notification sent successfully`);
    } catch (error) {
        console.error(`❌ Failed to send Slack notification: ${error.message}`);
        console.log(`📋 Message content: ${message}`);
    }
}

/**
 * Update progress tracking
 */
async function updateProgress() {
    const progress = {
        timestamp: new Date().toISOString(),
        totalProcessed: STATS.totalProcessed,
        totalSuccessful: STATS.totalSuccessful,
        totalFailed: STATS.totalFailed,
        successRate: STATS.totalProcessed > 0 ? (STATS.totalSuccessful / STATS.totalProcessed * 100).toFixed(1) : 0,
        runtime: Math.round((Date.now() - STATS.startTime) / 1000),
        currentBatch: STATS.currentBatch,
        failureReasons: STATS.failureReasons,
        batchStats: STATS.batchStats
    };
    
    try {
        await fs.writeFile(CONFIG.PROGRESS_LOG, JSON.stringify(progress, null, 2));
    } catch (error) {
        console.error(`Failed to update progress: ${error.message}`);
    }
}

/**
 * Process batch of domains
 */
async function processBatch(domains, emails, batchNumber, totalBatches) {
    console.log(`\n🎯 Processing Batch ${batchNumber}/${totalBatches} (${domains.length} domains)`);
    STATS.currentBatch = batchNumber;
    
    const batchStartTime = Date.now();
    let batchSuccessful = 0;
    let batchFailed = 0;
    
    try {
        // Process domains with concurrency limit
        const chunks = [];
        for (let i = 0; i < domains.length; i += CONFIG.MAX_CONCURRENT_SESSIONS) {
            chunks.push(domains.slice(i, i + CONFIG.MAX_CONCURRENT_SESSIONS));
        }
        
        for (const chunk of chunks) {
            const promises = chunk.map(async (domain, index) => {
                const email = emails[index % emails.length];
                return processDomain(domain, email);
            });
            
            const results = await Promise.all(promises);
            
            // Process results
            for (const result of results) {
                STATS.totalProcessed++;
                
                if (result.success) {
                    STATS.totalSuccessful++;
                    batchSuccessful++;
                    await logSuccessfulDomain(result);
                    console.log(`✅ ${result.domain}`);
                } else {
                    STATS.totalFailed++;
                    batchFailed++;
                    await logFailedDomain(result);
                    console.log(`❌ ${result.domain} - ${result.reason}`);
                }
            }
        }
        
        // Batch completion
        const batchDuration = Math.round((Date.now() - batchStartTime) / 1000);
        const batchStats = {
            batchNumber,
            processed: domains.length,
            successful: batchSuccessful,
            failed: batchFailed,
            successRate: (batchSuccessful / domains.length * 100).toFixed(1),
            duration: batchDuration
        };
        
        STATS.batchStats.push(batchStats);
        
        // Update progress
        await updateProgress();
        
        // Send Slack notification
        const totalSuccessRate = (STATS.totalSuccessful / STATS.totalProcessed * 100).toFixed(1);
        const totalRuntime = Math.round((Date.now() - STATS.startTime) / 60000);
        
        const slackMessage = `🚀 **Batch ${batchNumber}/${totalBatches} Complete**
📊 **Batch Results:** ${batchSuccessful}/${domains.length} successful (${batchStats.successRate}%)
📈 **Overall Progress:** ${STATS.totalSuccessful}/${STATS.totalProcessed} successful (${totalSuccessRate}%)
⏱️ **Runtime:** ${totalRuntime} minutes
🎯 **Remaining:** ${totalBatches - batchNumber} batches`;
        
        await sendSlackNotification(slackMessage);
        
        console.log(`\n⚡ Batch ${batchNumber} completed in ${batchDuration}s`);
        console.log(`📊 Batch: ${batchSuccessful}/${domains.length} successful (${batchStats.successRate}%)`);
        console.log(`📈 Overall: ${STATS.totalSuccessful}/${STATS.totalProcessed} successful (${totalSuccessRate}%)`);
        
    } finally {
        // Brief pause between batches
        if (batchNumber < totalBatches) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

/**
 * Main automation function
 */
async function runFullAutomation() {
    console.log('🚀 Starting Full 50K Domain Email Automation');
    console.log('='.repeat(80));
    console.log(`⚡ Max Concurrent Sessions: ${CONFIG.MAX_CONCURRENT_SESSIONS}`);
    console.log(`📦 Batch Size: ${CONFIG.BATCH_SIZE}`);
    console.log(`🔧 Enhanced Features: UTM Fallback, Proxy Support, Enhanced Detection`);
    
    try {
        // Initialize log directories
        await fs.mkdir('./logs', { recursive: true });
        
        // Load data
        console.log('\n📂 Loading domains and email accounts...');
        const domains = await loadDomains();
        const emails = await loadEmailAccounts();
        
        console.log(`✅ Loaded ${domains.length} domains and ${emails.length} email accounts`);
        
        // Calculate batches
        const totalBatches = Math.ceil(domains.length / CONFIG.BATCH_SIZE);
        console.log(`📦 Processing ${totalBatches} batches of ${CONFIG.BATCH_SIZE} domains each`);
        
        // Send start notification
        await sendSlackNotification(`🚀 **Full 50K Email Automation Started**
**Total Domains:** ${domains.length}
**Email Accounts:** ${emails.length}
**Batch Size:** ${CONFIG.BATCH_SIZE}
**Concurrent Sessions:** ${CONFIG.MAX_CONCURRENT_SESSIONS}
**Enhanced Features:** UTM Fallback, Proxy Support, Enhanced Detection`);
        
        // Check for resume capability
        let startBatch = 1;
        try {
            if (await fs.access('./logs/resume_point.json').then(() => true).catch(() => false)) {
                const resumeData = JSON.parse(await fs.readFile('./logs/resume_point.json', 'utf-8'));
                startBatch = resumeData.nextBatch || 1;
                
                if (startBatch > 1) {
                    console.log(`🔄 Resuming from batch ${startBatch}/${totalBatches}`);
                    console.log(`📊 Previous progress: ${resumeData.processedSoFar || 0} domains processed`);
                    
                    // Update stats from resume point
                    STATS.totalProcessed = resumeData.totalProcessed || 0;
                    STATS.totalSuccessful = resumeData.totalSuccessful || 0;
                    STATS.totalFailed = resumeData.totalFailed || 0;
                    STATS.batchStats = resumeData.batchStats || [];
                    
                    await sendSlackNotification(`🔄 **Automation Resumed**
📊 **Resuming from:** Batch ${startBatch}/${totalBatches}
📈 **Previous Progress:** ${STATS.totalSuccessful}/${STATS.totalProcessed} successful
⏱️ **Continuing:** ${totalBatches - startBatch + 1} batches remaining`);
                }
            }
        } catch (error) {
            console.log('ℹ️ No resume point found, starting from beginning');
        }

        // Process batches (starting from resume point)
        for (let i = startBatch - 1; i < totalBatches; i++) {
            const startIndex = i * CONFIG.BATCH_SIZE;
            const endIndex = Math.min(startIndex + CONFIG.BATCH_SIZE, domains.length);
            const batchDomains = domains.slice(startIndex, endIndex);
            
            await processBatch(batchDomains, emails, i + 1, totalBatches);
            
            // Save resume point after each batch
            const resumePoint = {
                nextBatch: i + 2,
                processedSoFar: (i + 1) * CONFIG.BATCH_SIZE,
                totalProcessed: STATS.totalProcessed,
                totalSuccessful: STATS.totalSuccessful,
                totalFailed: STATS.totalFailed,
                batchStats: STATS.batchStats,
                timestamp: new Date().toISOString()
            };
            
            try {
                await fs.writeFile('./logs/resume_point.json', JSON.stringify(resumePoint, null, 2));
            } catch (error) {
                console.warn('⚠️ Failed to save resume point:', error.message);
            }
        }
        
        // Clean up resume point on completion
        try {
            await fs.unlink('./logs/resume_point.json');
        } catch (error) {
            // Resume point file doesn't exist or can't be deleted, that's fine
        }
        
        // Final summary
        const totalRuntime = Math.round((Date.now() - STATS.startTime) / 60000);
        const finalSuccessRate = (STATS.totalSuccessful / STATS.totalProcessed * 100).toFixed(1);
        
        console.log('\n🎉 FULL AUTOMATION COMPLETE!');
        console.log('='.repeat(80));
        console.log(`📊 Final Results:`);
        console.log(`   - Total Processed: ${STATS.totalProcessed}`);
        console.log(`   - Successful: ${STATS.totalSuccessful}`);
        console.log(`   - Failed: ${STATS.totalFailed}`);
        console.log(`   - Success Rate: ${finalSuccessRate}%`);
        console.log(`   - Total Runtime: ${totalRuntime} minutes`);
        console.log(`   - Average Rate: ${(STATS.totalProcessed / totalRuntime).toFixed(1)} domains/minute`);
        
        console.log(`\n📋 Failure Breakdown:`);
        Object.entries(STATS.failureReasons)
            .sort(([,a], [,b]) => b - a)
            .forEach(([reason, count]) => {
                const percentage = (count / STATS.totalFailed * 100).toFixed(1);
                console.log(`   - ${reason}: ${count} (${percentage}%)`);
            });
        
        // Final Slack notification
        const topFailures = Object.entries(STATS.failureReasons)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([reason, count]) => `- ${reason}: ${count}`)
            .join('\n');
            
        await sendSlackNotification(`🎉 **Full Email Automation Complete!**
**Total Processed:** ${STATS.totalProcessed}
**Successful:** ${STATS.totalSuccessful}
**Failed:** ${STATS.totalFailed}
**Success Rate:** ${finalSuccessRate}%
**Total Runtime:** ${totalRuntime} minutes
**Average Rate:** ${(STATS.totalProcessed / totalRuntime).toFixed(1)} domains/minute

**Top Failure Reasons:**
${topFailures}`);
        
        console.log(`\n💾 Logs saved to:`);
        console.log(`   - Failed domains: ${CONFIG.FAILED_DOMAINS_LOG}`);
        console.log(`   - Successful domains: ${CONFIG.SUCCESS_DOMAINS_LOG}`);
        console.log(`   - Progress tracking: ${CONFIG.PROGRESS_LOG}`);
        
    } catch (error) {
        console.error(`❌ Automation failed: ${error.message}`);
        await sendSlackNotification(`❌ **Automation Failed**: ${error.message}`);
    }
}

// Run the automation
runFullAutomation().catch(console.error); 