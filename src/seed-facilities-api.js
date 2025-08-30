#!/usr/bin/env node
/**
 * Enhanced ETL Pipeline for FindTreatment.gov API
 * Fixed to handle actual API response format
 */

const axios = require('axios');
const { Pool } = require('pg');
const fs = require('fs').promises;

// Database configuration
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/soberlivings';

// API configuration
const API_URL = 'https://findtreatment.gov/locator/exportsAsJson/v2';
const BATCH_SIZE = 100;
const DELAY_MS = 500;

// Major US cities for comprehensive coverage
const TARGET_LOCATIONS = [
  // California
  { city: 'Los Angeles', state: 'CA', lat: 34.0522, lon: -118.2437 },
  { city: 'San Francisco', state: 'CA', lat: 37.7749, lon: -122.4194 },
  { city: 'San Diego', state: 'CA', lat: 32.7157, lon: -117.1611 },
  { city: 'San Jose', state: 'CA', lat: 37.3382, lon: -121.8863 },
  { city: 'Sacramento', state: 'CA', lat: 38.5816, lon: -121.4944 },
  
  // Texas
  { city: 'Houston', state: 'TX', lat: 29.7604, lon: -95.3698 },
  { city: 'Dallas', state: 'TX', lat: 32.7767, lon: -96.7970 },
  { city: 'Austin', state: 'TX', lat: 30.2672, lon: -97.7431 },
  { city: 'San Antonio', state: 'TX', lat: 29.4241, lon: -98.4936 },
  
  // Florida
  { city: 'Miami', state: 'FL', lat: 25.7617, lon: -80.1918 },
  { city: 'Tampa', state: 'FL', lat: 27.9506, lon: -82.4572 },
  { city: 'Orlando', state: 'FL', lat: 28.5383, lon: -81.3792 },
  { city: 'Jacksonville', state: 'FL', lat: 30.3322, lon: -81.6557 },
  
  // New York
  { city: 'New York', state: 'NY', lat: 40.7128, lon: -74.0060 },
  { city: 'Buffalo', state: 'NY', lat: 42.8864, lon: -78.8784 },
  
  // Illinois
  { city: 'Chicago', state: 'IL', lat: 41.8781, lon: -87.6298 },
  
  // Pennsylvania
  { city: 'Philadelphia', state: 'PA', lat: 39.9526, lon: -75.1652 },
  { city: 'Pittsburgh', state: 'PA', lat: 40.4406, lon: -79.9959 },
  
  // Arizona
  { city: 'Phoenix', state: 'AZ', lat: 33.4484, lon: -112.0740 },
  { city: 'Tucson', state: 'AZ', lat: 32.2217, lon: -110.9265 },
  
  // Massachusetts
  { city: 'Boston', state: 'MA', lat: 42.3601, lon: -71.0589 },
  
  // Washington
  { city: 'Seattle', state: 'WA', lat: 47.6062, lon: -122.3321 },
  { city: 'Spokane', state: 'WA', lat: 47.6587, lon: -117.4260 },
  
  // Colorado
  { city: 'Denver', state: 'CO', lat: 39.7392, lon: -104.9903 },
  
  // Georgia
  { city: 'Atlanta', state: 'GA', lat: 33.7490, lon: -84.3880 },
  
  // Michigan
  { city: 'Detroit', state: 'MI', lat: 42.3314, lon: -83.0458 },
  
  // Nevada
  { city: 'Las Vegas', state: 'NV', lat: 36.1699, lon: -115.1398 },
  
  // Oregon
  { city: 'Portland', state: 'OR', lat: 45.5152, lon: -122.6784 },
  
  // Ohio
  { city: 'Columbus', state: 'OH', lat: 39.9612, lon: -82.9988 },
  { city: 'Cleveland', state: 'OH', lat: 41.4993, lon: -81.6944 },
  
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
  const allFacilities = [];
  let page = 1;
  let hasMore = true;
  
  try {
    while (hasMore && page <= 5) { // Limit to 5 pages per location
      console.log(`📍 Fetching page ${page} for ${location.city}, ${location.state}...`);
      
      const params = {
        sType: 'sa',
        sAddr: `${location.lat},${location.lon}`,
        pageSize: BATCH_SIZE,
        page: page,
        sort: 0
      };

      const response = await axios.get(API_URL, { params, timeout: 10000 });
      
      if (response.data && response.data.rows && Array.isArray(response.data.rows)) {
        const facilities = response.data.rows;
        allFacilities.push(...facilities);
        console.log(`  ✅ Found ${facilities.length} facilities on page ${page}`);
        
        // Check if there are more pages
        hasMore = response.data.totalPages > page;
        page++;
        
        // Rate limiting
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
      } else {
        hasMore = false;
      }
    }
    
    return allFacilities;
  } catch (error) {
    console.error(`  ❌ Error fetching ${location.city}: ${error.message}`);
    return [];
  }
}

