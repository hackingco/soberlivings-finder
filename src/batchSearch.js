const SoberLivingFinder = require('./fetchFacilities');
const LocationUtils = require('./locationUtils');
const fs = require('fs').promises;
const path = require('path');

class BatchSearcher {
  constructor() {
    this.finder = new SoberLivingFinder();
    this.results = [];
  }

  /**
   * Search multiple cities and combine results
   * @param {Array<string>} locations - Array of location strings
   * @param {Object} options - Search options
   */
  async searchMultipleLocations(locations, options = {}) {
    const results = [];
    
    console.log(`🔍 Starting batch search for ${locations.length} locations...\n`);
    
    for (let i = 0; i < locations.length; i++) {
      const location = locations[i];
      
      try {
        console.log(`[${i + 1}/${locations.length}] Searching: ${location}`);
        
        // Format location for API
        const formattedLocation = await LocationUtils.formatLocationForAPI(location);
        
        // Search facilities
        const facilities = await this.finder.searchResidentialFacilities(formattedLocation, {
          json: false,
          csv: false
        });
        
        // Add search metadata
        const searchResult = {
          searchLocation: location,
          coordinates: formattedLocation,
          facilityCount: facilities.length,
          facilities: facilities,
          searchDate: new Date().toISOString()
        };
        
        results.push(searchResult);
        console.log(`✅ Found ${facilities.length} facilities\n`);
        
        // Add delay to be respectful to the API
        if (i < locations.length - 1) {
          await this.delay(2000); // 2 second delay between requests
        }
        
      } catch (error) {
        console.error(`❌ Error searching ${location}: ${error.message}\n`);
        results.push({
          searchLocation: location,
          error: error.message,
          facilityCount: 0,
          facilities: [],
          searchDate: new Date().toISOString()
        });
      }
    }
    
    return results;
  }

  /**
   * Search all major US cities
   * @param {Object} options - Search options
   */
  async searchMajorCities(options = {}) {
    const cities = LocationUtils.getMajorCities();
    const locations = cities.map(city => city.coords);
    
    console.log('🌆 Searching major US cities for residential treatment facilities...\n');
    
    const results = await this.searchMultipleLocations(locations, options);
    
    // Add city names to results
    results.forEach((result, index) => {
      if (result.facilities) {
        result.cityName = cities[index].name;
      }
    });
    
    return results;
  }

  /**
   * Generate comprehensive report from batch search results
   * @param {Array} searchResults - Results from batch search
   */
  async generateBatchReport(searchResults) {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    
    // Combine all facilities
    const allFacilities = [];
    const summaryStats = {
      totalLocationsSearched: searchResults.length,
      successfulSearches: 0,
      failedSearches: 0,
      totalFacilities: 0,
      facilitiesByState: {},
      facilitiesByCity: {},
      searchDate: new Date().toISOString()
    };
    
    searchResults.forEach(result => {
      if (result.error) {
        summaryStats.failedSearches++;
      } else {
        summaryStats.successfulSearches++;
        summaryStats.totalFacilities += result.facilityCount;
        
        result.facilities.forEach(facility => {
          // Add search metadata to each facility
          facility.searchLocation = result.searchLocation;
          facility.searchCoordinates = result.coordinates;
          facility.citySearched = result.cityName || result.searchLocation;
          
          allFacilities.push(facility);
          
          // Update statistics
          if (!summaryStats.facilitiesByState[facility.state]) {
            summaryStats.facilitiesByState[facility.state] = 0;
          }
          summaryStats.facilitiesByState[facility.state]++;
          
          if (!summaryStats.facilitiesByCity[facility.city]) {
            summaryStats.facilitiesByCity[facility.city] = 0;
          }
          summaryStats.facilitiesByCity[facility.city]++;
        });
      }
    });
    
    // Remove duplicates based on name and phone
    const uniqueFacilities = this.removeDuplicates(allFacilities);
    summaryStats.uniqueFacilities = uniqueFacilities.length;
    summaryStats.duplicatesRemoved = allFacilities.length - uniqueFacilities.length;
    
    // Save comprehensive data
    const batchDir = path.join(__dirname, '..', 'data', 'batch_searches');
    await fs.mkdir(batchDir, { recursive: true });
    
    // Save all facilities
    const facilitiesFile = path.join(batchDir, `all_facilities_${timestamp}.json`);
    await fs.writeFile(facilitiesFile, JSON.stringify(uniqueFacilities, null, 2));
    
    // Save summary report
    const summaryFile = path.join(batchDir, `summary_${timestamp}.json`);
    await fs.writeFile(summaryFile, JSON.stringify({
      summary: summaryStats,
      searchResults: searchResults
    }, null, 2));
    
    // Save CSV for easier analysis
    const csvFile = path.join(batchDir, `all_facilities_${timestamp}.csv`);
    await this.finder.saveToCsv(uniqueFacilities, `../batch_searches/all_facilities_${timestamp}.csv`);
    
    console.log('\n📊 BATCH SEARCH SUMMARY');
    console.log('═'.repeat(50));
    console.log(`🔍 Locations searched: ${summaryStats.totalLocationsSearched}`);
    console.log(`✅ Successful searches: ${summaryStats.successfulSearches}`);
    console.log(`❌ Failed searches: ${summaryStats.failedSearches}`);
    console.log(`🏠 Total facilities found: ${summaryStats.totalFacilities}`);
    console.log(`🔗 Unique facilities: ${summaryStats.uniqueFacilities}`);
    console.log(`🗑️  Duplicates removed: ${summaryStats.duplicatesRemoved}`);
    
    console.log('\n🗺️  TOP STATES BY FACILITY COUNT:');
    Object.entries(summaryStats.facilitiesByState)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([state, count]) => {
        console.log(`   ${state}: ${count} facilities`);
      });
    
    console.log(`\n📁 Files saved to: ${batchDir}`);
    console.log(`   - ${path.basename(facilitiesFile)}`);
    console.log(`   - ${path.basename(summaryFile)}`);
    console.log(`   - ${path.basename(csvFile)}`);
    
    return {
      facilities: uniqueFacilities,
      summary: summaryStats,
      files: {
        facilities: facilitiesFile,
        summary: summaryFile,
        csv: csvFile
      }
    };
  }

  /**
   * Remove duplicate facilities based on name and phone
   * @param {Array} facilities - Array of facilities
   * @returns {Array} Deduplicated facilities
   */
  removeDuplicates(facilities) {
    const seen = new Set();
    return facilities.filter(facility => {
      const key = `${facility.name}|${facility.phone}|${facility.city}`.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Add delay between requests
   * @param {number} ms - Milliseconds to delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = BatchSearcher;