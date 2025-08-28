#!/usr/bin/env node

/**
 * Comprehensive API Endpoint Testing Suite
 * Tests all API endpoints with various scenarios and edge cases
 */

const http = require('http');
const https = require('https');

const BASE_URL = 'http://localhost:3000';

// Test helper function
function makeRequest(url, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'QA-Test-Suite/1.0'
      }
    };

    const req = client.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsed
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: body
          });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Test scenarios
const testScenarios = [
  {
    name: 'Basic Search - No Parameters',
    url: `${BASE_URL}/api/facilities/search`,
    expectedStatus: 200,
    validate: (response) => {
      return response.data.facilities && Array.isArray(response.data.facilities);
    }
  },
  {
    name: 'Search with Location - San Francisco',
    url: `${BASE_URL}/api/facilities/search?location=San%20Francisco,%20CA`,
    expectedStatus: 200,
    validate: (response) => {
      return response.data.facilities && 
             response.data.facilities.some(f => f.city.includes('San Francisco'));
    }
  },
  {
    name: 'Search with Query Text - Recovery',
    url: `${BASE_URL}/api/facilities/search?q=recovery`,
    expectedStatus: 200,
    validate: (response) => {
      return response.data.facilities && 
             response.data.facilities.some(f => 
               f.name.toLowerCase().includes('recovery') ||
               f.description.toLowerCase().includes('recovery')
             );
    }
  },
  {
    name: 'Search with Services Filter - Detox',
    url: `${BASE_URL}/api/facilities/search?services=detox`,
    expectedStatus: 200,
    validate: (response) => {
      return response.data.facilities && 
             response.data.facilities.some(f => 
               f.residentialServices?.toLowerCase().includes('detox') ||
               f.allServices?.toLowerCase().includes('detox')
             );
    }
  },
  {
    name: 'Search with Insurance Filter - Medicare',
    url: `${BASE_URL}/api/facilities/search?insurance=Medicare`,
    expectedStatus: 200,
    validate: (response) => {
      return response.data.facilities && 
             response.data.facilities.some(f => 
               f.acceptedInsurance?.some(ins => ins.includes('Medicare'))
             );
    }
  },
  {
    name: 'Complex Search - Multiple Filters',
    url: `${BASE_URL}/api/facilities/search?location=CA&services=residential&insurance=Private%20Insurance&radius=50`,
    expectedStatus: 200,
    validate: (response) => {
      return response.data.facilities && response.data.query;
    }
  },
  {
    name: 'Search with Invalid Parameters',
    url: `${BASE_URL}/api/facilities/search?invalid=test&radius=invalid`,
    expectedStatus: 200,
    validate: (response) => {
      return response.data.facilities; // Should handle gracefully
    }
  },
  {
    name: 'Empty Search Results',
    url: `${BASE_URL}/api/facilities/search?q=nonexistentfacility123`,
    expectedStatus: 200,
    validate: (response) => {
      return response.data.facilities && response.data.facilities.length === 0;
    }
  },
  {
    name: 'API Metrics Endpoint',
    url: `${BASE_URL}/api/metrics`,
    expectedStatus: 200,
    validate: (response) => {
      return response.data; // Should return some metrics
    }
  },
  {
    name: 'Database Initialization Check',
    url: `${BASE_URL}/api/init-db`,
    expectedStatus: 200,
    validate: (response) => {
      return response.data; // Should handle gracefully
    }
  }
];

