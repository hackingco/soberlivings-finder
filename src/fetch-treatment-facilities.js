#!/usr/bin/env node
/**
 * Simplified ETL Pipeline for FindTreatment.gov API
 * Fetches treatment facilities and seeds database
 */

const axios = require('axios');
const { Pool } = require('pg');
const fs = require('fs').promises;

// Database configuration
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/soberlivings';

// API configuration  
const API_URL = 'https://findtreatment.gov/locator/exportsAsJson';

// Target cities for comprehensive coverage
const TARGET_CITIES = [
  { city: 'San Francisco', state: 'CA', lat: 37.7749, lon: -122.4194 },
  { city: 'Los Angeles', state: 'CA', lat: 34.0522, lon: -118.2437 },
  { city: 'San Diego', state: 'CA', lat: 32.7157, lon: -117.1611 },
  { city: 'San Jose', state: 'CA', lat: 37.3382, lon: -121.8863 },
  { city: 'Oakland', state: 'CA', lat: 37.8044, lon: -122.2712 },
  { city: 'Sacramento', state: 'CA', lat: 38.5816, lon: -121.4944 },
  { city: 'New York', state: 'NY', lat: 40.7128, lon: -74.0060 },
  { city: 'Chicago', state: 'IL', lat: 41.8781, lon: -87.6298 },
  { city: 'Houston', state: 'TX', lat: 29.7604, lon: -95.3698 },
  { city: 'Phoenix', state: 'AZ', lat: 33.4484, lon: -112.0740 },
  { city: 'Philadelphia', state: 'PA', lat: 39.9526, lon: -75.1652 },
  { city: 'Miami', state: 'FL', lat: 25.7617, lon: -80.1918 },
  { city: 'Atlanta', state: 'GA', lat: 33.7490, lon: -84.3880 },
  { city: 'Boston', state: 'MA', lat: 42.3601, lon: -71.0589 },
  { city: 'Denver', state: 'CO', lat: 39.7392, lon: -104.9903 },
  { city: 'Seattle', state: 'WA', lat: 47.6062, lon: -122.3321 },
  { city: 'Portland', state: 'OR', lat: 45.5152, lon: -122.6784 },
  { city: 'Las Vegas', state: 'NV', lat: 36.1699, lon: -115.1398 },
  { city: 'Austin', state: 'TX', lat: 30.2672, lon: -97.7431 },
  { city: 'Detroit', state: 'MI', lat: 42.3314, lon: -83.0458 }
];

let pool;

/**
 * Initialize database connection
 */
async function initDatabase() {
  pool = new Pool({ connectionString: DATABASE_URL });
  await pool.query('SELECT NOW()');
  console.log('✅ Database connected');
}

/**
 * Fetch facilities from API
 */
async function fetchFacilitiesFromAPI(location) {
  try {
    console.log(`📍 Fetching facilities near ${location.city}, ${location.state}...`);
    
    const params = {
      sType: 'sa',
      sAddr: `${location.lat},${location.lon}`,
      pageSize: 200,
      page: 1,
      sort: 0
    };

    const response = await axios.get(`${API_URL}/v2`, { params });
    
    if (response.data && Array.isArray(response.data)) {
      console.log(`  ✅ Found ${response.data.length} facilities`);
      return response.data;
    }
    return [];
  } catch (error) {
    console.error(`  ❌ Error fetching ${location.city}: ${error.message}`);
    return [];
  }
}

/**
 * Transform facility data
 */
