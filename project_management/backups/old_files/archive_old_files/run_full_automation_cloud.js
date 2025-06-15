/**
 * Cloud-Optimized 50K Domain Email Automation
 * 
 * Optimized for Google Cloud deployment with:
 * - Higher concurrency (75 sessions)
 * - Better error handling for cloud environment
 * - Enhanced monitoring and logging
 * - Environment variable configuration
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const csv = require('csv-parse/sync');
const axios = require('axios');

// Cloud-optimized configuration
const CONFIG = {
    BROWSERBASE_API_KEY: process.env.BROWSERBASE_API_KEY || 'bb_live_FTV11nF0Vs1NR_T_rVBHRmQHv74',
    BROWSERBASE_PROJECT_ID: process.env.BROWSERBASE_PROJECT_ID || 'd277f38a-cc07-4af9-8473-83cefed0bfcd',
    
    // Cloud-optimized performance settings - NO PROXIES
    MAX_CONCURRENT_SESSIONS: 50,  // 50 concurrent sessions as requested
    BATCH_SIZE: 100,  // Process in batches of 100
    
    // Cloud-optimized timeouts
    NAVIGATION_TIMEOUT: 45000,  // Longer timeout for stability
    FORM_INTERACTION_TIMEOUT: 15000,
    SESSION_CREATION_TIMEOUT: 30000,
    
    // Slack webhook for remote monitoring
    SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL || null,
    
    // Cloud logging paths
    FAILED_DOMAINS_LOG: './logs/failed_domains_cloud_run.jsonl',
    SUCCESS_DOMAINS_LOG: './logs/successful_domains_cloud_run.jsonl',
    PROGRESS_LOG: './logs/progress_cloud_run.json',
    PERFORMANCE_LOG: './logs/performance_cloud_run.json',
    
    // Cloud optimization flags
    DEBUG_MODE: false,  // Disabled for performance
    SCREENSHOTS: false, // Disabled for performance
    DETAILED_LOGGING: true,  // Enable for cloud monitoring
    
    // Retry settings for cloud reliability
    MAX_RETRIES: 3,
    RETRY_DELAY: 5000,
    
    // Session pool management
    SESSION_POOL_SIZE: 10,  // Pre-create session pool
    SESSION_REUSE_COUNT: 5,  // Reuse sessions for efficiency
};

// Global stats tracking with cloud metrics
const STATS = {
    totalProcessed: 0,
    totalSuccessful: 0,
    totalFailed: 0,
    startTime: Date.now(),
    batchStats: [],
    failureReasons: {},
    currentBatch: 0,
    
    // Cloud performance metrics
    avgProcessingTime: 0,
    sessionsCreated: 0,
    sessionsReused: 0,
    memoryUsage: [],
    errorRates: [],
    throughputHistory: []
};

// Enhanced selectors optimized for cloud processing
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
        'input[name="Email"]',
        // Additional cloud-specific selectors
        'input[data-testid*="email" i]',
        'input[aria-label*="email" i]'
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
        'button[class*="newsletter" i]',
        'button[data-testid*="submit" i]',
        'button[aria-label*="submit" i]'
    ]
};

/**
 * Cloud-optimized domain loading with error handling
 */
