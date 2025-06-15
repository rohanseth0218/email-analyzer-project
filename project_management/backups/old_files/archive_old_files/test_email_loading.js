const { parse } = require('csv-parse/sync');
const fs = require('fs').promises;

async function testEmails() {
  try {
    console.log('🧪 Testing email loading...');
    
    const csvContent = await fs.readFile('./mailboxaccounts.csv', 'utf-8');
    console.log('📄 CSV first 200 chars:', csvContent.substring(0, 200));
    
    const records = parse(csvContent, { 
      columns: true, 
      skip_empty_lines: true 
    });
    
    console.log('📊 Records length:', records.length);
    console.log('🔍 First record:', records[0]);
    console.log('🔑 First record keys:', Object.keys(records[0]));
    
    const emails = records
      .map(record => record.Email || record.email)
      .filter(email => email && email.includes('@'));
    
    console.log('📧 Emails found:', emails.length);
    console.log('📋 First 3 emails:', emails.slice(0, 3));
    
    if (emails.length === 0) {
      console.log('❌ No emails found! Checking column names...');
      console.log('Available columns:', Object.keys(records[0]));
      
      // Try different column names
      const emailColumn = Object.keys(records[0]).find(key => 
        key.toLowerCase().includes('email')
      );
      console.log('Found email column:', emailColumn);
      
      if (emailColumn) {
        const emails2 = records
          .map(record => record[emailColumn])
          .filter(email => email && email.includes('@'));
        console.log('📧 Emails with correct column:', emails2.length);
        console.log('📋 First 3 emails:', emails2.slice(0, 3));
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testEmails(); 