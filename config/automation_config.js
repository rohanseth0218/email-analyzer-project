/**
 * Email Signup Automation Configuration
 * Centralized configuration for all automation settings
 */

const config = {
    // Browser Settings
    maxConcurrentBrowsers: 50,
    timeoutMs: 30000, // 30 seconds per domain
    retryAttempts: 3,
    delayBetweenAttempts: 2000, // 2 seconds
    delayBetweenBatches: 5000, // 5 seconds between batches
    
    // Notification Settings
    notificationInterval: 100, // Notify every 100 domains
    slackChannel: '#email-automation',
    errorChannel: '#automation-errors',
    
    // File Paths
    domainsFile: 'Storedomains.csv',
    emailsFile: 'mailboxaccounts.csv',
    logFile: 'logs/automation.log',
    resultsFile: 'logs/results.json',
    
    // Browser Context Settings
    browserContext: {
        geolocation: { latitude: 40.7128, longitude: -74.0060 }, // New York
        locale: 'en-US',
        permissions: ['geolocation'],
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
        hasTouch: false,
        isMobile: false
    },
    
    // Form Detection Settings
    formSelectors: {
        popup: [
            'div[class*="popup"] input[type="email"]:visible',
            'div[class*="modal"] input[type="email"]:visible',
            'div[class*="overlay"] input[type="email"]:visible',
            '[role="dialog"] input[type="email"]:visible',
            '.klaviyo-form input[type="email"]:visible',
            '.mc4wp-form input[type="email"]:visible',
            '.privy-form input[type="email"]:visible',
            '.omnisend-form input[type="email"]:visible',
            '.mailerlite-form input[type="email"]:visible'
        ],
        newsletter: [
            'form[class*="newsletter"] input[type="email"]',
            'form[class*="signup"] input[type="email"]',
            'form[class*="subscribe"] input[type="email"]',
            '[class*="newsletter"] input[type="email"]',
            '[class*="email-signup"] input[type="email"]',
            'input[placeholder*="email" i][placeholder*="subscribe" i]',
            'input[placeholder*="newsletter" i]'
        ],
        footer: [
            'footer input[type="email"]',
            '[class*="footer"] input[type="email"]',
            'footer form input[type="email"]'
        ],
        header: [
            'header input[type="email"]',
            '[class*="header"] input[type="email"]',
            'nav input[type="email"]'
        ],
        generic: [
            'input[type="email"]:visible',
            'input[name*="email" i]:visible',
            'input[placeholder*="email" i]:visible'
        ]
    },
    
    // Submit Button Selectors
    submitSelectors: [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Subscribe")',
        'button:has-text("Sign Up")',
        'button:has-text("Join")',
        'button:has-text("Submit")',
        'button[class*="submit"]',
        'button[class*="subscribe"]',
        'input[value*="Subscribe" i]',
        'input[value*="Sign Up" i]'
    ],
    
    // UTM Parameters for tracking
    utmParams: "?utm_source=automation&utm_medium=signup&utm_campaign=bulk-signup&utm_content=email-automation",
    
    // Excluded Terms (skip if form contains these)
    excludedTerms: [
        'password',
        'login',
        'signin',
        'sign-in',
        'account',
        'register',
        'checkout'
    ],
    
    // Success Indicators
    successIndicators: [
        'thank you',
        'thanks',
        'subscribed',
        'success',
        'confirmation',
        'welcome',
        'check your email',
        'almost done'
    ],
    
    // Development/Testing Settings
    development: {
        enabled: false, // Set to true for testing
        maxDomains: 10,  // Limit domains in dev mode
        logLevel: 'debug'
    }
};

// Environment-specific overrides
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
    config.development.enabled = true;
    config.maxConcurrentBrowsers = 5;
    config.notificationInterval = 5;
}

// Export configuration
if (typeof module !== 'undefined' && module.exports) {
    module.exports = config;
}

// Make available globally in browser
if (typeof window !== 'undefined') {
    window.automationConfig = config;
} 