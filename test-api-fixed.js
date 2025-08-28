#!/usr/bin/env node

/**
 * Fixed API Testing Suite for Development Server (Port 3001)
 */

const http = require('http');

const BASE_URL = 'http://localhost:3001';

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ statusCode: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function testSearchAPI() {
  console.log('🔍 Testing Search API with Supabase Configuration');
  console.log('================================================');
  
  const tests = [
    { 
      name: 'Basic Search', 
      url: `${BASE_URL}/api/facilities/search`,
      validate: (res) => res.data.facilities || res.data.error
    },
    { 
      name: 'Location Search - CA', 
      url: `${BASE_URL}/api/facilities/search?location=CA`,
      validate: (res) => res.data.facilities || res.data.error
    },
    { 
      name: 'Text Search - Recovery', 
      url: `${BASE_URL}/api/facilities/search?q=recovery`,
      validate: (res) => res.data.facilities || res.data.error
    }
  ];

  let passed = 0;
  let total = tests.length;

  for (const test of tests) {
    console.log(`Testing: ${test.name}`);
    try {
      const response = await makeRequest(test.url);
      console.log(`Status: ${response.statusCode}`);
      
      if (response.data.error) {
        console.log(`❌ API Error: ${response.data.error}`);
      } else if (response.data.facilities) {
        console.log(`✅ Success: ${response.data.facilities.length} facilities found`);
        if (response.data.mock) {
          console.log('   📝 Note: Using mock data');
        }
        passed++;
      } else {
        console.log(`❓ Unknown response format`);
      }
      
      console.log('');
    } catch (error) {
      console.log(`❌ Request failed: ${error.message}\n`);
    }
  }

  console.log(`📊 Results: ${passed}/${total} tests passed\n`);
  return passed === total;
}

async function testOtherEndpoints() {
  console.log('🔧 Testing Other API Endpoints');
  console.log('==============================');
  
  const endpoints = [
    `${BASE_URL}/api/metrics`,
    `${BASE_URL}/api/init-db`,
    `${BASE_URL}/api/seed-data`
  ];

  for (const url of endpoints) {
    const endpoint = url.split('/').pop();
    console.log(`Testing: /api/${endpoint}`);
    
    try {
      const response = await makeRequest(url);
      console.log(`Status: ${response.statusCode}`);
      
      if (response.statusCode === 200) {
        console.log('✅ Endpoint accessible');
      } else {
        console.log(`❌ Endpoint returned status: ${response.statusCode}`);
      }
    } catch (error) {
      console.log(`❌ Request failed: ${error.message}`);
    }
    console.log('');
  }
}

async function main() {
  console.log('⏳ Waiting for server to be ready...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  const searchResults = await testSearchAPI();
  await testOtherEndpoints();
  
  console.log('🏁 QA Testing Complete');
  console.log('======================');
  if (searchResults) {
    console.log('✅ All search functionality working');
  } else {
    console.log('❌ Search functionality needs attention');
    console.log('💡 Check database configuration or mock data setup');
  }
}

main().catch(console.error);