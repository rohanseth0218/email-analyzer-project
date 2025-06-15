const { chromium } = require('playwright');
const fs = require('fs').promises;
const axios = require('axios');

class Diagnostic5DomainTest {
    constructor() {
        this.progress = {
            domains_processed: 0,
            successful_signups: 0,
            failed_domains: 0,
            rate_limit_errors: 0,
            form_detection_failures: 0,
            browser_errors: 0,
            other_errors: 0,
            detailed_logs: []
        };
        
        this.testDomains = [
            'https://www.sanrio.com',
            'https://skims.com',
            'https://soldejaneiro.com',
            'https://thursdayboots.com',
            'https://www.thesill.com'
        ];
        
        this.emails = [
            'testemailforapp991@gmail.com',
            'testemailforapp992@gmail.com',
            'testemailforapp993@gmail.com',
            'testemailforapp994@gmail.com',
            'testemailforapp995@gmail.com'
        ];
        
        this.slackWebhook = "https://hooks.slack.com/services/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";
        
        // Browserbase config (from working automation)
        this.BROWSERBASE_API_KEY = 'bb_live_FTV11nF0Vs1NR_T_rVBHRmQHv74';
        this.BROWSERBASE_PROJECT_ID = 'd277f38a-cc07-4af9-8473-83cefed0bfcd';
    }

    async sendSlackNotification(message, isError = false) {
        try {
            const color = isError ? '#ff0000' : '#00ff00';
            const payload = {
                text: `🔍 5-Domain Diagnostic Test`,
                attachments: [{
                    color: color,
                    text: message,
                    ts: Math.floor(Date.now() / 1000)
                }]
            };
            
            await axios.post(this.slackWebhook, payload);
        } catch (error) {
            console.error('❌ Slack notification failed:', error.message);
        }
    }

    async log(message, type = 'INFO') {
        const timestamp = new Date().toISOString();
        const logEntry = `${timestamp} [${type}] ${message}`;
        
        console.log(logEntry);
        this.progress.detailed_logs.push(logEntry);
        
        // Write to file immediately
        await fs.appendFile('diagnostic_5domains.log', logEntry + '\n');
    }

