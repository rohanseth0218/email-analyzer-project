/**
 * Create Unprocessed Domains List
 * 
 * Generates a clean list of domains that haven't been processed yet
 * by excluding all previously attempted domains from the main list
 */

const fs = require('fs').promises;

function normalizeDomain(domain) {
    return domain
        .replace(/^https?:\/\//, '')  // Remove protocol
        .replace(/^www\./, '')        // Remove www
        .replace(/\/$/, '')          // Remove trailing slash
        .toLowerCase()               // Lowercase for comparison
        .trim();
}

async function extractProcessedDomains() {
    console.log('🔍 Extracting all previously processed domains...');
    
    const processedDomains = new Set();
    
    try {
        // 1. Get successful domains
        console.log('📊 Loading successful domains...');
        const successfulLog = await fs.readFile('./logs/successful_domains_full_run.jsonl', 'utf-8');
        const successfulLines = successfulLog.trim().split('\n').filter(line => line.trim());
        
        for (const line of successfulLines) {
            try {
                const record = JSON.parse(line);
                if (record.domain) {
                    const cleanDomain = normalizeDomain(record.domain);
                    processedDomains.add(cleanDomain);
                }
            } catch (e) {
                // Skip invalid JSON lines
            }
        }
        console.log(`   ✅ Found ${successfulLines.length} successful domains`);
        
        // 2. Get failed domains  
        console.log('📊 Loading failed domains...');
        const failedLog = await fs.readFile('./logs/failed_domains_local_no_proxy.jsonl', 'utf-8');
        const failedLines = failedLog.trim().split('\n').filter(line => line.trim());
        
        for (const line of failedLines) {
            try {
                const record = JSON.parse(line);
                if (record.domain) {
                    const cleanDomain = normalizeDomain(record.domain);
                    processedDomains.add(cleanDomain);
                }
            } catch (e) {
                // Skip invalid JSON lines
            }
        }
        console.log(`   ✅ Found ${failedLines.length} failed domain attempts`);
        
        // 3. Get currently processing domains (RETRY_FAILED list)
        console.log('📊 Loading current retry list...');
        try {
            const retryContent = await fs.readFile('./logs/failed_domains_for_retry.json', 'utf-8');
            const retryList = JSON.parse(retryContent);
            
            for (const item of retryList) {
                if (item.domain) {
                    const cleanDomain = normalizeDomain(item.domain);
                    processedDomains.add(cleanDomain);
                }
            }
            console.log(`   ✅ Found ${retryList.length} domains in current retry`);
        } catch (e) {
            console.log('   ⚠️ No retry list found (using JSONL fallback)');
        }
        
        console.log(`\n📋 Total unique domains processed/processing: ${processedDomains.size}`);
        return processedDomains;
        
    } catch (error) {
        console.error(`❌ Error extracting processed domains: ${error.message}`);
        return new Set();
    }
}

async function createUnprocessedList() {
    console.log('🚀 Creating unprocessed domains list...\n');
    
    // Get all processed domains
    const processedDomains = await extractProcessedDomains();
    
    // Load the main domain list
    console.log('📂 Loading main domain list (Storedomains.csv)...');
    const mainListContent = await fs.readFile('./Storedomains.csv', 'utf-8');
    const lines = mainListContent.trim().split('\n');
    
    // Skip header row and extract domain column
    const allDomains = lines.slice(1).map(line => {
        const domain = line.split(',')[0].trim(); // First column is domain
        return domain;
    }).filter(domain => domain && domain.length > 0);
    
    console.log(`   📊 Total domains in main list: ${allDomains.length}`);
    
    // Filter out processed domains
    console.log('🔍 Filtering out processed domains...');
    const unprocessedDomains = allDomains.filter(domain => {
        const cleanDomain = normalizeDomain(domain);
        return !processedDomains.has(cleanDomain);
    });
    
    console.log(`   ✅ Unprocessed domains found: ${unprocessedDomains.length}`);
    console.log(`   📊 Domains already processed: ${allDomains.length - unprocessedDomains.length}`);
    
    // Save the unprocessed list (keeping original format)
    console.log('💾 Saving unprocessed domains list...');
    const unprocessedCSV = unprocessedDomains.join('\n');
    await fs.writeFile('./Storedomains_unprocessed.csv', unprocessedCSV);
    
    // Create summary
    const summary = {
        timestamp: new Date().toISOString(),
        totalDomainsInMainList: allDomains.length,
        domainsAlreadyProcessed: allDomains.length - unprocessedDomains.length,
        unprocessedDomainsRemaining: unprocessedDomains.length,
        processingRate: ((allDomains.length - unprocessedDomains.length) / allDomains.length * 100).toFixed(2) + '%'
    };
    
    await fs.writeFile('./unprocessed_summary.json', JSON.stringify(summary, null, 2));
    
    // Show some examples of matched domains
    console.log('\n🔍 Sample processed domains found:');
    const sampleProcessed = Array.from(processedDomains).slice(0, 5);
    sampleProcessed.forEach((domain, i) => {
        console.log(`   ${i + 1}. ${domain}`);
    });
    
    console.log('\n🔍 Sample unprocessed domains:');
    const sampleUnprocessed = unprocessedDomains.slice(0, 5);
    sampleUnprocessed.forEach((domain, i) => {
        console.log(`   ${i + 1}. ${domain}`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 UNPROCESSED DOMAINS SUMMARY');
    console.log('='.repeat(60));
    console.log(`📂 Main list total: ${summary.totalDomainsInMainList.toLocaleString()}`);
    console.log(`✅ Already processed: ${summary.domainsAlreadyProcessed.toLocaleString()}`);
    console.log(`🎯 Remaining unprocessed: ${summary.unprocessedDomainsRemaining.toLocaleString()}`);
    console.log(`📈 Processing progress: ${summary.processingRate}`);
    console.log('='.repeat(60));
    
    console.log('\n📁 Files created:');
    console.log('   📄 Storedomains_unprocessed.csv - Clean list for next run');
    console.log('   📊 unprocessed_summary.json - Processing summary');
    
    console.log('\n🚀 Next steps:');
    console.log('   1. Wait for current RETRY_FAILED run to complete');
    console.log('   2. Use Storedomains_unprocessed.csv for the next automation run');
    console.log('   3. This ensures no duplicate processing!');
    
    return {
        unprocessedCount: unprocessedDomains.length,
        totalProcessed: allDomains.length - unprocessedDomains.length
    };
}

// Run the script
createUnprocessedList().catch(console.error); 