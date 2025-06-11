/**
 * Advanced Dynamic Form Detection System
 * 
 * Handles:
 * - JavaScript-loaded forms
 * - Scroll-triggered forms
 * - Network activity monitoring
 * - DOM mutation observation
 * - Multiple detection passes
 * - Lazy-loaded content
 */

const { chromium } = require('playwright');

/**
 * Advanced form detection configuration
 */
const DYNAMIC_DETECTION_CONFIG = {
    // Detection phases with increasing wait times
    DETECTION_PHASES: [
        { name: 'immediate', waitTime: 1000, scrolls: 0 },
        { name: 'early', waitTime: 3000, scrolls: 3 },
        { name: 'medium', waitTime: 5000, scrolls: 5 },
        { name: 'late', waitTime: 8000, scrolls: 8 },
        { name: 'final', waitTime: 12000, scrolls: 10 }
    ],
    
    // Network activity settings
    NETWORK_IDLE_TIME: 2000,  // Wait for 2s of network inactivity
    MAX_NETWORK_WAIT: 15000,  // Max time to wait for network idle
    
    // Scroll configuration
    SCROLL_STEPS: 10,
    SCROLL_DELAY: 500,
    
    // DOM mutation settings
    MUTATION_OBSERVER_TIMEOUT: 5000,
    
    // Enhanced form selectors including dynamic patterns
    DYNAMIC_SELECTORS: {
        // Standard email inputs
        emailInputs: [
            'input[type="email"]',
            'input[name*="email" i]',
            'input[placeholder*="email" i]',
            'input[id*="email" i]',
            'input[class*="email" i]',
            'input[type="text"][name*="email" i]',
            'input[type="text"][placeholder*="email" i]',
            'input[type="text"][id*="email" i]'
        ],
        
        // Newsletter-specific patterns
        newsletter: [
            '*[class*="newsletter" i]',
            '*[id*="newsletter" i]',
            '*[data-*="newsletter" i]',
            'form[action*="newsletter" i]',
            'form[action*="subscribe" i]'
        ],
        
        // Popup and modal patterns
        popups: [
            '.modal input[type="email"]',
            '.popup input[type="email"]',
            '.overlay input[type="email"]',
            '[role="dialog"] input[type="email"]',
            '.lightbox input[type="email"]',
            '[class*="modal" i] input',
            '[class*="popup" i] input',
            '[class*="overlay" i] input'
        ],
        
        // Footer forms (often lazy-loaded)
        footer: [
            'footer input[type="email"]',
            '.footer input[type="email"]',
            '[class*="footer" i] input',
            'section:last-child input[type="email"]'
        ],
        
        // Subscription forms
        subscription: [
            '*[class*="subscribe" i] input',
            '*[class*="signup" i] input',
            '*[class*="join" i] input',
            'form[class*="subscription" i] input'
        ],
        
        // Dynamic/AJAX loaded forms
        dynamic: [
            '[data-component*="newsletter" i] input',
            '[data-widget*="newsletter" i] input',
            '[data-module*="email" i] input',
            '.js-newsletter input',
            '.js-signup input',
            '.js-subscribe input'
        ]
    }
};

/**
 * Advanced Dynamic Form Detector Class
 */
class DynamicFormDetector {
    constructor(page) {
        this.page = page;
        this.detectionResults = [];
        this.networkActivity = [];
        this.mutations = [];
        this.scrollPositions = [];
    }

