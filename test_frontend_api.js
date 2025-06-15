const fetch = require('node-fetch');

async function testAPI() {
  const API_BASE = 'http://localhost:3001';
  
  console.log('🧪 Testing Pulse API endpoints...\n');
  
  try {
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await fetch(`${API_BASE}/health`);
    const healthData = await healthResponse.json();
    console.log('   ✅ Health check:', healthData.status);
    
    // Test stats endpoint
    console.log('\n2. Testing stats endpoint...');
    const statsResponse = await fetch(`${API_BASE}/api/stats`);
    const statsData = await statsResponse.json();
    console.log('   📊 Total campaigns:', statsData.total_campaigns);
    console.log('   🏪 Unique brands:', statsData.unique_brands);
    console.log('   🎨 Campaign themes:', statsData.unique_themes);
    
    // Test filters endpoint
    console.log('\n3. Testing filters endpoint...');
    const filtersResponse = await fetch(`${API_BASE}/api/filters`);
    const filtersData = await filtersResponse.json();
    console.log('   🔍 Available brands:', filtersData.brands.length);
    console.log('   🎯 Available themes:', filtersData.themes.length);
    
    // Test campaigns endpoint
    console.log('\n4. Testing campaigns endpoint...');
    const campaignsResponse = await fetch(`${API_BASE}/api/campaigns?limit=2`);
    const campaignsData = await campaignsResponse.json();
    console.log('   📧 Retrieved campaigns:', campaignsData.campaigns.length);
    
    if (campaignsData.campaigns.length > 0) {
      const firstCampaign = campaignsData.campaigns[0];
      console.log('   📋 Sample campaign:');
      console.log('      Brand:', firstCampaign.brand);
      console.log('      Subject:', firstCampaign.subject.substring(0, 50) + '...');
      console.log('      Theme:', firstCampaign.campaign_theme);
      console.log('      Has screenshot:', !!firstCampaign.screenshot);
    }
    
    console.log('\n🎉 All API tests passed! Frontend should work correctly.');
    console.log('🌐 Open http://localhost:5173 to view your Pulse dashboard');
    
  } catch (error) {
    console.error('❌ API test failed:', error.message);
    console.log('\n🛠️ Make sure:');
    console.log('   1. API server is running: cd api && node server.js');
    console.log('   2. BigQuery credentials are set up correctly');
    console.log('   3. Port 3001 is available');
  }
}

testAPI(); 