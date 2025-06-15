const fs = require('fs').promises;
const { parse } = require('csv-parse/sync');

async function debugEmailLoading() {
    try {
        console.log('🔍 Debug: Testing email loading from CSV...');
        
        const csvContent = await fs.readFile('./mailboxaccounts.csv', 'utf-8');
        console.log('📄 CSV content length:', csvContent.length);
        console.log('📄 First 200 chars:', csvContent.substring(0, 200));
        
        const records = parse(csvContent, { 
            columns: true, 
            skip_empty_lines: true 
        });
        
        console.log('📊 Total records parsed:', records.length);
        console.log('📋 First record keys:', Object.keys(records[0]));
        console.log('📋 First record:', records[0]);
        
        const emails = records
            .map(record => {
                const email = record['﻿Email'] || record.Email || record.email;
                console.log(`📧 Processing record - BOM Email: "${record['﻿Email']}", Email: "${record.Email}", email: "${record.email}", result: "${email}"`);
                return email;
            })
            .filter(email => {
                const isValid = email && email.includes('@') && email.includes('.');
                console.log(`✅ Email "${email}" valid: ${isValid}`);
                return isValid;
            });
        
        console.log(`📧 Final result: ${emails.length} valid emails`);
        console.log('📧 First 5 emails:', emails.slice(0, 5));
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

debugEmailLoading(); 