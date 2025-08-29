#!/usr/bin/env node
/**
 * Fixed ETL Pipeline using direct API calls
 */

const axios = require('axios');
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

// Database configuration
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/soberlivings';

// API configuration
const API_URL = 'https://findtreatment.gov/locator/exportsAsJson';
const BATCH_SIZE = 500;
const DELAY = 1000;

// Major US cities for comprehensive coverage
const TARGET_CITIES = [
  // California
  { city: 'Los Angeles', state: 'CA', lat: 34.0522, lon: -118.2437 },
  { city: 'San Francisco', state: 'CA', lat: 37.7749, lon: -122.4194 },
  { city: 'San Diego', state: 'CA', lat: 32.7157, lon: -117.1611 },
  { city: 'San Jose', state: 'CA', lat: 37.3382, lon: -121.8863 },
  { city: 'Sacramento', state: 'CA', lat: 38.5816, lon: -121.4944 },
  { city: 'Oakland', state: 'CA', lat: 37.8044, lon: -122.2712 },
  { city: 'Fresno', state: 'CA', lat: 36.7378, lon: -119.7871 },
  
  // Texas
  { city: 'Houston', state: 'TX', lat: 29.7604, lon: -95.3698 },
  { city: 'Dallas', state: 'TX', lat: 32.7767, lon: -96.7970 },
  { city: 'Austin', state: 'TX', lat: 30.2672, lon: -97.7431 },
  { city: 'San Antonio', state: 'TX', lat: 29.4241, lon: -98.4936 },
  { city: 'Fort Worth', state: 'TX', lat: 32.7555, lon: -97.3308 },
  { city: 'El Paso', state: 'TX', lat: 31.7619, lon: -106.4850 },
  
  // Florida
  { city: 'Miami', state: 'FL', lat: 25.7617, lon: -80.1918 },
  { city: 'Tampa', state: 'FL', lat: 27.9506, lon: -82.4572 },
  { city: 'Orlando', state: 'FL', lat: 28.5383, lon: -81.3792 },
  { city: 'Jacksonville', state: 'FL', lat: 30.3322, lon: -81.6557 },
  
  // New York
  { city: 'New York', state: 'NY', lat: 40.7128, lon: -74.0060 },
  { city: 'Buffalo', state: 'NY', lat: 42.8864, lon: -78.8784 },
  { city: 'Rochester', state: 'NY', lat: 43.1566, lon: -77.6088 },
  { city: 'Albany', state: 'NY', lat: 42.6526, lon: -73.7562 },
  
  // Illinois
  { city: 'Chicago', state: 'IL', lat: 41.8781, lon: -87.6298 },
  { city: 'Springfield', state: 'IL', lat: 39.7817, lon: -89.6501 },
  
  // Pennsylvania
  { city: 'Philadelphia', state: 'PA', lat: 39.9526, lon: -75.1652 },
  { city: 'Pittsburgh', state: 'PA', lat: 40.4406, lon: -79.9959 },
  
  // Arizona
  { city: 'Phoenix', state: 'AZ', lat: 33.4484, lon: -112.0740 },
  { city: 'Tucson', state: 'AZ', lat: 32.2217, lon: -110.9265 },
  
  // Massachusetts
  { city: 'Boston', state: 'MA', lat: 42.3601, lon: -71.0589 },
  { city: 'Worcester', state: 'MA', lat: 42.2626, lon: -71.8023 },
  
  // Washington
  { city: 'Seattle', state: 'WA', lat: 47.6062, lon: -122.3321 },
  { city: 'Spokane', state: 'WA', lat: 47.6587, lon: -117.4260 },
  
  // Colorado
  { city: 'Denver', state: 'CO', lat: 39.7392, lon: -104.9903 },
  { city: 'Colorado Springs', state: 'CO', lat: 38.8339, lon: -104.8214 },
  
  // Georgia
  { city: 'Atlanta', state: 'GA', lat: 33.7490, lon: -84.3880 },
  
  // Michigan
  { city: 'Detroit', state: 'MI', lat: 42.3314, lon: -83.0458 },
  { city: 'Grand Rapids', state: 'MI', lat: 42.9634, lon: -85.6681 },
  
  // Nevada
  { city: 'Las Vegas', state: 'NV', lat: 36.1699, lon: -115.1398 },
  { city: 'Reno', state: 'NV', lat: 39.5296, lon: -119.8138 },
  
  // Oregon
  { city: 'Portland', state: 'OR', lat: 45.5152, lon: -122.6784 },
  
  // Ohio
  { city: 'Columbus', state: 'OH', lat: 39.9612, lon: -82.9988 },
  { city: 'Cleveland', state: 'OH', lat: 41.4993, lon: -81.6944 },
  { city: 'Cincinnati', state: 'OH', lat: 39.1031, lon: -84.5120 },
  
  // North Carolina
  { city: 'Charlotte', state: 'NC', lat: 35.2271, lon: -80.8431 },
  { city: 'Raleigh', state: 'NC', lat: 35.7796, lon: -78.6382 },
  
  // Tennessee
  { city: 'Nashville', state: 'TN', lat: 36.1627, lon: -86.7816 },
  { city: 'Memphis', state: 'TN', lat: 35.1495, lon: -90.0490 },
  
  // Missouri
  { city: 'Kansas City', state: 'MO', lat: 39.0997, lon: -94.5786 },
  { city: 'St. Louis', state: 'MO', lat: 38.6270, lon: -90.1994 },
  
  // Maryland
  { city: 'Baltimore', state: 'MD', lat: 39.2904, lon: -76.6122 },
  
  // Wisconsin
  { city: 'Milwaukee', state: 'WI', lat: 43.0389, lon: -87.9065 },
  
  // Minnesota
  { city: 'Minneapolis', state: 'MN', lat: 44.9778, lon: -93.2650 },
  
  // Louisiana
  { city: 'New Orleans', state: 'LA', lat: 29.9511, lon: -90.0715 },
  
  // Kentucky
  { city: 'Louisville', state: 'KY', lat: 38.2527, lon: -85.7585 },
  
  // Oklahoma
  { city: 'Oklahoma City', state: 'OK', lat: 35.4676, lon: -97.5164 },
  
  // Utah
  { city: 'Salt Lake City', state: 'UT', lat: 40.7608, lon: -111.8910 }
];

