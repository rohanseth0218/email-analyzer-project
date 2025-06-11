/**
 * Analyze Failed Domains - Debug Mode
 * 
 * This script focuses on the failed domains from previous tests
 * and provides detailed analysis to understand why they failed.
 */

const { runEnhancedAutomation } = require('./enhanced_automation');

// List of domains that failed in previous test (we'll extract these from the first 100)
const FAILED_DOMAINS = [
    // We'll start with these and add more as we discover them
    'https://shoplimoni.com',
    'https://cutnpeelknives.com',
    'https://mktours.com',
    'https://allstyleswigs.com',
    'https://crystalmaggie.com',
    'https://sweetpeaskids.com',
    'https://roseandpearl.com',
    'https://skims.com',  // Test this one as it should work
    'https://fancytreasures.com',
    'https://gigiandmaxpets.com',
    'https://luxuryskincarebykate.com',
    'https://americandental.com',
    'https://daysigma.com',
    'https://graceandlaceboutique.com',
    'https://blinktoys.com',
    'https://shopbrightlingerie.com',
    'https://chicbirdie.com',
    'https://chicsafetyshop.com',
    'https://crystalintuition.com',
    'https://lorikennedystudio.com'
];

/**
 * Save failed domains list for the enhanced automation to pick up
 */
async function saveFailedDomainsList() {
    const fs = require('fs').promises;
    
    const failedAttempts = FAILED_DOMAINS.map(domain => ({
        domain: domain,
        email: 'test@example.com',
        error: 'Previous test failure',
        timestamp: new Date().toISOString()
    }));
    
    await fs.writeFile('./logs/failed_attempts.json', JSON.stringify(failedAttempts, null, 2));
    console.log(`💾 Created failed attempts file with ${FAILED_DOMAINS.length} domains for analysis`);
}

/**
 * Run focused analysis on failed domains
 */
async function analyzeFailures() {
    console.log('🔍 Starting Focused Failure Analysis...');
    console.log(`📋 Analyzing ${FAILED_DOMAINS.length} previously failed domains`);
    console.log('🎯 Goal: Understand and fix failure patterns');
    
    try {
        // Save the failed domains list
        await saveFailedDomainsList();
        
        // Run enhanced automation in retry mode with detailed debugging
        const result = await runEnhancedAutomation(null, true);
        
        console.log('\n📊 Failure Analysis Complete!');
        console.log('📈 Results:', {
            analyzed: result.stats.processed,
            nowWorking: result.stats.successful,
            stillFailing: result.stats.failed,
            improvementRate: `${(result.stats.successful / result.stats.processed * 100).toFixed(1)}%`
        });
        
        if (result.stats.failed > 0) {
            console.log('\n🔄 Failures still exist. Check the detailed logs and screenshots for insights.');
            console.log('📁 Debug files location:');
            console.log('   - Screenshots: ./logs/screenshots/');
            console.log('   - Page sources: ./logs/');
            console.log('   - Failure report: ./logs/failure_analysis_*.json');
        }
        
        if (result.stats.successful > 0) {
            console.log('\n✅ Some failures were fixed! The enhanced form detection is working.');
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ Failure analysis failed:', error);
        throw error;
    }
}

// Run the analysis
if (require.main === module) {
    analyzeFailures()
        .then(() => {
            console.log('\n🎯 Analysis complete. Check the detailed logs to understand the failure patterns.');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Analysis failed:', error);
            process.exit(1);
        });
}

module.exports = { analyzeFailures }; 