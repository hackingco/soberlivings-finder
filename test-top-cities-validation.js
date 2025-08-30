#!/usr/bin/env node
/**
 * Comprehensive API & UI Validation for Top US Cities
 * Tests facility search functionality across major metropolitan areas
 */

const axios = require('axios');
const { Pool } = require('pg');
const fs = require('fs').promises;

const API_BASE = 'http://localhost:3001/api';
const DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/soberlivings';

// Top 10 US Cities by Population
const TOP_US_CITIES = [
  { city: 'Los Angeles', state: 'CA', population: 3898747, lat: 34.0522, lon: -118.2437 },
  { city: 'New York', state: 'NY', population: 8336817, lat: 40.7128, lon: -74.0060 },
  { city: 'Chicago', state: 'IL', population: 2746388, lat: 41.8781, lon: -87.6298 },
  { city: 'Houston', state: 'TX', population: 2304580, lat: 29.7604, lon: -95.3698 },
  { city: 'Phoenix', state: 'AZ', population: 1608139, lat: 33.4484, lon: -112.0740 },
  { city: 'Philadelphia', state: 'PA', population: 1603797, lat: 39.9526, lon: -75.1652 },
  { city: 'San Antonio', state: 'TX', population: 1434625, lat: 29.4241, lon: -98.4936 },
  { city: 'San Diego', state: 'CA', population: 1386932, lat: 32.7157, lon: -117.1611 },
  { city: 'Dallas', state: 'TX', population: 1304379, lat: 32.7767, lon: -96.7970 },
  { city: 'San Jose', state: 'CA', population: 1013240, lat: 37.3382, lon: -121.8863 }
];

let pool;
const testResults = {
  timestamp: new Date().toISOString(),
  environment: 'Local Development',
  totalTests: 0,
  passed: 0,
  failed: 0,
  cityResults: [],
  apiTests: [],
  performanceMetrics: [],
  dataValidation: [],
  errors: []
};

async function initDatabase() {
  pool = new Pool({ connectionString: DATABASE_URL });
  await pool.query('SELECT NOW()');
  console.log('✅ Database connected for validation\n');
}

async function testDatabaseCity(cityData) {
  const startTime = Date.now();
  
  try {
    // Test exact city match
    const exactQuery = `
      SELECT COUNT(*) as count, 
             AVG(CAST(latitude AS FLOAT)) as avg_lat,
             AVG(CAST(longitude AS FLOAT)) as avg_lon
      FROM facilities 
      WHERE city = $1 AND state = $2
    `;
    const exactResult = await pool.query(exactQuery, [cityData.city, cityData.state]);
    
    // Test area search (within 25 miles)
    const areaQuery = `
      SELECT COUNT(*) as count
      FROM facilities
      WHERE state = $1
        AND ABS(CAST(latitude AS FLOAT) - $2) < 0.5
        AND ABS(CAST(longitude AS FLOAT) - $3) < 0.5
    `;
    const areaResult = await pool.query(areaQuery, [
      cityData.state,
      cityData.lat,
      cityData.lon
    ]);
    
    const duration = Date.now() - startTime;
    
    return {
      success: true,
      city: `${cityData.city}, ${cityData.state}`,
      exactCount: parseInt(exactResult.rows[0].count),
      areaCount: parseInt(areaResult.rows[0].count),
      avgLat: exactResult.rows[0].avg_lat,
      avgLon: exactResult.rows[0].avg_lon,
      queryTime: duration
    };
  } catch (error) {
    return {
      success: false,
      city: `${cityData.city}, ${cityData.state}`,
      error: error.message
    };
  }
}

