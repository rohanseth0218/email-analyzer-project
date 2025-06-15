/**
 * Browserbase Email Signup Automation Runner
 * 
 * INSTRUCTIONS:
 * 1. Copy this entire script
 * 2. Paste it into Browserbase console
 * 3. The automation will start automatically
 * 4. Check Slack for progress updates every 100 domains
 * 
 * REQUIREMENTS:
 * - Browserbase MCP configured
 * - Zapier MCP configured for Slack
 * - CSV files uploaded to the session
 */

// ===== CONFIGURATION =====
const CONFIG = {
    maxConcurrentBrowsers: 50,
    notificationInterval: 100,
    retryAttempts: 3,
    timeoutMs: 30000,
    delayBetweenAttempts: 2000,
    slackChannel: '#email-automation',
    errorChannel: '#automation-errors'
};

// ===== MAIN AUTOMATION CLASS =====
class BrowserbaseEmailAutomation {
    constructor() {
        this.domains = [];
        this.emails = [];
        this.emailIndex = 0;
        this.stats = {
            processed: 0,
            successful: 0,
            failed: 0,
            errors: [],
            startTime: new Date(),
            currentBatch: 0
        };
        this.activeSessions = new Map();
    }

    // Load CSV data (you'll need to paste CSV data or upload files)
    async loadData() {
        console.log('📂 Loading data...');
        
        // For Browserbase, you'll need to either:
        // 1. Upload CSV files to the session, or
        // 2. Paste the data directly here
        
        // Method 1: If files are uploaded
        try {
            const domainsResponse = await fetch('/Storedomains.csv');
            const domainsText = await domainsResponse.text();
            const domainLines = domainsText.split('\n').slice(1);
            this.domains = domainLines
                .filter(line => line.trim())
                .map(line => {
                    const domain = line.split(',')[0].trim();
                    return domain.startsWith('http') ? domain : `https://${domain}`;
                });

            const emailsResponse = await fetch('/mailboxaccounts.csv');
            const emailsText = await emailsResponse.text();
            const emailLines = emailsText.split('\n').slice(1);
            this.emails = emailLines
                .filter(line => line.trim())
                .map(line => line.split(',')[0].trim())
                .filter(email => email);
        } catch (error) {
            console.warn('Could not load CSV files. Using fallback data...');
            
            // Method 2: Fallback - you can paste domain data here
            this.domains = [
                'https://www.sanrio.com',
                'https://www.khy.com',
                'https://skims.com',
                'https://www.forever21.com',
                'https://soldejaneiro.com'
                // Add more domains here...
            ];
            
            this.emails = [
                'rohan.seth@openripplestudio.info',
                'rohan.s@openripplestudio.info',
                'rohan.seth@trygetripplemedia.com'
                // Add more emails here...
            ];
        }

        console.log(`✅ Loaded ${this.domains.length} domains and ${this.emails.length} emails`);
    }

    getNextEmail() {
        const email = this.emails[this.emailIndex];
        this.emailIndex = (this.emailIndex + 1) % this.emails.length;
        return email;
    }

    // Enhanced email signup with multiple strategies
    async attemptEmailSignup(domain, email) {
        const browser = await window.playwright.chromium.connectOverCDP(window.connectionString);
        const context = await browser.newContext({
            geolocation: { latitude: 40.7128, longitude: -74.0060 },
            locale: 'en-US',
            permissions: ['geolocation'],
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            viewport: { width: 1920, height: 1080 }
        });
        const page = await context.newPage();

        let submitted = false;
        const attempts = [];

        try {
            console.log(`🌐 Processing: ${domain} with ${email}`);
            
            // Navigate with UTM parameters
            const url = `${domain}?utm_source=automation&utm_medium=signup&utm_campaign=bulk-signup`;
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: CONFIG.timeoutMs });
            await page.waitForTimeout(3000);

            // Strategy 1: Popup forms
            submitted = await this.handlePopups(page, email, attempts);
            
            if (!submitted) {
                // Strategy 2: Newsletter forms
                submitted = await this.handleNewsletterForms(page, email, attempts);
            }
            
            if (!submitted) {
                // Strategy 3: Footer forms
                submitted = await this.handleFooterForms(page, email, attempts);
            }
            
            if (!submitted) {
                // Strategy 4: Any email input
                submitted = await this.handleGenericForms(page, email, attempts);
            }

