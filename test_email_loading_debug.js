const fs = require('fs').promises;
const { parse } = require('csv-parse/sync');

async function testEmailLoading() {
    try {
        console.log('📧 Testing email loading...');
        const csvContent = await fs.readFile('./mailboxaccounts.csv', 'utf-8');
        
        // Show first few characters to check for BOM
        console.log('First 20 characters of CSV:', JSON.stringify(csvContent.substring(0, 20)));
        
        const records = parse(csvContent, { 
            columns: true, 
            skip_empty_lines: true 
        });
        
        console.log('Available columns:', Object.keys(records[0]));
        console.log('First 5 records:');
        
        const emails = [];
        for (let i = 0; i < Math.min(5, records.length); i++) {
            const record = records[i];
            console.log(`Record ${i}:`, record);
            
            // Try different ways to get email
            const email1 = record['﻿Email'];  // BOM version
            const email2 = record.Email;      // Normal version
            const email3 = record.email;      // Lowercase version
            
            console.log(`  - BOM Email: ${email1}`);
            console.log(`  - Normal Email: ${email2}`);
            console.log(`  - Lowercase Email: ${email3}`);
            
            const finalEmail = email1 || email2 || email3;
            emails.push(finalEmail);
            console.log(`  - Final Email: ${finalEmail}`);
        }
        
        console.log(`\n✅ Successfully loaded ${emails.length} emails`);
        console.log('Sample emails:', emails);
        
        return emails;
        
    } catch (error) {
        console.error(`❌ Error loading emails: ${error.message}`);
        throw error;
    }
}

if (require.main === module) {
    testEmailLoading().catch(console.error);
} 