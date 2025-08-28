/**
 * Test script to find the correct API endpoint
 */

const axios = require('axios');

async function testEndpoints() {
  const endpoints = [
    {
      name: 'SAMHSA Treatment Locator API v1',
      url: 'https://findtreatment.samhsa.gov/api/v1/facilities',
      params: { lat: 37.7749, lng: -122.4194, radius: 10 }
    },
    {
      name: 'FindTreatment.gov Locator API',
      url: 'https://findtreatment.gov/api/facilities',
      params: { latitude: 37.7749, longitude: -122.4194, distance: 10 }
    },
    {
      name: 'DPT2 SAMHSA Treatment API',
      url: 'https://dpt2.samhsa.gov/treatment/listing',
      params: { 
        sType: 'SA',
        sAddr: '37.7749,-122.4194',
        pageSize: 5,
        page: 1
      }
    },
    {
      name: 'FindTreatment Locator Export',
      url: 'https://findtreatment.gov/locator/listing',
      params: {
        sType: 'SA',
        sAddr: '37.7749,-122.4194',
        pageSize: 5
      }
    },
    {
      name: 'SAMHSA Locator API',
      url: 'https://findtreatment.samhsa.gov/locator/listing',
      params: {
        sType: 'SA',
        sAddr: '37.7749,-122.4194',
        pageSize: 5
      }
    }
  ];

  console.log('Testing FindTreatment.gov API endpoints...\n');

  for (const endpoint of endpoints) {
    console.log(`Testing: ${endpoint.name}`);
    console.log(`URL: ${endpoint.url}`);
    
    try {
      const response = await axios.get(endpoint.url, {
        params: endpoint.params,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        },
        timeout: 5000,
        validateStatus: function (status) {
          return status < 500; // Accept any status code less than 500
        }
      });
      
      console.log(`✓ Status: ${response.status}`);
      
      if (response.status === 200) {
        const data = response.data;
        if (typeof data === 'object') {
          console.log(`✓ Response is JSON`);
          
          // Check for facility data
          if (Array.isArray(data)) {
            console.log(`✓ Found ${data.length} facilities`);
            if (data.length > 0) {
              console.log(`✓ Sample facility:`, JSON.stringify(data[0], null, 2).substring(0, 200));
            }
          } else if (data.rows || data.facilities || data.results || data.listing) {
            const items = data.rows || data.facilities || data.results || data.listing;
            console.log(`✓ Found ${items.length} facilities in '${Object.keys(data).find(k => data[k] === items)}'`);
          }
        } else {
          console.log(`✗ Response is not JSON:`, typeof data);
        }
      } else {
        console.log(`✗ HTTP ${response.status}`);
      }
    } catch (error) {
      console.log(`✗ Error: ${error.message}`);
    }
    
    console.log('---\n');
  }
}

testEndpoints().catch(console.error);