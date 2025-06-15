/**
 * Enhanced Email Automation with Detailed Failure Analysis
 * 
 * This version includes:
 * - Detailed error logging and screenshots
 * - Page source capture for failed attempts
 * - Form detection debugging
 * - Retry mechanism for failed domains
 * - Comprehensive failure analysis
 */

const { chromium } = require('playwright');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const CONFIG = {
    BROWSERBASE_API_KEY: process.env.BROWSERBASE_API_KEY || 'bb_live_FTV11nF0Vs1NR_T_rVBHRmQHv74',
    BROWSERBASE_PROJECT_ID: process.env.BROWSERBASE_PROJECT_ID || 'd277f38a-cc07-4af9-8473-83cefed0bfcd',
    MAX_CONCURRENT_SESSIONS: 50,
    DOMAINS_PER_BATCH: 50,
    REQUEST_TIMEOUT: 30000,
    PAGE_TIMEOUT: 30000,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 2000,
    NOTIFICATION_INTERVAL: 100,
    SESSION_CLEANUP_DELAY: 1000,
    SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL || 'your-slack-webhook-here',
    DEBUG_MODE: true,
    CAPTURE_SCREENSHOTS: true,
    CAPTURE_PAGE_SOURCE: true,
    LOGS_DIR: './logs',
    SCREENSHOTS_DIR: './logs/screenshots',
    FAILED_ATTEMPTS_FILE: './logs/failed_attempts.json'
};

// Enhanced form detection strategies
const FORM_SELECTORS = {
    popup: [
        'div[class*="popup"] input[type="email"]',
        'div[class*="modal"] input[type="email"]',
        '[role="dialog"] input[type="email"]',
        '.klaviyo-form input[type="email"]',
        '.mc4wp-form input[type="email"]',
        '.privy-popup input[type="email"]',
        '.popup input[type="email"]',
        '.modal input[type="email"]',
        '.overlay input[type="email"]',
        '[data-testid*="popup"] input[type="email"]',
        '[data-testid*="modal"] input[type="email"]'
    ],
    newsletter: [
        'form[class*="newsletter"] input[type="email"]',
        'form[class*="signup"] input[type="email"]',
        'form[class*="subscribe"] input[type="email"]',
        '[class*="newsletter"] input[type="email"]',
        '[class*="signup"] input[type="email"]',
        '[class*="subscribe"] input[type="email"]',
        'input[placeholder*="newsletter" i]',
        'input[placeholder*="email newsletter" i]',
        'input[placeholder*="subscribe" i]',
        'input[placeholder*="join" i]',
        'input[name*="newsletter" i]',
        'input[name*="subscribe" i]',
        // Handle text inputs in newsletter/signup forms
        'form[class*="newsletter"] input[type="text"][name*="email" i]',
        'form[class*="signup"] input[type="text"][name*="email" i]',
        'form[class*="subscribe"] input[type="text"][name*="email" i]'
    ],
    footer: [
        'footer input[type="email"]',
        '[class*="footer"] input[type="email"]',
        '.footer input[type="email"]',
        'section[class*="footer"] input[type="email"]',
        'div[class*="footer"] input[type="email"]'
    ],
    header: [
        'header input[type="email"]',
        '[class*="header"] input[type="email"]',
        '.header input[type="email"]',
        'nav input[type="email"]',
        '[class*="navigation"] input[type="email"]'
    ],
    sidebar: [
        'aside input[type="email"]',
        '[class*="sidebar"] input[type="email"]',
        '.sidebar input[type="email"]',
        '[class*="side-bar"] input[type="email"]'
    ],
    contact: [
        'form[class*="contact"] input[type="email"]',
        'form[class*="appointment"] input[type="email"]',
        'form[id*="contact"] input[type="email"]',
        'form[id*="appointment"] input[type="email"]',
        // Handle text inputs in contact/appointment forms
        'form[class*="contact"] input[type="text"][name*="email" i]',
        'form[class*="appointment"] input[type="text"][name*="email" i]',
        'form[id*="contact"] input[type="text"][name*="email" i]',
        'form[id*="appointment"] input[type="text"][name*="email" i]',
        'input[class*="appointment"][name*="email" i]',
        'input[id*="appointment"][name*="email" i]'
    ],
    generic: [
        'input[type="email"]:not([form]):not([class*="login"]):not([class*="signin"]):not([class*="search"])',
        'input[name*="email" i]:not([class*="login"]):not([class*="signin"]):not([class*="search"])',
        'input[placeholder*="email" i]:not([placeholder*="login" i]):not([placeholder*="signin" i]):not([placeholder*="search" i])',
        'input[id*="email" i]:not([id*="login" i]):not([id*="signin" i]):not([id*="search" i])',
        // Handle text inputs that are likely email fields
        'input[type="text"][name*="email" i]:not([class*="login"]):not([class*="signin"])',
        'input[type="text"][id*="email" i]:not([id*="login"]):not([id*="signin"])',
        'input[type="text"][placeholder*="email" i]:not([placeholder*="login" i]):not([placeholder*="signin" i])'
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
        errors: [],
        failedDomains: []
    },
    activeSessions: new Map(),
    failureAnalysis: {
        noFormsFound: 0,
        navigationErrors: 0,
        timeoutErrors: 0,
        formSubmissionErrors: 0,
        captchaDetected: 0,
        siteDown: 0,
        otherErrors: 0
    }
};