    /**
     * Main detection method with multiple phases
     */
    async detectForms(domain) {
        console.log(`🔍 Starting Advanced Dynamic Form Detection for ${domain}`);
        
        const results = {
            domain,
            phases: [],
            totalFormsFound: 0,
            totalEmailInputs: 0,
            dynamicFormsDetected: false,
            scrollTriggeredForms: false,
            detectionSummary: {},
            timestamp: new Date().toISOString()
        };

        // Set up monitoring
        await this.setupMonitoring();

        // Run detection phases
        for (const phase of DYNAMIC_DETECTION_CONFIG.DETECTION_PHASES) {
            console.log(`📊 Running detection phase: ${phase.name}`);
            const phaseResult = await this.runDetectionPhase(phase);
            results.phases.push(phaseResult);
            
            if (phaseResult.formsFound > results.totalFormsFound) {
                results.dynamicFormsDetected = true;
            }
            
            results.totalFormsFound = Math.max(results.totalFormsFound, phaseResult.formsFound);
            results.totalEmailInputs = Math.max(results.totalEmailInputs, phaseResult.emailInputs);
        }

        // Final analysis
        results.detectionSummary = await this.generateDetectionSummary();
        
        console.log(`✅ Advanced detection complete: ${results.totalFormsFound} forms, ${results.totalEmailInputs} email inputs`);
        return results;
    }

