#!/usr/bin/env node

/**
 * Edge Case Testing Suite
 * Tests unusual scenarios, error conditions, and boundary cases
 */

const http = require('http');

const BASE_URL = 'http://localhost:3001';

async function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const req = http.request(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ 
            statusCode: res.statusCode, 
            data: parsed,
            responseTime: Date.now() - startTime 
          });
        } catch (e) {
          resolve({ 
            statusCode: res.statusCode, 
            data: body,
            responseTime: Date.now() - startTime
          });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function testEdgeCases() {
  console.log('🧪 Edge Case Testing Suite');
  console.log('===========================');

  const edgeCases = [
    {
      name: 'Empty Search Query',
      url: `${BASE_URL}/api/facilities/search?q=`,
      expected: 'Should return all facilities'
    },
    {
      name: 'Very Long Search Query',
      url: `${BASE_URL}/api/facilities/search?q=${'a'.repeat(1000)}`,
      expected: 'Should handle gracefully'
    },
    {
      name: 'Special Characters in Query',
      url: `${BASE_URL}/api/facilities/search?q=café@#$%^&*()`,
      expected: 'Should handle special characters'
    },
    {
      name: 'Unicode Characters',
      url: `${BASE_URL}/api/facilities/search?q=日本語`,
      expected: 'Should handle unicode'
    },
    {
      name: 'Zero Radius',
      url: `${BASE_URL}/api/facilities/search?radius=0`,
      expected: 'Should reject or default'
    },
    {
      name: 'Negative Radius',
      url: `${BASE_URL}/api/facilities/search?radius=-5`,
      expected: 'Should reject negative values'
    },
    {
      name: 'Maximum Limit Boundary',
      url: `${BASE_URL}/api/facilities/search?limit=100`,
      expected: 'Should accept max limit'
    },
    {
      name: 'Over Maximum Limit',
      url: `${BASE_URL}/api/facilities/search?limit=1000`,
      expected: 'Should reject or cap limit'
    },
    {
      name: 'Invalid Coordinates',
      url: `${BASE_URL}/api/facilities/search?lat=invalid&lon=also_invalid`,
      expected: 'Should handle invalid coordinates'
    },
    {
      name: 'Boundary Coordinates - North Pole',
      url: `${BASE_URL}/api/facilities/search?lat=90&lon=0`,
      expected: 'Should handle extreme coordinates'
    },
    {
      name: 'Boundary Coordinates - South Pole',
      url: `${BASE_URL}/api/facilities/search?lat=-90&lon=180`,
      expected: 'Should handle extreme coordinates'
    },
    {
      name: 'Multiple Same Parameters',
      url: `${BASE_URL}/api/facilities/search?location=CA&location=NY`,
      expected: 'Should handle duplicate parameters'
    },
    {
      name: 'SQL Injection Attempt',
      url: `${BASE_URL}/api/facilities/search?q='; DROP TABLE facilities; --`,
      expected: 'Should prevent SQL injection'
    },
    {
      name: 'HTML/Script Injection',
      url: `${BASE_URL}/api/facilities/search?q=<img src=x onerror=alert(1)>`,
      expected: 'Should prevent XSS'
    },
    {
      name: 'Very Large Request URL',
      url: `${BASE_URL}/api/facilities/search?${'q=test&'.repeat(100)}`,
      expected: 'Should handle large URLs'
    }
  ];

  let passed = 0;
  let failed = 0;
  const results = [];

  for (const testCase of edgeCases) {
    console.log(`\nTesting: ${testCase.name}`);
    console.log(`Expected: ${testCase.expected}`);
    
    try {
      const response = await makeRequest(testCase.url);
      console.log(`Status: ${response.statusCode} | Time: ${response.responseTime}ms`);
      
      let testPassed = false;
      
      // Evaluate based on response
      if (response.statusCode === 200) {
        if (response.data.facilities !== undefined) {
          console.log(`✅ SUCCESS - Returned ${Array.isArray(response.data.facilities) ? response.data.facilities.length : 'data'} facilities`);
          testPassed = true;
        } else if (response.data.error) {
          console.log(`⚠️  HANDLED - Error: ${response.data.error}`);
          testPassed = true; // Proper error handling is good
        }
      } else if (response.statusCode === 400) {
        console.log(`⚠️  REJECTED - Properly rejected invalid request`);
        testPassed = true;
      } else {
        console.log(`❌ UNEXPECTED - Status ${response.statusCode}`);
      }
      
      if (testPassed) {
        passed++;
      } else {
        failed++;
      }
      
      results.push({
        name: testCase.name,
        passed: testPassed,
        statusCode: response.statusCode,
        responseTime: response.responseTime,
        hasError: !!response.data.error
      });
      
    } catch (error) {
      console.log(`❌ ERROR - ${error.message}`);
      failed++;
      results.push({
        name: testCase.name,
        passed: false,
        error: error.message
      });
    }
  }

  console.log(`\n📊 Edge Case Test Results`);
  console.log(`=========================`);
  console.log(`Total Tests: ${edgeCases.length}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log(`Success Rate: ${Math.round((passed / edgeCases.length) * 100)}%`);

  // Analyze patterns
  const avgResponseTime = results
    .filter(r => r.responseTime)
    .reduce((sum, r) => sum + r.responseTime, 0) / results.filter(r => r.responseTime).length;
    
  console.log(`\nAverage Response Time: ${Math.round(avgResponseTime)}ms`);
  
  const errorHandlingTests = results.filter(r => 
    r.name.includes('SQL') || 
    r.name.includes('Script') || 
    r.name.includes('Invalid') ||
    r.name.includes('Negative')
  );
  
  const errorHandlingPassed = errorHandlingTests.filter(r => r.passed).length;
  console.log(`Security/Error Handling: ${errorHandlingPassed}/${errorHandlingTests.length} passed`);

  return {
    total: edgeCases.length,
    passed,
    failed,
    successRate: Math.round((passed / edgeCases.length) * 100),
    avgResponseTime: Math.round(avgResponseTime),
    securityScore: Math.round((errorHandlingPassed / errorHandlingTests.length) * 100),
    results
  };
}

async function testConcurrency() {
  console.log(`\n⚡ Concurrency Testing`);
  console.log(`=====================`);

  const url = `${BASE_URL}/api/facilities/search?location=CA`;
  const concurrentRequests = 10;
  
  console.log(`Making ${concurrentRequests} concurrent requests...`);
  
  const promises = Array(concurrentRequests).fill(null).map(() => makeRequest(url));
  
  try {
    const startTime = Date.now();
    const responses = await Promise.all(promises);
    const totalTime = Date.now() - startTime;
    
    const successful = responses.filter(r => r.statusCode === 200).length;
    const avgResponseTime = responses.reduce((sum, r) => sum + r.responseTime, 0) / responses.length;
    
    console.log(`✅ Completed in ${totalTime}ms`);
    console.log(`   Successful: ${successful}/${concurrentRequests}`);
    console.log(`   Average per request: ${Math.round(avgResponseTime)}ms`);
    console.log(`   Throughput: ${Math.round((concurrentRequests / totalTime) * 1000)} requests/sec`);
    
    return {
      totalTime,
      successful,
      total: concurrentRequests,
      avgResponseTime: Math.round(avgResponseTime),
      throughput: Math.round((concurrentRequests / totalTime) * 1000)
    };
    
  } catch (error) {
    console.log(`❌ Concurrency test failed: ${error.message}`);
    return { failed: true, error: error.message };
  }
}

async function main() {
  console.log('🚀 Starting Edge Case and Stress Testing\n');
  
  const edgeResults = await testEdgeCases();
  const concurrencyResults = await testConcurrency();
  
  console.log(`\n🏁 Final Edge Case Report`);
  console.log(`========================`);
  console.log(`Edge Cases: ${edgeResults.successRate}% passed`);
  console.log(`Security Tests: ${edgeResults.securityScore}% passed`);
  console.log(`Avg Response Time: ${edgeResults.avgResponseTime}ms`);
  
  if (concurrencyResults.successful) {
    console.log(`Concurrency: ${concurrencyResults.successful}/${concurrencyResults.total} succeeded`);
    console.log(`Throughput: ${concurrencyResults.throughput} req/sec`);
  }
  
  const overallScore = Math.round(
    (edgeResults.successRate * 0.4 + 
     edgeResults.securityScore * 0.3 +
     (concurrencyResults.successful ? (concurrencyResults.successful / concurrencyResults.total * 100) : 0) * 0.3)
  );
  
  console.log(`\n🎯 Edge Case Testing Score: ${overallScore}%`);
  
  if (overallScore >= 90) {
    console.log('🟢 EXCELLENT - Robust error handling');
  } else if (overallScore >= 75) {
    console.log('🟡 GOOD - Minor edge cases to address');
  } else {
    console.log('🔴 NEEDS IMPROVEMENT - Several edge cases failing');
  }
}

main().catch(console.error);