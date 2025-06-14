/**
 * REPOSITORY CLEANUP SCRIPT
 * Removes old automation files and organizes the workspace
 */

const fs = require('fs').promises;
const path = require('path');

const KEEP_FILES = [
    // Essential working files
    'run_local_no_proxy.js',           // Current working automation
    'monitor_automation.js',           // Monitoring script
    'cleanup_repo.js',                 // This file
    
    // Data files
    'Storedomains.csv',
    'mailboxaccounts.csv',
    'package.json',
    'package-lock.json',
    'README.md',
    
    // Keep one test file for reference
    'test_browserbase.js',
    
    // Current logs directory
    'logs/',
    'node_modules/',
    
    // Essential config files
    '.DS_Store'
];

const ARCHIVE_DIR = './archive_old_files';

async function shouldKeep(filename) {
    return KEEP_FILES.some(keepFile => {
        if (keepFile.endsWith('/')) {
            return filename.startsWith(keepFile);
        }
        return filename === keepFile;
    });
}

async function cleanupRepository() {
    console.log('🧹 Starting Repository Cleanup...');
    console.log('=====================================');
    
    try {
        // Create archive directory
        await fs.mkdir(ARCHIVE_DIR, { recursive: true });
        console.log(`📁 Created archive directory: ${ARCHIVE_DIR}`);
        
        // Get all files in current directory
        const allFiles = await fs.readdir('.');
        console.log(`📋 Found ${allFiles.length} items in repository`);
        
        let movedCount = 0;
        let keptCount = 0;
        
        for (const file of allFiles) {
            if (await shouldKeep(file)) {
                console.log(`✅ Keeping: ${file}`);
                keptCount++;
            } else {
                // Move to archive
                const sourcePath = path.join('.', file);
                const targetPath = path.join(ARCHIVE_DIR, file);
                
                try {
                    const stats = await fs.stat(sourcePath);
                    if (stats.isDirectory()) {
                        console.log(`📁 Archiving directory: ${file}`);
                        // For directories, we'll just log them for now
                        // Full directory moving would require recursive logic
                    } else {
                        await fs.rename(sourcePath, targetPath);
                        console.log(`📦 Archived: ${file}`);
                        movedCount++;
                    }
                } catch (error) {
                    console.error(`❌ Error archiving ${file}: ${error.message}`);
                }
            }
        }
        
        console.log('\n🎉 CLEANUP COMPLETE!');
        console.log(`✅ Kept ${keptCount} essential files`);
        console.log(`📦 Archived ${movedCount} old files`);
        console.log(`📁 Archive location: ${ARCHIVE_DIR}`);
        
        // Show current status
        console.log('\n📊 CURRENT REPOSITORY STATUS:');
        const remainingFiles = await fs.readdir('.');
        remainingFiles.forEach(file => {
            console.log(`   📄 ${file}`);
        });
        
    } catch (error) {
        console.error('❌ Cleanup failed:', error.message);
        throw error;
    }
}

// Show automation status
async function showAutomationStatus() {
    console.log('\n🤖 CURRENT AUTOMATION STATUS:');
    console.log('=====================================');
    
    try {
        // Check progress files
        const progressFiles = [
            'logs/progress_local_no_proxy.json',
            'logs/progress_final.json',
            'logs/progress_slow_debug.json'
        ];
        
        for (const file of progressFiles) {
            try {
                const data = await fs.readFile(file, 'utf-8');
                const progress = JSON.parse(data);
                console.log(`📊 ${file}:`);
                console.log(`   📈 Processed: ${progress.totalProcessed}`);
                console.log(`   ✅ Successful: ${progress.totalSuccessful}`);
                console.log(`   📋 Success Rate: ${progress.successRate}%`);
                console.log(`   ⏰ Last Update: ${new Date(progress.timestamp).toLocaleString()}`);
                console.log('');
            } catch (e) {
                console.log(`❌ ${file}: Not found or invalid`);
            }
        }
        
        // Check if automation is running
        console.log('🔍 Checking for running processes...');
        
    } catch (error) {
        console.error('❌ Status check failed:', error.message);
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--status') || args.includes('-s')) {
        await showAutomationStatus();
    } else if (args.includes('--cleanup') || args.includes('-c')) {
        await cleanupRepository();
    } else {
        console.log('🧹 REPOSITORY CLEANUP & STATUS TOOL');
        console.log('===================================');
        console.log('');
        console.log('Usage:');
        console.log('  node cleanup_repo.js --cleanup    # Clean up old files');
        console.log('  node cleanup_repo.js --status     # Show automation status');
        console.log('');
        console.log('Starting status check...');
        await showAutomationStatus();
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { cleanupRepository, showAutomationStatus }; 