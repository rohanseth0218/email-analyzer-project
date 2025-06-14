/**
 * Email Signup Automation Runner
 * 
 * This script orchestrates the email signup automation using the MCP tools
 * available in this environment (Browserbase MCP and Zapier MCP).
 */

// Configuration
const CONFIG = {
    maxConcurrentSessions: 50,
    notificationInterval: 100,
    retryAttempts: 3,
    timeoutMs: 30000,
    delayBetweenAttempts: 2000,
    slackChannel: '#email-automation',
    errorChannel: '#automation-errors',
    testMode: false // Set to true for testing with limited domains
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
        errors: [],
        startTime: new Date(),
        activeSessions: new Set()
    },
    activeSessions: new Map() // sessionId -> domain info
};

/**
 * Load domains and emails from CSV files
 */
async function loadData() {
    console.log('📂 Loading domains and email accounts...');
    
    try {
        // Read CSV files using the file reading tools
        const domainsResponse = await read_file({
            target_file: 'Storedomains.csv',
            explanation: 'Loading domains for email automation',
            should_read_entire_file: true,
            start_line_one_indexed: 1,
            end_line_one_indexed_inclusive: -1
        });
        
        // Parse domains
        const domainLines = domainsResponse.split('\n').slice(1); // Skip header
        automation.domains = domainLines
            .filter(line => line.trim())
            .map(line => {
                const domain = line.split(',')[0].trim();
                return domain.startsWith('http') ? domain : `https://${domain}`;
            })
            .filter(domain => domain !== 'https://');

        const emailsResponse = await read_file({
            target_file: 'mailboxaccounts.csv',
            explanation: 'Loading email accounts for automation',
            should_read_entire_file: true,
            start_line_one_indexed: 1,
            end_line_one_indexed_inclusive: -1
        });
        
        // Parse emails
        const emailLines = emailsResponse.split('\n').slice(1); // Skip header
        automation.emails = emailLines
            .filter(line => line.trim())
            .map(line => line.split(',')[0].trim())
            .filter(email => email && email.includes('@'));

        // Apply test mode limits
        if (CONFIG.testMode) {
            const maxDomains = CONFIG.maxTestDomains || 10;
            console.log(`🧪 Test mode: limiting to ${maxDomains} domains`);
            automation.domains = automation.domains.slice(0, maxDomains);
        }

        console.log(`✅ Loaded ${automation.domains.length} domains and ${automation.emails.length} email accounts`);
        
        if (automation.domains.length === 0 || automation.emails.length === 0) {
            throw new Error('No domains or emails loaded');
        }

    } catch (error) {
        await logError('Failed to load data', error);
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
 * Send Slack notification
 */
async function sendSlackNotification(message, isError = false) {
    try {
        const channel = isError ? CONFIG.errorChannel : CONFIG.slackChannel;
        
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
async function logError(context, error) {
    const errorMessage = `🚨 **Email Signup Automation Error**
**Context:** ${context}
**Error:** ${error.message}
**Time:** ${new Date().toISOString()}
**Progress:** ${automation.stats.processed}/${automation.domains.length}
**Success Rate:** ${((automation.stats.successful / Math.max(automation.stats.processed, 1)) * 100).toFixed(1)}%`;

    console.error(`❌ ${context}:`, error);
    await sendSlackNotification(errorMessage, true);
}

/**
 * Send progress update
 */
async function sendProgressUpdate() {
    const runtime = Math.round((new Date() - automation.stats.startTime) / 1000 / 60);
    const rate = automation.stats.processed / Math.max(runtime, 1);
    const remaining = automation.domains.length - automation.stats.processed;
    const eta = remaining > 0 ? Math.round(remaining / Math.max(rate, 1)) : 0;

    const message = `📊 **Email Signup Progress Update**
**Completed:** ${automation.stats.processed}/${automation.domains.length}
**Successful:** ${automation.stats.successful} (${((automation.stats.successful / Math.max(automation.stats.processed, 1)) * 100).toFixed(1)}%)
**Failed:** ${automation.stats.failed}
**Runtime:** ${runtime} minutes
**Rate:** ${rate.toFixed(1)} domains/minute
**ETA:** ${eta} minutes remaining
**Active Sessions:** ${automation.stats.activeSessions.size}`;

    await sendSlackNotification(message);
    console.log('📊 Progress update sent');
}

/**
 * Attempt email signup on a domain
 */
async function attemptEmailSignup(domain, email) {
    let sessionId = null;
    const attempts = [];
    let submitted = false;

    try {
        console.log(`🔧 Processing ${domain} with ${email}`);
        
        // Create browser session
        const sessionResponse = await mcp_Browserbase_browserbase_session_create({});
        sessionId = extractSessionId(sessionResponse);
        automation.stats.activeSessions.add(sessionId);
        automation.activeSessions.set(sessionId, { domain, startTime: new Date() });
        
        attempts.push(`Created session: ${sessionId}`);
        
        // Navigate to domain with UTM parameters
        const utmParams = "?utm_source=automation&utm_medium=signup&utm_campaign=bulk-signup";
        const url = `${domain}${utmParams}`;
        
        await mcp_Browserbase_browserbase_navigate({ url: url });
        attempts.push(`Navigated to ${url}`);
        
        // Wait for page to load
        await mcp_Browserbase_browserbase_wait({ time: 3 });
        
        // Try different form detection strategies
        submitted = await tryPopupForms(email, attempts) ||
                   await tryNewsletterForms(email, attempts) ||
                   await tryFooterForms(email, attempts) ||
                   await tryGenericForms(email, attempts);

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
    } finally {
        // Always clean up session
        if (sessionId) {
            try {
                await mcp_Browserbase_browserbase_session_close({ random_string: sessionId });
                automation.stats.activeSessions.delete(sessionId);
                automation.activeSessions.delete(sessionId);
            } catch (closeError) {
                console.warn(`Failed to close session ${sessionId}:`, closeError.message);
            }
        }
    }
}

/**
 * Extract session ID from Browserbase response
 */
function extractSessionId(response) {
    if (typeof response === 'string' && response.includes('sessions/')) {
        return response.split('sessions/')[1].split('?')[0];
    }
    return response.sessionId || 'unknown';
}

/**
 * Try popup/modal forms
 */
async function tryPopupForms(email, attempts) {
    try {
        const selectors = [
            'div[class*="popup"] input[type="email"]',
            'div[class*="modal"] input[type="email"]',
            '[role="dialog"] input[type="email"]',
            '.klaviyo-form input[type="email"]',
            '.mc4wp-form input[type="email"]'
        ];

        for (const selector of selectors) {
            try {
                await mcp_Browserbase_browserbase_type({
                    element: `Popup email input`,
                    ref: selector,
                    text: email,
                    slowly: false
                });

                attempts.push(`Found popup form: ${selector}`);
                
                // Submit by pressing Enter
                await mcp_Browserbase_browserbase_press_key({ key: 'Enter' });
                await mcp_Browserbase_browserbase_wait({ time: 2 });

                attempts.push(`Submitted popup form`);
                return true;

            } catch (error) {
                // Try next selector
                continue;
            }
        }
    } catch (error) {
        attempts.push(`Popup forms error: ${error.message}`);
    }
    return false;
}

/**
 * Try newsletter forms
 */
async function tryNewsletterForms(email, attempts) {
    try {
        const selectors = [
            'form[class*="newsletter"] input[type="email"]',
            'form[class*="signup"] input[type="email"]',
            '[class*="newsletter"] input[type="email"]',
            'input[placeholder*="newsletter" i]'
        ];

        for (const selector of selectors) {
            try {
                await mcp_Browserbase_browserbase_type({
                    element: `Newsletter email input`,
                    ref: selector,
                    text: email,
                    slowly: false
                });

                attempts.push(`Found newsletter form: ${selector}`);
                
                await mcp_Browserbase_browserbase_press_key({ key: 'Enter' });
                await mcp_Browserbase_browserbase_wait({ time: 2 });

                attempts.push(`Submitted newsletter form`);
                return true;

            } catch (error) {
                continue;
            }
        }
    } catch (error) {
        attempts.push(`Newsletter forms error: ${error.message}`);
    }
    return false;
}

/**
 * Try footer forms
 */
async function tryFooterForms(email, attempts) {
    try {
        // Scroll to bottom
        await mcp_Browserbase_browserbase_press_key({ key: 'End' });
        await mcp_Browserbase_browserbase_wait({ time: 2 });

        const selectors = [
            'footer input[type="email"]',
            '[class*="footer"] input[type="email"]'
        ];

        for (const selector of selectors) {
            try {
                await mcp_Browserbase_browserbase_type({
                    element: `Footer email input`,
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
        attempts.push(`Footer forms error: ${error.message}`);
    }
    return false;
}

/**
 * Try generic email forms
 */
async function tryGenericForms(email, attempts) {
    try {
        const selectors = [
            'input[type="email"]',
            'input[name*="email" i]',
            'input[placeholder*="email" i]'
        ];

        for (const selector of selectors) {
            try {
                await mcp_Browserbase_browserbase_type({
                    element: `Generic email input`,
                    ref: selector,
                    text: email,
                    slowly: false
                });

                attempts.push(`Found generic form: ${selector}`);
                
                await mcp_Browserbase_browserbase_press_key({ key: 'Enter' });
                await mcp_Browserbase_browserbase_wait({ time: 2 });

                attempts.push(`Submitted generic form`);
                return true;

            } catch (error) {
                continue;
            }
        }
    } catch (error) {
        attempts.push(`Generic forms error: ${error.message}`);
    }
    return false;
}

/**
 * Process a single domain with retries
 */
async function processDomain(domain) {
    let result = null;

    for (let attempt = 1; attempt <= CONFIG.retryAttempts; attempt++) {
        try {
            const email = getNextEmail();
            result = await attemptEmailSignup(domain, email);
            
            if (result.success) {
                break; // Success, no need to retry
            }
            
            if (attempt < CONFIG.retryAttempts) {
                console.log(`⏳ Retrying ${domain} (attempt ${attempt + 1}/${CONFIG.retryAttempts})`);
                await new Promise(resolve => setTimeout(resolve, CONFIG.delayBetweenAttempts));
            }
            
        } catch (error) {
            console.error(`❌ Error processing ${domain} (attempt ${attempt}):`, error.message);
            result = {
                success: false,
                domain,
                email: getNextEmail(),
                error: error.message,
                attempt,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Update stats
    automation.stats.processed++;
    if (result?.success) {
        automation.stats.successful++;
        console.log(`✅ Successfully signed up to ${domain}`);
    } else {
        automation.stats.failed++;
        automation.stats.errors.push(result);
        console.log(`❌ Failed to sign up to ${domain}`);
    }

    return result;
}

/**
 * Main automation function
 */
async function runEmailAutomation() {
    try {
        console.log('🚀 Starting Email Signup Automation...');
        await loadData();
        
        // Send startup notification
        await sendSlackNotification(`🚀 **Email Signup Automation Started**
**Domains:** ${automation.domains.length}
**Email Accounts:** ${automation.emails.length}
**Max Concurrent Sessions:** ${CONFIG.maxConcurrentSessions}
**Notification Interval:** Every ${CONFIG.notificationInterval} domains`);

        // Process domains sequentially for now (due to MCP session limits)
        // In production, this could be batched for concurrency
        for (let i = 0; i < automation.domains.length; i++) {
            const domain = automation.domains[i];
            
            console.log(`\n🎯 Processing domain ${i + 1}/${automation.domains.length}: ${domain}`);
            
            await processDomain(domain);
            
            // Send progress updates
            if ((i + 1) % CONFIG.notificationInterval === 0 || i + 1 === automation.domains.length) {
                await sendProgressUpdate();
            }
            
            // Brief pause between domains
            if (i + 1 < automation.domains.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // Final summary
        const totalTime = Math.round((new Date() - automation.stats.startTime) / 1000 / 60);
        const successRate = ((automation.stats.successful / automation.stats.processed) * 100).toFixed(1);
        
        const finalMessage = `🎉 **Email Signup Automation Completed!**
**Total Processed:** ${automation.stats.processed}
**Successful:** ${automation.stats.successful}
**Failed:** ${automation.stats.failed}
**Success Rate:** ${successRate}%
**Total Runtime:** ${totalTime} minutes`;

        await sendSlackNotification(finalMessage);
        console.log('\n🎉 Automation completed successfully!');
        
        return automation.stats;

    } catch (error) {
        await logError('Automation failed', error);
        throw error;
    }
}

// Export the main function for external use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runEmailAutomation, CONFIG, automation };
}

console.log(`
🤖 Email Signup Automation System Loaded

📊 Configuration:
   - Max Concurrent Sessions: ${CONFIG.maxConcurrentSessions}
   - Notification Interval: ${CONFIG.notificationInterval}
   - Test Mode: ${CONFIG.testMode ? 'ENABLED' : 'DISABLED'}
   - Slack Channel: ${CONFIG.slackChannel}

🚀 To start the automation, call: runEmailAutomation()
🧪 To test with limited domains, set: CONFIG.testMode = true
`);

// Auto-start capability (uncomment to run immediately)
// runEmailAutomation().catch(console.error); 