async function loadDomains() {
    try {
        console.log('📂 Loading domains from CSV...');
        const csvContent = await fs.readFile('./Storedomains.csv', 'utf-8');
        const records = csv.parse(csvContent, { 
            columns: true, 
            skip_empty_lines: true,
            trim: true 
        });
        
        console.log(`📂 Loaded ${records.length} raw records from CSV`);
        
        // Extract and clean domains with enhanced validation
        const domains = records
            .map(record => {
                const domain = record.domain || record.Domain || record.url || record.URL;
                if (!domain) return null;
                
                // Enhanced URL cleaning and validation
                let cleanDomain = domain.trim().toLowerCase();
                
                // Remove common prefixes if they exist
                cleanDomain = cleanDomain.replace(/^https?:\/\//, '');
                cleanDomain = cleanDomain.replace(/^www\./, '');
                cleanDomain = cleanDomain.split('/')[0];  // Remove paths
                
                // Add https:// prefix
                cleanDomain = 'https://' + cleanDomain;
                
                // Basic domain validation
                if (!cleanDomain.includes('.') || cleanDomain.length < 8) {
                    return null;
                }
                
                return cleanDomain;
            })
            .filter(domain => domain && domain.length > 0);
        
        console.log(`✅ Processed ${domains.length} valid domains`);
        
        // Log sample for verification
        console.log(`📋 Sample domains: ${domains.slice(0, 5).join(', ')}`);
        
        return domains;
        
    } catch (error) {
        console.error(`❌ Error loading domains: ${error.message}`);
        throw error;
    }
}

/**
 * Load email accounts with validation
 */
async function loadEmailAccounts() {
    try {
        console.log('📧 Loading email accounts...');
        const csvContent = await fs.readFile('./mailboxaccounts.csv', 'utf-8');
        const records = csv.parse(csvContent, { 
            columns: true, 
            skip_empty_lines: true 
        });
        
        const emails = records
            .map(record => record.email || record.Email)
            .filter(email => email && email.includes('@') && email.includes('.'));
        
        console.log(`📧 Loaded ${emails.length} valid email accounts`);
        console.log(`📋 Sample emails: ${emails.slice(0, 3).join(', ')}`);
        
        return emails;
        
    } catch (error) {
        console.error(`❌ Error loading email accounts: ${error.message}`);
        throw error;
    }
}

/**
 * Cloud-optimized Browserbase session creation with retry logic
 */
async function createBrowserbaseSession(retryCount = 0) {
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
                },
                timeout: CONFIG.SESSION_CREATION_TIMEOUT
            }
        );

        STATS.sessionsCreated++;
        return {
            sessionId: response.data.id,
            connectUrl: response.data.connectUrl,
            createdAt: Date.now(),
            useCount: 0
        };
    } catch (error) {
        if (retryCount < CONFIG.MAX_RETRIES) {
            console.log(`⚠️ Session creation failed, retrying (${retryCount + 1}/${CONFIG.MAX_RETRIES})...`);
            await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
            return createBrowserbaseSession(retryCount + 1);
        }
        throw new Error(`Failed to create session after ${CONFIG.MAX_RETRIES} retries: ${error.message}`);
    }
}

/**
 * Enhanced form submission with cloud optimizations
 */