    /**
     * Set up monitoring for network activity and DOM mutations
     */
    async setupMonitoring() {
        // Monitor network requests
        this.page.on('request', request => {
            this.networkActivity.push({
                type: 'request',
                url: request.url(),
                method: request.method(),
                timestamp: Date.now()
            });
        });

        this.page.on('response', response => {
            this.networkActivity.push({
                type: 'response',
                url: response.url(),
                status: response.status(),
                timestamp: Date.now()
            });
        });

        // Set up DOM mutation observer
        await this.page.addInitScript(() => {
            window.formDetectorMutations = [];
            const observer = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                        mutation.addedNodes.forEach(node => {
                            if (node.nodeType === 1) { // Element node
                                const hasForm = node.querySelector && (
                                    node.querySelector('form') || 
                                    node.querySelector('input[type="email"]') ||
                                    node.querySelector('input[name*="email" i]')
                                );
                                if (hasForm) {
                                    window.formDetectorMutations.push({
                                        type: 'form_added',
                                        timestamp: Date.now(),
                                        nodeName: node.nodeName,
                                        className: node.className
                                    });
                                }
                            }
                        });
                    }
                });
            });
            observer.observe(document.body, { childList: true, subtree: true });
        });
    }

    /**
     * Run a single detection phase
     */
    async runDetectionPhase(phase) {
        const phaseStart = Date.now();
        
        // Wait for the phase-specific time
        await this.page.waitForTimeout(phase.waitTime);
        
        // Perform scrolling to trigger lazy-loaded content
        if (phase.scrolls > 0) {
            await this.performIntelligentScrolling(phase.scrolls);
        }

        // Wait for network activity to settle
        await this.waitForNetworkIdle();

        // Scan for forms
        const formAnalysis = await this.scanForForms();
        
        // Check for mutations
        const mutations = await this.page.evaluate(() => {
            const muts = window.formDetectorMutations || [];
            window.formDetectorMutations = []; // Clear for next phase
            return muts;
        });

        return {
            phase: phase.name,
            duration: Date.now() - phaseStart,
            formsFound: formAnalysis.totalForms,
            emailInputs: formAnalysis.emailInputs,
            mutations: mutations.length,
            scrollsPerformed: phase.scrolls,
            formDetails: formAnalysis.formDetails,
            emailInputDetails: formAnalysis.emailInputDetails
        };
    }

    /**
     * Intelligent scrolling that triggers lazy-loaded content
     */
    async performIntelligentScrolling(scrollSteps) {
        console.log(`🔄 Performing ${scrollSteps} intelligent scroll steps`);
        
        const viewportHeight = await this.page.evaluate(() => window.innerHeight);
        const documentHeight = await this.page.evaluate(() => document.documentElement.scrollHeight);
        
        const scrollDistance = Math.max(documentHeight / scrollSteps, viewportHeight * 0.8);
        
        for (let i = 0; i <= scrollSteps; i++) {
            const scrollY = (i / scrollSteps) * (documentHeight - viewportHeight);
            
            await this.page.evaluate((y) => {
                window.scrollTo(0, y);
            }, scrollY);
            
            // Wait for potential lazy loading
            await this.page.waitForTimeout(DYNAMIC_DETECTION_CONFIG.SCROLL_DELAY);
            
            // Check if new forms appeared
            const currentForms = await this.page.evaluate(() => {
                return document.querySelectorAll('form, input[type="email"], input[name*="email" i]').length;
            });
            
            this.scrollPositions.push({
                scrollY,
                formsCount: currentForms,
                timestamp: Date.now()
            });
        }
        
        // Scroll back to top
        await this.page.evaluate(() => window.scrollTo(0, 0));
        await this.page.waitForTimeout(1000);
    }

    /**
     * Wait for network activity to settle
     */
    async waitForNetworkIdle() {
        const startTime = Date.now();
        let lastActivityTime = startTime;
        
        while (Date.now() - startTime < DYNAMIC_DETECTION_CONFIG.MAX_NETWORK_WAIT) {
            const recentActivity = this.networkActivity.filter(
                activity => activity.timestamp > lastActivityTime
            );
            
            if (recentActivity.length === 0) {
                // No activity for idle time, consider network idle
                if (Date.now() - lastActivityTime >= DYNAMIC_DETECTION_CONFIG.NETWORK_IDLE_TIME) {
                    console.log(`🌐 Network idle detected after ${Date.now() - startTime}ms`);
                    break;
                }
            } else {
                lastActivityTime = Date.now();
            }
            
            await this.page.waitForTimeout(100);
        }
    }

    /**
     * Comprehensive form scanning
     */
    async scanForForms() {
        return await this.page.evaluate((selectors) => {
            const results = {
                totalForms: 0,
                emailInputs: 0,
                formDetails: [],
                emailInputDetails: []
            };

            // Count all forms
            const forms = document.querySelectorAll('form');
            results.totalForms = forms.length;

            // Analyze each form
            forms.forEach((form, index) => {
                const formInfo = {
                    index,
                    id: form.id,
                    className: form.className,
                    action: form.action,
                    method: form.method,
                    visible: form.offsetParent !== null,
                    emailInputsInForm: form.querySelectorAll('input[type="email"], input[name*="email" i]').length,
                    position: form.getBoundingClientRect()
                };
                results.formDetails.push(formInfo);
            });

            // Find all email inputs using dynamic selectors
            const allEmailSelectors = [
                ...selectors.emailInputs,
                ...selectors.newsletter.map(s => s + ' input'),
                ...selectors.popups,
                ...selectors.footer,
                ...selectors.subscription,
                ...selectors.dynamic
            ];

            const foundEmailInputs = new Set();
            
            allEmailSelectors.forEach(selector => {
                try {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(element => {
                        if (element.type === 'email' || 
                            element.type === 'text' || 
                            element.name?.toLowerCase().includes('email') ||
                            element.placeholder?.toLowerCase().includes('email') ||
                            element.id?.toLowerCase().includes('email')) {
                            
                            const key = element.outerHTML;
                            if (!foundEmailInputs.has(key)) {
                                foundEmailInputs.add(key);
                                results.emailInputDetails.push({
                                    selector: selector,
                                    type: element.type,
                                    name: element.name,
                                    id: element.id,
                                    placeholder: element.placeholder,
                                    className: element.className,
                                    visible: element.offsetParent !== null,
                                    position: element.getBoundingClientRect(),
                                    inForm: !!element.closest('form'),
                                    formId: element.closest('form')?.id || null
                                });
                            }
                        }
                    });
                } catch (e) {
                    // Skip invalid selectors
                }
            });

            results.emailInputs = foundEmailInputs.size;
            return results;
        }, DYNAMIC_DETECTION_CONFIG.DYNAMIC_SELECTORS);
    }

    /**
     * Generate comprehensive detection summary
     */
    async generateDetectionSummary() {
        return await this.page.evaluate(() => {
            return {
                // Page characteristics
                hasLazyLoading: !!document.querySelector('[loading="lazy"], [data-lazy], .lazy'),
                hasJavaScriptFrameworks: {
                    react: !!window.React || !!document.querySelector('[data-reactroot]'),
                    vue: !!window.Vue || !!document.querySelector('[data-v-]'),
                    angular: !!window.angular || !!document.querySelector('[ng-app], [data-ng-app]'),
                    jquery: !!window.jQuery || !!window.$
                },
                
                // Dynamic content indicators
                hasModalTriggers: document.querySelectorAll('[data-toggle="modal"], [data-bs-toggle="modal"], .modal-trigger').length,
                hasPopupTriggers: document.querySelectorAll('[class*="popup" i], [class*="overlay" i]').length,
                hasNewsletterTriggers: document.querySelectorAll('[class*="newsletter" i], [id*="newsletter" i]').length,
                
                // Text content analysis
                hasNewsletterText: document.body.textContent.toLowerCase().includes('newsletter'),
                hasSubscribeText: document.body.textContent.toLowerCase().includes('subscribe'),
                hasSignupText: document.body.textContent.toLowerCase().includes('sign up') || document.body.textContent.toLowerCase().includes('signup'),
                hasJoinText: document.body.textContent.toLowerCase().includes('join'),
                
                // Italian text (for sites like shoplimoni)
                hasIscrivitiText: document.body.textContent.toLowerCase().includes('iscriviti'),
                hasRegistratiText: document.body.textContent.toLowerCase().includes('registrati'),
                
                // Form-related elements
                totalElements: document.querySelectorAll('*').length,
                totalButtons: document.querySelectorAll('button, input[type="button"], input[type="submit"]').length,
                totalInputs: document.querySelectorAll('input').length
            };
        });
    }
}

