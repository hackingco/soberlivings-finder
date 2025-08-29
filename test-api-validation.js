#!/usr/bin/env node
/**
 * API Validation Test Suite
 * Tests facility search API with top US cities
 */

const axios = require('axios');
const { Pool } = require('pg');

const API_BASE = 'http://localhost:3001/api';
const DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/soberlivings';

// Top US cities to test
const TEST_CITIES = [
  { name: 'Los Angeles, CA', expected: 900 },
  { name: 'New York, NY', expected: 390 },
  { name: 'Chicago, IL', expected: 440 },
  { name: 'Houston, TX', expected: 370 },
  { name: 'Phoenix, AZ', expected: 340 },
  { name: 'San Francisco, CA', expected: 900 },
  { name: 'Miami, FL', expected: 470 },
  { name: 'Boston, MA', expected: 310 },
  { name: 'Seattle, WA', expected: 270 },
  { name: 'Atlanta, GA', expected: 240 }
];

const TEST_SERVICES = ['residential', 'outpatient', 'detox', 'counseling'];
const TEST_INSURANCE = ['Medicare', 'Medicaid', 'Private Insurance'];

let pool;
let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

async function initDatabase() {
  pool = new Pool({ connectionString: DATABASE_URL });
  await pool.query('SELECT NOW()');
  console.log('✅ Database connected for validation');
}

async function testDatabaseQuery(city) {
  try {
    const [cityName, state] = city.name.split(', ');
    const query = `
      SELECT COUNT(*) as count 
      FROM facilities 
      WHERE (city ILIKE $1 OR state = $2)
    `;
    const result = await pool.query(query, [`%${cityName}%`, state]);
    return {
      success: true,
      count: parseInt(result.rows[0].count),
      message: `Found ${result.rows[0].count} facilities`
    };
  } catch (error) {
    return {
      success: false,
      count: 0,
      message: error.message
    };
  }
}

async function testAPIEndpoint(endpoint, params = {}) {
  try {
    const response = await axios.get(`${API_BASE}${endpoint}`, { 
      params,
      timeout: 5000 
    });
    return {
      success: true,
      status: response.status,
      data: response.data,
      count: response.data?.facilities?.length || response.data?.length || 0
    };
  } catch (error) {
    return {
      success: false,
      status: error.response?.status || 0,
      message: error.message,
      count: 0
    };
  }
}

async function runValidationTests() {
  console.log('🔍 API & Database Validation Test Suite');
  console.log('========================================\n');

  await initDatabase();

  // Test 1: Database Direct Queries
  console.log('📊 Test 1: Database Direct Queries');
  console.log('-----------------------------------');
  for (const city of TEST_CITIES) {
    const result = await testDatabaseQuery(city);
    const passed = result.success && result.count > 0;
    
    console.log(`${passed ? '✅' : '❌'} ${city.name}: ${result.count} facilities`);
    
    testResults.tests.push({
      name: `DB Query: ${city.name}`,
      passed,
      details: result
    });
    
    if (passed) testResults.passed++;
    else testResults.failed++;
  }

  // Test 2: API Search Endpoint
  console.log('\n📡 Test 2: API Search Endpoints');
  console.log('--------------------------------');
  
  // Test basic search
  const searchTests = [
    { endpoint: '/facilities/search', params: { q: '', location: 'Los Angeles, CA' } },
    { endpoint: '/facilities/search', params: { q: 'treatment', location: 'New York, NY' } },
    { endpoint: '/facilities/search', params: { q: '', location: 'Chicago, IL' } },
    { endpoint: '/facilities/search', params: { services: 'residential' } },
    { endpoint: '/facilities/search', params: { insurance: 'Medicare' } }
  ];

  for (const test of searchTests) {
    const result = await testAPIEndpoint(test.endpoint, test.params);
    const passed = result.success && result.status === 200;
    
    const paramStr = JSON.stringify(test.params);
    console.log(`${passed ? '✅' : '❌'} ${test.endpoint} ${paramStr}: ${result.count} results`);
    
    testResults.tests.push({
      name: `API: ${test.endpoint}`,
      params: test.params,
      passed,
      details: result
    });
    
    if (passed) testResults.passed++;
    else testResults.failed++;
  }

  // Test 3: Performance Tests
  console.log('\n⚡ Test 3: Performance Tests');
  console.log('-----------------------------');
  
  const performanceTests = [
    { name: 'Large dataset query', location: 'California' },
    { name: 'Multi-filter query', location: 'TX', services: 'residential', insurance: 'Medicaid' },
    { name: 'Empty location search', location: '' }
  ];

  for (const test of performanceTests) {
    const startTime = Date.now();
    const result = await testAPIEndpoint('/facilities/search', test);
    const duration = Date.now() - startTime;
    const passed = result.success && duration < 2000; // Should respond within 2 seconds
    
    console.log(`${passed ? '✅' : '❌'} ${test.name}: ${duration}ms (${result.count} results)`);
    
    testResults.tests.push({
      name: `Performance: ${test.name}`,
      passed,
      duration,
      details: result
    });
    
    if (passed) testResults.passed++;
    else testResults.failed++;
  }

  // Test 4: Data Validation
  console.log('\n✓ Test 4: Data Validation');
  console.log('-------------------------');
  
  const sampleResult = await testAPIEndpoint('/facilities/search', { location: 'Los Angeles, CA', limit: 5 });
  if (sampleResult.success && sampleResult.data?.facilities) {
    const facilities = sampleResult.data.facilities;
    let dataValidation = {
      hasRequiredFields: true,
      hasValidCoordinates: true,
      hasContactInfo: true
    };

    facilities.forEach(facility => {
      // Check required fields
      if (!facility.name || !facility.city || !facility.state) {
        dataValidation.hasRequiredFields = false;
      }
      // Check coordinates
      if (!facility.latitude || !facility.longitude) {
        dataValidation.hasValidCoordinates = false;
      }
      // Check contact info
      if (!facility.phone && !facility.website) {
        dataValidation.hasContactInfo = false;
      }
    });

    console.log(`${dataValidation.hasRequiredFields ? '✅' : '❌'} All facilities have required fields`);
    console.log(`${dataValidation.hasValidCoordinates ? '✅' : '❌'} All facilities have valid coordinates`);
    console.log(`${dataValidation.hasContactInfo ? '✅' : '❌'} All facilities have contact information`);
    
    if (dataValidation.hasRequiredFields) testResults.passed++;
    else testResults.failed++;
    
    if (dataValidation.hasValidCoordinates) testResults.passed++;
    else testResults.failed++;
    
    if (dataValidation.hasContactInfo) testResults.passed++;
    else testResults.failed++;
  }

  // Generate Summary Report
  console.log('\n');
  console.log('📊 VALIDATION SUMMARY');
  console.log('====================');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  
  // Save detailed report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      passed: testResults.passed,
      failed: testResults.failed,
      successRate: ((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1) + '%'
    },
    tests: testResults.tests,
    environment: {
      apiUrl: API_BASE,
      databaseUrl: DATABASE_URL,
      totalFacilities: (await pool.query('SELECT COUNT(*) FROM facilities')).rows[0].count
    }
  };

  const fs = require('fs').promises;
  await fs.writeFile('api-validation-report.json', JSON.stringify(report, null, 2));
  console.log('\n✅ Detailed report saved to api-validation-report.json');
  
  if (pool) await pool.end();
}

// Run validation
runValidationTests().catch(console.error);