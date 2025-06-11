/**
 * Debug Shoplimoni.com Form Detection
 * 
 * Detailed analysis of why we're not detecting the newsletter signup form
 * that is clearly visible on the site.
 */

const { chromium } = require('playwright');
const axios = require('axios');

// Configuration
const CONFIG = {
    BROWSERBASE_API_KEY: 'bb_live_FTV11nF0Vs1NR_T_rVBHRmQHv74',
    BROWSERBASE_PROJECT_ID: 'd277f38a-cc07-4af9-8473-83cefed0bfcd',
    REQUEST_TIMEOUT: 30000,
    PAGE_TIMEOUT: 30000
};

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
                },
                proxies: [{
                    type: "browserbase",
                    geolocation: {
                        country: "US",
                        state: "NY", 
                        city: "NEW_YORK"
                    }
                }]
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
        throw new Error(`Failed to create session: ${error.message}`);
    }
}

/**
 * Detailed form analysis
 */
async function analyzeShoplimoni() {
    let browser = null;
    let sessionId = null;
    
    try {
        console.log('🔍 Creating Browserbase session with proxy...');
        const session = await createBrowserbaseSession();
        sessionId = session.sessionId;
        
        console.log('🌐 Connecting to browser...');
        browser = await chromium.connectOverCDP(session.connectUrl);
        const context = browser.contexts()[0] || await browser.newContext();
        const page = context.pages()[0] || await context.newPage();
        
        page.setDefaultTimeout(CONFIG.PAGE_TIMEOUT);
        
        console.log('📍 Navigating to shoplimoni.com...');
        await page.goto('https://shoplimoni.com', { waitUntil: 'domcontentloaded' });
        
        console.log('⏱️ Waiting for dynamic content...');
        await page.waitForTimeout(5000);
        
        console.log('📊 Analyzing page structure...');
        
        // Count all elements
        const analysis = await page.evaluate(() => {
            const results = {
                totalForms: document.querySelectorAll('form').length,
                totalInputs: document.querySelectorAll('input').length,
                emailInputs: document.querySelectorAll('input[type="email"]').length,
                textInputs: document.querySelectorAll('input[type="text"]').length,
                inputsWithEmailPlaceholder: document.querySelectorAll('input[placeholder*="email" i]').length,
                inputsWithEmailName: document.querySelectorAll('input[name*="email" i]').length,
                inputsWithEmailId: document.querySelectorAll('input[id*="email" i]').length,
                allInputDetails: [],
                allForms: [],
                newsletterElements: document.querySelectorAll('*[class*="newsletter" i], *[id*="newsletter" i]').length,
                subscribeElements: document.querySelectorAll('*[class*="subscribe" i], *[id*="subscribe" i]').length,
                registratiButtons: document.querySelectorAll('button:contains("REGISTRATI"), input[value*="REGISTRATI" i]').length
            };
            
            // Get details of all inputs
            document.querySelectorAll('input').forEach((input, index) => {
                results.allInputDetails.push({
                    index,
                    type: input.type,
                    name: input.name,
                    id: input.id,
                    className: input.className,
                    placeholder: input.placeholder,
                    visible: input.offsetParent !== null,
                    outerHTML: input.outerHTML.substring(0, 200)
                });
            });
            
            // Get details of all forms
            document.querySelectorAll('form').forEach((form, index) => {
                results.allForms.push({
                    index,
                    id: form.id,
                    className: form.className,
                    action: form.action,
                    method: form.method,
                    inputCount: form.querySelectorAll('input').length,
                    visible: form.offsetParent !== null,
                    outerHTML: form.outerHTML.substring(0, 300)
                });
            });
            
            return results;
        });
        
        console.log('📋 Analysis Results:');
        console.log('==================');
        console.log(`Total Forms: ${analysis.totalForms}`);
        console.log(`Total Inputs: ${analysis.totalInputs}`);
        console.log(`Email Inputs: ${analysis.emailInputs}`);
        console.log(`Text Inputs: ${analysis.textInputs}`);
        console.log(`Inputs with email in placeholder: ${analysis.inputsWithEmailPlaceholder}`);
        console.log(`Inputs with email in name: ${analysis.inputsWithEmailName}`);
        console.log(`Inputs with email in id: ${analysis.inputsWithEmailId}`);
        console.log(`Newsletter elements: ${analysis.newsletterElements}`);
        console.log(`Subscribe elements: ${analysis.subscribeElements}`);
        console.log(`REGISTRATI buttons: ${analysis.registratiButtons}`);
        
        if (analysis.allForms.length > 0) {
            console.log('\n📝 Form Details:');
            analysis.allForms.forEach(form => {
                console.log(`Form ${form.index}: ${form.className} (${form.inputCount} inputs) - Visible: ${form.visible}`);
                console.log(`  HTML: ${form.outerHTML}`);
            });
        }
        
        if (analysis.allInputDetails.length > 0) {
            console.log('\n🔍 Input Details:');
            analysis.allInputDetails.forEach(input => {
                console.log(`Input ${input.index}: type="${input.type}" name="${input.name}" placeholder="${input.placeholder}" - Visible: ${input.visible}`);
                if (input.placeholder && input.placeholder.toLowerCase().includes('email')) {
                    console.log(`  ⭐ POTENTIAL EMAIL INPUT: ${input.outerHTML}`);
                }
            });
        }
        
        // Try to find the newsletter form specifically
        console.log('\n🎯 Looking for newsletter signup...');
        const newsletterTest = await page.evaluate(() => {
            // Look for Italian newsletter text
            const newsletterTexts = [
                'newsletter',
                'iscriviti',
                'registrati',
                'email'
            ];
            
            const foundElements = [];
            
            newsletterTexts.forEach(text => {
                const elements = Array.from(document.querySelectorAll('*')).filter(el => 
                    el.textContent && el.textContent.toLowerCase().includes(text.toLowerCase())
                );
                if (elements.length > 0) {
                    foundElements.push({
                        searchText: text,
                        count: elements.length,
                        examples: elements.slice(0, 3).map(el => ({
                            tagName: el.tagName,
                            className: el.className,
                            textContent: el.textContent.trim().substring(0, 100)
                        }))
                    });
                }
            });
            
            return foundElements;
        });
        
        console.log('Newsletter-related elements found:');
        newsletterTest.forEach(result => {
            console.log(`"${result.searchText}": ${result.count} elements`);
            result.examples.forEach(ex => {
                console.log(`  - ${ex.tagName}.${ex.className}: "${ex.textContent}"`);
            });
        });
        
        // Take a screenshot
        console.log('\n📸 Taking screenshot...');
        await page.screenshot({ path: './logs/shoplimoni_debug.png', fullPage: true });
        
        // Save page source
        console.log('💾 Saving page source...');
        const content = await page.content();
        require('fs').writeFileSync('./logs/shoplimoni_debug.html', content);
        
        console.log('\n✅ Debug analysis complete!');
        console.log('📁 Files saved:');
        console.log('  - Screenshot: ./logs/shoplimoni_debug.png');
        console.log('  - Page source: ./logs/shoplimoni_debug.html');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (browser) {
            await browser.close();
        }
        if (sessionId) {
            try {
                await axios.post(
                    `https://api.browserbase.com/v1/sessions/${sessionId}`,
                    { status: 'COMPLETED' },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'X-BB-API-Key': CONFIG.BROWSERBASE_API_KEY
                        }
                    }
                );
            } catch (e) {
                console.warn('Failed to close session:', e.message);
            }
        }
    }
}

console.log('🔍 Starting Shoplimoni Form Detection Debug...');
analyzeShoplimoni().then(() => {
    console.log('🎯 Debug complete!');
}).catch(error => {
    console.error('❌ Debug failed:', error.message);
}); 