// Test runner
async function runTests() {
  console.log('🧪 QA Testing Suite - API Endpoint Testing');
  console.log('==========================================\n');
  
  const results = {
    passed: 0,
    failed: 0,
    total: testScenarios.length,
    details: []
  };

  for (const test of testScenarios) {
    console.log(`Testing: ${test.name}`);
    
    try {
      const response = await makeRequest(test.url);
      const statusMatch = response.statusCode === test.expectedStatus;
      const validationPassed = test.validate ? test.validate(response) : true;
      
      if (statusMatch && validationPassed) {
        console.log(`✅ PASSED - Status: ${response.statusCode}`);
        results.passed++;
        results.details.push({
          test: test.name,
          status: 'PASSED',
          statusCode: response.statusCode,
          dataSize: JSON.stringify(response.data).length
        });
      } else {
        console.log(`❌ FAILED - Status: ${response.statusCode}, Validation: ${validationPassed}`);
        console.log(`   Expected status: ${test.expectedStatus}`);
        results.failed++;
        results.details.push({
          test: test.name,
          status: 'FAILED',
          statusCode: response.statusCode,
          expectedStatus: test.expectedStatus,
          validationPassed,
          error: response.data
        });
      }
    } catch (error) {
      console.log(`❌ ERROR - ${error.message}`);
      results.failed++;
      results.details.push({
        test: test.name,
        status: 'ERROR',
        error: error.message
      });
    }
    
    console.log('');
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Summary
  console.log('\n📊 Test Summary');
  console.log('================');
  console.log(`Total Tests: ${results.total}`);
  console.log(`Passed: ${results.passed} ✅`);
  console.log(`Failed: ${results.failed} ❌`);
  console.log(`Success Rate: ${Math.round((results.passed / results.total) * 100)}%\n`);

  // Detailed results
  if (results.failed > 0) {
    console.log('❌ Failed Tests:');
    results.details.filter(d => d.status !== 'PASSED').forEach(detail => {
      console.log(`  - ${detail.test}: ${detail.status}`);
      if (detail.error) {
        console.log(`    Error: ${JSON.stringify(detail.error, null, 2)}`);
      }
    });
  }

  return results;
}

// Export data test
async function testDataExport() {
  console.log('\n📊 Testing Data Export Functionality');
  console.log('====================================');

  try {
    // Test search with export intent
    const response = await makeRequest(`${BASE_URL}/api/facilities/search?location=CA&format=json`);
    
    if (response.statusCode === 200 && response.data.facilities) {
      console.log('✅ JSON Export: Mock data available for export');
      console.log(`   Facilities found: ${response.data.facilities.length}`);
      
      // Verify data structure for CSV export
      const sample = response.data.facilities[0];
      const csvHeaders = Object.keys(sample);
      console.log(`   CSV Headers available: ${csvHeaders.length}`);
      console.log(`   Sample headers: ${csvHeaders.slice(0, 5).join(', ')}...`);
      
      return true;
    }
  } catch (error) {
    console.log(`❌ Export test failed: ${error.message}`);
    return false;
  }
}

// Performance test
async function testPerformance() {
  console.log('\n⚡ Performance Testing');
  console.log('=====================');

  const testUrl = `${BASE_URL}/api/facilities/search?location=CA`;
  const iterations = 5;
  const times = [];

  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    try {
      await makeRequest(testUrl);
      const end = Date.now();
      times.push(end - start);
      console.log(`Request ${i + 1}: ${end - start}ms`);
    } catch (error) {
      console.log(`Request ${i + 1}: Failed - ${error.message}`);
    }
  }

  if (times.length > 0) {
    const avgTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    console.log(`\n📈 Performance Results:`);
    console.log(`   Average: ${avgTime}ms`);
    console.log(`   Min: ${minTime}ms`);
    console.log(`   Max: ${maxTime}ms`);
    
    return {
      average: avgTime,
      min: minTime,
      max: maxTime,
      acceptable: avgTime < 2000 // 2 seconds threshold
    };
  }
}

// Main execution
async function main() {
  console.log('⏳ Waiting 5 seconds for server to start...\n');
  await new Promise(resolve => setTimeout(resolve, 5000));

  const testResults = await runTests();
  const exportTest = await testDataExport();
  const performanceResults = await testPerformance();

  console.log('\n🏁 Complete QA Testing Report');
  console.log('==============================');
  console.log(`API Tests: ${testResults.passed}/${testResults.total} passed`);
  console.log(`Export Test: ${exportTest ? 'PASSED' : 'FAILED'}`);
  console.log(`Performance: ${performanceResults?.acceptable ? 'ACCEPTABLE' : 'NEEDS IMPROVEMENT'} (${performanceResults?.average || 'N/A'}ms avg)`);
  
  const overallScore = Math.round(
    ((testResults.passed / testResults.total) * 0.6 +
     (exportTest ? 1 : 0) * 0.2 +
     (performanceResults?.acceptable ? 1 : 0) * 0.2) * 100
  );
  
  console.log(`\n🎯 Overall QA Score: ${overallScore}%`);
  
  if (overallScore >= 90) {
    console.log('🟢 EXCELLENT - Ready for deployment');
  } else if (overallScore >= 80) {
    console.log('🟡 GOOD - Minor issues to address');
  } else {
    console.log('🔴 NEEDS WORK - Major issues found');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { runTests, testDataExport, testPerformance };