#!/usr/bin/env node
/**
 * ETL Pipeline for FindTreatment.gov API
 * Fetches all treatment facilities across the United States
 * and seeds the database with comprehensive provider data
 */

const https = require('https');
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

// Database configuration
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/soberlivings';

// API configuration
const API_BASE_URL = 'https://findtreatment.gov/locator/exportsAsJson/v2';
const BATCH_SIZE = 500; // Max records per request
const DELAY_BETWEEN_REQUESTS = 1000; // 1 second delay to avoid rate limiting

// US States and major cities for comprehensive coverage
const LOCATIONS = [
  // States
  { state: 'CA', name: 'California', lat: 36.7783, lon: -119.4179 },
  { state: 'TX', name: 'Texas', lat: 31.9686, lon: -99.9018 },
  { state: 'FL', name: 'Florida', lat: 27.6648, lon: -81.5158 },
  { state: 'NY', name: 'New York', lat: 40.7128, lon: -74.0060 },
  { state: 'PA', name: 'Pennsylvania', lat: 41.2033, lon: -77.1945 },
  { state: 'IL', name: 'Illinois', lat: 40.6331, lon: -89.3985 },
  { state: 'OH', name: 'Ohio', lat: 40.4173, lon: -82.9071 },
  { state: 'GA', name: 'Georgia', lat: 32.1656, lon: -82.9001 },
  { state: 'NC', name: 'North Carolina', lat: 35.7596, lon: -79.0193 },
  { state: 'MI', name: 'Michigan', lat: 44.3148, lon: -85.6024 },
  { state: 'NJ', name: 'New Jersey', lat: 40.0583, lon: -74.4057 },
  { state: 'VA', name: 'Virginia', lat: 37.4316, lon: -78.6569 },
  { state: 'WA', name: 'Washington', lat: 47.7511, lon: -120.7401 },
  { state: 'AZ', name: 'Arizona', lat: 34.0489, lon: -111.0937 },
  { state: 'MA', name: 'Massachusetts', lat: 42.4072, lon: -71.3824 },
  { state: 'TN', name: 'Tennessee', lat: 35.5175, lon: -86.5804 },
  { state: 'IN', name: 'Indiana', lat: 40.2672, lon: -86.1349 },
  { state: 'MO', name: 'Missouri', lat: 37.9643, lon: -91.8318 },
  { state: 'MD', name: 'Maryland', lat: 39.0458, lon: -76.6413 },
  { state: 'WI', name: 'Wisconsin', lat: 43.7844, lon: -88.7879 },
  { state: 'CO', name: 'Colorado', lat: 39.5501, lon: -105.7821 },
  { state: 'MN', name: 'Minnesota', lat: 46.7296, lon: -94.6859 },
  { state: 'SC', name: 'South Carolina', lat: 33.8361, lon: -81.1637 },
  { state: 'AL', name: 'Alabama', lat: 32.3182, lon: -86.9023 },
  { state: 'LA', name: 'Louisiana', lat: 30.9843, lon: -91.9623 },
  { state: 'KY', name: 'Kentucky', lat: 37.8393, lon: -84.2700 },
  { state: 'OR', name: 'Oregon', lat: 43.8041, lon: -120.5542 },
  { state: 'OK', name: 'Oklahoma', lat: 35.0078, lon: -97.0929 },
  { state: 'CT', name: 'Connecticut', lat: 41.6032, lon: -73.0877 },
  { state: 'UT', name: 'Utah', lat: 39.3210, lon: -111.0937 },
  { state: 'IA', name: 'Iowa', lat: 41.8780, lon: -93.0977 },
  { state: 'NV', name: 'Nevada', lat: 38.8026, lon: -116.4194 },
  { state: 'AR', name: 'Arkansas', lat: 35.2010, lon: -91.8318 },
  { state: 'MS', name: 'Mississippi', lat: 32.3547, lon: -89.3985 },
  { state: 'KS', name: 'Kansas', lat: 39.0119, lon: -98.4842 },
  { state: 'NM', name: 'New Mexico', lat: 34.5199, lon: -105.8701 },
  { state: 'NE', name: 'Nebraska', lat: 41.4925, lon: -99.9018 },
  { state: 'WV', name: 'West Virginia', lat: 38.5976, lon: -80.4549 },
  { state: 'ID', name: 'Idaho', lat: 44.0682, lon: -114.7420 },
  { state: 'HI', name: 'Hawaii', lat: 19.8968, lon: -155.5828 },
  { state: 'NH', name: 'New Hampshire', lat: 43.1939, lon: -71.5724 },
  { state: 'ME', name: 'Maine', lat: 45.2538, lon: -69.4455 },
  { state: 'RI', name: 'Rhode Island', lat: 41.5801, lon: -71.4774 },
  { state: 'MT', name: 'Montana', lat: 46.8797, lon: -110.3626 },
  { state: 'DE', name: 'Delaware', lat: 38.9108, lon: -75.5277 },
  { state: 'SD', name: 'South Dakota', lat: 43.9695, lon: -99.9018 },
  { state: 'ND', name: 'North Dakota', lat: 47.5515, lon: -101.0020 },
  { state: 'AK', name: 'Alaska', lat: 64.2008, lon: -149.4937 },
  { state: 'VT', name: 'Vermont', lat: 44.5588, lon: -72.5778 },
  { state: 'WY', name: 'Wyoming', lat: 43.0760, lon: -107.2903 }
];