async function testAPIEndpoint(cityData) {
  const tests = [];
  
  // Test 1: Search by city and state
  try {
    const startTime = Date.now();
    const response = await axios.get(`${API_BASE}/v1/facilities/search`, {
      params: {
        location: `${cityData.city}, ${cityData.state}`,
        limit: 20
      },
      timeout: 5000
    });
    const duration = Date.now() - startTime;
    
    tests.push({
      endpoint: '/api/v1/facilities/search',
      params: `location=${cityData.city}, ${cityData.state}`,
      success: response.data.success,
      facilitiesReturned: response.data.facilities?.length || 0,
      totalAvailable: response.data.pagination?.total || 0,
      responseTime: duration,
      status: response.status
    });
  } catch (error) {
    tests.push({
      endpoint: '/api/v1/facilities/search',
      params: `location=${cityData.city}, ${cityData.state}`,
      success: false,
      error: error.message,
      status: error.response?.status || 0
    });
  }
  
  // Test 2: Search by state only
  try {
    const startTime = Date.now();
    const response = await axios.get(`${API_BASE}/v1/facilities/search`, {
      params: {
        location: cityData.state,
        limit: 10
      },
      timeout: 5000
    });
    const duration = Date.now() - startTime;
    
    tests.push({
      endpoint: '/api/v1/facilities/search',
      params: `location=${cityData.state}`,
      success: response.data.success,
      facilitiesReturned: response.data.facilities?.length || 0,
      totalAvailable: response.data.pagination?.total || 0,
      responseTime: duration,
      status: response.status
    });
  } catch (error) {
    tests.push({
      endpoint: '/api/v1/facilities/search',
      params: `location=${cityData.state}`,
      success: false,
      error: error.message,
      status: error.response?.status || 0
    });
  }
  
  // Test 3: Search with services filter
  try {
    const startTime = Date.now();
    const response = await axios.get(`${API_BASE}/v1/facilities/search`, {
      params: {
        location: cityData.city,
        services: 'residential',
        limit: 5
      },
      timeout: 5000
    });
    const duration = Date.now() - startTime;
    
    tests.push({
      endpoint: '/api/v1/facilities/search',
      params: `location=${cityData.city}&services=residential`,
      success: response.data.success,
      facilitiesReturned: response.data.facilities?.length || 0,
      responseTime: duration,
      status: response.status
    });
  } catch (error) {
    tests.push({
      endpoint: '/api/v1/facilities/search',
      params: `location=${cityData.city}&services=residential`,
      success: false,
      error: error.message,
      status: error.response?.status || 0
    });
  }
  
  return tests;
}

