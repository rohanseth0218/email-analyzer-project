const fs = require('fs');
const readline = require('readline');

// Configuration for retry attempt
const RETRY_CONFIG = {
    // Only retry specific failure types that might succeed on retry
    retryableFailures: [
        'navigation_timeout',    // Browserbase connection issues
        'form_submission_failed', // Form detection worked, submission failed
        'navigation_error'       // Network/connection errors
    ],
    
    // Skip failures that are unlikely to succeed on retry
    skipFailures: [
        'no_forms_found'        // Sites legitimately don't have email forms
    ],
    
    // Enhanced retry settings
    maxConcurrency: 25,         // Reduce load on Browserbase
    pageTimeout: 45000,         // Longer timeout
    waitBetweenBatches: 30,     // Seconds between batches
    useAlternativeStrategies: true
};

async function analyzeFailedDomains() {
    console.log('📊 Analyzing failed domains for retry...');
    
    const failedDomains = [];
    const stats = {
        total: 0,
        byReason: {},
        retryable: 0,
        skippable: 0
    };
    
    // Read failed domains log
    const fileStream = fs.createReadStream('logs/failed_domains_full_run.jsonl');
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });
    
    for await (const line of rl) {
        if (line.trim()) {
            const entry = JSON.parse(line);
            stats.total++;
            
            const reason = entry.reason;
            stats.byReason[reason] = (stats.byReason[reason] || 0) + 1;
            
            if (RETRY_CONFIG.retryableFailures.includes(reason)) {
                failedDomains.push({
                    domain: entry.domain,
                    reason: reason,
                    originalBatch: entry.batchNumber,
                    details: entry.details || entry.error
                });
                stats.retryable++;
            } else {
                stats.skippable++;
            }
        }
    }
    
    console.log('\n📈 Failed Domain Analysis:');
    console.log(`📊 Total Failed: ${stats.total}`);
    console.log(`🔄 Retryable: ${stats.retryable}`);
    console.log(`⏭️ Skippable: ${stats.skippable}`);
    console.log('\n📋 Failure Breakdown:');
    
    Object.entries(stats.byReason).forEach(([reason, count]) => {
        const status = RETRY_CONFIG.retryableFailures.includes(reason) ? '🔄' : '⏭️';
        console.log(`  ${status} ${reason}: ${count}`);
    });
    
    return failedDomains;
}

async function createRetryBatches(failedDomains) {
    console.log(`\n🔄 Creating retry batches for ${failedDomains.length} domains...`);
    
    // Group by failure reason for different strategies
    const byReason = failedDomains.reduce((acc, domain) => {
        acc[domain.reason] = acc[domain.reason] || [];
        acc[domain.reason].push(domain);
        return acc;
    }, {});
    
    // Create retry domain CSV
    const retryDomainsCSV = failedDomains.map(d => d.domain.replace('https://', '')).join('\n');
    fs.writeFileSync('retry_domains.csv', `Domain\n${retryDomainsCSV}`);
    
    // Create retry configuration
    const retryConfig = {
        timestamp: new Date().toISOString(),
        totalRetryDomains: failedDomains.length,
        byReason: Object.fromEntries(
            Object.entries(byReason).map(([reason, domains]) => [reason, domains.length])
        ),
        config: RETRY_CONFIG
    };
    
    fs.writeFileSync('logs/retry_config.json', JSON.stringify(retryConfig, null, 2));
    
    console.log(`✅ Created retry_domains.csv with ${failedDomains.length} domains`);
    console.log(`📊 Retry breakdown:`);
    Object.entries(byReason).forEach(([reason, domains]) => {
        console.log(`  • ${reason}: ${domains.length} domains`);
    });
    
    return failedDomains;
}

async function main() {
    console.log('🔄 Failed Domain Retry Analysis Starting...');
    
    try {
        const failedDomains = await analyzeFailedDomains();
        await createRetryBatches(failedDomains);
        
        console.log('\n✅ Retry Analysis Complete!');
        console.log('\n📋 Next Steps:');
        console.log('1. Review retry_domains.csv for domains to retry');
        console.log('2. Run retry automation with enhanced strategies');
        console.log('\n💡 Recommendation: Focus on navigation_timeout and form_submission_failed domains first');
        
    } catch (error) {
        console.error('❌ Error during retry analysis:', error);
    }
}

if (require.main === module) {
    main();
}

module.exports = { analyzeFailedDomains, createRetryBatches }; 