let pool;

async function initDatabase() {
  pool = new Pool({ connectionString: DATABASE_URL });
  await pool.query('SELECT NOW()');
  console.log('✅ Database connected');
}

async function fetchFacilitiesFromAPI(location) {
  try {
    console.log(`📍 Fetching facilities near ${location.city}, ${location.state}...`);
    
    const params = {
      sType: 'sa',
      sAddr: `${location.lat},${location.lon}`,
      pageSize: BATCH_SIZE,
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

function transformFacility(raw, location) {
  // Generate unique ID
  const sanitizedName = (raw.name_facility || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '-');
  const id = `${location.state.toLowerCase()}-${sanitizedName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Parse services
  const services = [];
  if (raw.type_facility) {
    const facilityType = raw.type_facility.toLowerCase();
    if (facilityType.includes('residential')) services.push('residential');
    if (facilityType.includes('outpatient')) services.push('outpatient');
    if (facilityType.includes('detox')) services.push('detox');
    if (facilityType.includes('hospital')) services.push('hospital');
    if (facilityType.includes('treatment')) services.push('treatment');
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
    services: services.length > 0 ? services : ['treatment'],
    description: `${raw.name_facility} provides treatment services in ${raw.city || location.city}, ${raw.state || location.state}.`,
    capacity: null,
    amenities: [],
    acceptedInsurance: insurance,
    programs: [],
    verified: true
  };
}

async function insertFacilities(facilities) {
  if (!facilities.length) return { inserted: 0, skipped: 0 };

  let inserted = 0;
  let skipped = 0;

  for (const facility of facilities) {
    try {
      // Check if facility already exists
      const existingCheck = await pool.query(
        'SELECT id FROM facilities WHERE name = $1 AND city = $2 AND state = $3',
        [facility.name, facility.city, facility.state]
      );

      if (existingCheck.rows.length > 0) {
        skipped++;
        continue;
      }

      await pool.query(
        `INSERT INTO facilities (
          id, name, street, city, state, zip, phone, website,
          latitude, longitude, "residentialServices", "allServices",
          services, description, amenities, "acceptedInsurance", verified
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [
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
          facility.acceptedInsurance,
          facility.verified
        ]
      );
      inserted++;
    } catch (error) {
      if (error.code === '23505') {
        skipped++;
      } else {
        console.error(`Error inserting ${facility.name}: ${error.message}`);
      }
    }
  }
  
  return { inserted, skipped };
}

async function runETL() {
  console.log('🚀 Starting FindTreatment.gov ETL Pipeline');
  console.log('==========================================');
  console.log(`📍 Processing ${TARGET_CITIES.length} major US cities`);
  console.log('');
  
  try {
    await initDatabase();
    
    const initialCount = await pool.query('SELECT COUNT(*) FROM facilities');
    console.log(`📊 Initial facilities in database: ${initialCount.rows[0].count}`);
    console.log('');
    
    let totalFetched = 0;
    let totalInserted = 0;
    let totalSkipped = 0;
    const startTime = Date.now();
    
    for (let i = 0; i < TARGET_CITIES.length; i++) {
      const location = TARGET_CITIES[i];
      console.log(`[${i+1}/${TARGET_CITIES.length}] Processing ${location.city}, ${location.state}...`);
      
      const facilities = await fetchFacilitiesFromAPI(location);
      
      if (facilities.length > 0) {
        const transformed = facilities.map(f => transformFacility(f, location));
        const result = await insertFacilities(transformed);
        
        totalFetched += facilities.length;
        totalInserted += result.inserted;
        totalSkipped += result.skipped;
        
        console.log(`  ✅ Inserted ${result.inserted} new facilities (${result.skipped} duplicates skipped)`);
      }
      
      // Rate limiting
      if (i < TARGET_CITIES.length - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY));
      }
    }
    
    // Get final count
    const finalCount = await pool.query('SELECT COUNT(*) FROM facilities');
    const duration = (Date.now() - startTime) / 1000;
    
    console.log('\n📊 ETL Pipeline Complete!');
    console.log('========================');
    console.log(`✅ Total fetched: ${totalFetched}`);
    console.log(`✅ New inserted: ${totalInserted}`);
    console.log(`⚠️  Duplicates skipped: ${totalSkipped}`);
    console.log(`📦 Database total: ${finalCount.rows[0].count}`);
    console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
    console.log(`📍 Cities processed: ${TARGET_CITIES.length}`);
    
    // Save stats
    const stats = {
      timestamp: new Date().toISOString(),
      fetched: totalFetched,
      inserted: totalInserted,
      skipped: totalSkipped,
      dbTotal: parseInt(finalCount.rows[0].count),
      duration: duration,
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