#!/usr/bin/env node

const { program } = require('commander');
const SoberLivingFinder = require('./src/fetchFacilities');
const LocationUtils = require('./src/locationUtils');
const BatchSearcher = require('./src/batchSearch');

program
  .name('sober-living-finder')
  .description('Find sober living and residential treatment facilities')
  .version('1.0.0');

program
  .command('search')
  .description('Search for residential treatment facilities')
  .option('-l, --location <location>', 'Search location (coordinates "lat,lng" or address)', '37.7749,-122.4194')
  .option('--no-json', 'Skip JSON export')
  .option('--no-csv', 'Skip CSV export')
  .option('-o, --output <dir>', 'Output directory', './data')
  .action(async (options) => {
    const finder = new SoberLivingFinder();
    
    try {
      console.log(`🔍 Searching for residential facilities near: ${options.location}\n`);
      
      // Format location (handle addresses vs coordinates)
      const formattedLocation = await LocationUtils.formatLocationForAPI(options.location);
      
      const facilities = await finder.searchResidentialFacilities(formattedLocation, {
        json: options.json,
        csv: options.csv
      });
      
      console.log(`\n✅ Successfully found ${facilities.length} residential treatment facilities`);
      
      if (facilities.length > 0) {
        console.log('\n📋 Top 5 Results:');
        facilities.slice(0, 5).forEach((facility, index) => {
          console.log(`\n${index + 1}. ${facility.name}`);
          console.log(`   📍 ${facility.city}, ${facility.state} ${facility.zip}`);
          console.log(`   📞 ${facility.phone || 'No phone listed'}`);
          console.log(`   🏠 ${facility.residential_services || 'General residential'}`);
        });
        
        if (facilities.length > 5) {
          console.log(`\n... and ${facilities.length - 5} more facilities in the exported files`);
        }
      }
      
      console.log('\n📁 Files saved to ./data/ directory');
      
    } catch (error) {
      console.error('❌ Search failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('batch')
  .description('Search multiple locations or all major US cities')
  .option('-f, --file <file>', 'File with locations (one per line)')
  .option('--cities', 'Search all major US cities')
  .option('-l, --locations <locations>', 'Comma-separated list of locations')
  .action(async (options) => {
    const batchSearcher = new BatchSearcher();
    
    try {
      let locations = [];
      
      if (options.cities) {
        // Search major cities
        const results = await batchSearcher.searchMajorCities();
        await batchSearcher.generateBatchReport(results);
        
      } else if (options.file) {
        // Read locations from file
        const fs = require('fs').promises;
        const fileContent = await fs.readFile(options.file, 'utf8');
        locations = fileContent.split('\n').filter(line => line.trim());
        
        const results = await batchSearcher.searchMultipleLocations(locations);
        await batchSearcher.generateBatchReport(results);
        
      } else if (options.locations) {
        // Parse comma-separated locations
        locations = options.locations.split(',').map(loc => loc.trim());
        
        const results = await batchSearcher.searchMultipleLocations(locations);
        await batchSearcher.generateBatchReport(results);
        
      } else {
        console.error('❌ Please specify either --cities, --file, or --locations');
        process.exit(1);
      }
      
    } catch (error) {
      console.error('❌ Batch search failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('cities')
  .description('List available major cities for searching')
  .action(() => {
    const cities = LocationUtils.getMajorCities();
    console.log('🌆 Available Major US Cities:');
    console.log('');
    cities.forEach((city, index) => {
      console.log(`${(index + 1).toString().padStart(2)}. ${city.name.padEnd(20)} (${city.coords})`);
    });
    console.log('');
    console.log('💡 Use coordinates or city names with the search command');
    console.log('Example: node index.js search --location "Chicago, IL"');
  });

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

program.parse();