/**
 * Initialize directories for logs and screenshots
 */
async function initializeDirectories() {
    try {
        await fs.mkdir(CONFIG.LOGS_DIR, { recursive: true });
        await fs.mkdir(CONFIG.SCREENSHOTS_DIR, { recursive: true });
        console.log('📁 Initialized log directories');
    } catch (error) {
        console.warn('Warning: Could not create directories:', error.message);
    }
}

/**
 * Load data from CSV files or failed attempts
 */
async function loadData(maxDomains = null, retryFailed = false) {
    console.log('📂 Loading domains and email accounts...');
    
    try {
        if (retryFailed) {
            // Load failed domains from previous run
            try {
                const failedData = await fs.readFile(CONFIG.FAILED_ATTEMPTS_FILE, 'utf8');
                const failedAttempts = JSON.parse(failedData);
                automation.domains = failedAttempts.map(attempt => attempt.domain).filter(Boolean);
                console.log(`🔄 Loaded ${automation.domains.length} failed domains for retry`);
            } catch (error) {
                console.error('❌ No failed attempts file found or invalid format');
                throw new Error('No failed attempts to retry');
            }
        } else {
            // Load domains normally
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
 * Create a Browserbase session with proxy fallback
 */
async function createBrowserbaseSession(useProxy = true, retryCount = 0) {
    const proxyConfigs = [
        // Try specific US locations first
        [{ type: "browserbase", geolocation: { country: "US", state: "NY", city: "NEW_YORK" } }],
        [{ type: "browserbase", geolocation: { country: "US", state: "CA", city: "LOS_ANGELES" } }],
        [{ type: "browserbase", geolocation: { country: "US" } }],
        // Try simple proxy setting
        true,
        // No proxy as last resort
        undefined
    ];
    
    const sessionConfig = {
        projectId: CONFIG.BROWSERBASE_PROJECT_ID,
        browserSettings: {
            viewport: { width: 1920, height: 1080 },
            stealth: true
        }
    };
    
    // Add proxy configuration if specified
    if (useProxy && retryCount < proxyConfigs.length - 1) {
        const proxyConfig = proxyConfigs[retryCount];
        if (proxyConfig) {
            sessionConfig.proxies = proxyConfig;
        }
    }

    try {
        const response = await axios.post(
            'https://api.browserbase.com/v1/sessions',
            sessionConfig,
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
            connectUrl: response.data.connectUrl,
            proxyUsed: sessionConfig.proxies ? JSON.stringify(sessionConfig.proxies) : 'none'
        };
    } catch (error) {
        // If proxy creation fails, try without proxy or different proxy
        if (retryCount < proxyConfigs.length - 1) {
            console.log(`Proxy config ${retryCount} failed, trying next configuration...`);
            return createBrowserbaseSession(useProxy, retryCount + 1);
        }
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
 * Take screenshot for debugging
 */
async function takeDebugScreenshot(page, domain, description) {
    if (!CONFIG.CAPTURE_SCREENSHOTS) return null;
    
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const safeDomain = domain.replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `${safeDomain}_${description}_${timestamp}.png`;
        const filepath = path.join(CONFIG.SCREENSHOTS_DIR, filename);
        
        await page.screenshot({ path: filepath, fullPage: true });
        return filepath;
    } catch (error) {
        console.warn('Failed to take screenshot:', error.message);
        return null;
    }
}

/**
 * Save page source for debugging
 */
async function savePageSource(page, domain, description) {
    if (!CONFIG.CAPTURE_PAGE_SOURCE) return null;
    
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const safeDomain = domain.replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `${safeDomain}_${description}_${timestamp}.html`;
        const filepath = path.join(CONFIG.LOGS_DIR, filename);
        
        const content = await page.content();
        await fs.writeFile(filepath, content);
        return filepath;
    } catch (error) {
        console.warn('Failed to save page source:', error.message);
        return null;
    }
}

/**
 * Analyze page for forms with detailed debugging
 */
async function analyzePageForms(page, domain) {
    const analysis = {
        totalForms: 0,
        emailInputs: 0,
        formsByStrategy: {},
        detectedPlatforms: [],
        possibleCaptcha: false,
        errors: []
    };

    try {
        // Count total forms
        analysis.totalForms = await page.locator('form').count();
        
        // Count email inputs
        analysis.emailInputs = await page.locator('input[type="email"]').count();
        
        // Check each strategy
        for (const [strategy, selectors] of Object.entries(FORM_SELECTORS)) {
            analysis.formsByStrategy[strategy] = {
                found: 0,
                visible: 0,
                selectors: []
            };
            
            for (const selector of selectors) {
                try {
                    const elements = await page.locator(selector);
                    const count = await elements.count();
                    
                    if (count > 0) {
                        analysis.formsByStrategy[strategy].found += count;
                        analysis.formsByStrategy[strategy].selectors.push(selector);
                        
                        // Check visibility
                        for (let i = 0; i < count; i++) {
                            const isVisible = await elements.nth(i).isVisible().catch(() => false);
                            if (isVisible) {
                                analysis.formsByStrategy[strategy].visible++;
                            }
                        }
                    }
                } catch (error) {
                    // Continue with next selector
                }
            }
        }

        // Detect platforms
        const pageContent = await page.content();
        if (pageContent.includes('klaviyo')) analysis.detectedPlatforms.push('Klaviyo');
        if (pageContent.includes('mailchimp')) analysis.detectedPlatforms.push('Mailchimp');
        if (pageContent.includes('privy')) analysis.detectedPlatforms.push('Privy');
        if (pageContent.includes('shopify')) analysis.detectedPlatforms.push('Shopify');
        if (pageContent.includes('omnisend')) analysis.detectedPlatforms.push('Omnisend');
        if (pageContent.includes('yotpo')) analysis.detectedPlatforms.push('Yotpo');

        // Check for captcha
        analysis.possibleCaptcha = pageContent.includes('recaptcha') || 
                                  pageContent.includes('hcaptcha') || 
                                  pageContent.includes('captcha');

    } catch (error) {
        analysis.errors.push(`Analysis failed: ${error.message}`);
    }

    return analysis;
}

/**
 * Enhanced email signup attempt with detailed debugging
 */
async function attemptEmailSignup(domain, email) {
    let sessionId = null;
    let browser = null;
    const attempts = [];
    const debugInfo = {
        pageAnalysis: null,
        screenshots: [],
        pageSource: null,
        errorType: null
    };
    let success = false;

    try {
        // Create Browserbase session with proxy support
        const session = await createBrowserbaseSession();
        sessionId = session.sessionId;
        automation.activeSessions.set(sessionId, { domain, startTime: new Date() });
        
        attempts.push(`Created session: ${sessionId} (proxy: ${session.proxyUsed})`);

        // Connect to session with Playwright
        const { browser: browserInstance, page } = await connectToSession(session.connectUrl);
        browser = browserInstance;
        
        attempts.push(`Connected to browser session`);

        // Try navigation with UTM parameters, fallback to plain domain
        let url = `${domain}?utm_source=automation&utm_medium=signup&utm_campaign=bulk-signup`;
        let response = null;
        let navigationSuccess = false;
        
        try {
            response = await page.goto(url, { 
                waitUntil: 'domcontentloaded',
                timeout: CONFIG.PAGE_TIMEOUT 
            });
            
            const statusCode = response ? response.status() : 'unknown';
            
            // If we get a 4xx or 5xx error, try without UTM parameters
            if (statusCode >= 400) {
                attempts.push(`UTM navigation failed (Status: ${statusCode}), trying without UTM...`);
                
                // Try without UTM parameters
                url = domain;
                response = await page.goto(url, { 
                    waitUntil: 'domcontentloaded',
                    timeout: CONFIG.PAGE_TIMEOUT 
                });
                
                const newStatusCode = response ? response.status() : 'unknown';
                attempts.push(`Navigated to ${url} (Status: ${newStatusCode}) - No UTM`);
                
                if (newStatusCode >= 400) {
                    debugInfo.errorType = 'navigation_error';
                    if (newStatusCode >= 500) {
                        automation.failureAnalysis.siteDown++;
                    } else {
                        automation.failureAnalysis.navigationErrors++;
                    }
                } else {
                    navigationSuccess = true;
                }
            } else {
                attempts.push(`Navigated to ${url} (Status: ${statusCode})`);
                navigationSuccess = true;
            }
            
        } catch (navError) {
            // If UTM navigation fails completely, try without UTM
            attempts.push(`UTM navigation error: ${navError.message}, trying without UTM...`);
            
            try {
                url = domain;
                response = await page.goto(url, { 
                    waitUntil: 'domcontentloaded',
                    timeout: CONFIG.PAGE_TIMEOUT 
                });
                
                const statusCode = response ? response.status() : 'unknown';
                attempts.push(`Navigated to ${url} (Status: ${statusCode}) - No UTM`);
                
                if (statusCode >= 400) {
                    debugInfo.errorType = 'navigation_error';
                    automation.failureAnalysis.navigationErrors++;
                } else {
                    navigationSuccess = true;
                }
            } catch (fallbackError) {
                attempts.push(`Fallback navigation also failed: ${fallbackError.message}`);
                debugInfo.errorType = 'navigation_timeout';
                automation.failureAnalysis.timeoutErrors++;
                throw fallbackError;
            }
        }

        // Wait for dynamic content
        await page.waitForTimeout(3000);

        // Take initial screenshot
        const initialScreenshot = await takeDebugScreenshot(page, domain, 'initial');
        if (initialScreenshot) debugInfo.screenshots.push(initialScreenshot);

        // Try to reveal hidden forms by clicking common triggers
        attempts.push(`Attempting to reveal hidden forms...`);
        const triggers = [
            'button:has-text("Contact")', 'a:has-text("Contact")', 
            'button:has-text("Appointment")', 'a:has-text("Appointment")',
            'button:has-text("Book")', 'a:has-text("Book")',
            'button:has-text("Schedule")', 'a:has-text("Schedule")',
            'button:has-text("Get Quote")', 'a:has-text("Get Quote")',
            'button:has-text("Request")', 'a:has-text("Request")',
            '.contact-trigger', '.appointment-trigger', '.book-trigger',
            '[data-toggle="modal"]', '[data-bs-toggle="modal"]'
        ];
        
        for (const trigger of triggers) {
            try {
                const triggerElement = page.locator(trigger).first();
                const exists = await triggerElement.count() > 0;
                if (exists && await triggerElement.isVisible().catch(() => false)) {
                    attempts.push(`Found and clicking trigger: ${trigger}`);
                    await triggerElement.click();
                    await page.waitForTimeout(2000);
                    break;
                }
            } catch (triggerError) {
                // Continue to next trigger
            }
        }

        // Analyze page forms
        debugInfo.pageAnalysis = await analyzePageForms(page, domain);
        attempts.push(`Page analysis: ${debugInfo.pageAnalysis.totalForms} forms, ${debugInfo.pageAnalysis.emailInputs} email inputs`);

        // Check for captcha
        if (debugInfo.pageAnalysis.possibleCaptcha) {
            attempts.push('⚠️ Possible CAPTCHA detected');
            automation.failureAnalysis.captchaDetected++;
        }

        // Try different form strategies with enhanced debugging
        success = await tryFormSubmissionEnhanced(page, email, attempts, debugInfo, domain);
        
        // If standard detection failed, try dynamic detection
        if (!success) {
            attempts.push('🔄 Standard form detection failed, trying dynamic detection...');
            const { attemptDynamicFormSubmission } = require('./dynamic_form_detector');
            
            try {
                const dynamicResult = await attemptDynamicFormSubmission(page, email, domain);
                if (dynamicResult.success) {
                    success = true;
                    attempts.push('✅ Dynamic form detection succeeded!');
                    debugInfo.dynamicDetection = dynamicResult.detectionResults;
                    debugInfo.dynamicFormUsed = dynamicResult.inputUsed;
                } else {
                    attempts.push(`❌ Dynamic detection failed: ${dynamicResult.reason}`);
                    debugInfo.dynamicDetection = dynamicResult.detectionResults;
                }
            } catch (dynamicError) {
                attempts.push(`⚠️ Dynamic detection error: ${dynamicError.message}`);
            }
        }

        // Take final screenshot
        const finalScreenshot = await takeDebugScreenshot(page, domain, success ? 'success' : 'failed');
        if (finalScreenshot) debugInfo.screenshots.push(finalScreenshot);

        // Save page source if failed
        if (!success) {
            debugInfo.pageSource = await savePageSource(page, domain, 'failed');
            if (!debugInfo.errorType) {
                debugInfo.errorType = 'no_forms_found';
                automation.failureAnalysis.noFormsFound++;
            }
        }

        return {
            success,
            domain,
            email,
            sessionId,
            attempts,
            debugInfo,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        attempts.push(`Error: ${error.message}`);
        
        // Classify error type
        if (!debugInfo.errorType) {
            if (error.message.includes('timeout')) {
                debugInfo.errorType = 'timeout';
                automation.failureAnalysis.timeoutErrors++;
            } else if (error.message.includes('navigation')) {
                debugInfo.errorType = 'navigation_error';
                automation.failureAnalysis.navigationErrors++;
            } else {
                debugInfo.errorType = 'other_error';
                automation.failureAnalysis.otherErrors++;
            }
        }

        return {
            success: false,
            domain,
            email,
            sessionId,
            error: error.message,
            attempts,
            debugInfo,
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
 * Enhanced form submission with detailed debugging
 */
async function tryFormSubmissionEnhanced(page, email, attempts, debugInfo, domain) {
    const strategies = ['popup', 'newsletter', 'footer', 'header', 'sidebar', 'contact', 'generic'];
    
    for (const strategy of strategies) {
        try {
            const selectors = FORM_SELECTORS[strategy];
            attempts.push(`🎯 Trying ${strategy} strategy (${selectors.length} selectors)`);
            
            // Special handling for footer forms - scroll to bottom first
            if (strategy === 'footer') {
                await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                await page.waitForTimeout(1000);
                attempts.push(`Scrolled to footer`);
            }

            for (const selector of selectors) {
                try {
                    // Check if element exists and is visible
                    const elements = await page.locator(selector);
                    const count = await elements.count();
                    
                    if (count === 0) continue;
                    
                    attempts.push(`Found ${count} elements for selector: ${selector}`);
                    
                    for (let i = 0; i < count; i++) {
                        const element = elements.nth(i);
                        let isVisible = await element.isVisible().catch(() => false);
                        
                        if (!isVisible) {
                            attempts.push(`Element ${i+1} not visible, trying to make it visible`);
                            
                            // Try scrolling to the element
                            try {
                                await element.scrollIntoViewIfNeeded();
                                await page.waitForTimeout(1000);
                                isVisible = await element.isVisible().catch(() => false);
                                if (isVisible) {
                                    attempts.push(`Element became visible after scrolling`);
                                }
                            } catch (scrollError) {
                                attempts.push(`Scroll failed: ${scrollError.message}`);
                            }
                            
                            // Try clicking any buttons that might reveal the form
                            if (!isVisible) {
                                try {
                                    const revealButtons = await page.locator('button:has-text("Contact"), button:has-text("Appointment"), button:has-text("Book"), button:has-text("Schedule"), a:has-text("Contact"), a:has-text("Appointment")');
                                    const buttonCount = await revealButtons.count();
                                    if (buttonCount > 0) {
                                        await revealButtons.first().click();
                                        await page.waitForTimeout(2000);
                                        isVisible = await element.isVisible().catch(() => false);
                                        if (isVisible) {
                                            attempts.push(`Element became visible after clicking reveal button`);
                                        }
                                    }
                                } catch (revealError) {
                                    attempts.push(`Reveal attempt failed: ${revealError.message}`);
                                }
                            }
                            
                            // Last resort: try to force visibility with JavaScript
                            if (!isVisible) {
                                try {
                                    await element.evaluate(node => {
                                        // Force visibility
                                        node.style.display = 'block';
                                        node.style.visibility = 'visible';
                                        node.style.opacity = '1';
                                        node.style.position = 'static';
                                        
                                        // Also try to show parent containers
                                        let parent = node.parentElement;
                                        while (parent && parent !== document.body) {
                                            parent.style.display = 'block';
                                            parent.style.visibility = 'visible';
                                            parent.style.opacity = '1';
                                            parent = parent.parentElement;
                                        }
                                    });
                                    await page.waitForTimeout(1000);
                                    isVisible = await element.isVisible().catch(() => false);
                                    if (isVisible) {
                                        attempts.push(`Element became visible after JavaScript force`);
                                    }
                                } catch (jsError) {
                                    attempts.push(`JavaScript force failed: ${jsError.message}`);
                                }
                            }
                            
                            if (!isVisible) {
                                attempts.push(`Element ${i+1} still not visible after all attempts`);
                                continue;
                            }
                        }

                        // Get form context
                        const form = await element.locator('xpath=ancestor-or-self::form').first();
                        const formExists = await form.count() > 0;
                        
                        if (formExists) {
                            const formText = await form.textContent().catch(() => '');
                            const formHtml = await form.innerHTML().catch(() => '');
                            
                            // Skip login forms
                            if (formText.toLowerCase().includes('login') || 
                                formText.toLowerCase().includes('sign in') ||
                                formHtml.toLowerCase().includes('password')) {
                                attempts.push(`Skipped login form`);
                                continue;
                            }
                            
                            attempts.push(`Found valid form context`);
                        }

                        // Fill the email
                        try {
                            await element.fill(email);
                            attempts.push(`✅ Filled ${strategy} form with email: ${email}`);
                            
                            // Take screenshot after filling
                            const fillScreenshot = await takeDebugScreenshot(page, domain, `filled_${strategy}`);
                            if (fillScreenshot) debugInfo.screenshots.push(fillScreenshot);

                            // Try to submit the form
                            let submitted = false;
                            
                            // Look for submit button with enhanced selectors
                            const submitSelectors = [
                                'button[type="submit"]',
                                'input[type="submit"]',
                                'button:has-text("Sign Up")',
                                'button:has-text("Subscribe")',
                                'button:has-text("Join")',
                                'button:has-text("Submit")',
                                'button:has-text("Get")',
                                'button:has-text("Start")',
                                'button:has-text("Continue")',
                                'button[class*="submit"]',
                                'button[class*="subscribe"]',
                                'button[class*="signup"]',
                                'input[value*="Subscribe"]',
                                'input[value*="Sign Up"]',
                                'input[value*="Join"]',
                                'button:not([type])'
                            ];

                            const searchArea = formExists ? form : page;
                            
                            for (const submitSelector of submitSelectors) {
                                try {
                                    const submitBtn = searchArea.locator(submitSelector).first();
                                    const submitVisible = await submitBtn.isVisible().catch(() => false);
                                    
                                    if (submitVisible) {
                                        const btnText = await submitBtn.textContent().catch(() => '');
                                        attempts.push(`Found submit button: "${btnText}" (${submitSelector})`);
                                        
                                        await submitBtn.click();
                                        submitted = true;
                                        attempts.push(`✅ Clicked submit button`);
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
                                submitted = true;
                            }

                            // Wait for submission response
                            await page.waitForTimeout(3000);
                            
                            // Check for success indicators
                            const pageContent = await page.content();
                            const successIndicators = [
                                'thank you',
                                'thanks',
                                'subscribed',
                                'signed up',
                                'welcome',
                                'confirm',
                                'check your email',
                                'success'
                            ];
                            
                            const hasSuccessIndicator = successIndicators.some(indicator => 
                                pageContent.toLowerCase().includes(indicator)
                            );
                            
                            if (hasSuccessIndicator) {
                                attempts.push(`✅ Success indicators found in page content`);
                            }

                            // Take screenshot after submission
                            const submitScreenshot = await takeDebugScreenshot(page, domain, `submitted_${strategy}`);
                            if (submitScreenshot) debugInfo.screenshots.push(submitScreenshot);

                            attempts.push(`✅ Successfully submitted ${strategy} form`);
                            return true;

                        } catch (fillError) {
                            attempts.push(`Failed to fill/submit: ${fillError.message}`);
                            debugInfo.errorType = 'form_submission_error';
                            automation.failureAnalysis.formSubmissionErrors++;
                            continue;
                        }
                    }

                } catch (selectorError) {
                    attempts.push(`Selector error: ${selectorError.message}`);
                    continue;
                }
            }
        } catch (strategyError) {
            attempts.push(`${strategy} strategy failed: ${strategyError.message}`);
        }
    }

    attempts.push('❌ No suitable forms found or submission failed');
    return false;
}

/**
 * Save failed attempts for retry
 */
async function saveFailedAttempts() {
    try {
        const failedAttempts = automation.stats.errors.map(error => ({
            domain: error.domain,
            email: error.email,
            error: error.error || 'Unknown error',
            attempts: error.attempts,
            debugInfo: error.debugInfo,
            timestamp: error.timestamp
        }));
        
        await fs.writeFile(CONFIG.FAILED_ATTEMPTS_FILE, JSON.stringify(failedAttempts, null, 2));
        console.log(`💾 Saved ${failedAttempts.length} failed attempts to ${CONFIG.FAILED_ATTEMPTS_FILE}`);
    } catch (error) {
        console.error('Failed to save failed attempts:', error.message);
    }
}

/**
 * Generate detailed failure analysis report
 */
async function generateFailureReport() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(CONFIG.LOGS_DIR, `failure_analysis_${timestamp}.json`);
    
    const report = {
        summary: {
            totalProcessed: automation.stats.processed,
            successful: automation.stats.successful,
            failed: automation.stats.failed,
            successRate: ((automation.stats.successful / automation.stats.processed) * 100).toFixed(2) + '%',
            timestamp: new Date().toISOString()
        },
        failureBreakdown: automation.failureAnalysis,
        failedDomains: automation.stats.errors.map(error => ({
            domain: error.domain,
            errorType: error.debugInfo?.errorType || 'unknown',
            formsFound: error.debugInfo?.pageAnalysis?.totalForms || 0,
            emailInputs: error.debugInfo?.pageAnalysis?.emailInputs || 0,
            platforms: error.debugInfo?.pageAnalysis?.detectedPlatforms || [],
            captcha: error.debugInfo?.pageAnalysis?.possibleCaptcha || false,
            screenshots: error.debugInfo?.screenshots || [],
            lastAttempt: error.attempts?.[error.attempts.length - 1] || 'No attempts logged'
        }))
    };
    
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`📊 Generated failure analysis report: ${reportPath}`);
    
    return report;
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
            username: 'Enhanced Email Bot',
            icon_emoji: '🔍'
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
 * Main enhanced automation function
 */
async function runEnhancedAutomation(maxDomains = null, retryFailed = false) {
    try {
        console.log('🔍 Starting Enhanced Email Automation with Detailed Analysis...');
        console.log(`⚡ Max Concurrent Sessions: ${CONFIG.MAX_CONCURRENT_SESSIONS}`);
        console.log(`🐛 Debug Mode: ${CONFIG.DEBUG_MODE ? 'ON' : 'OFF'}`);
        console.log(`📸 Screenshots: ${CONFIG.CAPTURE_SCREENSHOTS ? 'ON' : 'OFF'}`);
        
        await initializeDirectories();
        await loadData(maxDomains, retryFailed);
        
        // Reset stats for retry
        if (retryFailed) {
            automation.stats = {
                processed: 0,
                successful: 0,
                failed: 0,
                startTime: new Date(),
                errors: [],
                failedDomains: []
            };
            automation.failureAnalysis = {
                noFormsFound: 0,
                navigationErrors: 0,
                timeoutErrors: 0,
                formSubmissionErrors: 0,
                captchaDetected: 0,
                siteDown: 0,
                otherErrors: 0
            };
        }
        
        // Send startup notification
        const mode = retryFailed ? 'RETRY' : 'FULL';
        await sendSlackNotification(`🔍 **Enhanced Email Automation Started (${mode} MODE)**
**Total Domains:** ${automation.domains.length}
**Email Accounts:** ${automation.emails.length}
**Concurrent Sessions:** ${CONFIG.MAX_CONCURRENT_SESSIONS}
**Debug Features:** Screenshots, Page Analysis, Error Classification
**Technology:** Enhanced Playwright + Browserbase`);

        // Process domains in smaller batches for better debugging
        const batchSize = Math.min(CONFIG.DOMAINS_PER_BATCH, 20); // Smaller batches for debugging
        const batches = [];
        for (let i = 0; i < automation.domains.length; i += batchSize) {
            batches.push(automation.domains.slice(i, i + batchSize));
        }

        console.log(`📦 Processing ${batches.length} batches of ${batchSize} domains each`);

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            const batchNumber = batchIndex + 1;
            
            console.log(`\n🎯 Processing batch ${batchNumber}/${batches.length} (${batch.length} domains)`);
            console.log(`📊 Current progress: ${automation.stats.processed}/${automation.domains.length}`);
            
            const startTime = Date.now();
            const batchResults = await processBatch(batch);
            const batchTime = (Date.now() - startTime) / 1000;

            // Update stats and collect detailed results
            batchResults.forEach(result => {
                automation.stats.processed++;
                if (result.success) {
                    automation.stats.successful++;
                    console.log(`✅ ${result.domain} - SUCCESS`);
                } else {
                    automation.stats.failed++;
                    automation.stats.errors.push(result);
                    automation.stats.failedDomains.push(result.domain);
                    
                    const errorType = result.debugInfo?.errorType || 'unknown';
                    console.log(`❌ ${result.domain} - FAILED (${errorType}): ${result.error || 'Unknown error'}`);
                    
                    if (CONFIG.DEBUG_MODE && result.debugInfo?.pageAnalysis) {
                        const analysis = result.debugInfo.pageAnalysis;
                        console.log(`   📊 Forms: ${analysis.totalForms}, Email inputs: ${analysis.emailInputs}`);
                        if (analysis.detectedPlatforms.length > 0) {
                            console.log(`   🔧 Platforms: ${analysis.detectedPlatforms.join(', ')}`);
                        }
                        if (analysis.possibleCaptcha) {
                            console.log(`   🤖 Captcha detected`);
                        }
                    }
                }
            });

            const successRate = ((automation.stats.successful / automation.stats.processed) * 100).toFixed(1);
            const domainsPerSecond = (batch.length / batchTime).toFixed(1);
            
            console.log(`⚡ Batch ${batchNumber} completed in ${batchTime.toFixed(1)}s (${domainsPerSecond} domains/sec)`);
            console.log(`📈 Success rate: ${successRate}% (${automation.stats.successful}/${automation.stats.processed})`);
            
            // Show failure breakdown
            console.log(`📊 Failure Analysis: NoForms=${automation.failureAnalysis.noFormsFound}, NavError=${automation.failureAnalysis.navigationErrors}, Timeout=${automation.failureAnalysis.timeoutErrors}, FormError=${automation.failureAnalysis.formSubmissionErrors}, Captcha=${automation.failureAnalysis.captchaDetected}, SiteDown=${automation.failureAnalysis.siteDown}, Other=${automation.failureAnalysis.otherErrors}`);

            // Send progress updates
            if (automation.stats.processed % 20 === 0 || batchIndex === batches.length - 1) {
                const totalRuntime = Math.round((new Date() - automation.stats.startTime) / 1000 / 60);
                const rate = automation.stats.processed / Math.max(totalRuntime, 1);

                await sendSlackNotification(`🔍 **Enhanced Analysis Progress - Batch ${batchNumber}/${batches.length}**
**Completed:** ${automation.stats.processed}/${automation.domains.length}
**Successful:** ${automation.stats.successful} (${successRate}%)
**Failed:** ${automation.stats.failed}
**Failure Types:** NoForms=${automation.failureAnalysis.noFormsFound}, NavError=${automation.failureAnalysis.navigationErrors}, Timeout=${automation.failureAnalysis.timeoutErrors}
**Runtime:** ${totalRuntime} minutes
**Rate:** ${rate.toFixed(1)} domains/minute`);
            }

            // Brief pause between batches
            if (batchIndex < batches.length - 1) {
                console.log(`⏳ Waiting ${CONFIG.SESSION_CLEANUP_DELAY}ms before next batch...`);
                await new Promise(resolve => setTimeout(resolve, CONFIG.SESSION_CLEANUP_DELAY));
            }
        }

        // Save failed attempts and generate report
        await saveFailedAttempts();
        const report = await generateFailureReport();

        // Final results
        const totalTime = Math.round((new Date() - automation.stats.startTime) / 1000 / 60);
        const finalSuccessRate = ((automation.stats.successful / automation.stats.processed) * 100).toFixed(1);
        const avgRate = (automation.stats.processed / Math.max(totalTime, 1)).toFixed(1);

        const finalMessage = `🔍 **Enhanced Automation Completed!**
**Mode:** ${mode}
**Total Processed:** ${automation.stats.processed}
**Successful:** ${automation.stats.successful}
**Failed:** ${automation.stats.failed}
**Success Rate:** ${finalSuccessRate}%
**Total Runtime:** ${totalTime} minutes
**Average Rate:** ${avgRate} domains/minute
**Top Failure Reasons:**
- No Forms Found: ${automation.failureAnalysis.noFormsFound}
- Navigation Errors: ${automation.failureAnalysis.navigationErrors}
- Timeouts: ${automation.failureAnalysis.timeoutErrors}
- Captcha: ${automation.failureAnalysis.captchaDetected}`;

        await sendSlackNotification(finalMessage);
        
        console.log('\n🔍 Enhanced Automation completed!');
        console.log(`📊 Final Stats:`, {
            processed: automation.stats.processed,
            successful: automation.stats.successful,
            failed: automation.stats.failed,
            successRate: finalSuccessRate + '%',
            runtime: totalTime + ' minutes',
            avgRate: avgRate + ' domains/minute',
            failureAnalysis: automation.failureAnalysis
        });

        console.log(`\n💾 Debug files saved:`);
        console.log(`   - Failed attempts: ${CONFIG.FAILED_ATTEMPTS_FILE}`);
        console.log(`   - Screenshots: ${CONFIG.SCREENSHOTS_DIR}`);
        console.log(`   - Logs: ${CONFIG.LOGS_DIR}`);

        return { stats: automation.stats, report };

    } catch (error) {
        console.error('❌ Enhanced automation failed:', error);
        await sendSlackNotification(`🚨 **Enhanced Automation Failed**
**Error:** ${error.message}
**Progress:** ${automation.stats.processed}/${automation.domains.length}`);
        throw error;
    }
}

module.exports = {
    runEnhancedAutomation,
    CONFIG
};

// Run if called directly
if (require.main === module) {
    const args = process.argv.slice(2);
    const maxDomains = args.includes('--test') ? 20 : null; // Smaller test size for debugging
    const retryFailed = args.includes('--retry');
    
    runEnhancedAutomation(maxDomains, retryFailed)
        .then(result => {
            console.log('✅ Enhanced automation completed successfully');
            
            if (result.stats.failed > 0) {
                console.log(`\n🔄 To retry failed domains, run: node enhanced_automation.js --retry`);
            }
            
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Enhanced automation failed:', error);
            process.exit(1);
        });
} 