function extractServices(facility) {
  const services = new Set();
  
  if (facility.services && Array.isArray(facility.services)) {
    facility.services.forEach(service => {
      const serviceType = (service.f3 || '').toLowerCase();
      
      if (serviceType.includes('residential')) services.add('residential');
      if (serviceType.includes('outpatient')) services.add('outpatient');
      if (serviceType.includes('detox')) services.add('detox');
      if (serviceType.includes('hospital')) services.add('hospital');
      if (serviceType.includes('treatment')) services.add('treatment');
      if (serviceType.includes('recovery')) services.add('recovery');
      if (serviceType.includes('counseling')) services.add('counseling');
      if (serviceType.includes('medication')) services.add('medication-assisted');
    });
  }
  
  return Array.from(services).length > 0 ? Array.from(services) : ['treatment'];
}

function extractInsurance(facility) {
  const insurance = new Set();
  
  if (facility.services && Array.isArray(facility.services)) {
    facility.services.forEach(service => {
      if (service.f1 === 'Payment/Insurance/Funding Accepted' && service.f3) {
        const payments = service.f3.toLowerCase();
        if (payments.includes('medicare')) insurance.add('Medicare');
        if (payments.includes('medicaid')) insurance.add('Medicaid');
        if (payments.includes('private')) insurance.add('Private Insurance');
        if (payments.includes('cash') || payments.includes('self-payment')) insurance.add('Self-Pay');
        if (payments.includes('military') || payments.includes('tricare')) insurance.add('Military Insurance');
        if (payments.includes('state')) insurance.add('State Insurance');
      }
    });
  }
  
  return Array.from(insurance);
}

function extractPrograms(facility) {
  const programs = new Set();
  
  if (facility.services && Array.isArray(facility.services)) {
    facility.services.forEach(service => {
      if (service.f1 === 'Special Programs/Groups Offered' && service.f3) {
        const specialPrograms = service.f3.toLowerCase();
        if (specialPrograms.includes('women')) programs.add('Women\'s Program');
        if (specialPrograms.includes('men')) programs.add('Men\'s Program');
        if (specialPrograms.includes('youth') || specialPrograms.includes('adolescent')) programs.add('Youth Program');
        if (specialPrograms.includes('veteran')) programs.add('Veterans Program');
        if (specialPrograms.includes('lgbtq')) programs.add('LGBTQ+ Program');
        if (specialPrograms.includes('dual diagnosis') || specialPrograms.includes('co-occurring')) programs.add('Dual Diagnosis');
      }
    });
  }
  
  return Array.from(programs);
}