    async createBrowserbaseSession() {
        try {
            await this.log('🔄 Creating Browserbase session...');
            
            const response = await axios.post('https://api.browserbase.com/v1/sessions', 
                {
                    projectId: this.BROWSERBASE_PROJECT_ID,
                    browserSettings: {
                        viewport: { width: 1920, height: 1080 },
                        stealth: true
                    }
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-BB-API-Key': this.BROWSERBASE_API_KEY
                    },
                    timeout: 15000
                }
            );
            
            const sessionId = response.data.id;
            const connectUrl = response.data.connectUrl;
            await this.log(`✅ Session created: ${sessionId}`);
            
            const browser = await chromium.connect(connectUrl);
            const context = await browser.newContext();
            const page = await context.newPage();
            
            await this.log(`✅ Browser connected and page created`);
            
            return { sessionId, browser, context, page, connectUrl };
        } catch (error) {
            await this.log(`❌ Session creation failed: ${error.message}`, 'ERROR');
            if (error.response) {
                await this.log(`❌ Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`, 'ERROR');
                
                if (error.response.status === 429) {
                    this.progress.rate_limit_errors++;
                    await this.log('🚨 RATE LIMIT DETECTED - 429 Error!', 'ERROR');
                }
            }
            throw error;
        }
    }

    async testSingleDomain(domain, email, index) {
        let sessionData = null;
        
        try {
            await this.log(`\n🔍 TESTING DOMAIN ${index + 1}/5: ${domain} with ${email}`);
            
            // Create session
            sessionData = await this.createBrowserbaseSession();
            const { sessionId, browser, context, page } = sessionData;
            
            await this.log(`📝 Session ${sessionId} - Navigating to ${domain}`);
            
            // Navigate with timeout and error handling
            const startTime = Date.now();
            try {
                await page.goto(domain, { 
                    waitUntil: 'domcontentloaded', 
                    timeout: 30000 
                });
                
                const loadTime = Date.now() - startTime;
                await this.log(`✅ Page loaded in ${loadTime}ms`);
                
                // Take screenshot for debugging
                await page.screenshot({ 
                    path: `logs/diagnostic_${domain}_${index}.png`,
                    fullPage: true 
                });
                await this.log(`📸 Screenshot saved: diagnostic_${domain}_${index}.png`);
                
            } catch (navError) {
                await this.log(`❌ Navigation failed: ${navError.message}`, 'ERROR');
                
                if (navError.message.includes('net::ERR_CONNECTION_REFUSED')) {
                    await this.log(`🚫 Domain ${domain} appears to be unreachable`, 'WARN');
                } else if (navError.message.includes('429')) {
                    this.progress.rate_limit_errors++;
                    await this.log('🚨 RATE LIMIT ERROR during navigation!', 'ERROR');
                }
                
                this.progress.failed_domains++;
                return { success: false, error: 'Navigation failed', domain };
            }
            
            // Look for email forms
            await this.log(`🔍 Searching for email input forms...`);
            
            const emailSelectors = [
                'input[type="email"]',
                'input[name*="email" i]',
                'input[placeholder*="email" i]',
                'input[id*="email" i]',
                'input[class*="email" i]'
            ];
            
            let emailInput = null;
            let foundSelector = null;
            
            for (const selector of emailSelectors) {
                try {
                    const elements = await page.$$(selector);
                    if (elements.length > 0) {
                        emailInput = elements[0];
                        foundSelector = selector;
                        await this.log(`✅ Found email input with selector: ${selector}`);
                        break;
                    }
                } catch (e) {
                    await this.log(`⚠️ Selector ${selector} failed: ${e.message}`, 'WARN');
                }
            }
            
            if (!emailInput) {
                await this.log(`❌ No email input found on ${domain}`, 'ERROR');
                this.progress.form_detection_failures++;
                this.progress.failed_domains++;
                
                // Get page content for analysis
                const pageText = await page.textContent('body');
                await this.log(`📄 Page text preview: ${pageText.substring(0, 200)}...`, 'DEBUG');
                
                return { success: false, error: 'No email form found', domain };
            }
            
            // Try to fill and submit the form
            await this.log(`📝 Filling email input with: ${email}`);
            
            try {
                await emailInput.fill(email);
                await this.log(`✅ Email filled successfully`);
                
                // Look for submit button
                const submitSelectors = [
                    'button[type="submit"]',
                    'input[type="submit"]',
                    'button:has-text("Subscribe")',
                    'button:has-text("Join")',
                    'button:has-text("Sign up")',
                    `button:near(${foundSelector})`
                ];
                
                let submitButton = null;
                for (const selector of submitSelectors) {
                    try {
                        const button = await page.$(selector);
                        if (button) {
                            submitButton = button;
                            await this.log(`✅ Found submit button with: ${selector}`);
                            break;
                        }
                    } catch (e) {
                        await this.log(`⚠️ Submit selector ${selector} failed: ${e.message}`, 'WARN');
                    }
                }
                
                if (submitButton) {
                    await this.log(`🚀 Clicking submit button...`);
                    await submitButton.click();
                    
                    // Wait for response
                    await page.waitForTimeout(3000);
                    
                    // Take screenshot after submission
                    await page.screenshot({ 
                        path: `logs/diagnostic_${domain}_${index}_after_submit.png`,
                        fullPage: true 
                    });
                    
                    await this.log(`✅ Form submitted successfully for ${domain}!`);
                    this.progress.successful_signups++;
                    
                    return { success: true, domain, email };
                } else {
                    await this.log(`❌ No submit button found`, 'ERROR');
                    this.progress.form_detection_failures++;
                    this.progress.failed_domains++;
                    return { success: false, error: 'No submit button', domain };
                }
                
            } catch (fillError) {
                await this.log(`❌ Form interaction failed: ${fillError.message}`, 'ERROR');
                this.progress.form_detection_failures++;
                this.progress.failed_domains++;
                return { success: false, error: 'Form interaction failed', domain };
            }
            
        } catch (error) {
            await this.log(`❌ DOMAIN TEST FAILED: ${error.message}`, 'ERROR');
            
            if (error.message.includes('429') || (error.response && error.response.status === 429)) {
                this.progress.rate_limit_errors++;
                await this.log('🚨 RATE LIMIT ERROR!', 'ERROR');
            } else {
                this.progress.other_errors++;
            }
            
            this.progress.failed_domains++;
            return { success: false, error: error.message, domain };
            
        } finally {
            // Clean up browser session
            if (sessionData) {
                try {
                    await sessionData.browser.close();
                    await this.log(`🔚 Browser session closed`);
                } catch (closeError) {
                    await this.log(`⚠️ Error closing browser: ${closeError.message}`, 'WARN');
                }
            }
            
            this.progress.domains_processed++;
            await this.saveProgress();
        }
    }

    async saveProgress() {
        await fs.writeFile('diagnostic_progress.json', JSON.stringify(this.progress, null, 2));
    }

    async runDiagnostic() {
        await this.log('🚀 Starting 5-Domain Diagnostic Test');
        await this.sendSlackNotification('🔍 Starting 5-domain diagnostic test to check for rate limits and form detection issues');
        
        const results = [];
        
        for (let i = 0; i < this.testDomains.length; i++) {
            const domain = this.testDomains[i];
            const email = this.emails[i];
            
            const result = await this.testSingleDomain(domain, email, i);
            results.push(result);
            
            // Wait between tests to avoid rate limits
            if (i < this.testDomains.length - 1) {
                await this.log('⏱️ Waiting 10 seconds between tests...');
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        }
        
        // Final report
        await this.generateFinalReport(results);
    }

    async generateFinalReport(results) {
        await this.log('\n📊 DIAGNOSTIC TEST COMPLETE - FINAL REPORT');
        await this.log('================================================');
        
        const successRate = this.progress.domains_processed > 0 ? 
            (this.progress.successful_signups / this.progress.domains_processed * 100).toFixed(2) : 0;
        
        await this.log(`✅ Successful signups: ${this.progress.successful_signups}/${this.progress.domains_processed} (${successRate}%)`);
        await this.log(`🚨 Rate limit errors: ${this.progress.rate_limit_errors}`);
        await this.log(`📝 Form detection failures: ${this.progress.form_detection_failures}`);
        await this.log(`🌐 Browser errors: ${this.progress.browser_errors}`);
        await this.log(`❓ Other errors: ${this.progress.other_errors}`);
        
        await this.log('\n📋 DETAILED RESULTS:');
        results.forEach((result, index) => {
            const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
            this.log(`  ${index + 1}. ${result.domain}: ${status} ${result.error ? `(${result.error})` : ''}`);
        });
        
        // Determine main issue
        let mainIssue = 'Unknown';
        if (this.progress.rate_limit_errors > 0) {
            mainIssue = '🚨 RATE LIMITING (429 errors)';
        } else if (this.progress.form_detection_failures > this.progress.other_errors) {
            mainIssue = '📝 FORM DETECTION ISSUES';
        } else if (this.progress.browser_errors > 0) {
            mainIssue = '🌐 BROWSER CONNECTION ISSUES';
        }
        
        await this.log(`\n🔍 PRIMARY ISSUE DETECTED: ${mainIssue}`);
        
        const finalMessage = `🔍 Diagnostic Complete!\n\n` +
            `📊 Results: ${this.progress.successful_signups}/${this.progress.domains_processed} success (${successRate}%)\n` +
            `🚨 Rate limits: ${this.progress.rate_limit_errors}\n` +
            `📝 Form issues: ${this.progress.form_detection_failures}\n` +
            `🔍 Main issue: ${mainIssue}`;
        
        await this.sendSlackNotification(finalMessage, this.progress.successful_signups === 0);
        
        await this.log('\n📁 Check these files for details:');
        await this.log('  - diagnostic_5domains.log (full logs)');
        await this.log('  - diagnostic_progress.json (structured data)');
        await this.log('  - logs/diagnostic_*.png (screenshots)');
    }
}

// Run the diagnostic
async function runDiagnostic() {
    const diagnostic = new Diagnostic5DomainTest();
    await diagnostic.runDiagnostic();
}

if (require.main === module) {
    runDiagnostic().catch(error => {
        console.error('💥 Diagnostic failed:', error);
        process.exit(1);
    });
}

module.exports = { Diagnostic5DomainTest }; 