            return {
                success: submitted,
                domain,
                email,
                attempts,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            attempts.push(`Error: ${error.message}`);
            return {
                success: false,
                domain,
                email,
                error: error.message,
                attempts,
                timestamp: new Date().toISOString()
            };
        } finally {
            try {
                await browser.close();
            } catch (e) {
                console.warn('Failed to close browser:', e.message);
            }
        }
    }

    async handlePopups(page, email, attempts) {
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
            });

            await page.waitForTimeout(2000);

            const popupSelectors = [
                'div[class*="popup"] input[type="email"]:visible',
                'div[class*="modal"] input[type="email"]:visible',
                '[role="dialog"] input[type="email"]:visible',
                '.klaviyo-form input[type="email"]:visible',
                '.mc4wp-form input[type="email"]:visible'
            ];

            for (const selector of popupSelectors) {
                const input = await page.$(selector);
                if (input) {
                    attempts.push(`Found popup: ${selector}`);
                    await input.fill(email);

                    // Find submit button
                    const form = await input.evaluateHandle(el => el.closest('form'));
                    const submitBtn = await form.$('button[type="submit"], input[type="submit"], button:has-text("Subscribe"), button:has-text("Sign Up")');
                    
                    if (submitBtn) {
                        try {
                            await submitBtn.click({ timeout: 5000 });
                        } catch {
                            await page.evaluate(el => el.click(), submitBtn);
                        }
                    } else {
                        await input.press('Enter');
                    }

                    attempts.push(`Submitted popup form`);
                    await page.waitForTimeout(2000);
                    return true;
                }
            }
        } catch (error) {
            attempts.push(`Popup error: ${error.message}`);
        }
        return false;
    }

    async handleNewsletterForms(page, email, attempts) {
        try {
            const selectors = [
                'form[class*="newsletter"] input[type="email"]',
                'form[class*="signup"] input[type="email"]',
                '[class*="newsletter"] input[type="email"]',
                'input[placeholder*="newsletter" i]'
            ];

            for (const selector of selectors) {
                const input = await page.$(selector);
                if (input && await input.isVisible()) {
                    attempts.push(`Found newsletter: ${selector}`);
                    await input.fill(email);

                    const form = await input.evaluateHandle(el => el.closest('form'));
                    const submitBtn = await form.$('button[type="submit"], input[type="submit"], button');
                    
                    if (submitBtn) {
                        await submitBtn.click();
                    } else {
                        await input.press('Enter');
                    }

                    attempts.push(`Submitted newsletter form`);
                    await page.waitForTimeout(2000);
                    return true;
                }
            }
        } catch (error) {
            attempts.push(`Newsletter error: ${error.message}`);
        }
        return false;
    }

    async handleFooterForms(page, email, attempts) {
        try {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(2000);

            const input = await page.$('footer input[type="email"]');
            if (input && await input.isVisible()) {
                attempts.push('Found footer form');
                await input.fill(email);

                const form = await input.evaluateHandle(el => el.closest('form'));
                const submitBtn = await form.$('button[type="submit"], input[type="submit"], button:has-text("Subscribe")');
                
                if (submitBtn) {
                    await submitBtn.click();
                } else {
                    await input.press('Enter');
                }

                attempts.push('Submitted footer form');
                await page.waitForTimeout(2000);
                return true;
            }
        } catch (error) {
            attempts.push(`Footer error: ${error.message}`);
        }
        return false;
    }

    async handleGenericForms(page, email, attempts) {
        try {
            const inputs = await page.$$('input[type="email"]:visible');
            
            for (const input of inputs) {
                if (await input.isVisible()) {
                    const placeholder = await input.getAttribute('placeholder') || '';
                    const name = await input.getAttribute('name') || '';
                    
                    // Skip login forms
                    if (placeholder.toLowerCase().includes('password') || 
                        name.toLowerCase().includes('login')) {
                        continue;
                    }
                    
                    attempts.push(`Found generic input: ${name || placeholder}`);
                    await input.fill(email);

                    const form = await input.evaluateHandle(el => el.closest('form'));
                    const submitBtn = await form.$('button[type="submit"], input[type="submit"], button');
                    
                    if (submitBtn) {
                        await submitBtn.click();
                    } else {
                        await input.press('Enter');
                    }

                    attempts.push('Submitted generic form');
                    await page.waitForTimeout(2000);
                    return true;
                }
            }
        } catch (error) {
            attempts.push(`Generic error: ${error.message}`);
        }
        return false;
    }

    // Send Slack notification
    async sendSlackNotification(message, isError = false) {
        try {
            const channel = isError ? CONFIG.errorChannel : CONFIG.slackChannel;
            
            // Using MCP Zapier integration
            if (window.mcp_Zapier_slack_send_channel_message) {
                await window.mcp_Zapier_slack_send_channel_message({
                    instructions: `Send message to ${channel}: ${message}`,
                    channel: channel,
                    text: message,
                    username: 'Email Signup Bot',
                    as_bot: 'true'
                });
            } else {
                console.log(`📨 Would send Slack: ${message.substring(0, 100)}...`);
            }
        } catch (error) {
            console.error('Slack notification failed:', error);
        }
    }

    async sendProgressUpdate() {
        const runtime = Math.round((new Date() - this.stats.startTime) / 1000 / 60);
        const rate = this.stats.processed / Math.max(runtime, 1);
        const remaining = this.domains.length - this.stats.processed;
        const eta = remaining > 0 ? Math.round(remaining / Math.max(rate, 1)) : 0;

        const message = `📊 **Email Signup Progress**
Completed: ${this.stats.processed}/${this.domains.length}
Success: ${this.stats.successful} (${((this.stats.successful / Math.max(this.stats.processed, 1)) * 100).toFixed(1)}%)
Runtime: ${runtime} min | Rate: ${rate.toFixed(1)}/min | ETA: ${eta} min`;

        await this.sendSlackNotification(message);
        console.log(message);
    }

    // Process single domain with retries
    async processDomain(domain) {
        let result = null;

        for (let attempt = 1; attempt <= CONFIG.retryAttempts; attempt++) {
            try {
                const email = this.getNextEmail();
                result = await this.attemptEmailSignup(domain, email);
                
                if (result.success) {
                    break;
                }
                
                if (attempt < CONFIG.retryAttempts) {
                    console.log(`⏳ Retrying ${domain}...`);
                    await new Promise(resolve => setTimeout(resolve, CONFIG.delayBetweenAttempts));
                }
            } catch (error) {
                console.error(`❌ Error with ${domain}:`, error.message);
                result = {
                    success: false,
                    domain,
                    error: error.message,
                    timestamp: new Date().toISOString()
                };
            }
        }

        // Update stats
        this.stats.processed++;
        if (result?.success) {
            this.stats.successful++;
            console.log(`✅ Success: ${domain}`);
        } else {
            this.stats.failed++;
            this.stats.errors.push(result);
            console.log(`❌ Failed: ${domain}`);
        }

        return result;
    }

    // Main runner
    async run() {
        try {
            console.log('🚀 Starting Email Signup Automation...');
            await this.loadData();

            await this.sendSlackNotification(`🚀 **Automation Started**
Domains: ${this.domains.length} | Emails: ${this.emails.length}
Concurrent: ${CONFIG.maxConcurrentBrowsers} browsers`);

            // Process in batches
            const batchSize = Math.min(CONFIG.maxConcurrentBrowsers, 10); // Start smaller for stability
            
            for (let i = 0; i < this.domains.length; i += batchSize) {
                const batch = this.domains.slice(i, i + batchSize);
                console.log(`\n🎯 Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} domains`);
                
                // Process batch with limited concurrency
                const promises = batch.map(domain => this.processDomain(domain));
                await Promise.allSettled(promises);
                
                // Progress updates
                if ((i + batchSize) % CONFIG.notificationInterval === 0 || i + batchSize >= this.domains.length) {
                    await this.sendProgressUpdate();
                }
                
                // Brief pause between batches
                if (i + batchSize < this.domains.length) {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }

            // Final summary
            const totalTime = Math.round((new Date() - this.stats.startTime) / 1000 / 60);
            const finalMessage = `🎉 **Automation Complete!**
Processed: ${this.stats.processed} | Success: ${this.stats.successful}
Success Rate: ${((this.stats.successful / this.stats.processed) * 100).toFixed(1)}%
Total Time: ${totalTime} minutes`;

            await this.sendSlackNotification(finalMessage);
            console.log('\n' + finalMessage);
            
            return this.stats;

        } catch (error) {
            const errorMsg = `🚨 **Automation Failed**: ${error.message}`;
            await this.sendSlackNotification(errorMsg, true);
            console.error(errorMsg, error);
            throw error;
        }
    }
}

// ===== AUTO-START =====
console.log('🤖 Email Signup Automation Loaded');
console.log('Starting automation in 3 seconds...');

setTimeout(async () => {
    const automation = new BrowserbaseEmailAutomation();
    try {
        await automation.run();
    } catch (error) {
        console.error('💥 Automation failed:', error);
    }
}, 3000);

// ===== MANUAL CONTROLS =====
// You can also control manually:
// window.emailAutomation = new BrowserbaseEmailAutomation();
// window.emailAutomation.run(); 