/**
 * Enhanced form interaction with dynamic detection
 */
async function attemptDynamicFormSubmission(page, email, domain) {
    const detector = new DynamicFormDetector(page);
    const detectionResults = await detector.detectForms(domain);
    
    console.log(`📋 Dynamic detection found ${detectionResults.totalEmailInputs} email inputs across ${detectionResults.phases.length} phases`);
    
    if (detectionResults.totalEmailInputs === 0) {
        return {
            success: false,
            reason: 'No email inputs found after dynamic detection',
            detectionResults
        };
    }

    // Try to interact with the most promising email inputs
    const lastPhase = detectionResults.phases[detectionResults.phases.length - 1];
    const emailInputs = lastPhase.emailInputDetails || [];
    
    for (const inputDetail of emailInputs) {
        if (!inputDetail.visible) continue;
        
        try {
            // Create a more specific selector
            let selector = '';
            if (inputDetail.id) {
                selector = `#${inputDetail.id}`;
            } else if (inputDetail.name) {
                selector = `input[name="${inputDetail.name}"]`;
            } else {
                selector = `input[type="${inputDetail.type}"]`;
            }
            
            const element = page.locator(selector).first();
            
            if (await element.isVisible().catch(() => false)) {
                await element.fill(email);
                console.log(`✅ Filled email input: ${selector}`);
                
                // Try to submit
                const form = element.locator('xpath=ancestor-or-self::form').first();
                const submitButton = form.locator('button[type="submit"], input[type="submit"], button:has-text("Subscribe"), button:has-text("Sign Up"), button:has-text("Registrati")').first();
                
                if (await submitButton.isVisible().catch(() => false)) {
                    await submitButton.click();
                    console.log(`✅ Clicked submit button`);
                    await page.waitForTimeout(2000);
                    
                    return {
                        success: true,
                        inputUsed: inputDetail,
                        detectionResults
                    };
                } else {
                    // Try pressing Enter
                    await element.press('Enter');
                    await page.waitForTimeout(2000);
                    
                    return {
                        success: true,
                        inputUsed: inputDetail,
                        method: 'enter_key',
                        detectionResults
                    };
                }
            }
        } catch (error) {
            console.log(`⚠️ Failed to interact with input: ${error.message}`);
            continue;
        }
    }

    return {
        success: false,
        reason: 'Found email inputs but could not interact with them',
        detectionResults
    };
}

module.exports = {
    DynamicFormDetector,
    attemptDynamicFormSubmission,
    DYNAMIC_DETECTION_CONFIG
}; 