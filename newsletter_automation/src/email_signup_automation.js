/**
 * Email Signup Automation System
 * Automates email signups across thousands of domains using Browserbase
 * Features: 50 concurrent browsers, email rotation, Slack notifications, comprehensive error handling
 */

const fs = require('fs').promises;
const path = require('path');

class EmailSignupAutomation {
    constructor(config = {}) {
        this.config = {
            maxConcurrentBrowsers: 50,
            notificationInterval: 100, // Notify every 100 domains
            retryAttempts: 3,
            timeoutMs: 30000, // 30 seconds per domain
            delayBetweenAttempts: 2000, // 2 seconds between retries
            slackChannel: config.slackChannel || '#automation-updates',
            ...config
        };
        
        this.domains = [];
        this.emails = [];
        this.stats = {
            processed: 0,
            successful: 0,
            failed: 0,
            errors: [],
            startTime: new Date(),
            currentBatch: 0
        };
        
        this.activeBrowsers = new Map();
        this.emailIndex = 0;
    }

    /**
     * Load domains and emails from CSV files
     */
    async loadData() {
        try {
            console.log('📂 Loading domains and email accounts...');
            
            // Load domains
            const domainsContent = await fs.readFile('Storedomains.csv', 'utf-8');
            const domainLines = domainsContent.split('\n').slice(1); // Skip header
            this.domains = domainLines
                .filter(line => line.trim())
                .map(line => {
                    const domain = line.split(',')[0].trim();
                    return domain.startsWith('http') ? domain : `https://${domain}`;
                });

            // Load emails
            const emailsContent = await fs.readFile('mailboxaccounts.csv', 'utf-8');
            const emailLines = emailsContent.split('\n').slice(1); // Skip header
            this.emails = emailLines
                .filter(line => line.trim())
                .map(line => line.split(',')[0].trim())
                .filter(email => email);

            console.log(`✅ Loaded ${this.domains.length} domains and ${this.emails.length} email accounts`);
            
            if (this.domains.length === 0 || this.emails.length === 0) {
                throw new Error('No domains or emails loaded');
            }
        } catch (error) {
            await this.logError('Failed to load data', error);
            throw error;
        }
    }

    /**
     * Get next email in rotation
     */
    getNextEmail() {
        const email = this.emails[this.emailIndex];
        this.emailIndex = (this.emailIndex + 1) % this.emails.length;
        return email;
    }

    /**
     * Create a new browser session with Browserbase
     */
    async createBrowserSession() {
        try {
            const browser = await window.playwright.chromium.connectOverCDP(window.connectionString);
            
            const context = await browser.newContext({
                geolocation: { latitude: 40.7128, longitude: -74.0060 },
                locale: 'en-US',
                permissions: ['geolocation'],
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                viewport: { width: 1920, height: 1080 },
                deviceScaleFactor: 1,
                hasTouch: false,
                isMobile: false
            });
            
            const page = await context.newPage();
            return { browser, context, page };
        } catch (error) {
            await this.logError('Failed to create browser session', error);
            throw error;
        }
    }

