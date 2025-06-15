const fs = require('fs').promises;
const { parse } = require('csv-parse/sync');

async function loadEmailAccounts() {
    try {
        console.log('📧 Loading email accounts...');
        const csvContent = await fs.readFile('./mailboxaccounts.csv', 'utf-8');
        const records = parse(csvContent, { 
            columns: true, 
            skip_empty_lines: true 
        });
        
        const emails = records
            .map(record => record['﻿Email'] || record.Email || record.email)
            .filter(email => email && email.includes('@') && email.includes('.'));
        
        console.log(`📧 Loaded ${emails.length} valid email accounts`);
        return emails;
        
    } catch (error) {
        console.error(`❌ Error loading email accounts: ${error.message}`);
        throw error;
    }
}

async function testAutomationFlow() {
    try {
        const emails = await loadEmailAccounts();
        console.log('\n🔍 Testing automation flow...');
        console.log(`Emails array length: ${emails.length}`);
        console.log(`First few emails:`, emails.slice(0, 5));
        
        // Simulate how the automation accesses emails
        const testIndices = [0, 1, 2, 50, 100, 150];
        
        for (const currentIndex of testIndices) {
            const email = emails[currentIndex % emails.length];
            console.log(`Index ${currentIndex}: ${currentIndex % emails.length} -> ${email}`);
            
            if (!email) {
                console.error(`❌ UNDEFINED EMAIL at index ${currentIndex}!`);
            }
        }
        
        // Test edge cases
        console.log('\n🧪 Testing edge cases...');
        if (emails.length === 0) {
            console.error('❌ CRITICAL: Emails array is empty!');
            return;
        }
        
        // Test modulo operation
        const testEmail = emails[999 % emails.length];
        console.log(`Test email (999 % ${emails.length}): ${testEmail}`);
        
    } catch (error) {
        console.error(`❌ Error in automation flow test: ${error.message}`);
        throw error;
    }
}

if (require.main === module) {
    testAutomationFlow().catch(console.error);
} 