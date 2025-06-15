/**
 * DEBUG VERSION - Email Automation Diagnostics
 * 
 * This version will help us understand:
 * 1. Why success rate is 0%
 * 2. What's causing rate limit issues
 * 3. What domains actually look like
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const { parse } = require('csv-parse/sync');
const axios = require('axios');

// CONSERVATIVE DEBUG CONFIGURATION
const CONFIG = {
    BROWSERBASE_API_KEY: 'bb_live_FTV11nF0Vs1NR_T_rVBHRmQHv74',
    BROWSERBASE_PROJECT_ID: 'd277f38a-cc07-4af9-8473-83cefed0bfcd',
    
    // VERY CONSERVATIVE - TEST JUST 10 DOMAINS WITH 3 SESSIONS
    MAX_CONCURRENT_SESSIONS: 3,  // Start very small
    BATCH_SIZE: 10,  // Small test batch
    START_FROM_BATCH: 31,
    SESSION_CREATION_DELAY: 5000,  // 5 seconds between sessions
    
    // Timeouts
    NAVIGATION_TIMEOUT: 60000,  // Longer timeout for debugging
    FORM_INTERACTION_TIMEOUT: 15000,
    
    // Slack webhook
    SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/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',
    
    // Debug settings
    DEBUG_MODE: true,
    SCREENSHOTS: true,  // Enable screenshots for debugging
    DETAILED_LOGGING: true
};

const STATS = {
    totalProcessed: 0,
    totalSuccessful: 0,
    totalFailed: 0,
    debugInfo: {},
    failureReasons: {}
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
        
        console.log(`✅ Processed ${domains.length} valid domains`);
        console.log(`🔍 First 10 domains for debugging:`);
        domains.slice(0, 10).forEach((domain, i) => {
            console.log(`   ${i + 1}. ${domain}`);
        });
        
        return domains;
        
    } catch (error) {
        console.error(`❌ Error loading domains: ${error.message}`);
        throw error;
    }
}

async function loadEmailAccounts() {
    try {
        console.log('📧 Loading email accounts...');
        const csvContent = await fs.readFile('./mailboxaccounts.csv', 'utf-8');
        const records = parse(csvContent, { 
            columns: true, 
            skip_empty_lines: true 
        });
        
        const emails = records
            .map(record => record.email || record.Email)
            .filter(email => email && email.includes('@') && email.includes('.'));
        
        console.log(`📧 Loaded ${emails.length} valid email accounts`);
        console.log(`🔍 First 3 emails: ${emails.slice(0, 3).join(', ')}`);
        
        return emails;
        
    } catch (error) {
        console.error(`❌ Error loading email accounts: ${error.message}`);
        throw error;
    }
}

async function createBrowserbaseSession() {
    try {
        console.log('🔧 Creating Browserbase session...');
        
        const response = await axios.post(
            'https://api.browserbase.com/v1/sessions',
            {
                projectId: CONFIG.BROWSERBASE_PROJECT_ID,
                browserSettings: {
                    viewport: { width: 1920, height: 1080 },
                    stealth: true
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-BB-API-Key': CONFIG.BROWSERBASE_API_KEY
                }
            }
        );
        
        console.log(`✅ Session created: ${response.data.id}`);
        return {
            id: response.data.id,
            connectUrl: response.data.connectUrl
        };
        
    } catch (error) {
        console.error(`❌ Failed to create session: ${error.message}`);
        if (error.response) {
            console.error(`📊 Status: ${error.response.status}`);
            console.error(`📊 Headers:`, error.response.headers);
        }
        throw error;
    }
}

async function debugFormDetection(page, domain) {
    console.log(`🔍 DEBUG: Analyzing ${domain}`);
    
    try {
        // Check page content
        const title = await page.title();
        const url = page.url();
        console.log(`   📄 Title: ${title}`);
        console.log(`   🌐 Final URL: ${url}`);
        
        // Look for email inputs
        const emailInputs = await page.locator('input[type="email"], input[name*="email" i], input[placeholder*="email" i]').count();
        console.log(`   📧 Email inputs found: ${emailInputs}`);
        
        // Look for forms
        const forms = await page.locator('form').count();
        console.log(`   📝 Forms found: ${forms}`);
        
        // Look for submit buttons
        const submitButtons = await page.locator('button[type="submit"], input[type="submit"], button:has-text("Subscribe")').count();
        console.log(`   🔘 Submit buttons found: ${submitButtons}`);
        
        // Check for newsletter/subscription keywords
        const pageText = await page.textContent('body');
        const hasNewsletter = pageText.toLowerCase().includes('newsletter') || 
                            pageText.toLowerCase().includes('subscribe') ||
                            pageText.toLowerCase().includes('email');
        console.log(`   📰 Has newsletter/subscription text: ${hasNewsletter}`);
        
        // Take a screenshot for manual inspection
        if (CONFIG.SCREENSHOTS) {
            const timestamp = Date.now();
            const screenshotPath = `./logs/debug_${timestamp}_${domain.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
            await page.screenshot({ path: screenshotPath, fullPage: false });
            console.log(`   📸 Screenshot saved: ${screenshotPath}`);
        }
        
        return {
            title,
            finalUrl: url,
            emailInputs,
            forms,
            submitButtons,
            hasNewsletterText: hasNewsletter
        };
        
    } catch (error) {
        console.error(`   ❌ Debug analysis failed: ${error.message}`);
        return { error: error.message };
    }
}

async function processDomain(domain, email) {
    let browser = null;
    let page = null;
    
    console.log(`\n🌐 Processing: ${domain}`);
    console.log(`📧 Using email: ${email}`);
    
    try {
        const sessionData = await createBrowserbaseSession();
        
        // Wait a bit to avoid hitting rate limits
        await new Promise(resolve => setTimeout(resolve, CONFIG.SESSION_CREATION_DELAY));
        
        browser = await chromium.connectOverCDP(sessionData.connectUrl);
        const contexts = browser.contexts();
        const context = contexts.length > 0 ? contexts[0] : await browser.newContext();
        page = await context.newPage();
        
        // Navigate to domain
        console.log(`   🔄 Navigating to ${domain}...`);
        await page.goto(domain, { 
            waitUntil: 'domcontentloaded', 
            timeout: CONFIG.NAVIGATION_TIMEOUT 
        });
        
        console.log(`   ✅ Page loaded successfully`);
        
        // Debug the page
        const debugInfo = await debugFormDetection(page, domain);
        
        // Attempt form interaction if we found elements
        let result = { success: false, reason: 'no_form_elements' };
        
        if (debugInfo.emailInputs > 0 && debugInfo.submitButtons > 0) {
            console.log(`   🎯 Attempting form submission...`);
            
            try {
                // Find email input
                const emailInput = await page.locator('input[type="email"], input[name*="email" i]').first();
                await emailInput.fill(email);
                console.log(`   ✅ Email filled: ${email}`);
                
                // Find submit button  
                const submitButton = await page.locator('button[type="submit"], input[type="submit"], button:has-text("Subscribe")').first();
                await submitButton.click();
                console.log(`   🔘 Submit button clicked`);
                
                // Wait for response
                await page.waitForTimeout(3000);
                
                // Check for success
                const newUrl = page.url();
                const pageContent = await page.textContent('body');
                const hasSuccess = pageContent.toLowerCase().includes('thank') || 
                                 pageContent.toLowerCase().includes('success') ||
                                 newUrl.includes('thank') || newUrl.includes('success');
                
                if (hasSuccess) {
                    result = { success: true, reason: 'form_submitted_successfully' };
                    console.log(`   🎉 SUCCESS: Form submission detected!`);
                } else {
                    result = { success: false, reason: 'no_success_confirmation' };
                    console.log(`   ⚠️  Form submitted but no success confirmation found`);
                }
                
            } catch (formError) {
                result = { success: false, reason: 'form_interaction_failed', error: formError.message };
                console.log(`   ❌ Form interaction failed: ${formError.message}`);
            }
        } else {
            console.log(`   ⚠️  No suitable form elements found`);
            result = { success: false, reason: 'no_form_elements' };
        }
        
        // Update stats
        STATS.totalProcessed++;
        if (result.success) {
            STATS.totalSuccessful++;
        } else {
            STATS.totalFailed++;
            STATS.failureReasons[result.reason] = (STATS.failureReasons[result.reason] || 0) + 1;
        }
        
        // Store debug info
        STATS.debugInfo[domain] = {
            ...debugInfo,
            result,
            email
        };
        
        return {
            domain,
            email,
            success: result.success,
            reason: result.reason,
            debugInfo,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error(`   ❌ Processing failed: ${error.message}`);
        
        STATS.totalProcessed++;
        STATS.totalFailed++;
        STATS.failureReasons['processing_error'] = (STATS.failureReasons['processing_error'] || 0) + 1;
        
        return {
            domain,
            email,
            success: false,
            reason: 'processing_error',
            error: error.message,
            timestamp: new Date().toISOString()
        };
        
    } finally {
        try {
            if (page) await page.close();
            if (browser) await browser.close();
        } catch (e) {
            console.error(`   ⚠️  Cleanup error: ${e.message}`);
        }
    }
}

async function runDebugAutomation() {
    console.log('🐛 Starting DEBUG Email Automation...');
    console.log(`🔧 Config: ${CONFIG.MAX_CONCURRENT_SESSIONS} sessions, ${CONFIG.BATCH_SIZE} domains`);
    
    try {
        await fs.mkdir('./logs', { recursive: true });
        
        const allDomains = await loadDomains();
        const emails = await loadEmailAccounts();
        
        // Get test batch from batch 31
        const startIndex = (CONFIG.START_FROM_BATCH - 1) * 100; // Original batch size was 100
        const testDomains = allDomains.slice(startIndex, startIndex + CONFIG.BATCH_SIZE);
        
        console.log(`\n🎯 Testing ${testDomains.length} domains from batch ${CONFIG.START_FROM_BATCH}`);
        console.log(`📋 Test domains:`);
        testDomains.forEach((domain, i) => {
            console.log(`   ${i + 1}. ${domain}`);
        });
        
        // Process domains sequentially for better debugging
        for (let i = 0; i < testDomains.length; i++) {
            const domain = testDomains[i];
            const email = emails[i % emails.length];
            
            console.log(`\n📊 Progress: ${i + 1}/${testDomains.length}`);
            const result = await processDomain(domain, email);
            
            // Small delay between domains
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Print final analysis
        console.log('\n📊 DEBUG ANALYSIS COMPLETE');
        console.log(`✅ Successful: ${STATS.totalSuccessful}/${STATS.totalProcessed}`);
        console.log(`❌ Failed: ${STATS.totalFailed}/${STATS.totalProcessed}`);
        console.log(`📈 Success Rate: ${(STATS.totalSuccessful / STATS.totalProcessed * 100).toFixed(2)}%`);
        
        console.log('\n🔍 Failure Breakdown:');
        Object.entries(STATS.failureReasons).forEach(([reason, count]) => {
            console.log(`   ${reason}: ${count}`);
        });
        
        console.log('\n📝 Debug Summary:');
        let domainsWithForms = 0;
        let domainsWithEmailInputs = 0;
        let domainsWithNewsletterText = 0;
        
        Object.entries(STATS.debugInfo).forEach(([domain, info]) => {
            if (info.forms > 0) domainsWithForms++;
            if (info.emailInputs > 0) domainsWithEmailInputs++;
            if (info.hasNewsletterText) domainsWithNewsletterText++;
        });
        
        console.log(`   📝 Domains with forms: ${domainsWithForms}/${CONFIG.BATCH_SIZE}`);
        console.log(`   📧 Domains with email inputs: ${domainsWithEmailInputs}/${CONFIG.BATCH_SIZE}`);
        console.log(`   📰 Domains with newsletter text: ${domainsWithNewsletterText}/${CONFIG.BATCH_SIZE}`);
        
        // Save detailed debug report
        await fs.writeFile('./logs/debug_report.json', JSON.stringify(STATS, null, 2));
        console.log('\n💾 Detailed debug report saved to ./logs/debug_report.json');
        
    } catch (error) {
        console.error(`❌ Debug automation failed: ${error.message}`);
        throw error;
    }
}

// Run debug automation
if (require.main === module) {
    runDebugAutomation().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
} 