function transformFacility(raw, location) {
  // Generate unique ID
  const sanitizedName = (raw.name1 || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '-');
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  const id = `${location.state.toLowerCase()}-${sanitizedName}-${timestamp}-${random}`.substring(0, 50);
  
  // Format phone
  let phone = raw.phone || '';
  if (phone.match(/^\d{10}$/)) {
    phone = `(${phone.substr(0,3)}) ${phone.substr(3,3)}-${phone.substr(6)}`;
  }
  
  // Extract all services details
  const allServicesText = raw.services ? 
    raw.services.map(s => `${s.f1}: ${s.f3}`).join('; ') : '';
  
  // Get facility type
  const facilityType = raw.typeFacility === 'SA' ? 'Substance Abuse' : 'Treatment Center';
  
  return {
    id,
    name: raw.name1 || 'Unknown Facility',
    street: raw.street1 || '',
    city: raw.city || location.city,
    state: raw.state || location.state,
    zip: raw.zip || '',
    phone: phone,
    website: raw.website || '',
    latitude: parseFloat(raw.latitude) || location.lat,
    longitude: parseFloat(raw.longitude) || location.lon,
    residentialServices: facilityType,
    allServices: allServicesText.substring(0, 1000), // Limit to 1000 chars
    services: extractServices(raw),
    description: `${raw.name1 || 'Facility'} ${raw.name2 ? '- ' + raw.name2 : ''} provides treatment services in ${raw.city || location.city}, ${raw.state || location.state}. Located ${raw.miles ? raw.miles + ' miles' : 'near'} from city center.`,
    capacity: null,
    amenities: [],
    acceptedInsurance: extractInsurance(raw),
    programs: extractPrograms(raw),
    verified: true
  };
}

async function insertFacilities(facilities) {
  if (!facilities.length) return { inserted: 0, skipped: 0 };

  let inserted = 0;
  let skipped = 0;

  for (const facility of facilities) {
    try {
      // Check if facility already exists by name and location
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
          services, description, amenities, "acceptedInsurance", programs, verified
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
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
          facility.programs,
          facility.verified
        ]
      );
      inserted++;
    } catch (error) {
      if (error.code === '23505') { // Unique constraint violation
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
  console.log(`📍 Processing ${TARGET_LOCATIONS.length} major US cities`);
  console.log(`📦 Batch size: ${BATCH_SIZE} facilities per page`);
  console.log(`⏱️  Rate limit: ${DELAY_MS}ms between requests`);
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
    
    for (let i = 0; i < TARGET_LOCATIONS.length; i++) {
      const location = TARGET_LOCATIONS[i];
      console.log(`\n[${i+1}/${TARGET_LOCATIONS.length}] Processing ${location.city}, ${location.state}...`);
      
      const facilities = await fetchFacilitiesFromAPI(location);
      
      if (facilities.length > 0) {
        const transformed = facilities.map(f => transformFacility(f, location));
        const result = await insertFacilities(transformed);
        
        totalFetched += facilities.length;
        totalInserted += result.inserted;
        totalSkipped += result.skipped;
        
        console.log(`  ✅ Total: ${facilities.length} | Inserted: ${result.inserted} | Skipped: ${result.skipped}`);
      }
    }
    
    // Get final count
    const finalCount = await pool.query('SELECT COUNT(*) FROM facilities');
    const duration = (Date.now() - startTime) / 1000;
    
    console.log('\n');
    console.log('📊 ETL Pipeline Complete!');
    console.log('========================');
    console.log(`✅ Total fetched: ${totalFetched}`);
    console.log(`✅ New inserted: ${totalInserted}`);
    console.log(`⚠️  Duplicates skipped: ${totalSkipped}`);
    console.log(`📦 Database total: ${finalCount.rows[0].count}`);
    console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
    console.log(`📍 Cities processed: ${TARGET_LOCATIONS.length}`);
    
    // Save stats
    const stats = {
      timestamp: new Date().toISOString(),
      fetched: totalFetched,
      inserted: totalInserted,
      skipped: totalSkipped,
      dbTotal: parseInt(finalCount.rows[0].count),
      duration: duration,
      cities: TARGET_LOCATIONS.length,
      locations: TARGET_LOCATIONS.map(l => `${l.city}, ${l.state}`)
    };
    
    await fs.writeFile('etl-stats.json', JSON.stringify(stats, null, 2));
    console.log('\n✅ Stats saved to etl-stats.json');
    
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