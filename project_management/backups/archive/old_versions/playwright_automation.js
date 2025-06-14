/**
 * High-Performance Email Automation using Playwright + Browserbase
 * 
 * This version uses Playwright connecting to Browserbase for true 50 concurrent sessions
 * Maximum performance with proper browser automation capabilities.
 */

const { chromium } = require('playwright');
const axios = require('axios');
const fs = require('fs').promises;

// Configuration
const CONFIG = {
    BROWSERBASE_API_KEY: process.env.BROWSERBASE_API_KEY || 'your-api-key-here',
    BROWSERBASE_PROJECT_ID: process.env.BROWSERBASE_PROJECT_ID || 'your-project-id-here',
    MAX_CONCURRENT_SESSIONS: 50,
    DOMAINS_PER_BATCH: 50, // Process 50 domains simultaneously
    REQUEST_TIMEOUT: 30000,
    PAGE_TIMEOUT: 30000,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 2000,
    NOTIFICATION_INTERVAL: 100,
    SESSION_CLEANUP_DELAY: 1000,
    SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL || 'your-slack-webhook-here'
};

// Form detection strategies
const FORM_SELECTORS = {
    popup: [
        'div[class*="popup"] input[type="email"]',
        'div[class*="modal"] input[type="email"]',
        '[role="dialog"] input[type="email"]',
        '.klaviyo-form input[type="email"]',
        '.mc4wp-form input[type="email"]',
        '.privy-popup input[type="email"]',
        '.popup input[type="email"]',
        '.modal input[type="email"]'
    ],
    newsletter: [
        'form[class*="newsletter"] input[type="email"]',
        'form[class*="signup"] input[type="email"]',
        '[class*="newsletter"] input[type="email"]',
        'input[placeholder*="newsletter" i]',
        'input[placeholder*="email newsletter" i]'
    ],
    footer: [
        'footer input[type="email"]',
        '[class*="footer"] input[type="email"]',
        '.footer input[type="email"]'
    ],
    generic: [
        'input[type="email"]:not([form]):not([class*="login"]):not([class*="signin"])',
        'input[name*="email" i]:not([class*="login"]):not([class*="signin"])',
        'input[placeholder*="email" i]:not([placeholder*="login" i]):not([placeholder*="signin" i])'
    ]
};

// Global state
let automation = {
    domains: [],
    emails: [],
    emailIndex: 0,
    stats: {
        processed: 0,
        successful: 0,
        failed: 0,
        startTime: new Date(),
        errors: []
    },
    activeSessions: new Map()
};

/**
 * Load data from CSV files
 */
async function loadData(maxDomains = null) {
    console.log('📂 Loading domains and email accounts...');
    
    try {
        // Load domains
        const domainsData = await fs.readFile('Storedomains.csv', 'utf8');
        const domainLines = domainsData.split('\n').slice(1);
        automation.domains = domainLines
            .filter(line => line.trim())
            .map(line => {
                const domain = line.split(',')[0].trim();
                return domain.startsWith('http') ? domain : `https://${domain}`;
            })
            .filter(domain => domain !== 'https://');

        // Limit domains if specified (for testing)
        if (maxDomains) {
            automation.domains = automation.domains.slice(0, maxDomains);
        }

        // Load emails
        const emailsData = await fs.readFile('mailboxaccounts.csv', 'utf8');
        const emailLines = emailsData.split('\n').slice(1);
        automation.emails = emailLines
            .filter(line => line.trim())
            .map(line => line.split(',')[0].trim())
            .filter(email => email && email.includes('@'));

        console.log(`✅ Loaded ${automation.domains.length} domains and ${automation.emails.length} email accounts`);
        
        if (automation.domains.length === 0 || automation.emails.length === 0) {
            throw new Error('No domains or emails loaded');
        }

    } catch (error) {
        console.error('❌ Failed to load data:', error.message);
        throw error;
    }
}

/**
 * Get next email in rotation
 */
function getNextEmail() {
    const email = automation.emails[automation.emailIndex];
    automation.emailIndex = (automation.emailIndex + 1) % automation.emails.length;
    return email;
}

/**
 * Create a Browserbase session using direct API
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
                },
                // Enable built-in residential proxies to bypass IP blocking
                proxies: true
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-BB-API-Key': CONFIG.BROWSERBASE_API_KEY
                },
                timeout: CONFIG.REQUEST_TIMEOUT
            }
        );

        return {
            sessionId: response.data.id,
            connectUrl: response.data.connectUrl
        };
    } catch (error) {
        throw new Error(`Failed to create Browserbase session: ${error.response?.data?.message || error.message}`);
    }
}

/**
 * Close a Browserbase session
 */