// Database pool
let pool;

/**
 * Initialize database connection
 */
async function initDatabase() {
  pool = new Pool({ connectionString: DATABASE_URL });
  
  // Test connection
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    throw error;
  }
}

/**
 * Fetch facilities from FindTreatment.gov API
 */
async function fetchFacilities(location, pageSize = BATCH_SIZE) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      sType: 'sa', // Substance abuse services
      sAddr: `${location.lat},${location.lon}`,
      pageSize: pageSize,
      page: 1,
      sort: 0
    });

    const url = `${API_BASE_URL}?${params}`;
    console.log(`📍 Fetching facilities for ${location.name}...`);

    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const facilities = JSON.parse(data);
          console.log(`  ✅ Found ${facilities.length} facilities in ${location.name}`);
          resolve(facilities);
        } catch (error) {
          console.error(`  ❌ Error parsing JSON for ${location.name}:`, error.message);
          resolve([]);
        }
      });
    }).on('error', (error) => {
      console.error(`  ❌ Request failed for ${location.name}:`, error.message);
      resolve([]);
    });
  });
}

/**
 * Transform API data to match database schema
 */
function transformFacility(facility, state) {
  // Extract services
  const services = [];
  const serviceCategories = facility.service_codes || [];
  
  serviceCategories.forEach(category => {
    if (category.includes('RT')) services.push('residential');
    if (category.includes('OP')) services.push('outpatient');
    if (category.includes('HH')) services.push('transitional');
    if (category.includes('DT')) services.push('detox');
    if (category.includes('MM')) services.push('medication_assisted');
    if (category.includes('CT')) services.push('co_occurring');
  });

  // Extract residential services
  let residentialServices = '';
  if (facility.type_facility && facility.type_facility.includes('Residential')) {
    residentialServices = facility.type_facility;
  }

  // Clean phone number
  const phone = facility.phone ? facility.phone.replace(/[^0-9]/g, '') : '';
  const formattedPhone = phone.length === 10 
    ? `(${phone.slice(0,3)}) ${phone.slice(3,6)}-${phone.slice(6)}` 
    : facility.phone;

  // Generate unique ID
  const id = `${state.toLowerCase()}-${facility.name_facility.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;

  return {
    id: id.substring(0, 100), // Limit ID length
    name: facility.name_facility || 'Unknown Facility',
    street: facility.street1 || '',
    city: facility.city || '',
    state: facility.state || state,
    zip: facility.zip || '',
    phone: formattedPhone || '',
    website: facility.website || '',
    latitude: parseFloat(facility.latitude) || 0,
    longitude: parseFloat(facility.longitude) || 0,
    residentialServices: residentialServices,
    allServices: facility.type_facility || '',
    services: services.length > 0 ? services : ['treatment'],
    description: `${facility.name_facility} provides ${facility.type_facility || 'treatment services'} in ${facility.city}, ${facility.state}.`,
    capacity: null,
    amenities: [],
    acceptedInsurance: facility.payment_types ? facility.payment_types.split(';').map(p => p.trim()) : [],
    programs: [],
    verified: true,
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Insert facilities into database
 */
async function insertFacilities(facilities) {
  if (facilities.length === 0) return 0;

  const values = [];
  const placeholders = [];
  let paramIndex = 1;

  facilities.forEach(facility => {
    placeholders.push(`($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4}, $${paramIndex+5}, $${paramIndex+6}, $${paramIndex+7}, $${paramIndex+8}, $${paramIndex+9}, $${paramIndex+10}, $${paramIndex+11}, $${paramIndex+12}, $${paramIndex+13}, $${paramIndex+14}, $${paramIndex+15}, $${paramIndex+16})`);
    
    values.push(
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
    );
    
    paramIndex += 16;
  });

  const query = `
    INSERT INTO facilities (
      id, name, street, city, state, zip, phone, website,
      latitude, longitude, "residentialServices", "allServices",
      services, description, amenities, "acceptedInsurance"
    ) VALUES ${placeholders.join(', ')}
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      street = EXCLUDED.street,
      city = EXCLUDED.city,
      phone = EXCLUDED.phone,
      website = EXCLUDED.website,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      "residentialServices" = EXCLUDED."residentialServices",
      "allServices" = EXCLUDED."allServices",
      services = EXCLUDED.services,
      description = EXCLUDED.description,
      amenities = EXCLUDED.amenities,
      "acceptedInsurance" = EXCLUDED."acceptedInsurance"
  `;

  try {
    const result = await pool.query(query, values);
    return facilities.length;
  } catch (error) {
    console.error('❌ Error inserting facilities:', error.message);
    console.error('Query:', query.substring(0, 200));
    return 0;
  }
}

/**
 * Main ETL pipeline
 */
async function runETLPipeline() {
  console.log('🚀 Starting ETL Pipeline for FindTreatment.gov API');
  console.log('================================================');
  
  try {
    // Initialize database
    await initDatabase();
    
    // Clear existing data (optional)
    console.log('\n📋 Preparing database...');
    const clearResult = await pool.query('DELETE FROM facilities WHERE id LIKE \'%-%-\'');
    console.log(`  ✅ Cleared ${clearResult.rowCount} existing ETL records`);
    
    // Process each location
    let totalFacilities = 0;
    let totalInserted = 0;
    const startTime = Date.now();
    
    for (let i = 0; i < LOCATIONS.length; i++) {
      const location = LOCATIONS[i];
      console.log(`\n[${i+1}/${LOCATIONS.length}] Processing ${location.name}...`);
      
      // Fetch facilities
      const rawFacilities = await fetchFacilities(location);
      totalFacilities += rawFacilities.length;
      
      // Transform and insert
      if (rawFacilities.length > 0) {
        const transformed = rawFacilities.map(f => transformFacility(f, location.state));
        const inserted = await insertFacilities(transformed);
        totalInserted += inserted;
        console.log(`  ✅ Inserted ${inserted} facilities`);
      }
      
      // Rate limiting
      if (i < LOCATIONS.length - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
      }
    }
    
    // Generate statistics
    const duration = (Date.now() - startTime) / 1000;
    console.log('\n📊 ETL Pipeline Complete!');
    console.log('========================');
    console.log(`✅ Total facilities fetched: ${totalFacilities}`);
    console.log(`✅ Total facilities inserted: ${totalInserted}`);
    console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
    
    // Get final count
    const countResult = await pool.query('SELECT COUNT(*) FROM facilities');
    console.log(`📦 Total facilities in database: ${countResult.rows[0].count}`);
    
    // Save statistics
    const stats = {
      timestamp: new Date().toISOString(),
      totalFetched: totalFacilities,
      totalInserted: totalInserted,
      duration: duration,
      locationsProcessed: LOCATIONS.length,
      databaseTotal: parseInt(countResult.rows[0].count)
    };
    
    await fs.writeFile(
      path.join(__dirname, 'etl-stats.json'),
      JSON.stringify(stats, null, 2)
    );
    
    console.log('\n✅ Statistics saved to etl-stats.json');
    
  } catch (error) {
    console.error('❌ ETL Pipeline failed:', error);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
      console.log('👋 Database connection closed');
    }
  }
}

// Run if executed directly
if (require.main === module) {
  runETLPipeline().catch(console.error);
}

module.exports = { runETLPipeline, fetchFacilities, transformFacility };