async function validateFacilityData(cityData) {
  try {
    const response = await axios.get(`${API_BASE}/v1/facilities/search`, {
      params: {
        location: `${cityData.city}, ${cityData.state}`,
        limit: 5
      }
    });
    
    if (!response.data.success || !response.data.facilities) {
      return { valid: false, reason: 'No facilities returned' };
    }
    
    const facilities = response.data.facilities;
    const validation = {
      valid: true,
      totalChecked: facilities.length,
      issues: []
    };
    
    facilities.forEach((facility, index) => {
      // Check required fields
      if (!facility.name) validation.issues.push(`Facility ${index}: Missing name`);
      if (!facility.city) validation.issues.push(`Facility ${index}: Missing city`);
      if (!facility.state) validation.issues.push(`Facility ${index}: Missing state`);
      
      // Check data quality
      if (facility.latitude && (facility.latitude < -90 || facility.latitude > 90)) {
        validation.issues.push(`Facility ${index}: Invalid latitude`);
      }
      if (facility.longitude && (facility.longitude < -180 || facility.longitude > 180)) {
        validation.issues.push(`Facility ${index}: Invalid longitude`);
      }
      
      // Check contact info
      if (!facility.phone && !facility.website) {
        validation.issues.push(`Facility ${index}: No contact information`);
      }
    });
    
    validation.valid = validation.issues.length === 0;
    return validation;
    
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

async function runComprehensiveTests() {
  console.log('🔍 Comprehensive API & UI Validation for Top US Cities');
  console.log('======================================================\n');
  
  await initDatabase();
  
  // Get total facility count
  const totalResult = await pool.query('SELECT COUNT(*) as total FROM facilities');
  const totalFacilities = parseInt(totalResult.rows[0].total);
  console.log(`📊 Total facilities in database: ${totalFacilities}\n`);
  
  testResults.totalFacilities = totalFacilities;
  
  // Test each top city
  console.log('🏙️  Testing Top 10 US Cities:');
  console.log('-----------------------------\n');
  
  for (let i = 0; i < TOP_US_CITIES.length; i++) {
    const city = TOP_US_CITIES[i];
    console.log(`[${i+1}/10] Testing ${city.city}, ${city.state} (Pop: ${city.population.toLocaleString()})`);
    
    const cityResult = {
      rank: i + 1,
      city: city.city,
      state: city.state,
      population: city.population,
      coordinates: { lat: city.lat, lon: city.lon }
    };
    
    // Database tests
    const dbTest = await testDatabaseCity(city);
    cityResult.database = dbTest;
    console.log(`  📊 Database: ${dbTest.exactCount} exact, ${dbTest.areaCount} area (${dbTest.queryTime}ms)`);
    
    // API tests
    const apiTests = await testAPIEndpoint(city);
    cityResult.api = apiTests;
    const successfulAPIs = apiTests.filter(t => t.success).length;
    console.log(`  📡 API: ${successfulAPIs}/${apiTests.length} endpoints successful`);
    
    // Data validation
    const dataValidation = await validateFacilityData(city);
    cityResult.dataValidation = dataValidation;
    console.log(`  ✓ Data: ${dataValidation.valid ? 'Valid' : 'Issues found'}`);
    
    testResults.cityResults.push(cityResult);
    testResults.totalTests += 4; // DB + 3 API tests
    
    if (dbTest.success) testResults.passed++;
    else testResults.failed++;
    
    apiTests.forEach(test => {
      if (test.success) testResults.passed++;
      else testResults.failed++;
      testResults.totalTests++;
    });
    
    console.log('');
  }
  
  // Performance summary
  console.log('⚡ Performance Summary:');
  console.log('----------------------');
  
  const avgDBTime = testResults.cityResults
    .filter(r => r.database.success)
    .reduce((sum, r) => sum + r.database.queryTime, 0) / TOP_US_CITIES.length;
  
  const avgAPITime = testResults.cityResults
    .flatMap(r => r.api)
    .filter(t => t.success && t.responseTime)
    .reduce((sum, t) => sum + t.responseTime, 0) / 
    testResults.cityResults.flatMap(r => r.api).filter(t => t.success).length;
  
  console.log(`  Database avg query time: ${avgDBTime.toFixed(2)}ms`);
  console.log(`  API avg response time: ${avgAPITime.toFixed(2)}ms`);
  
  testResults.performanceMetrics = {
    avgDatabaseQueryTime: avgDBTime,
    avgAPIResponseTime: avgAPITime
  };
  
  // Calculate success rate
  const successRate = (testResults.passed / testResults.totalTests * 100).toFixed(1);
  
  console.log('\n📊 Final Results:');
  console.log('----------------');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${successRate}%`);
  
  testResults.successRate = parseFloat(successRate);
  
  // Save detailed report
  await fs.writeFile(
    'top-cities-validation-report.json',
    JSON.stringify(testResults, null, 2)
  );
  
  console.log('\n✅ Detailed report saved to top-cities-validation-report.json');
  
  // Create summary report
  const summaryReport = {
    timestamp: testResults.timestamp,
    totalFacilities: totalFacilities,
    citiesTested: TOP_US_CITIES.length,
    totalTests: testResults.totalTests,
    passed: testResults.passed,
    failed: testResults.failed,
    successRate: successRate + '%',
    topCitiesCoverage: testResults.cityResults.map(r => ({
      city: `${r.city}, ${r.state}`,
      facilities: r.database.exactCount,
      apiWorking: r.api.filter(t => t.success).length > 0
    })),
    performance: {
      avgDatabaseQuery: avgDBTime.toFixed(2) + 'ms',
      avgAPIResponse: avgAPITime.toFixed(2) + 'ms'
    }
  };
  
  await fs.writeFile(
    'validation-summary.json',
    JSON.stringify(summaryReport, null, 2)
  );
  
  console.log('✅ Summary report saved to validation-summary.json\n');
  
  if (pool) await pool.end();
}

// Run validation
runComprehensiveTests().catch(console.error);