async function closeBrowserbaseSession(sessionId) {
    try {
        await axios.post(
            `https://api.browserbase.com/v1/sessions/${sessionId}`,
            { status: 'COMPLETED' },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-BB-API-Key': CONFIG.BROWSERBASE_API_KEY
                },
                timeout: 10000
            }
        );
    } catch (error) {
        console.warn(`Warning: Failed to close session ${sessionId}:`, error.message);
    }
}

/**
 * Connect to Browserbase session using Playwright
 */
async function connectToSession(connectUrl) {
    try {
        const browser = await chromium.connectOverCDP(connectUrl);
        const contexts = browser.contexts();
        const context = contexts.length > 0 ? contexts[0] : await browser.newContext();
        const pages = context.pages();
        const page = pages.length > 0 ? pages[0] : await context.newPage();
        
        // Set timeouts
        page.setDefaultTimeout(CONFIG.PAGE_TIMEOUT);
        page.setDefaultNavigationTimeout(CONFIG.PAGE_TIMEOUT);
        
        return { browser, context, page };
    } catch (error) {
        throw new Error(`Failed to connect to Browserbase session: ${error.message}`);
    }
}

/**
 * Attempt email signup on a domain
 */
async function attemptEmailSignup(domain, email) {
    let sessionId = null;
    let browser = null;
    const attempts = [];
    let success = false;

    try {
        // Create Browserbase session
        const session = await createBrowserbaseSession();
        sessionId = session.sessionId;
        automation.activeSessions.set(sessionId, { domain, startTime: new Date() });
        
        attempts.push(`Created session: ${sessionId}`);

        // Connect to session with Playwright
        const { browser: browserInstance, page } = await connectToSession(session.connectUrl);
        browser = browserInstance;
        
        attempts.push(`Connected to browser session`);

        // Try navigation with UTM parameters, fallback to plain domain
        let url = `${domain}?utm_source=automation&utm_medium=signup&utm_campaign=bulk-signup`;
        
        try {
            const response = await page.goto(url, { 
                waitUntil: 'domcontentloaded',
                timeout: CONFIG.PAGE_TIMEOUT 
            });
            
            // If we get a 4xx or 5xx error, try without UTM parameters
            if (response.status() >= 400) {
                attempts.push(`UTM navigation failed (Status: ${response.status()}), trying without UTM...`);
                url = domain;
                const fallbackResponse = await page.goto(url, { 
                    waitUntil: 'domcontentloaded',
                    timeout: CONFIG.PAGE_TIMEOUT 
                });
                attempts.push(`Navigated to ${url} (Status: ${fallbackResponse.status()}) - No UTM`);
            } else {
                attempts.push(`Navigated to ${url} (Status: ${response.status()})`);
            }
        } catch (navError) {
            // If UTM navigation fails completely, try without UTM
            attempts.push(`UTM navigation error, trying without UTM...`);
            url = domain;
            const fallbackResponse = await page.goto(url, { 
                waitUntil: 'domcontentloaded',
                timeout: CONFIG.PAGE_TIMEOUT 
            });
            attempts.push(`Navigated to ${url} (Status: ${fallbackResponse.status()}) - No UTM`);
        }

        // Wait for dynamic content
        await page.waitForTimeout(3000);

        // Try different form strategies
        success = await tryFormSubmission(page, email, attempts);

        return {
            success,
            domain,
            email,
            sessionId,
            attempts,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        attempts.push(`Error: ${error.message}`);
        return {
            success: false,
            domain,
            email,
            sessionId,
            error: error.message,
            attempts,
            timestamp: new Date().toISOString()
        };
    } finally {
        // Cleanup
        if (browser) {
            try {
                await browser.close();
            } catch (closeError) {
                console.warn(`Failed to close browser:`, closeError.message);
            }
        }
        
        if (sessionId) {
            try {
                await closeBrowserbaseSession(sessionId);
                automation.activeSessions.delete(sessionId);
            } catch (closeError) {
                console.warn(`Failed to close session ${sessionId}:`, closeError.message);
            }
        }
    }
}

/**
 * Try form submission with multiple strategies
 */
async function tryFormSubmission(page, email, attempts) {
    const strategies = ['popup', 'newsletter', 'footer', 'generic'];
    
    for (const strategy of strategies) {
        try {
            const selectors = FORM_SELECTORS[strategy];
            
            // Special handling for footer forms - scroll to bottom first
            if (strategy === 'footer') {
                await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                await page.waitForTimeout(1000);
            }

            for (const selector of selectors) {
                try {
                    // Check if element exists and is visible
                    const element = await page.locator(selector).first();
                    const isVisible = await element.isVisible().catch(() => false);
                    
                    if (!isVisible) {
                        continue;
                    }

                    // Check if it's not a login form
                    const form = await element.locator('xpath=ancestor-or-self::form').first();
                    const formText = await form.textContent().catch(() => '');
                    if (formText.toLowerCase().includes('login') || formText.toLowerCase().includes('sign in')) {
                        continue;
                    }

                    // Fill the email
                    await element.fill(email);
                    attempts.push(`Filled ${strategy} form with selector: ${selector}`);

                    // Try to submit the form
                    let submitted = false;
                    
                    // Look for submit button
                    const submitSelectors = [
                        'button[type="submit"]',
                        'input[type="submit"]',
                        'button:has-text("Sign Up")',
                        'button:has-text("Subscribe")',
                        'button:has-text("Join")',
                        'button:has-text("Submit")',
                        'button:not([type])'
                    ];

                    for (const submitSelector of submitSelectors) {
                        try {
                            const submitBtn = form.locator(submitSelector).first();
                            const submitVisible = await submitBtn.isVisible().catch(() => false);
                            if (submitVisible) {
                                await submitBtn.click();
                                submitted = true;
                                attempts.push(`Clicked submit button: ${submitSelector}`);
                                break;
                            }
                        } catch (btnError) {
                            continue;
                        }
                    }

                    // If no button found, try pressing Enter
                    if (!submitted) {
                        await element.press('Enter');
                        attempts.push(`Pressed Enter on email field`);
                    }

                    // Wait a moment for submission
                    await page.waitForTimeout(2000);

                    attempts.push(`Successfully submitted ${strategy} form`);
                    return true;

                } catch (selectorError) {
                    // Continue to next selector
                    continue;
                }
            }
        } catch (strategyError) {
            attempts.push(`${strategy} strategy failed: ${strategyError.message}`);
        }
    }

    attempts.push('No suitable forms found');
    return false;
}

/**
 * Send Slack notification
 */
async function sendSlackNotification(message) {
    if (!CONFIG.SLACK_WEBHOOK_URL || CONFIG.SLACK_WEBHOOK_URL === 'your-slack-webhook-here') {
        console.log('📨 Slack notification (webhook not configured):', message);
        return;
    }

    try {
        await axios.post(CONFIG.SLACK_WEBHOOK_URL, {
            text: message,
            username: 'High-Performance Email Bot',
            icon_emoji: ':rocket:'
        });
        console.log('📨 Sent Slack notification');
    } catch (error) {
        console.error('Failed to send Slack notification:', error.message);
    }
}

/**
 * Process domains in batches with concurrency
 */
async function processBatch(domainBatch) {
    const promises = domainBatch.map(async (domain) => {
        const email = getNextEmail();
        return attemptEmailSignup(domain, email);
    });

    const results = await Promise.allSettled(promises);
    
    return results.map((result, index) => {
        if (result.status === 'fulfilled') {
            return result.value;
        } else {
            return {
                success: false,
                domain: domainBatch[index],
                email: getNextEmail(),
                error: result.reason.message,
                timestamp: new Date().toISOString()
            };
        }
    });
}

/**
 * Main automation function
 */
async function runPlaywrightAutomation(maxDomains = null) {
    try {
        console.log('🚀 Starting High-Performance Playwright + Browserbase Automation...');
        console.log(`⚡ Max Concurrent Sessions: ${CONFIG.MAX_CONCURRENT_SESSIONS}`);
        
        await loadData(maxDomains);
        
        // Send startup notification
        await sendSlackNotification(`🚀 **High-Performance Email Automation Started**
**Total Domains:** ${automation.domains.length}
**Email Accounts:** ${automation.emails.length}
**Concurrent Sessions:** ${CONFIG.MAX_CONCURRENT_SESSIONS}
**Batch Size:** ${CONFIG.DOMAINS_PER_BATCH}
**Technology:** Playwright + Browserbase
**Expected Runtime:** ~${Math.round(automation.domains.length / CONFIG.DOMAINS_PER_BATCH * 2)} minutes`);

        // Process domains in batches
        const batches = [];
        for (let i = 0; i < automation.domains.length; i += CONFIG.DOMAINS_PER_BATCH) {
            batches.push(automation.domains.slice(i, i + CONFIG.DOMAINS_PER_BATCH));
        }

        console.log(`📦 Processing ${batches.length} batches of ${CONFIG.DOMAINS_PER_BATCH} domains each`);

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            const batchNumber = batchIndex + 1;
            
            console.log(`\n🎯 Processing batch ${batchNumber}/${batches.length} (${batch.length} domains)`);
            console.log(`📊 Current progress: ${automation.stats.processed}/${automation.domains.length}`);
            
            const startTime = Date.now();
            const batchResults = await processBatch(batch);
            const batchTime = (Date.now() - startTime) / 1000;

            // Update stats
            batchResults.forEach(result => {
                automation.stats.processed++;
                if (result.success) {
                    automation.stats.successful++;
                    console.log(`✅ ${result.domain} - SUCCESS`);
                } else {
                    automation.stats.failed++;
                    automation.stats.errors.push(result);
                    console.log(`❌ ${result.domain} - FAILED: ${result.error || 'Unknown error'}`);
                }
            });

            const successRate = ((automation.stats.successful / automation.stats.processed) * 100).toFixed(1);
            const domainsPerSecond = (batch.length / batchTime).toFixed(1);
            
            console.log(`⚡ Batch ${batchNumber} completed in ${batchTime.toFixed(1)}s (${domainsPerSecond} domains/sec)`);
            console.log(`📈 Success rate: ${successRate}% (${automation.stats.successful}/${automation.stats.processed})`);

            // Send progress updates
            if (automation.stats.processed % CONFIG.NOTIFICATION_INTERVAL === 0 || batchIndex === batches.length - 1) {
                const totalRuntime = Math.round((new Date() - automation.stats.startTime) / 1000 / 60);
                const rate = automation.stats.processed / Math.max(totalRuntime, 1);
                const remaining = automation.domains.length - automation.stats.processed;
                const eta = remaining > 0 ? Math.round(remaining / Math.max(rate, 1)) : 0;

                await sendSlackNotification(`📊 **Progress Update - Batch ${batchNumber}/${batches.length}**
**Completed:** ${automation.stats.processed}/${automation.domains.length}
**Successful:** ${automation.stats.successful} (${successRate}%)
**Failed:** ${automation.stats.failed}
**Runtime:** ${totalRuntime} minutes
**Rate:** ${rate.toFixed(1)} domains/minute
**ETA:** ${eta} minutes remaining
**Batch Performance:** ${domainsPerSecond} domains/second`);
            }

            // Brief pause between batches to avoid overwhelming the API
            if (batchIndex < batches.length - 1) {
                console.log(`⏳ Waiting ${CONFIG.SESSION_CLEANUP_DELAY}ms before next batch...`);
                await new Promise(resolve => setTimeout(resolve, CONFIG.SESSION_CLEANUP_DELAY));
            }
        }

        // Final results
        const totalTime = Math.round((new Date() - automation.stats.startTime) / 1000 / 60);
        const finalSuccessRate = ((automation.stats.successful / automation.stats.processed) * 100).toFixed(1);
        const avgRate = (automation.stats.processed / Math.max(totalTime, 1)).toFixed(1);

        const finalMessage = `🎉 **High-Performance Automation Completed!**
**Total Processed:** ${automation.stats.processed}
**Successful:** ${automation.stats.successful}
**Failed:** ${automation.stats.failed}
**Success Rate:** ${finalSuccessRate}%
**Total Runtime:** ${totalTime} minutes
**Average Rate:** ${avgRate} domains/minute
**Peak Performance:** 50 concurrent browsers via Playwright + Browserbase`;

        await sendSlackNotification(finalMessage);
        
        console.log('\n🎉 High-Performance Automation completed successfully!');
        console.log(`📊 Final Stats:`, {
            processed: automation.stats.processed,
            successful: automation.stats.successful,
            failed: automation.stats.failed,
            successRate: finalSuccessRate + '%',
            runtime: totalTime + ' minutes',
            avgRate: avgRate + ' domains/minute'
        });

        return automation.stats;

    } catch (error) {
        console.error('❌ Automation failed:', error);
        await sendSlackNotification(`🚨 **Automation Failed**
**Error:** ${error.message}
**Progress:** ${automation.stats.processed}/${automation.domains.length}`);
        throw error;
    }
}

module.exports = {
    runPlaywrightAutomation,
    CONFIG
};

// Run if called directly
if (require.main === module) {
    // Check for command line arguments
    const args = process.argv.slice(2);
    const maxDomains = args.includes('--test') ? 100 : null;
    
    runPlaywrightAutomation(maxDomains)
        .then(stats => {
            console.log('✅ Automation completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Automation failed:', error);
            process.exit(1);
        });
} 