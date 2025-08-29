#!/usr/bin/env node
/**
 * Comprehensive ETL Pipeline for FindTreatment.gov API
 * Seeds database with ALL treatment facilities across the United States
 */

const https = require('https');
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

// Database configuration for local Docker
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/soberlivings';

// API configuration
const API_BASE_URL = 'https://findtreatment.gov/locator/exportsAsJson/v2';
const BATCH_SIZE = 500; // Max records per request
const DELAY_BETWEEN_REQUESTS = 500; // 0.5 second delay to avoid rate limiting

// Comprehensive US locations - Major cities and state centers
const US_LOCATIONS = [
  // Northeast
  { state: 'ME', city: 'Portland', lat: 43.6591, lon: -70.2568 },
  { state: 'ME', city: 'Augusta', lat: 44.3106, lon: -69.7795 },
  { state: 'NH', city: 'Manchester', lat: 42.9956, lon: -71.4548 },
  { state: 'NH', city: 'Concord', lat: 43.2081, lon: -71.5376 },
  { state: 'VT', city: 'Burlington', lat: 44.4759, lon: -73.2121 },
  { state: 'VT', city: 'Montpelier', lat: 44.2600, lon: -72.5806 },
  { state: 'MA', city: 'Boston', lat: 42.3601, lon: -71.0589 },
  { state: 'MA', city: 'Worcester', lat: 42.2626, lon: -71.8023 },
  { state: 'MA', city: 'Springfield', lat: 42.1015, lon: -72.5898 },
  { state: 'RI', city: 'Providence', lat: 41.8240, lon: -71.4128 },
  { state: 'CT', city: 'Hartford', lat: 41.7658, lon: -72.6734 },
  { state: 'CT', city: 'New Haven', lat: 41.3083, lon: -72.9279 },
  { state: 'NY', city: 'New York', lat: 40.7128, lon: -74.0060 },
  { state: 'NY', city: 'Buffalo', lat: 42.8864, lon: -78.8784 },
  { state: 'NY', city: 'Albany', lat: 42.6526, lon: -73.7562 },
  { state: 'NY', city: 'Rochester', lat: 43.1566, lon: -77.6088 },
  { state: 'NJ', city: 'Newark', lat: 40.7357, lon: -74.1724 },
  { state: 'NJ', city: 'Trenton', lat: 40.2171, lon: -74.7429 },
  { state: 'PA', city: 'Philadelphia', lat: 39.9526, lon: -75.1652 },
  { state: 'PA', city: 'Pittsburgh', lat: 40.4406, lon: -79.9959 },
  { state: 'PA', city: 'Harrisburg', lat: 40.2732, lon: -76.8867 },
  
  // Southeast
  { state: 'DE', city: 'Wilmington', lat: 39.7391, lon: -75.5398 },
  { state: 'DE', city: 'Dover', lat: 39.1582, lon: -75.5244 },
  { state: 'MD', city: 'Baltimore', lat: 39.2904, lon: -76.6122 },
  { state: 'MD', city: 'Annapolis', lat: 38.9784, lon: -76.4922 },
  { state: 'DC', city: 'Washington', lat: 38.9072, lon: -77.0369 },
  { state: 'VA', city: 'Richmond', lat: 37.5407, lon: -77.4360 },
  { state: 'VA', city: 'Virginia Beach', lat: 36.8529, lon: -75.9780 },
  { state: 'VA', city: 'Norfolk', lat: 36.8508, lon: -76.2859 },
  { state: 'WV', city: 'Charleston', lat: 38.3498, lon: -81.6326 },
  { state: 'WV', city: 'Huntington', lat: 38.4192, lon: -82.4452 },
  { state: 'NC', city: 'Charlotte', lat: 35.2271, lon: -80.8431 },
  { state: 'NC', city: 'Raleigh', lat: 35.7796, lon: -78.6382 },
  { state: 'NC', city: 'Greensboro', lat: 36.0726, lon: -79.7920 },
  { state: 'SC', city: 'Columbia', lat: 34.0007, lon: -81.0348 },
  { state: 'SC', city: 'Charleston', lat: 32.7765, lon: -79.9311 },
  { state: 'GA', city: 'Atlanta', lat: 33.7490, lon: -84.3880 },
  { state: 'GA', city: 'Augusta', lat: 33.4735, lon: -82.0105 },
  { state: 'GA', city: 'Savannah', lat: 32.0809, lon: -81.0912 },
  { state: 'FL', city: 'Miami', lat: 25.7617, lon: -80.1918 },
  { state: 'FL', city: 'Tampa', lat: 27.9506, lon: -82.4572 },
  { state: 'FL', city: 'Jacksonville', lat: 30.3322, lon: -81.6557 },
  { state: 'FL', city: 'Orlando', lat: 28.5383, lon: -81.3792 },
  { state: 'FL', city: 'Tallahassee', lat: 30.4383, lon: -84.2807 },
  
  // Midwest
  { state: 'OH', city: 'Columbus', lat: 39.9612, lon: -82.9988 },
  { state: 'OH', city: 'Cleveland', lat: 41.4993, lon: -81.6944 },
  { state: 'OH', city: 'Cincinnati', lat: 39.1031, lon: -84.5120 },
  { state: 'IN', city: 'Indianapolis', lat: 39.7684, lon: -86.1581 },
  { state: 'IN', city: 'Fort Wayne', lat: 41.0793, lon: -85.1394 },
  { state: 'IL', city: 'Chicago', lat: 41.8781, lon: -87.6298 },
  { state: 'IL', city: 'Springfield', lat: 39.7817, lon: -89.6501 },
  { state: 'IL', city: 'Peoria', lat: 40.6936, lon: -89.5890 },
  { state: 'MI', city: 'Detroit', lat: 42.3314, lon: -83.0458 },
  { state: 'MI', city: 'Grand Rapids', lat: 42.9634, lon: -85.6681 },
  { state: 'MI', city: 'Lansing', lat: 42.7325, lon: -84.5555 },
  { state: 'WI', city: 'Milwaukee', lat: 43.0389, lon: -87.9065 },
  { state: 'WI', city: 'Madison', lat: 43.0731, lon: -89.4012 },
  { state: 'MN', city: 'Minneapolis', lat: 44.9778, lon: -93.2650 },
  { state: 'MN', city: 'St. Paul', lat: 44.9537, lon: -93.0900 },
  { state: 'IA', city: 'Des Moines', lat: 41.5868, lon: -93.6250 },
  { state: 'IA', city: 'Cedar Rapids', lat: 41.9779, lon: -91.6656 },
  { state: 'MO', city: 'Kansas City', lat: 39.0997, lon: -94.5786 },
  { state: 'MO', city: 'St. Louis', lat: 38.6270, lon: -90.1994 },
  { state: 'MO', city: 'Jefferson City', lat: 38.5767, lon: -92.1735 },
  { state: 'ND', city: 'Fargo', lat: 46.8772, lon: -96.7898 },
  { state: 'ND', city: 'Bismarck', lat: 46.8083, lon: -100.7837 },
  { state: 'SD', city: 'Sioux Falls', lat: 43.5460, lon: -96.7313 },
  { state: 'SD', city: 'Pierre', lat: 44.3683, lon: -100.3510 },
  { state: 'NE', city: 'Omaha', lat: 41.2565, lon: -95.9345 },
  { state: 'NE', city: 'Lincoln', lat: 40.8136, lon: -96.7026 },
  { state: 'KS', city: 'Wichita', lat: 37.6872, lon: -97.3301 },
  { state: 'KS', city: 'Topeka', lat: 39.0473, lon: -95.6752 },
  
  // South
  { state: 'KY', city: 'Louisville', lat: 38.2527, lon: -85.7585 },
  { state: 'KY', city: 'Lexington', lat: 38.0406, lon: -84.5037 },
  { state: 'TN', city: 'Nashville', lat: 36.1627, lon: -86.7816 },
  { state: 'TN', city: 'Memphis', lat: 35.1495, lon: -90.0490 },
  { state: 'TN', city: 'Knoxville', lat: 35.9606, lon: -83.9207 },
  { state: 'AL', city: 'Birmingham', lat: 33.5186, lon: -86.8104 },
  { state: 'AL', city: 'Montgomery', lat: 32.3668, lon: -86.3000 },
  { state: 'AL', city: 'Mobile', lat: 30.6954, lon: -88.0399 },
  { state: 'MS', city: 'Jackson', lat: 32.2988, lon: -90.1848 },
  { state: 'MS', city: 'Gulfport', lat: 30.3674, lon: -89.0928 },
  { state: 'AR', city: 'Little Rock', lat: 34.7465, lon: -92.2896 },
  { state: 'AR', city: 'Fort Smith', lat: 35.3859, lon: -94.3985 },
  { state: 'LA', city: 'New Orleans', lat: 29.9511, lon: -90.0715 },
  { state: 'LA', city: 'Baton Rouge', lat: 30.4515, lon: -91.1871 },
  { state: 'LA', city: 'Shreveport', lat: 32.5252, lon: -93.7502 },
  { state: 'OK', city: 'Oklahoma City', lat: 35.4676, lon: -97.5164 },
  { state: 'OK', city: 'Tulsa', lat: 36.1540, lon: -95.9928 },
  { state: 'TX', city: 'Houston', lat: 29.7604, lon: -95.3698 },
  { state: 'TX', city: 'Dallas', lat: 32.7767, lon: -96.7970 },
  { state: 'TX', city: 'Austin', lat: 30.2672, lon: -97.7431 },
  { state: 'TX', city: 'San Antonio', lat: 29.4241, lon: -98.4936 },
  { state: 'TX', city: 'El Paso', lat: 31.7619, lon: -106.4850 },
  { state: 'TX', city: 'Fort Worth', lat: 32.7555, lon: -97.3308 },
  
  // West
  { state: 'MT', city: 'Billings', lat: 45.7833, lon: -108.5007 },
  { state: 'MT', city: 'Helena', lat: 46.5891, lon: -112.0391 },
  { state: 'WY', city: 'Cheyenne', lat: 41.1400, lon: -104.8202 },
  { state: 'WY', city: 'Casper', lat: 42.8501, lon: -106.3252 },
  { state: 'CO', city: 'Denver', lat: 39.7392, lon: -104.9903 },
  { state: 'CO', city: 'Colorado Springs', lat: 38.8339, lon: -104.8214 },
  { state: 'CO', city: 'Boulder', lat: 40.0150, lon: -105.2705 },
  { state: 'NM', city: 'Albuquerque', lat: 35.0853, lon: -106.6056 },
  { state: 'NM', city: 'Santa Fe', lat: 35.6870, lon: -105.9378 },
  { state: 'ID', city: 'Boise', lat: 43.6150, lon: -116.2023 },
  { state: 'ID', city: 'Pocatello', lat: 42.8713, lon: -112.4455 },
  { state: 'UT', city: 'Salt Lake City', lat: 40.7608, lon: -111.8910 },
  { state: 'UT', city: 'Provo', lat: 40.2338, lon: -111.6585 },
  { state: 'AZ', city: 'Phoenix', lat: 33.4484, lon: -112.0740 },
  { state: 'AZ', city: 'Tucson', lat: 32.2217, lon: -110.9265 },
  { state: 'AZ', city: 'Flagstaff', lat: 35.1983, lon: -111.6513 },
  { state: 'NV', city: 'Las Vegas', lat: 36.1699, lon: -115.1398 },
  { state: 'NV', city: 'Reno', lat: 39.5296, lon: -119.8138 },
  { state: 'WA', city: 'Seattle', lat: 47.6062, lon: -122.3321 },
  { state: 'WA', city: 'Spokane', lat: 47.6587, lon: -117.4260 },
  { state: 'WA', city: 'Tacoma', lat: 47.2529, lon: -122.4443 },
  { state: 'OR', city: 'Portland', lat: 45.5152, lon: -122.6784 },
  { state: 'OR', city: 'Eugene', lat: 44.0521, lon: -123.0868 },
  { state: 'OR', city: 'Salem', lat: 44.9429, lon: -123.0351 },
  { state: 'CA', city: 'Los Angeles', lat: 34.0522, lon: -118.2437 },
  { state: 'CA', city: 'San Francisco', lat: 37.7749, lon: -122.4194 },
  { state: 'CA', city: 'San Diego', lat: 32.7157, lon: -117.1611 },
  { state: 'CA', city: 'Sacramento', lat: 38.5816, lon: -121.4944 },
  { state: 'CA', city: 'San Jose', lat: 37.3382, lon: -121.8863 },
  { state: 'CA', city: 'Fresno', lat: 36.7378, lon: -119.7871 },
  { state: 'CA', city: 'Oakland', lat: 37.8044, lon: -122.2712 },
  
  // Alaska & Hawaii
  { state: 'AK', city: 'Anchorage', lat: 61.2181, lon: -149.9003 },
  { state: 'AK', city: 'Fairbanks', lat: 64.8378, lon: -147.7164 },
  { state: 'AK', city: 'Juneau', lat: 58.3019, lon: -134.4197 },
  { state: 'HI', city: 'Honolulu', lat: 21.3099, lon: -157.8581 },
  { state: 'HI', city: 'Hilo', lat: 19.7297, lon: -155.0900 },
  { state: 'HI', city: 'Kailua', lat: 21.4022, lon: -157.7394 }
];

