#!/usr/bin/env node
/**
 * Continue seeding remaining cities
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

// Remaining cities (starting from Seattle which was interrupted)
const REMAINING_CITIES = [
  { city: 'Seattle', state: 'WA', lat: 47.6062, lon: -122.3321 },
  { city: 'Spokane', state: 'WA', lat: 47.6587, lon: -117.4260 },
  { city: 'Denver', state: 'CO', lat: 39.7392, lon: -104.9903 },
  { city: 'Atlanta', state: 'GA', lat: 33.7490, lon: -84.3880 },
  { city: 'Detroit', state: 'MI', lat: 42.3314, lon: -83.0458 },
  { city: 'Las Vegas', state: 'NV', lat: 36.1699, lon: -115.1398 },
  { city: 'Portland', state: 'OR', lat: 45.5152, lon: -122.6784 },
  { city: 'Columbus', state: 'OH', lat: 39.9612, lon: -82.9988 },
  { city: 'Cleveland', state: 'OH', lat: 41.4993, lon: -81.6944 },
  { city: 'Charlotte', state: 'NC', lat: 35.2271, lon: -80.8431 },
  { city: 'Raleigh', state: 'NC', lat: 35.7796, lon: -78.6382 },
  { city: 'Nashville', state: 'TN', lat: 36.1627, lon: -86.7816 },
  { city: 'Memphis', state: 'TN', lat: 35.1495, lon: -90.0490 },
  { city: 'Kansas City', state: 'MO', lat: 39.0997, lon: -94.5786 },
  { city: 'St. Louis', state: 'MO', lat: 38.6270, lon: -90.1994 },
  { city: 'Baltimore', state: 'MD', lat: 39.2904, lon: -76.6122 },
  { city: 'Milwaukee', state: 'WI', lat: 43.0389, lon: -87.9065 },
  { city: 'Minneapolis', state: 'MN', lat: 44.9778, lon: -93.2650 },
  { city: 'New Orleans', state: 'LA', lat: 29.9511, lon: -90.0715 },
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
    while (hasMore && page <= 3) { // Reduced to 3 pages to speed up
      console.log(`  📍 Fetching page ${page}...`);
      
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
        console.log(`    ✅ Found ${facilities.length} facilities`);
        
        hasMore = response.data.totalPages > page && facilities.length === BATCH_SIZE;
        page++;
        
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
      } else {
        hasMore = false;
      }
    }
    
    return allFacilities;
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
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
  const sanitizedName = (raw.name1 || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '-');
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  const id = `${location.state.toLowerCase()}-${sanitizedName}-${timestamp}-${random}`.substring(0, 50);
  
  let phone = raw.phone || '';
  if (phone.match(/^\d{10}$/)) {
    phone = `(${phone.substr(0,3)}) ${phone.substr(3,3)}-${phone.substr(6)}`;
  }
  
  const allServicesText = raw.services ? 
    raw.services.map(s => `${s.f1}: ${s.f3}`).join('; ') : '';
  
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
    allServices: allServicesText.substring(0, 1000),
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
  console.log('🚀 Continuing FindTreatment.gov ETL Pipeline');
  console.log('==========================================');
  console.log(`📍 Processing ${REMAINING_CITIES.length} remaining cities`);
  console.log('');
  
  try {
    await initDatabase();
    
    const initialCount = await pool.query('SELECT COUNT(*) FROM facilities');
    console.log(`📊 Current facilities in database: ${initialCount.rows[0].count}`);
    console.log('');
    
    let totalFetched = 0;
    let totalInserted = 0;
    let totalSkipped = 0;
    const startTime = Date.now();
    
    for (let i = 0; i < REMAINING_CITIES.length; i++) {
      const location = REMAINING_CITIES[i];
      console.log(`[${i+1}/${REMAINING_CITIES.length}] ${location.city}, ${location.state}`);
      
      const facilities = await fetchFacilitiesFromAPI(location);
      
      if (facilities.length > 0) {
        const transformed = facilities.map(f => transformFacility(f, location));
        const result = await insertFacilities(transformed);
        
        totalFetched += facilities.length;
        totalInserted += result.inserted;
        totalSkipped += result.skipped;
        
        console.log(`  📊 Fetched: ${facilities.length} | New: ${result.inserted} | Duplicates: ${result.skipped}`);
      }
    }
    
    const finalCount = await pool.query('SELECT COUNT(*) FROM facilities');
    const duration = (Date.now() - startTime) / 1000;
    
    // Get state breakdown
    const stateBreakdown = await pool.query(`
      SELECT state, COUNT(*) as count 
      FROM facilities 
      GROUP BY state 
      ORDER BY count DESC 
      LIMIT 15
    `);
    
    console.log('\n');
    console.log('📊 ETL Pipeline Complete!');
    console.log('========================');
    console.log(`✅ Session fetched: ${totalFetched}`);
    console.log(`✅ Session inserted: ${totalInserted}`);
    console.log(`⚠️  Session skipped: ${totalSkipped}`);
    console.log(`📦 Total in database: ${finalCount.rows[0].count}`);
    console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
    
    console.log('\n📍 Facilities by state:');
    stateBreakdown.rows.forEach(row => {
      console.log(`   ${row.state}: ${row.count} facilities`);
    });
    
    // Save final stats
    const stats = {
      timestamp: new Date().toISOString(),
      sessionFetched: totalFetched,
      sessionInserted: totalInserted,
      sessionSkipped: totalSkipped,
      dbTotal: parseInt(finalCount.rows[0].count),
      duration: duration,
      citiesProcessed: REMAINING_CITIES.length,
      stateBreakdown: stateBreakdown.rows
    };
    
    await fs.writeFile('etl-final-stats.json', JSON.stringify(stats, null, 2));
    console.log('\n✅ Final stats saved to etl-final-stats.json');
    
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