function transformFacility(raw, location) {
  // Generate unique ID
  const id = `${location.state.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Parse services
  const services = [];
  if (raw.type_facility) {
    const facilityType = raw.type_facility.toLowerCase();
    if (facilityType.includes('residential')) services.push('residential');
    if (facilityType.includes('outpatient')) services.push('outpatient');
    if (facilityType.includes('detox')) services.push('detox');
    if (facilityType.includes('hospital')) services.push('hospital');
  }
  
  // Parse insurance
  const insurance = [];
  if (raw.payment_types) {
    const payments = raw.payment_types.toLowerCase();
    if (payments.includes('medicare')) insurance.push('Medicare');
    if (payments.includes('medicaid')) insurance.push('Medicaid');
    if (payments.includes('private')) insurance.push('Private Insurance');
    if (payments.includes('cash')) insurance.push('Self-Pay');
    if (payments.includes('military')) insurance.push('Military Insurance');
  }

  // Format phone
  let phone = raw.phone || '';
  if (phone.match(/^\d{10}$/)) {
    phone = `(${phone.substr(0,3)}) ${phone.substr(3,3)}-${phone.substr(6)}`;
  }

  return {
    id: id.substring(0, 50),
    name: raw.name_facility || 'Unknown Facility',
    street: raw.street1 || '',
    city: raw.city || location.city,
    state: raw.state || location.state,
    zip: raw.zip || '',
    phone: phone,
    website: raw.website || '',
    latitude: parseFloat(raw.latitude) || location.lat,
    longitude: parseFloat(raw.longitude) || location.lon,
    residentialServices: raw.type_facility || '',
    allServices: raw.services_provided || raw.type_facility || '',
    services: services,
    description: `${raw.name_facility} provides treatment services in ${raw.city || location.city}, ${raw.state || location.state}.`,
    capacity: null,
    amenities: [],
    acceptedInsurance: insurance,
    programs: [],
    verified: true
  };
}

/**
 * Insert facilities into database
 */
async function insertFacilities(facilities) {
  if (!facilities.length) return 0;

  for (const facility of facilities) {
    try {
      await pool.query(`
        INSERT INTO facilities (
          id, name, street, city, state, zip, phone, website,
          latitude, longitude, "residentialServices", "allServices",
          services, description, amenities, "acceptedInsurance"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          phone = EXCLUDED.phone,
          website = EXCLUDED.website
      `, [
        facility.id,
        facility.name,
        facility.street,
        facility.city,
        facility.state,
        facility.zip,
        facility.phone,
        facility.website,
        facility.latitude,
        facility.longitude,
        facility.residentialServices,
        facility.allServices,
        facility.services,
        facility.description,
        facility.amenities,
        facility.acceptedInsurance
      ]);
    } catch (error) {
      console.error(`Error inserting ${facility.name}: ${error.message}`);
    }
  }
  
  return facilities.length;
}

/**
 * Main ETL process
 */
async function runETL() {
  console.log('🚀 Starting FindTreatment.gov ETL Pipeline');
  console.log('=========================================');
  
  try {
    await initDatabase();
    
    let totalFetched = 0;
    let totalInserted = 0;
    
    for (const location of TARGET_CITIES) {
      const facilities = await fetchFacilitiesFromAPI(location);
      
      if (facilities.length > 0) {
        const transformed = facilities.map(f => transformFacility(f, location));
        const inserted = await insertFacilities(transformed);
        
        totalFetched += facilities.length;
        totalInserted += inserted;
        
        console.log(`  ✅ Inserted ${inserted} facilities from ${location.city}`);
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Get final count
    const result = await pool.query('SELECT COUNT(*) FROM facilities');
    const dbCount = result.rows[0].count;
    
    console.log('\n📊 ETL Pipeline Complete!');
    console.log('========================');
    console.log(`✅ Total fetched: ${totalFetched}`);
    console.log(`✅ Total inserted: ${totalInserted}`);
    console.log(`📦 Database total: ${dbCount}`);
    
    // Save stats
    const stats = {
      timestamp: new Date().toISOString(),
      fetched: totalFetched,
      inserted: totalInserted,
      dbTotal: parseInt(dbCount),
      cities: TARGET_CITIES.length
    };
    
    await fs.writeFile('etl-stats.json', JSON.stringify(stats, null, 2));
    console.log('✅ Stats saved to etl-stats.json');
    
  } catch (error) {
    console.error('❌ ETL failed:', error);
  } finally {
    if (pool) await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  runETL().catch(console.error);
}

module.exports = { runETL };