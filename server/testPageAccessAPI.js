// Test script for Role Page Access API
// Run: node testPageAccessAPI.js
// Make sure your server is running first!

const API_BASE_URL = 'http://localhost:5170';

// You need to get a real token by logging in as super-admin
// This is just a placeholder - replace with actual token
const TOKEN = process.env.TEST_TOKEN || 'YOUR_SUPER_ADMIN_TOKEN_HERE';

async function testPageAccessAPI() {
  console.log('🧪 Testing Role Page Access API...\n');
  console.log(`📍 API URL: ${API_BASE_URL}`);
  console.log(`🔐 Using token: ${TOKEN.substring(0, 20)}...\n`);

  try {
    // Test 1: Get all page access
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1️⃣  Testing GET /api/role-page-access');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const response1 = await fetch(`${API_BASE_URL}/api/role-page-access`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    
    const result1 = await response1.json();
    console.log(`Status: ${response1.status} ${response1.statusText}`);
    console.log('Response:', JSON.stringify(result1, null, 2));
    
    if (result1.success && result1.data) {
      console.log(`✅ Found ${result1.data.length} role configurations`);
      result1.data.forEach(role => {
        console.log(`   - ${role.role}: ${role.allowedPages.length} pages`);
      });
    } else {
      console.log('⚠️  No data returned or unsuccessful response');
    }
    console.log();

    // Test 2: Get specific role (sb-admin)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('2️⃣  Testing GET /api/role-page-access/sb-admin');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const response2 = await fetch(`${API_BASE_URL}/api/role-page-access/sb-admin`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    
    const result2 = await response2.json();
    console.log(`Status: ${response2.status} ${response2.statusText}`);
    console.log('Response:', JSON.stringify(result2, null, 2));
    
    if (result2.success && result2.data) {
      console.log(`✅ SB Admin has access to: ${result2.data.allowedPages.join(', ')}`);
    }
    console.log();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ All tests completed!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n💡 To test UPDATE and RESET, uncomment those sections below');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\n💡 Make sure:');
    console.error('   1. Server is running (npm start in server folder)');
    console.error('   2. MongoDB is connected');
    console.error('   3. You have a valid super-admin token');
    console.error('   4. Set TOKEN environment variable or update the script');
  }
}

// Uncomment to test UPDATE functionality
/*
async function testUpdate() {
  const response = await fetch(`${API_BASE_URL}/api/role-page-access/sb-admin`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      allowedPages: ['dashboard', 'franchisee-list', 'analytics']
    }),
  });
  const result = await response.json();
  console.log('Update result:', result);
}
*/

testPageAccessAPI();
