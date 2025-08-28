#!/usr/bin/env tsx
/**
 * Database seeding script for SoberLivings Finder
 * Run with: npm run seed or tsx src/scripts/seed-database.ts
 */

import { PrismaClient } from '@prisma/client';
import { createETLPipeline, createDatabaseSeeder } from '../lib/etl-pipeline';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: '.env.local' });

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding process...\n');

  try {
    // Create ETL pipeline
    const pipeline = createETLPipeline(
      prisma,
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Create seeder
    const seeder = createDatabaseSeeder(pipeline);

    // Parse command line arguments
    const args = process.argv.slice(2);
    const command = args[0] || 'data-files';

    switch (command) {
      case 'data-files':
        console.log('📄 Seeding from data files...\n');
        const dataDir = args[1] || '../data';
        await seeder.seedFromDataFiles(dataDir);
        break;

      case 'comprehensive':
        console.log('🚀 Comprehensive seeding (files + API)...\n');
        const comprehensiveDataDir = args[1] || '../data';
        const includeAPI = args.includes('--include-api');
        await seeder.seedComprehensive(comprehensiveDataDir, includeAPI);
        break;

      case 'major-cities':
        console.log('📍 Seeding major US cities...\n');
        await seeder.seedMajorCities();
        break;

      case 'custom':
        const locations = args.slice(1).map(loc => {
          const [name, lat, lon] = loc.split(',');
          return {
            name,
            lat: parseFloat(lat),
            lon: parseFloat(lon)
          };
        });
        
        if (locations.length === 0) {
          console.error('❌ No locations provided. Use format: custom "City,lat,lon" ...');
          process.exit(1);
        }
        
        console.log(`📍 Seeding ${locations.length} custom locations...\n`);
        await seeder.seedNewLocations(locations);
        break;

      case 'states':
        console.log('📍 Seeding all US states (major cities per state)...\n');
        const stateLocations = [
          // One major city per state
          { lat: 33.4484, lon: -112.0740, name: 'Phoenix, AZ' },
          { lat: 34.7465, lon: -92.2896, name: 'Little Rock, AR' },
          { lat: 38.5816, lon: -121.4944, name: 'Sacramento, CA' },
          { lat: 39.7392, lon: -104.9903, name: 'Denver, CO' },
          { lat: 41.7658, lon: -72.6734, name: 'Hartford, CT' },
          { lat: 39.1582, lon: -75.5244, name: 'Dover, DE' },
          { lat: 30.4383, lon: -84.2807, name: 'Tallahassee, FL' },
          { lat: 33.7490, lon: -84.3880, name: 'Atlanta, GA' },
          { lat: 21.3099, lon: -157.8581, name: 'Honolulu, HI' },
          { lat: 43.6150, lon: -116.2023, name: 'Boise, ID' },
          { lat: 39.7817, lon: -89.6501, name: 'Springfield, IL' },
          { lat: 39.7684, lon: -86.1581, name: 'Indianapolis, IN' },
          { lat: 41.5910, lon: -93.6038, name: 'Des Moines, IA' },
          { lat: 39.0473, lon: -95.6752, name: 'Topeka, KS' },
          { lat: 38.1867, lon: -84.8753, name: 'Frankfort, KY' },
          { lat: 30.4515, lon: -91.1871, name: 'Baton Rouge, LA' },
          { lat: 44.3106, lon: -69.7795, name: 'Augusta, ME' },
          { lat: 38.9784, lon: -76.4922, name: 'Annapolis, MD' },
          { lat: 42.3601, lon: -71.0589, name: 'Boston, MA' },
          { lat: 42.7335, lon: -84.5555, name: 'Lansing, MI' },
          { lat: 44.9537, lon: -93.0900, name: 'St. Paul, MN' },
          { lat: 32.3200, lon: -90.2075, name: 'Jackson, MS' },
          { lat: 38.5767, lon: -92.1735, name: 'Jefferson City, MO' },
          { lat: 46.5927, lon: -112.0361, name: 'Helena, MT' },
          { lat: 40.8136, lon: -96.7026, name: 'Lincoln, NE' },
          { lat: 39.1638, lon: -119.7674, name: 'Carson City, NV' },
          { lat: 43.2081, lon: -71.5376, name: 'Concord, NH' },
          { lat: 40.2206, lon: -74.7597, name: 'Trenton, NJ' },
          { lat: 35.6844, lon: -105.9378, name: 'Santa Fe, NM' },
          { lat: 42.6526, lon: -73.7562, name: 'Albany, NY' },
          { lat: 35.7721, lon: -78.6386, name: 'Raleigh, NC' },
          { lat: 46.8133, lon: -100.7790, name: 'Bismarck, ND' },
          { lat: 39.9612, lon: -82.9988, name: 'Columbus, OH' },
          { lat: 35.4676, lon: -97.5164, name: 'Oklahoma City, OK' },
          { lat: 44.9429, lon: -123.0351, name: 'Salem, OR' },
          { lat: 40.2640, lon: -76.8867, name: 'Harrisburg, PA' },
          { lat: 41.8240, lon: -71.4128, name: 'Providence, RI' },
          { lat: 34.0003, lon: -81.0348, name: 'Columbia, SC' },
          { lat: 44.3683, lon: -100.3364, name: 'Pierre, SD' },
          { lat: 36.1627, lon: -86.7816, name: 'Nashville, TN' },
          { lat: 30.2672, lon: -97.7431, name: 'Austin, TX' },
          { lat: 40.7608, lon: -111.8910, name: 'Salt Lake City, UT' },
          { lat: 44.2619, lon: -72.5806, name: 'Montpelier, VT' },
          { lat: 37.5407, lon: -77.4360, name: 'Richmond, VA' },
          { lat: 47.0379, lon: -122.9007, name: 'Olympia, WA' },
          { lat: 38.3498, lon: -81.6326, name: 'Charleston, WV' },
          { lat: 43.0731, lon: -89.4012, name: 'Madison, WI' },
          { lat: 41.1400, lon: -104.8202, name: 'Cheyenne, WY' },
        ];
        
        await seeder.seedNewLocations(stateLocations);
        break;

      case 'clean':
        console.log('🧹 Cleaning database before seeding...\n');
        await prisma.facility.deleteMany();
        console.log('✅ Database cleaned\n');
        
        // Then seed from data files
        const cleanDataDir = args[1] || '../data';
        await seeder.seedFromDataFiles(cleanDataDir);
        break;

      default:
        console.log(`
Usage: npm run seed [command] [options]

Commands:
  data-files      Seed database from data files (CSV/JSON) - RECOMMENDED
  comprehensive   Seed from data files + optional API data
                  Use --include-api to add API data for better coverage
  major-cities    Seed database with major US cities (API only)
  states          Seed database with all US state capitals (API only)
  custom          Seed specific locations (API only)
                  Example: npm run seed custom "Boston,42.36,-71.05" "Miami,25.76,-80.19"
  clean           Clean database and re-seed from data files

Examples:
  npm run seed                                    # Default: seed from data files
  npm run seed data-files                         # Seed from data files only
  npm run seed comprehensive                      # Seed from data files
  npm run seed comprehensive --include-api        # Seed from files + API
  npm run seed major-cities                       # API-only seeding
  npm run seed clean                              # Clean and re-seed from files
        `);
        process.exit(0);
    }

    console.log('\n✨ Database seeding completed successfully!');
    
    // Print statistics (try Prisma, fallback to message)
    try {
      const count = await prisma.facility.count();
      const cities = await prisma.facility.groupBy({
        by: ['city', 'state'],
        _count: true,
      });
      
      console.log(`
📊 Database Statistics:
  Total Facilities: ${count}
  Cities Covered: ${cities.length}
  States Covered: ${new Set(cities.map(c => c.state)).size}
      `);
    } catch (error) {
      console.log(`
📊 Database Statistics:
  ✅ Data loaded to Supabase successfully
  ⚠️ Could not retrieve statistics (Prisma connection issue)
  📝 Check your Supabase dashboard to verify data
      `);
    }

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
main();