// Database pool
let pool;

/**
 * Initialize database connection
 */
async function initDatabase() {
  pool = new Pool({ connectionString: DATABASE_URL });
  
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
    console.log(`📍 Fetching facilities for ${location.city}, ${location.state}...`);

    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const facilities = JSON.parse(data);
          console.log(`  ✅ Found ${facilities.length} facilities in ${location.city}, ${location.state}`);
          resolve(facilities);
        } catch (error) {
          console.error(`  ❌ Error parsing JSON for ${location.city}:`, error.message);
          resolve([]);
        }
      });
    }).on('error', (error) => {
      console.error(`  ❌ Request failed for ${location.city}:`, error.message);
      resolve([]);
    });
  });
}

/**
 * Transform API data to match database schema
 */
function transformFacility(facility, location) {
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
    if (category.includes('RES')) services.push('residential');
    if (category.includes('HOSP')) services.push('hospital');
  });

  // Clean phone number
  const phone = facility.phone ? facility.phone.replace(/[^0-9]/g, '') : '';
  const formattedPhone = phone.length === 10 
    ? `(${phone.slice(0,3)}) ${phone.slice(3,6)}-${phone.slice(6)}` 
    : facility.phone;

  // Generate unique ID using facility name and location
  const sanitizedName = (facility.name_facility || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '-');
  const id = `${location.state.toLowerCase()}-${sanitizedName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return {
    id: id.substring(0, 50), // Limit ID length
    name: facility.name_facility || 'Unknown Facility',
    street: facility.street1 || '',
    city: facility.city || location.city,
    state: facility.state || location.state,
    zip: facility.zip || '',
    phone: formattedPhone || '',
    website: facility.website || '',
    latitude: parseFloat(facility.latitude) || location.lat,
    longitude: parseFloat(facility.longitude) || location.lon,
    residentialServices: facility.type_facility || '',
    allServices: facility.type_facility || '',
    services: services.length > 0 ? services : ['treatment'],
    description: `${facility.name_facility} provides ${facility.type_facility || 'treatment services'} in ${facility.city || location.city}, ${facility.state || location.state}.`,
    capacity: null,
    amenities: [],
    acceptedInsurance: facility.payment_types ? facility.payment_types.split(';').map(p => p.trim()) : [],
    programs: [],
    verified: true,
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Insert facilities into database with duplicate checking
 */
async function insertFacilities(facilities) {
  if (facilities.length === 0) return { inserted: 0, skipped: 0 };

  let inserted = 0;
  let skipped = 0;

  for (const facility of facilities) {
    try {
      // Check if facility already exists (by name and location)
      const existingCheck = await pool.query(
        'SELECT id FROM facilities WHERE name = $1 AND city = $2 AND state = $3',
        [facility.name, facility.city, facility.state]
      );

      if (existingCheck.rows.length > 0) {
        skipped++;
        continue;
      }

      // Insert new facility
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
      if (error.code === '23505') { // Duplicate key error
        skipped++;
      } else {
        console.error(`Error inserting ${facility.name}:`, error.message);
      }
    }
  }

  return { inserted, skipped };
}

/**
 * Main ETL pipeline
 */
async function runETLPipeline() {
  console.log('🚀 Starting Comprehensive ETL Pipeline for FindTreatment.gov API');
  console.log('================================================================');
  console.log(`📍 Processing ${US_LOCATIONS.length} locations across all 50 states`);
  console.log('');
  
  try {
    // Initialize database
    await initDatabase();
    
    // Get initial count
    const initialCount = await pool.query('SELECT COUNT(*) FROM facilities');
    console.log(`📊 Initial facilities in database: ${initialCount.rows[0].count}`);
    console.log('');
    
    // Process each location
    let totalFacilities = 0;
    let totalInserted = 0;
    let totalSkipped = 0;
    const startTime = Date.now();
    
    // Group locations by state for progress tracking
    const stateGroups = {};
    US_LOCATIONS.forEach(loc => {
      if (!stateGroups[loc.state]) stateGroups[loc.state] = [];
      stateGroups[loc.state].push(loc);
    });
    
    const states = Object.keys(stateGroups).sort();
    console.log(`Processing ${states.length} states...\n`);
    
    for (const state of states) {
      console.log(`\n🏛️  Processing ${state} (${stateGroups[state].length} locations)`);
      console.log('─'.repeat(50));
      
      for (const location of stateGroups[state]) {
        // Fetch facilities
        const rawFacilities = await fetchFacilities(location);
        totalFacilities += rawFacilities.length;
        
        // Transform and insert
        if (rawFacilities.length > 0) {
          const transformed = rawFacilities.map(f => transformFacility(f, location));
          const result = await insertFacilities(transformed);
          totalInserted += result.inserted;
          totalSkipped += result.skipped;
          
          if (result.inserted > 0) {
            console.log(`  ✅ Inserted ${result.inserted} new facilities (${result.skipped} duplicates skipped)`);
          }
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
      }
    }
    
    // Generate final statistics
    const duration = (Date.now() - startTime) / 1000;
    const finalCount = await pool.query('SELECT COUNT(*) FROM facilities');
    
    console.log('\n');
    console.log('═'.repeat(60));
    console.log('📊 ETL Pipeline Complete!');
    console.log('═'.repeat(60));
    console.log(`✅ Total facilities fetched: ${totalFacilities}`);
    console.log(`✅ New facilities inserted: ${totalInserted}`);
    console.log(`⚠️  Duplicates skipped: ${totalSkipped}`);
    console.log(`📦 Total facilities in database: ${finalCount.rows[0].count}`);
    console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
    console.log(`📍 Locations processed: ${US_LOCATIONS.length}`);
    console.log(`🏛️  States covered: ${states.length}`);
    
    // Save statistics
    const stats = {
      timestamp: new Date().toISOString(),
      totalFetched: totalFacilities,
      totalInserted: totalInserted,
      duplicatesSkipped: totalSkipped,
      duration: duration,
      locationsProcessed: US_LOCATIONS.length,
      statesCovered: states.length,
      databaseTotal: parseInt(finalCount.rows[0].count)
    };
    
    await fs.writeFile(
      path.join(__dirname, 'etl-comprehensive-stats.json'),
      JSON.stringify(stats, null, 2)
    );
    
    console.log('\n✅ Statistics saved to etl-comprehensive-stats.json');
    
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