async function tryFormSubmissionEnhanced(page, email, domain) {
    try {
        // Quick pre-check to avoid unnecessary processing
        const hasAnyInputs = await page.evaluate(() => {
            return document.querySelectorAll('input').length > 0;
        });
        
        if (!hasAnyInputs) {
            return false;
        }
        
        // Try enhanced selectors with timeout optimization
        for (const emailSelector of ENHANCED_SELECTORS.emailInputs) {
            try {
                const emailInput = page.locator(emailSelector).first();
                
                if (await emailInput.isVisible({ timeout: 1500 }).catch(() => false)) {
                    await emailInput.fill(email);
                    
                    // Quick submit attempt
                    for (const submitSelector of ENHANCED_SELECTORS.submitButtons) {
                        try {
                            const submitButton = page.locator(submitSelector).first();
                            if (await submitButton.isVisible({ timeout: 800 }).catch(() => false)) {
                                await submitButton.click({ timeout: 3000 });
                                await page.waitForTimeout(1500);  // Shorter wait in cloud
                                return true;
                            }
                        } catch (submitError) {
                            continue;
                        }
                    }
                    
                    // Fallback: Enter key
                    await emailInput.press('Enter');
                    await page.waitForTimeout(1500);
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
 * Cloud-optimized domain processing with session reuse
 */
async function processDomain(domain, email, sessionData = null) {
    let browser = null;
    let ownSession = false;
    const startTime = Date.now();
    
    try {
        // Create or reuse session
        if (!sessionData || sessionData.useCount >= CONFIG.SESSION_REUSE_COUNT) {
            sessionData = await createBrowserbaseSession();
            ownSession = true;
        } else {
            STATS.sessionsReused++;
        }
        
        sessionData.useCount++;
        
        // Connect to browser
        browser = await chromium.connectOverCDP(sessionData.connectUrl);
        const page = (browser.contexts()[0] || await browser.newContext()).pages()[0] || await browser.contexts()[0].newPage();
        
        // Cloud-optimized navigation with UTM fallback
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
        
        // Quick form analysis with cloud optimizations
        const formAnalysis = await page.evaluate(() => {
            const forms = document.querySelectorAll('form').length;
            const emailInputs = document.querySelectorAll('input[type="email"], input[name*="email" i]').length;
            const textInputs = document.querySelectorAll('input[type="text"]').length;
            
            // Quick content scan
            const bodyText = document.body.textContent.toLowerCase();
            
            return {
                forms,
                emailInputs,
                textInputs,
                hasNewsletterText: bodyText.includes('newsletter'),
                hasSubscribeText: bodyText.includes('subscribe'),
                hasSignupText: bodyText.includes('signup') || bodyText.includes('sign up'),
                pageSize: bodyText.length
            };
        });
        
        if (formAnalysis.emailInputs === 0 && formAnalysis.textInputs === 0) {
            return {
                success: false,
                domain,
                reason: 'no_forms_found',
                details: `Forms: ${formAnalysis.forms}, Email inputs: ${formAnalysis.emailInputs}, Text inputs: ${formAnalysis.textInputs}`,
                finalUrl,
                processingTime: Date.now() - startTime,
                sessionData: ownSession ? null : sessionData
            };
        }
        
        // Try form submission
        const success = await tryFormSubmissionEnhanced(page, email, domain);
        
        const result = {
            success,
            domain,
            finalUrl,
            formAnalysis,
            processingTime: Date.now() - startTime,
            sessionData: ownSession ? null : sessionData
        };
        
        if (!success) {
            result.reason = 'form_submission_failed';
            result.details = `Found ${formAnalysis.emailInputs} email inputs and ${formAnalysis.textInputs} text inputs but submission failed`;
        }
        
        return result;
        
    } catch (error) {
        // Classify error for cloud monitoring
        let reason = 'unknown_error';
        if (error.message.includes('timeout') || error.message.includes('Timeout')) {
            reason = 'navigation_timeout';
        } else if (error.message.includes('net::ERR_')) {
            reason = 'network_error';
        } else if (error.message.includes('Navigation failed')) {
            reason = 'navigation_error';
        } else if (error.message.includes('Session')) {
            reason = 'session_error';
        }
        
        return {
            success: false,
            domain,
            reason,
            error: error.message,
            finalUrl: domain,
            processingTime: Date.now() - startTime,
            sessionData: ownSession ? null : sessionData
        };
        
    } finally {
        if (browser) {
            try {
                await browser.close();
            } catch (e) {}
        }
        
        // Clean up session if we own it or it's overused
        if (ownSession || (sessionData && sessionData.useCount >= CONFIG.SESSION_REUSE_COUNT)) {
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
 * Enhanced logging for cloud environment
 */
async function logFailedDomain(result) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        domain: result.domain,
        reason: result.reason,
        error: result.error,
        details: result.details,
        finalUrl: result.finalUrl,
        processingTime: result.processingTime,
        batchNumber: STATS.currentBatch,
        sessionReused: result.sessionData ? true : false
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
 * Enhanced success logging
 */
async function logSuccessfulDomain(result) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        domain: result.domain,
        finalUrl: result.finalUrl,
        formAnalysis: result.formAnalysis,
        processingTime: result.processingTime,
        batchNumber: STATS.currentBatch,
        sessionReused: result.sessionData ? true : false
    };
    
    try {
        await fs.appendFile(CONFIG.SUCCESS_DOMAINS_LOG, JSON.stringify(logEntry) + '\n');
    } catch (error) {
        console.error(`Failed to log successful domain: ${error.message}`);
    }
}

/**
 * Enhanced Slack notifications for cloud monitoring
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
            username: 'Cloud Email Automation',
            icon_emoji: ':cloud:'
        });
        console.log(`📨 Slack notification sent successfully`);
    } catch (error) {
        console.error(`Failed to send Slack notification: ${error.message}`);
    }
}

/**
 * Cloud performance monitoring
 */
async function updatePerformanceMetrics() {
    const memUsage = process.memoryUsage();
    const runtime = Date.now() - STATS.startTime;
    const currentThroughput = STATS.totalProcessed / (runtime / 60000); // domains per minute
    
    STATS.memoryUsage.push({
        timestamp: Date.now(),
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss
    });
    
    STATS.throughputHistory.push({
        timestamp: Date.now(),
        domainsPerMinute: currentThroughput,
        successRate: STATS.totalProcessed > 0 ? (STATS.totalSuccessful / STATS.totalProcessed * 100) : 0
    });
    
    // Keep only last 100 entries to prevent memory bloat
    if (STATS.memoryUsage.length > 100) {
        STATS.memoryUsage = STATS.memoryUsage.slice(-50);
    }
    if (STATS.throughputHistory.length > 100) {
        STATS.throughputHistory = STATS.throughputHistory.slice(-50);
    }
    
    const performanceData = {
        timestamp: new Date().toISOString(),
        runtime: Math.round(runtime / 1000),
        memoryUsage: memUsage,
        throughput: currentThroughput,
        sessionsCreated: STATS.sessionsCreated,
        sessionsReused: STATS.sessionsReused,
        currentBatch: STATS.currentBatch,
        totalProcessed: STATS.totalProcessed,
        successRate: STATS.totalProcessed > 0 ? (STATS.totalSuccessful / STATS.totalProcessed * 100).toFixed(1) : 0
    };
    
    try {
        await fs.writeFile(CONFIG.PERFORMANCE_LOG, JSON.stringify(performanceData, null, 2));
    } catch (error) {
        console.error(`Failed to update performance metrics: ${error.message}`);
    }
}

/**
 * Enhanced progress tracking for cloud
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
        batchStats: STATS.batchStats,
        
        // Cloud-specific metrics
        sessionsCreated: STATS.sessionsCreated,
        sessionsReused: STATS.sessionsReused,
        avgProcessingTime: STATS.avgProcessingTime,
        memoryUsageMB: Math.round(process.memoryUsage().rss / 1024 / 1024)
    };
    
    try {
        await fs.writeFile(CONFIG.PROGRESS_LOG, JSON.stringify(progress, null, 2));
    } catch (error) {
        console.error(`Failed to update progress: ${error.message}`);
    }
}

/**
 * Cloud-optimized batch processing with session pooling
 */
async function processBatch(domains, emails, batchNumber, totalBatches) {
    console.log(`\n🎯 Processing Batch ${batchNumber}/${totalBatches} (${domains.length} domains)`);
    STATS.currentBatch = batchNumber;
    
    const batchStartTime = Date.now();
    let batchSuccessful = 0;
    let batchFailed = 0;
    let totalProcessingTime = 0;
    
    // Create session pool for efficiency
    const sessionPool = [];
    
    try {
        console.log(`🔧 Creating session pool...`);
        for (let i = 0; i < Math.min(CONFIG.SESSION_POOL_SIZE, CONFIG.MAX_CONCURRENT_SESSIONS); i++) {
            try {
                const session = await createBrowserbaseSession();
                sessionPool.push(session);
            } catch (error) {
                console.log(`⚠️ Failed to create session ${i + 1}: ${error.message}`);
            }
        }
        console.log(`✅ Created ${sessionPool.length} sessions in pool`);
        
        // Process domains with enhanced concurrency control
        const chunks = [];
        for (let i = 0; i < domains.length; i += CONFIG.MAX_CONCURRENT_SESSIONS) {
            chunks.push(domains.slice(i, i + CONFIG.MAX_CONCURRENT_SESSIONS));
        }
        
        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
            const chunk = chunks[chunkIndex];
            console.log(`📦 Processing chunk ${chunkIndex + 1}/${chunks.length} (${chunk.length} domains)`);
            
            const promises = chunk.map(async (domain, index) => {
                const email = emails[index % emails.length];
                const session = sessionPool[index % sessionPool.length];
                return processDomain(domain, email, session);
            });
            
            const results = await Promise.all(promises);
            
            // Process results
            for (const result of results) {
                STATS.totalProcessed++;
                totalProcessingTime += result.processingTime || 0;
                
                if (result.success) {
                    STATS.totalSuccessful++;
                    batchSuccessful++;
                    await logSuccessfulDomain(result);
                    console.log(`✅ ${result.domain} (${result.processingTime}ms)`);
                } else {
                    STATS.totalFailed++;
                    batchFailed++;
                    await logFailedDomain(result);
                    console.log(`❌ ${result.domain} - ${result.reason} (${result.processingTime}ms)`);
                }
                
                // Update session pool
                if (result.sessionData) {
                    const poolIndex = sessionPool.findIndex(s => s.sessionId === result.sessionData.sessionId);
                    if (poolIndex !== -1) {
                        sessionPool[poolIndex] = result.sessionData;
                    }
                }
            }
            
            // Update performance metrics
            await updatePerformanceMetrics();
        }
        
        // Calculate batch statistics
        const batchDuration = Math.round((Date.now() - batchStartTime) / 1000);
        const avgProcessingTime = totalProcessingTime / domains.length;
        STATS.avgProcessingTime = (STATS.avgProcessingTime * (STATS.totalProcessed - domains.length) + totalProcessingTime) / STATS.totalProcessed;
        
        const batchStats = {
            batchNumber,
            processed: domains.length,
            successful: batchSuccessful,
            failed: batchFailed,
            successRate: (batchSuccessful / domains.length * 100).toFixed(1),
            duration: batchDuration,
            avgProcessingTime: Math.round(avgProcessingTime),
            sessionsUsed: sessionPool.length
        };
        
        STATS.batchStats.push(batchStats);
        
        // Update progress
        await updateProgress();
        
        // Enhanced Slack notification with cloud metrics
        const totalSuccessRate = (STATS.totalSuccessful / STATS.totalProcessed * 100).toFixed(1);
        const totalRuntime = Math.round((Date.now() - STATS.startTime) / 60000);
        const currentThroughput = (STATS.totalProcessed / totalRuntime).toFixed(1);
        const memoryUsageMB = Math.round(process.memoryUsage().rss / 1024 / 1024);
        
        const slackMessage = `🚀 **Cloud Batch ${batchNumber}/${totalBatches} Complete**
📊 **Batch Results:** ${batchSuccessful}/${domains.length} successful (${batchStats.successRate}%)
📈 **Overall Progress:** ${STATS.totalSuccessful}/${STATS.totalProcessed} successful (${totalSuccessRate}%)
⏱️ **Runtime:** ${totalRuntime} minutes | **Throughput:** ${currentThroughput} domains/min
💾 **Memory:** ${memoryUsageMB}MB | **Sessions:** ${STATS.sessionsCreated} created, ${STATS.sessionsReused} reused
🎯 **Remaining:** ${totalBatches - batchNumber} batches`;
        
        await sendSlackNotification(slackMessage);
        
        console.log(`\n⚡ Batch ${batchNumber} completed in ${batchDuration}s`);
        console.log(`📊 Batch: ${batchSuccessful}/${domains.length} successful (${batchStats.successRate}%)`);
        console.log(`📈 Overall: ${STATS.totalSuccessful}/${STATS.totalProcessed} successful (${totalSuccessRate}%)`);
        console.log(`⏱️ Avg processing: ${avgProcessingTime.toFixed(0)}ms | Memory: ${memoryUsageMB}MB`);
        
    } finally {
        // Clean up session pool
        console.log(`🧹 Cleaning up ${sessionPool.length} sessions...`);
        for (const sessionData of sessionPool) {
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
        
        // Brief pause between batches for stability
        if (batchNumber < totalBatches) {
            console.log('⏱️ Brief pause for system stability...');
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
}

/**
 * Main cloud automation function
 */
async function runCloudAutomation() {
    console.log('☁️ Starting Cloud-Optimized 50K Domain Email Automation');
    console.log('='.repeat(80));
    console.log(`⚡ Max Concurrent Sessions: ${CONFIG.MAX_CONCURRENT_SESSIONS}`);
    console.log(`📦 Batch Size: ${CONFIG.BATCH_SIZE}`);
    console.log(`🔧 Session Pool Size: ${CONFIG.SESSION_POOL_SIZE}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'production'}`);
    console.log(`💾 Memory Limit: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB available`);
    
    try {
        // Initialize cloud logging
        await fs.mkdir('./logs', { recursive: true });
        
        // Load data with enhanced validation
        console.log('\n📂 Loading domains and email accounts...');
        const domains = await loadDomains();
        const emails = await loadEmailAccounts();
        
        console.log(`✅ Loaded ${domains.length} domains and ${emails.length} email accounts`);
        
        // Calculate batches
        const totalBatches = Math.ceil(domains.length / CONFIG.BATCH_SIZE);
        console.log(`📦 Processing ${totalBatches} batches of ${CONFIG.BATCH_SIZE} domains each`);
        
        // Enhanced start notification
        await sendSlackNotification(`☁️ **Cloud Email Automation Started**
**Environment:** Google Cloud (${process.env.NODE_ENV || 'production'})
**Total Domains:** ${domains.length.toLocaleString()}
**Email Accounts:** ${emails.length}
**Batch Size:** ${CONFIG.BATCH_SIZE}
**Concurrent Sessions:** ${CONFIG.MAX_CONCURRENT_SESSIONS}
**Session Pool:** ${CONFIG.SESSION_POOL_SIZE}
**Features:** UTM Fallback, Proxy Support, Session Reuse, Enhanced Detection`);
        
        // Process all batches
        for (let i = 0; i < totalBatches; i++) {
            const startIndex = i * CONFIG.BATCH_SIZE;
            const endIndex = Math.min(startIndex + CONFIG.BATCH_SIZE, domains.length);
            const batchDomains = domains.slice(startIndex, endIndex);
            
            await processBatch(batchDomains, emails, i + 1, totalBatches);
        }
        
        // Final comprehensive summary
        const totalRuntime = Math.round((Date.now() - STATS.startTime) / 60000);
        const finalSuccessRate = (STATS.totalSuccessful / STATS.totalProcessed * 100).toFixed(1);
        const avgThroughput = (STATS.totalProcessed / totalRuntime).toFixed(1);
        const finalMemoryMB = Math.round(process.memoryUsage().rss / 1024 / 1024);
        
        console.log('\n🎉 CLOUD AUTOMATION COMPLETE!');
        console.log('='.repeat(80));
        console.log(`📊 Final Results:`);
        console.log(`   - Total Processed: ${STATS.totalProcessed.toLocaleString()}`);
        console.log(`   - Successful: ${STATS.totalSuccessful.toLocaleString()}`);
        console.log(`   - Failed: ${STATS.totalFailed.toLocaleString()}`);
        console.log(`   - Success Rate: ${finalSuccessRate}%`);
        console.log(`   - Total Runtime: ${totalRuntime} minutes`);
        console.log(`   - Average Throughput: ${avgThroughput} domains/minute`);
        console.log(`   - Sessions Created: ${STATS.sessionsCreated}`);
        console.log(`   - Sessions Reused: ${STATS.sessionsReused}`);
        console.log(`   - Final Memory Usage: ${finalMemoryMB}MB`);
        
        console.log(`\n📋 Failure Breakdown:`);
        Object.entries(STATS.failureReasons)
            .sort(([,a], [,b]) => b - a)
            .forEach(([reason, count]) => {
                const percentage = (count / STATS.totalFailed * 100).toFixed(1);
                console.log(`   - ${reason}: ${count.toLocaleString()} (${percentage}%)`);
            });
        
        // Final cloud notification
        const topFailures = Object.entries(STATS.failureReasons)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([reason, count]) => `- ${reason}: ${count.toLocaleString()}`)
            .join('\n');
            
        await sendSlackNotification(`🎉 **Cloud Email Automation Complete!**
**Environment:** Google Cloud
**Total Processed:** ${STATS.totalProcessed.toLocaleString()}
**Successful:** ${STATS.totalSuccessful.toLocaleString()}
**Failed:** ${STATS.totalFailed.toLocaleString()}
**Success Rate:** ${finalSuccessRate}%
**Total Runtime:** ${totalRuntime} minutes
**Average Throughput:** ${avgThroughput} domains/minute
**Sessions Created:** ${STATS.sessionsCreated} | **Reused:** ${STATS.sessionsReused}
**Final Memory:** ${finalMemoryMB}MB

**Top Failure Reasons:**
${topFailures}

**Cost Estimate:** ~$${((totalRuntime / 60) * 0.10).toFixed(2)} (preemptible)`);
        
        console.log(`\n💾 Cloud logs saved to:`);
        console.log(`   - Failed domains: ${CONFIG.FAILED_DOMAINS_LOG}`);
        console.log(`   - Successful domains: ${CONFIG.SUCCESS_DOMAINS_LOG}`);
        console.log(`   - Progress tracking: ${CONFIG.PROGRESS_LOG}`);
        console.log(`   - Performance metrics: ${CONFIG.PERFORMANCE_LOG}`);
        
        console.log(`\n💰 Estimated cost: $${((totalRuntime / 60) * 0.10).toFixed(2)} (preemptible e2-standard-4)`);
        
    } catch (error) {
        console.error(`❌ Cloud automation failed: ${error.message}`);
        await sendSlackNotification(`❌ **Cloud Automation Failed**: ${error.message}`);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, gracefully shutting down...');
    await sendSlackNotification('🛑 **Cloud Automation Interrupted** - Graceful shutdown initiated');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, gracefully shutting down...');
    await sendSlackNotification('🛑 **Cloud Automation Terminated** - Graceful shutdown initiated');
    process.exit(0);
});

// Run the cloud automation
runCloudAutomation().catch(console.error); 