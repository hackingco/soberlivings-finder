const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class SoberLivingFinder {
  constructor() {
    this.baseUrl = 'https://findtreatment.gov/locator/exportsAsJson/v2';
    this.defaultParams = {
      limitType: 0,
      limitValue: 23,
      sType: 'sa',
      pageSize: 2000,
      page: 1
    };
  }

  /**
   * Fetch facilities data from the API
   * @param {string} location - Coordinates as "lat,lng" or address
   * @param {Object} options - Additional search options
   */
  async fetchFacilities(location = "37.7749,-122.4194", options = {}) {
    try {
      const params = {
        ...this.defaultParams,
        sAddr: location,
        ...options
      };

      console.log(`Fetching facilities near: ${location}`);
      const response = await axios.get(this.baseUrl, { 
        params,
        timeout: 30000 // 30 second timeout
      });

      if (!response.data || !response.data.rows) {
        throw new Error('Invalid response format from API');
      }

      console.log(`Found ${response.data.rows.length} total facilities`);
      return response.data.rows;
    } catch (error) {
      console.error('Error fetching facilities:', error.message);
      throw error;
    }
  }

  /**
   * Filter facilities for residential services
   * @param {Array} facilities - Raw facility data
   */
  filterResidentialFacilities(facilities) {
    return facilities
      .filter(facility => facility.services !== null)
      .filter(facility => {
        // Check if any service contains "Residential" in f3 field
        return facility.services.some(service => 
          service.f3 && service.f3.toLowerCase().includes('residential')
        );
      })
      .map(facility => ({
        name: facility.name1,
        city: facility.city,
        state: facility.state,
        zip: facility.zip,
        phone: facility.phone,
        address: facility.address,
        website: facility.website,
        latitude: facility.latitude,
        longitude: facility.longitude,
        residential_services: facility.services
          .filter(service => 
            service.f2 === "SET" && 
            service.f3 && 
            service.f3.toLowerCase().includes('residential')
          )
          .map(service => service.f3)
          .join('; '),
        all_services: facility.services
          .map(service => service.f3)
          .filter(Boolean)
          .join('; ')
      }));
  }

  /**
   * Save facilities data to JSON file
   * @param {Array} facilities - Processed facility data
   * @param {string} filename - Output filename
   */
  async saveToJson(facilities, filename = 'residential_facilities.json') {
    const filepath = path.join(__dirname, '..', 'data', filename);
    await fs.writeFile(filepath, JSON.stringify(facilities, null, 2));
    console.log(`Saved ${facilities.length} facilities to ${filepath}`);
  }

  /**
   * Save facilities data to CSV file
   * @param {Array} facilities - Processed facility data
   * @param {string} filename - Output filename
   */
  async saveToCsv(facilities, filename = 'residential_facilities.csv') {
    const createCsvWriter = require('csv-writer').createObjectCsvWriter;
    const filepath = path.join(__dirname, '..', 'data', filename);
    
    const csvWriter = createCsvWriter({
      path: filepath,
      header: [
        {id: 'name', title: 'Name'},
        {id: 'city', title: 'City'},
        {id: 'state', title: 'State'},
        {id: 'zip', title: 'ZIP'},
        {id: 'phone', title: 'Phone'},
        {id: 'address', title: 'Address'},
        {id: 'website', title: 'Website'},
        {id: 'latitude', title: 'Latitude'},
        {id: 'longitude', title: 'Longitude'},
        {id: 'residential_services', title: 'Residential Services'},
        {id: 'all_services', title: 'All Services'}
      ]
    });

    await csvWriter.writeRecords(facilities);
    console.log(`Saved ${facilities.length} facilities to ${filepath}`);
  }

  /**
   * Main method to search and export residential facilities
   * @param {string} location - Search location
   * @param {Object} exportOptions - Export format options
   */
  async searchResidentialFacilities(location = "37.7749,-122.4194", exportOptions = {json: true, csv: true}) {
    try {
      // Fetch raw data
      const rawFacilities = await this.fetchFacilities(location);
      
      // Filter for residential facilities
      const residentialFacilities = this.filterResidentialFacilities(rawFacilities);
      
      console.log(`Found ${residentialFacilities.length} residential facilities`);
      
      // Export data
      if (exportOptions.json) {
        await this.saveToJson(residentialFacilities);
      }
      
      if (exportOptions.csv) {
        await this.saveToCsv(residentialFacilities);
      }
      
      return residentialFacilities;
    } catch (error) {
      console.error('Search failed:', error.message);
      throw error;
    }
  }
}

// CLI usage
if (require.main === module) {
  const finder = new SoberLivingFinder();
  
  // Get location from command line args or use default (SF)
  const location = process.argv[2] || "37.7749,-122.4194";
  
  finder.searchResidentialFacilities(location)
    .then(facilities => {
      console.log('\n=== SAMPLE RESULTS ===');
      facilities.slice(0, 3).forEach((facility, index) => {
        console.log(`\n${index + 1}. ${facility.name}`);
        console.log(`   City: ${facility.city}, ${facility.state}`);
        console.log(`   Phone: ${facility.phone}`);
        console.log(`   Services: ${facility.residential_services}`);
      });
      
      if (facilities.length > 3) {
        console.log(`\n... and ${facilities.length - 3} more facilities`);
        console.log('Check the data/ directory for complete results.');
      }
    })
    .catch(error => {
      console.error('Error:', error.message);
      process.exit(1);
    });
}

module.exports = SoberLivingFinder;