    /**
     * Enhanced email signup logic with multiple fallback strategies
     */
    async attemptEmailSignup(page, domain, email) {
        const UTM_PARAMS = "?utm_source=automation&utm_medium=signup&utm_campaign=bulk-signup";
        let submitted = false;
        const attempts = [];

        try {
            // Navigate to site
            console.log(`🌐 Navigating to ${domain}...`);
            await page.goto(`${domain}${UTM_PARAMS}`, { 
                waitUntil: "domcontentloaded",
                timeout: this.config.timeoutMs 
            });
            
            // Wait for page to settle
            await page.waitForTimeout(3000);

            // Strategy 1: Handle popups and modals first
            submitted = await this.handlePopupForms(page, email, attempts);
            
            if (!submitted) {
                // Strategy 2: Look for newsletter signup forms
                submitted = await this.handleNewsletterForms(page, email, attempts);
            }
            
            if (!submitted) {
                // Strategy 3: Try footer forms
                submitted = await this.handleFooterForms(page, email, attempts);
            }
            
            if (!submitted) {
                // Strategy 4: Try header forms
                submitted = await this.handleHeaderForms(page, email, attempts);
            }
            
            if (!submitted) {
                // Strategy 5: Generic email input search
                submitted = await this.handleGenericEmailForms(page, email, attempts);
            }

            return {
                success: submitted,
                domain,
                email,
                attempts: attempts,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            attempts.push(`Error: ${error.message}`);
            return {
                success: false,
                domain,
                email,
                attempts: attempts,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Handle popup forms (modals, overlays, etc.)
     */
    async handlePopupForms(page, email, attempts) {
        try {
            // Trigger common popup systems
            await page.evaluate(() => {
                // Klaviyo
                if (window._klOnsite) {
                    window._klOnsite.push(['openForm', '']);
                }
                // Mailchimp
                if (window.mc4wp) {
                    window.mc4wp.forms.trigger('signup_show');
                }
                // Privy
                if (window.Privy) {
                    window.Privy.open();
                }
                // OptinMonster
                if (window.OptinMonsterAPI) {
                    window.OptinMonsterAPI.show();
                }
            });

            await page.waitForTimeout(2000);

            // Look for popup email inputs
            const popupSelectors = [
                'div[class*="popup"] input[type="email"]:visible',
                'div[class*="modal"] input[type="email"]:visible',
                'div[class*="overlay"] input[type="email"]:visible',
                '[role="dialog"] input[type="email"]:visible',
                '.klaviyo-form input[type="email"]:visible',
                '.mc4wp-form input[type="email"]:visible',
                '.privy-form input[type="email"]:visible'
            ];

            for (const selector of popupSelectors) {
                const input = await page.$(selector);
                if (input) {
                    attempts.push(`Found popup form: ${selector}`);
                    await input.fill(email);
                    
                    // Try to find and click submit button
                    const form = await input.evaluateHandle(el => el.closest('form'));
                    if (form) {
                        const submitBtn = await form.$('button[type="submit"], input[type="submit"], button:has-text("Subscribe"), button:has-text("Sign Up"), button:has-text("Join")');
                        if (submitBtn) {
                            await submitBtn.click();
                        } else {
                            await input.press('Enter');
                        }
                        attempts.push(`Submitted popup form via ${selector}`);
                        await page.waitForTimeout(2000);
                        return true;
                    }
                }
            }
        } catch (error) {
            attempts.push(`Popup form error: ${error.message}`);
        }
        return false;
    }

    /**
     * Handle dedicated newsletter signup forms
     */
    async handleNewsletterForms(page, email, attempts) {
        try {
            const newsletterSelectors = [
                'form[class*="newsletter"] input[type="email"]',
                'form[class*="signup"] input[type="email"]',
                'form[class*="subscribe"] input[type="email"]',
                '[class*="newsletter"] input[type="email"]',
                '[class*="email-signup"] input[type="email"]',
                'input[placeholder*="email" i][placeholder*="subscribe" i]',
                'input[placeholder*="newsletter" i]'
            ];

            for (const selector of newsletterSelectors) {
                const input = await page.$(selector);
                if (input && await input.isVisible()) {
                    attempts.push(`Found newsletter form: ${selector}`);
                    await input.fill(email);
                    
                    const form = await input.evaluateHandle(el => el.closest('form'));
                    if (form) {
                        const submitBtn = await form.$('button[type="submit"], input[type="submit"], button');
                        if (submitBtn) {
                            await submitBtn.click();
                        } else {
                            await input.press('Enter');
                        }
                        attempts.push(`Submitted newsletter form via ${selector}`);
                        await page.waitForTimeout(2000);
                        return true;
                    }
                }
            }
        } catch (error) {
            attempts.push(`Newsletter form error: ${error.message}`);
        }
        return false;
    }

    /**
     * Handle footer forms
     */
    async handleFooterForms(page, email, attempts) {
        try {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(2000);

            const footerSelectors = [
                'footer input[type="email"]',
                '[class*="footer"] input[type="email"]',
                'footer form input[type="email"]'
            ];

            for (const selector of footerSelectors) {
                const input = await page.$(selector);
                if (input && await input.isVisible()) {
                    attempts.push(`Found footer form: ${selector}`);
                    await input.fill(email);
                    
                    const form = await input.evaluateHandle(el => el.closest('form'));
                    if (form) {
                        const submitBtn = await form.$('button[type="submit"], input[type="submit"], button:has-text("Subscribe"), button:has-text("Sign Up")');
                        if (submitBtn) {
                            await submitBtn.click();
                        } else {
                            await input.press('Enter');
                        }
                        attempts.push(`Submitted footer form via ${selector}`);
                        await page.waitForTimeout(2000);
                        return true;
                    }
                }
            }
        } catch (error) {
            attempts.push(`Footer form error: ${error.message}`);
        }
        return false;
    }

    /**
     * Handle header forms
     */
    async handleHeaderForms(page, email, attempts) {
        try {
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.waitForTimeout(1000);

            const headerSelectors = [
                'header input[type="email"]',
                '[class*="header"] input[type="email"]',
                'nav input[type="email"]'
            ];

            for (const selector of headerSelectors) {
                const input = await page.$(selector);
                if (input && await input.isVisible()) {
                    attempts.push(`Found header form: ${selector}`);
                    await input.fill(email);
                    
                    const form = await input.evaluateHandle(el => el.closest('form'));
                    if (form) {
                        const submitBtn = await form.$('button[type="submit"], input[type="submit"], button');
                        if (submitBtn) {
                            await submitBtn.click();
                        } else {
                            await input.press('Enter');
                        }
                        attempts.push(`Submitted header form via ${selector}`);
                        await page.waitForTimeout(2000);
                        return true;
                    }
                }
            }
        } catch (error) {
            attempts.push(`Header form error: ${error.message}`);
        }
        return false;
    }

    /**
     * Handle any generic email forms on the page
     */
    async handleGenericEmailForms(page, email, attempts) {
        try {
            const genericSelectors = [
                'input[type="email"]:visible',
                'input[name*="email" i]:visible',
                'input[placeholder*="email" i]:visible'
            ];

            const emailInputs = await page.$$(genericSelectors.join(', '));
            
            for (const input of emailInputs) {
                try {
                    if (await input.isVisible()) {
                        const placeholder = await input.getAttribute('placeholder') || '';
                        const name = await input.getAttribute('name') || '';
                        
                        // Skip if it looks like a login form
                        if (placeholder.toLowerCase().includes('password') || 
                            name.toLowerCase().includes('login') ||
                            name.toLowerCase().includes('signin')) {
                            continue;
                        }
                        
                        attempts.push(`Found generic email input: ${name || placeholder}`);
                        await input.fill(email);
                        
                        const form = await input.evaluateHandle(el => el.closest('form'));
                        if (form) {
                            const submitBtn = await form.$('button[type="submit"], input[type="submit"], button');
                            if (submitBtn) {
                                await submitBtn.click();
                            } else {
                                await input.press('Enter');
                            }
                            attempts.push(`Submitted generic form`);
                            await page.waitForTimeout(2000);
                            return true;
                        }
                    }
                } catch (inputError) {
                    attempts.push(`Generic input error: ${inputError.message}`);
                }
            }
        } catch (error) {
            attempts.push(`Generic form error: ${error.message}`);
        }
        return false;
    }

    /**
     * Process a single domain with retry logic
     */
    async processDomain(domain) {
        let browserSession = null;
        let result = null;

        for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
            try {
                // Create new browser session for each attempt
                browserSession = await this.createBrowserSession();
                const email = this.getNextEmail();
                
                console.log(`🔧 Processing ${domain} (attempt ${attempt}/${this.config.retryAttempts}) with ${email}`);
                
                result = await this.attemptEmailSignup(browserSession.page, domain, email);
                
                if (result.success) {
                    break; // Success, no need to retry
                }
                
                if (attempt < this.config.retryAttempts) {
                    console.log(`⏳ Retrying ${domain} in ${this.config.delayBetweenAttempts}ms...`);
                    await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenAttempts));
                }
                
            } catch (error) {
                console.error(`❌ Error processing ${domain} (attempt ${attempt}):`, error.message);
                result = {
                    success: false,
                    domain,
                    email: this.getNextEmail(),
                    error: error.message,
                    attempt,
                    timestamp: new Date().toISOString()
                };
            } finally {
                // Always close browser session
                if (browserSession) {
                    try {
                        await browserSession.browser.close();
                    } catch (closeError) {
                        console.warn(`Warning: Failed to close browser for ${domain}:`, closeError.message);
                    }
                }
            }
        }

        // Update stats
        this.stats.processed++;
        if (result?.success) {
            this.stats.successful++;
            console.log(`✅ Successfully signed up to ${domain}`);
        } else {
            this.stats.failed++;
            this.stats.errors.push(result);
            console.log(`❌ Failed to sign up to ${domain}`);
        }

        return result;
    }

    /**
     * Send Slack notification
     */
    async sendSlackNotification(message, isError = false) {
        try {
            const channel = isError ? '#automation-errors' : this.config.slackChannel;
            
            // Using Zapier MCP for Slack integration
            await window.zapier.slack_send_channel_message({
                instructions: `Send message to ${channel}: ${message}`,
                channel: channel,
                text: message,
                username: 'Email Signup Bot',
                icon: isError ? '⚠️' : '🤖'
            });
            
            console.log(`📨 Sent Slack notification: ${message.substring(0, 50)}...`);
        } catch (error) {
            console.error('Failed to send Slack notification:', error);
        }
    }

    /**
     * Log error with Slack notification
     */
    async logError(context, error) {
        const errorMessage = `🚨 **Email Signup Automation Error**
**Context:** ${context}
**Error:** ${error.message}
**Time:** ${new Date().toISOString()}
**Processed:** ${this.stats.processed}/${this.domains.length}
**Success Rate:** ${((this.stats.successful / Math.max(this.stats.processed, 1)) * 100).toFixed(1)}%`;

        console.error(`❌ ${context}:`, error);
        await this.sendSlackNotification(errorMessage, true);
    }

    /**
     * Send progress update
     */
    async sendProgressUpdate() {
        const runtime = Math.round((new Date() - this.stats.startTime) / 1000 / 60); // minutes
        const rate = this.stats.processed / Math.max(runtime, 1); // per minute
        const remaining = this.domains.length - this.stats.processed;
        const eta = remaining > 0 ? Math.round(remaining / Math.max(rate, 1)) : 0;

        const message = `📊 **Email Signup Progress Update**
**Batch:** ${this.stats.currentBatch * this.config.notificationInterval} domains completed
**Success:** ${this.stats.successful}/${this.stats.processed} (${((this.stats.successful / Math.max(this.stats.processed, 1)) * 100).toFixed(1)}%)
**Runtime:** ${runtime} minutes
**Rate:** ${rate.toFixed(1)} domains/min
**ETA:** ${eta} minutes remaining
**Active Browsers:** ${this.activeBrowsers.size}/${this.config.maxConcurrentBrowsers}`;

        await this.sendSlackNotification(message);
    }

    /**
     * Main automation runner
     */
    async run() {
        try {
            console.log('🚀 Starting Email Signup Automation...');
            await this.loadData();
            
            // Send startup notification
            await this.sendSlackNotification(`🚀 **Email Signup Automation Started**
**Domains:** ${this.domains.length}
**Email Accounts:** ${this.emails.length}
**Concurrent Browsers:** ${this.config.maxConcurrentBrowsers}
**Notification Interval:** Every ${this.config.notificationInterval} domains`);

            // Process domains in batches with concurrency control
            const batchSize = this.config.maxConcurrentBrowsers;
            
            for (let i = 0; i < this.domains.length; i += batchSize) {
                const batch = this.domains.slice(i, i + batchSize);
                console.log(`\n🎯 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(this.domains.length / batchSize)} (${batch.length} domains)`);
                
                // Process batch concurrently
                const promises = batch.map(domain => this.processDomain(domain));
                await Promise.allSettled(promises);
                
                // Send progress notification every N domains
                if ((i + batchSize) % this.config.notificationInterval === 0 || i + batchSize >= this.domains.length) {
                    this.stats.currentBatch = Math.floor((i + batchSize) / this.config.notificationInterval);
                    await this.sendProgressUpdate();
                }
                
                // Small delay between batches to avoid overwhelming
                if (i + batchSize < this.domains.length) {
                    console.log('⏳ Brief pause between batches...');
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }

            // Final summary
            const totalTime = Math.round((new Date() - this.stats.startTime) / 1000 / 60);
            const finalMessage = `🎉 **Email Signup Automation Completed!**
**Total Processed:** ${this.stats.processed}
**Successful:** ${this.stats.successful}
**Failed:** ${this.stats.failed}
**Success Rate:** ${((this.stats.successful / this.stats.processed) * 100).toFixed(1)}%
**Total Runtime:** ${totalTime} minutes
**Average Rate:** ${(this.stats.processed / Math.max(totalTime, 1)).toFixed(1)} domains/min`;

            await this.sendSlackNotification(finalMessage);
            console.log('\n🎉 Automation completed successfully!');
            
            return this.stats;

        } catch (error) {
            await this.logError('Automation failed', error);
            throw error;
        }
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EmailSignupAutomation;
}

// Auto-run if executed directly
if (typeof window !== 'undefined' && window.location) {
    // Running in browser environment
    const automation = new EmailSignupAutomation({
        slackChannel: '#email-automation'
    });
    
    automation.run().catch(error => {
        console.error('Automation failed:', error);
    });
} 