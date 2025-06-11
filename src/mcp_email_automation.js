/**
 * MCP-Based Email Signup Automation
 * 
 * This script uses Browserbase MCP and Zapier MCP APIs to automate
 * email signups across thousands of domains with 50 concurrent browsers.
 * 
 * Features:
 * - 50 concurrent Browserbase sessions
 * - Email rotation through 69 accounts
 * - Slack notifications every 100 domains
 * - Comprehensive error handling and retries
 * - Multiple signup form detection strategies
 */

const fs = require('fs').promises;
const path = require('path');

class MCPEmailAutomation {
    constructor(config = {}) {
        this.config = {
            maxConcurrentBrowsers: 50,
            notificationInterval: 100,
            retryAttempts: 3,
            timeoutMs: 30000,
            delayBetweenAttempts: 2000,
            delayBetweenBatches: 5000,
            slackChannel: '#email-automation',
            errorChannel: '#automation-errors',
            ...config
        };
        
        this.domains = [];
        this.emails = [];
        this.emailIndex = 0;
        this.stats = {
            processed: 0,
            successful: 0,
            failed: 0,
            errors: [],
            startTime: new Date(),
            activeSessions: new Set()
        };
        
        this.activeSessions = new Map(); // sessionId -> domain info
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
                })
                .filter(domain => domain !== 'https://'); // Remove empty domains

            // Load emails (just the email addresses)
            const emailsContent = await fs.readFile('mailboxaccounts.csv', 'utf-8');
            const emailLines = emailsContent.split('\n').slice(1); // Skip header
            this.emails = emailLines
                .filter(line => line.trim())
                .map(line => line.split(',')[0].trim())
                .filter(email => email && email.includes('@'));

            // Apply test mode limits if configured
            if (this.config.testMode && this.config.maxTestDomains) {
                console.log(`🧪 Test mode: limiting to ${this.config.maxTestDomains} domains`);
                this.domains = this.domains.slice(0, this.config.maxTestDomains);
            }

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
     * Create a new Browserbase session
     */
    async createBrowserSession() {
        try {
            const response = await mcp_Browserbase_browserbase_session_create({});
            const sessionId = response.sessionId;
            
            console.log(`🌐 Created browser session: ${sessionId}`);
            this.stats.activeSessions.add(sessionId);
            
            return sessionId;
        } catch (error) {
            await this.logError('Failed to create browser session', error);
            throw error;
        }
    }

    /**
     * Navigate to a domain with UTM parameters
     */
    async navigateToDomain(sessionId, domain) {
        const utmParams = "?utm_source=automation&utm_medium=signup&utm_campaign=bulk-signup";
        const url = `${domain}${utmParams}`;
        
        try {
            await mcp_Browserbase_browserbase_navigate({
                url: url
            });
            
            // Wait for page to load
            await mcp_Browserbase_browserbase_wait({ time: 3 });
            
            return url;
        } catch (error) {
            console.error(`Failed to navigate to ${domain}:`, error.message);
            throw error;
        }
    }

    /**
     * Take a snapshot to get current page state
     */
    async takeSnapshot() {
        try {
            const snapshot = await mcp_Browserbase_browserbase_snapshot({
                random_string: 'snapshot'
            });
            return snapshot;
        } catch (error) {
            console.warn('Failed to take snapshot:', error.message);
            return null;
        }
    }

    /**
     * Attempt to fill and submit email signup forms
     */
    async attemptEmailSignup(sessionId, domain, email) {
        const attempts = [];
        let submitted = false;

        try {
            console.log(`🔧 Processing ${domain} with ${email} (session: ${sessionId})`);
            
            // Navigate to the domain
            await this.navigateToDomain(sessionId, domain);
            attempts.push(`Navigated to ${domain}`);
            
            // Get page snapshot to understand structure
            const snapshot = await this.takeSnapshot();
            
            // Strategy 1: Look for popup/modal email inputs
            submitted = await this.handlePopupForms(email, attempts);
            
            if (!submitted) {
                // Strategy 2: Look for newsletter signup forms
                submitted = await this.handleNewsletterForms(email, attempts);
            }
            
            if (!submitted) {
                // Strategy 3: Look for footer email forms
                submitted = await this.handleFooterForms(email, attempts);
            }
            
            if (!submitted) {
                // Strategy 4: Look for any email input
                submitted = await this.handleGenericEmailForms(email, attempts);
            }

            return {
                success: submitted,
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
        }
    }

    /**
     * Handle popup/modal forms
     */
    async handlePopupForms(email, attempts) {
        try {
            // Common popup email input selectors
            const popupSelectors = [
                'div[class*="popup"] input[type="email"]',
                'div[class*="modal"] input[type="email"]',
                '[role="dialog"] input[type="email"]',
                '.klaviyo-form input[type="email"]',
                '.mc4wp-form input[type="email"]',
                '.privy-form input[type="email"]'
            ];

            for (const selector of popupSelectors) {
                try {
                    // Try to type in the email input
                    await mcp_Browserbase_browserbase_type({
                        element: `Email input in popup (${selector})`,
                        ref: selector,
                        text: email,
                        slowly: false
                    });

                    attempts.push(`Found popup form: ${selector}`);

                    // Try to submit by pressing Enter
                    await mcp_Browserbase_browserbase_press_key({ key: 'Enter' });
                    await mcp_Browserbase_browserbase_wait({ time: 2 });

                    attempts.push(`Submitted popup form via Enter`);
                    return true;

                } catch (error) {
                    // This selector didn't work, try next one
                    continue;
                }
            }
        } catch (error) {
            attempts.push(`Popup form error: ${error.message}`);
        }
        return false;
    }

    /**
     * Handle newsletter signup forms
     */
    async handleNewsletterForms(email, attempts) {
        try {
            const newsletterSelectors = [
                'form[class*="newsletter"] input[type="email"]',
                'form[class*="signup"] input[type="email"]',
                '[class*="newsletter"] input[type="email"]',
                'input[placeholder*="newsletter" i]',
                'input[placeholder*="subscribe" i]'
            ];

            for (const selector of newsletterSelectors) {
                try {
                    await mcp_Browserbase_browserbase_type({
                        element: `Newsletter email input (${selector})`,
                        ref: selector,
                        text: email,
                        slowly: false
                    });

                    attempts.push(`Found newsletter form: ${selector}`);

                    // Try to submit
                    await mcp_Browserbase_browserbase_press_key({ key: 'Enter' });
                    await mcp_Browserbase_browserbase_wait({ time: 2 });

                    attempts.push(`Submitted newsletter form`);
                    return true;

                } catch (error) {
                    continue;
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
    async handleFooterForms(email, attempts) {
        try {
            // Scroll to bottom to reveal footer
            await mcp_Browserbase_browserbase_press_key({ key: 'End' });
            await mcp_Browserbase_browserbase_wait({ time: 2 });

            const footerSelectors = [
                'footer input[type="email"]',
                '[class*="footer"] input[type="email"]'
            ];

            for (const selector of footerSelectors) {
                try {
                    await mcp_Browserbase_browserbase_type({
                        element: `Footer email input (${selector})`,
                        ref: selector,
                        text: email,
                        slowly: false
                    });

                    attempts.push(`Found footer form: ${selector}`);

                    await mcp_Browserbase_browserbase_press_key({ key: 'Enter' });
                    await mcp_Browserbase_browserbase_wait({ time: 2 });

                    attempts.push(`Submitted footer form`);
                    return true;

                } catch (error) {
                    continue;
                }
            }
        } catch (error) {
            attempts.push(`Footer form error: ${error.message}`);
        }
        return false;
    }

    /**
     * Handle any generic email forms
     */
    async handleGenericEmailForms(email, attempts) {
        try {
            const genericSelectors = [
                'input[type="email"]',
                'input[name*="email" i]',
                'input[placeholder*="email" i]'
            ];

            for (const selector of genericSelectors) {
                try {
                    await mcp_Browserbase_browserbase_type({
                        element: `Generic email input (${selector})`,
                        ref: selector,
                        text: email,
                        slowly: false
                    });

                    attempts.push(`Found generic email input: ${selector}`);

                    await mcp_Browserbase_browserbase_press_key({ key: 'Enter' });
                    await mcp_Browserbase_browserbase_wait({ time: 2 });

                    attempts.push(`Submitted generic form`);
                    return true;

                } catch (error) {
                    continue;
                }
            }
        } catch (error) {
            attempts.push(`Generic form error: ${error.message}`);
        }
        return false;
    }

    /**
     * Close a browser session
     */
    async closeBrowserSession(sessionId) {
        try {
            await mcp_Browserbase_browserbase_session_close({
                random_string: sessionId
            });
            this.stats.activeSessions.delete(sessionId);
            console.log(`🗑️ Closed browser session: ${sessionId}`);
        } catch (error) {
            console.warn(`Failed to close session ${sessionId}:`, error.message);
        }
    }

    /**
     * Send Slack notification
     */
    async sendSlackNotification(message, isError = false) {
        try {
            const channel = isError ? this.config.errorChannel : this.config.slackChannel;
            
            await mcp_Zapier_slack_send_channel_message({
                instructions: `Send automation update to ${channel}`,
                channel: channel,
                text: message,
                username: 'Email Signup Bot',
                as_bot: 'true'
            });
            
            console.log(`📨 Sent Slack notification to ${channel}`);
        } catch (error) {
            console.error('Failed to send Slack notification:', error.message);
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
**Progress:** ${this.stats.processed}/${this.domains.length}
**Success Rate:** ${((this.stats.successful / Math.max(this.stats.processed, 1)) * 100).toFixed(1)}%
**Active Sessions:** ${this.stats.activeSessions.size}`;

        console.error(`❌ ${context}:`, error);
        await this.sendSlackNotification(errorMessage, true);
    }

    /**
     * Send progress update
     */
    async sendProgressUpdate() {
        const runtime = Math.round((new Date() - this.stats.startTime) / 1000 / 60);
        const rate = this.stats.processed / Math.max(runtime, 1);
        const remaining = this.domains.length - this.stats.processed;
        const eta = remaining > 0 ? Math.round(remaining / Math.max(rate, 1)) : 0;

        const message = `📊 **Email Signup Progress Update**
**Completed:** ${this.stats.processed}/${this.domains.length}
**Successful:** ${this.stats.successful} (${((this.stats.successful / Math.max(this.stats.processed, 1)) * 100).toFixed(1)}%)
**Failed:** ${this.stats.failed}
**Runtime:** ${runtime} minutes
**Rate:** ${rate.toFixed(1)} domains/minute
**ETA:** ${eta} minutes remaining
**Active Sessions:** ${this.stats.activeSessions.size}/${this.config.maxConcurrentBrowsers}`;

        await this.sendSlackNotification(message);
        console.log('📊 Progress update sent');
    }

    /**
     * Process a single domain with retry logic
     */
    async processDomain(domain) {
        let sessionId = null;
        let result = null;

        for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
            try {
                // Create new session for each attempt
                sessionId = await this.createBrowserSession();
                this.activeSessions.set(sessionId, { domain, startTime: new Date() });
                
                const email = this.getNextEmail();
                result = await this.attemptEmailSignup(sessionId, domain, email);
                
                if (result.success) {
                    break; // Success, no need to retry
                }
                
                if (attempt < this.config.retryAttempts) {
                    console.log(`⏳ Retrying ${domain} (attempt ${attempt + 1}/${this.config.retryAttempts})`);
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
                // Always close the session
                if (sessionId) {
                    await this.closeBrowserSession(sessionId);
                    this.activeSessions.delete(sessionId);
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
     * Main automation runner
     */
    async run() {
        try {
            console.log('🚀 Starting MCP Email Signup Automation...');
            await this.loadData();
            
            // Send startup notification
            await this.sendSlackNotification(`🚀 **Email Signup Automation Started**
**Domains:** ${this.domains.length}
**Email Accounts:** ${this.emails.length}
**Max Concurrent Browsers:** ${this.config.maxConcurrentBrowsers}
**Notification Interval:** Every ${this.config.notificationInterval} domains`);

            // Process domains in batches with concurrency control
            const batchSize = this.config.maxConcurrentBrowsers;
            
            for (let i = 0; i < this.domains.length; i += batchSize) {
                const batch = this.domains.slice(i, i + batchSize);
                const batchNumber = Math.floor(i / batchSize) + 1;
                const totalBatches = Math.ceil(this.domains.length / batchSize);
                
                console.log(`\n🎯 Processing batch ${batchNumber}/${totalBatches} (${batch.length} domains)`);
                
                // Process batch concurrently
                const promises = batch.map(domain => this.processDomain(domain));
                const results = await Promise.allSettled(promises);
                
                console.log(`✅ Batch ${batchNumber} completed`);
                
                // Send progress notification every N domains
                if ((i + batchSize) % this.config.notificationInterval === 0 || i + batchSize >= this.domains.length) {
                    await this.sendProgressUpdate();
                }
                
                // Brief pause between batches
                if (i + batchSize < this.domains.length) {
                    console.log(`⏳ Pausing ${this.config.delayBetweenBatches}ms between batches...`);
                    await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenBatches));
                }
            }

            // Final summary
            const totalTime = Math.round((new Date() - this.stats.startTime) / 1000 / 60);
            const successRate = ((this.stats.successful / this.stats.processed) * 100).toFixed(1);
            
            const finalMessage = `🎉 **Email Signup Automation Completed!**
**Total Processed:** ${this.stats.processed}
**Successful:** ${this.stats.successful}
**Failed:** ${this.stats.failed}
**Success Rate:** ${successRate}%
**Total Runtime:** ${totalTime} minutes
**Average Rate:** ${(this.stats.processed / Math.max(totalTime, 1)).toFixed(1)} domains/minute`;

            await this.sendSlackNotification(finalMessage);
            console.log('\n🎉 Automation completed successfully!');
            
            // Save results to file
            await this.saveResults();
            
            return this.stats;

        } catch (error) {
            await this.logError('Automation failed', error);
            throw error;
        }
    }

    /**
     * Save automation results to file
     */
    async saveResults() {
        try {
            const results = {
                stats: this.stats,
                config: this.config,
                timestamp: new Date().toISOString(),
                errors: this.stats.errors
            };
            
            await fs.writeFile('logs/automation_results.json', JSON.stringify(results, null, 2));
            console.log('💾 Results saved to logs/automation_results.json');
        } catch (error) {
            console.error('Failed to save results:', error.message);
        }
    }
}

// Export for use
module.exports = MCPEmailAutomation;

// Auto-run if executed directly
if (require.main === module) {
    const automation = new MCPEmailAutomation({
        slackChannel: '#email-automation',
        errorChannel: '#automation-errors'
    });
    
    automation.run().catch(error => {
        console.error('💥 Automation failed:', error);
        process.exit(1);
    });
} 