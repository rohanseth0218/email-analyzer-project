/**
 * Extract Failed Domains Utility
 * 
 * Extracts unique failed domains from log files for retry
 */

const fs = require('fs').promises;

async function extractFailedDomains() {
    try {
        console.log('🔍 Extracting failed domains from logs...');
        
        // Read the failed domains log
        const logContent = await fs.readFile('./logs/failed_domains_local_no_proxy.jsonl', 'utf-8');
        const lines = logContent.trim().split('\n');
        
        console.log(`📝 Processing ${lines.length} log entries...`);
        
        const failedDomains = new Set();
        const reasonCounts = {};
        
        let sessionErrors = 0;
        let formErrors = 0;
        let otherErrors = 0;
        
        for (const line of lines) {
            try {
                const record = JSON.parse(line);
                
                if (record.domain && !record.success) {
                    failedDomains.add(record.domain);
                    
                    // Count failure reasons
                    const reason = record.reason || 'unknown';
                    reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
                    
                    // Categorize errors
                    if (record.error && record.error.includes('session') || record.error && record.error.includes('410 Gone')) {
                        sessionErrors++;
                    } else if (reason.includes('form') || reason.includes('submission')) {
                        formErrors++;
                    } else {
                        otherErrors++;
                    }
                }
            } catch (parseError) {
                console.log(`⚠️ Failed to parse line: ${line.substring(0, 100)}...`);
            }
        }
        
        const uniqueFailedDomains = Array.from(failedDomains);
        
        console.log(`\n📊 EXTRACTION RESULTS:`);
        console.log(`   Total log entries: ${lines.length}`);
        console.log(`   Unique failed domains: ${uniqueFailedDomains.length}`);
        console.log(`   Session errors: ${sessionErrors}`);
        console.log(`   Form errors: ${formErrors}`);
        console.log(`   Other errors: ${otherErrors}`);
        
        console.log(`\n❌ Failure Reasons:`);
        for (const [reason, count] of Object.entries(reasonCounts)) {
            console.log(`   ${reason}: ${count}`);
        }
        
        // Save the unique failed domains for retry
        const retryList = uniqueFailedDomains.map(domain => ({ domain, retry: true }));
        await fs.writeFile('./logs/failed_domains_for_retry.json', JSON.stringify(retryList, null, 2));
        
        // Also save as a simple list
        await fs.writeFile('./logs/failed_domains_list.txt', uniqueFailedDomains.join('\n'));
        
        console.log(`\n✅ Saved retry list to:`);
        console.log(`   ./logs/failed_domains_for_retry.json`);
        console.log(`   ./logs/failed_domains_list.txt`);
        
        // Show some examples
        console.log(`\n📋 Sample failed domains (first 10):`);
        for (let i = 0; i < Math.min(10, uniqueFailedDomains.length); i++) {
            console.log(`   ${i + 1}. ${uniqueFailedDomains[i]}`);
        }
        
        return uniqueFailedDomains;
        
    } catch (error) {
        console.error(`❌ Error extracting failed domains: ${error.message}`);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    extractFailedDomains().catch(console.error);
}

module.exports = { extractFailedDomains }; 