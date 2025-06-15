const axios = require('axios');

const SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/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';

async function testSlackNotification() {
    console.log('🧪 Testing Slack notification...');
    
    try {
        const testMessage = `🤖 **Slack Integration Test**
✅ **Status:** Webhook connected successfully!
📅 **Time:** ${new Date().toLocaleString()}
🚀 **Ready for:** Email Automation Progress Updates

Your automation will now send updates every 100 domains processed! 🎯`;

        await axios.post(SLACK_WEBHOOK_URL, { 
            text: testMessage,
            username: 'Email Automation Bot',
            icon_emoji: ':robot_face:'
        });
        
        console.log('✅ Slack notification sent successfully!');
        console.log('📱 Check your Slack channel for the test message');
        
    } catch (error) {
        console.error('❌ Failed to send Slack notification:');
        console.error(`   Error: ${error.message}`);
        
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Response: ${JSON.stringify(error.response.data)}`);
        }
    }
}

testSlackNotification(); 