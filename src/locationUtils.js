/**
 * Utility functions for handling locations and coordinates
 */

const axios = require('axios');

class LocationUtils {
  /**
   * Convert address to coordinates using OpenStreetMap Nominatim API
   * @param {string} address - Address to geocode
   * @returns {Promise<{lat: number, lng: number}>} Coordinates
   */
  static async geocodeAddress(address) {
    try {
      const encodedAddress = encodeURIComponent(address);
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`;
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'SoberLivingFinder/1.0'
        }
      });

      if (!response.data || response.data.length === 0) {
        throw new Error(`No coordinates found for address: ${address}`);
      }

      const result = response.data[0];
      return {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        display_name: result.display_name
      };
    } catch (error) {
      throw new Error(`Geocoding failed: ${error.message}`);
    }
  }

  /**
   * Validate coordinate format
   * @param {string} coords - Coordinates in "lat,lng" format
   * @returns {boolean} Whether coordinates are valid
   */
  static isValidCoordinates(coords) {
    const coordRegex = /^-?\d+\.?\d*,-?\d+\.?\d*$/;
    if (!coordRegex.test(coords)) return false;

    const [lat, lng] = coords.split(',').map(parseFloat);
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  /**
   * Format location for API call
   * @param {string} location - Address or coordinates
   * @returns {Promise<string>} Formatted coordinates for API
   */
  static async formatLocationForAPI(location) {
    // Check if it's already coordinates
    if (this.isValidCoordinates(location)) {
      return location;
    }

    // Otherwise, geocode the address
    console.log(`Geocoding address: ${location}`);
    const coords = await this.geocodeAddress(location);
    console.log(`Found coordinates: ${coords.lat},${coords.lng} for "${coords.display_name}"`);
    
    return `${coords.lat},${coords.lng}`;
  }

  /**
   * Calculate distance between two points (Haversine formula)
   * @param {number} lat1 - Latitude of first point
   * @param {number} lng1 - Longitude of first point
   * @param {number} lat2 - Latitude of second point
   * @param {number} lng2 - Longitude of second point
   * @returns {number} Distance in miles
   */
  static calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   * @param {number} degrees - Degrees to convert
   * @returns {number} Radians
   */
  static toRadians(degrees) {
    return degrees * (Math.PI/180);
  }

  /**
   * Get major US cities with coordinates
   * @returns {Array<Object>} List of major cities
   */
  static getMajorCities() {
    return [
      { name: 'New York, NY', coords: '40.7128,-74.0060' },
      { name: 'Los Angeles, CA', coords: '34.0522,-118.2437' },
      { name: 'Chicago, IL', coords: '41.8781,-87.6298' },
      { name: 'Houston, TX', coords: '29.7604,-95.3698' },
      { name: 'Phoenix, AZ', coords: '33.4484,-112.0740' },
      { name: 'Philadelphia, PA', coords: '39.9526,-75.1652' },
      { name: 'San Antonio, TX', coords: '29.4241,-98.4936' },
      { name: 'San Diego, CA', coords: '32.7157,-117.1611' },
      { name: 'Dallas, TX', coords: '32.7767,-96.7970' },
      { name: 'San Jose, CA', coords: '37.3382,-121.8863' },
      { name: 'Austin, TX', coords: '30.2672,-97.7431' },
      { name: 'Jacksonville, FL', coords: '30.3322,-81.6557' },
      { name: 'San Francisco, CA', coords: '37.7749,-122.4194' },
      { name: 'Columbus, OH', coords: '39.9612,-82.9988' },
      { name: 'Indianapolis, IN', coords: '39.7684,-86.1581' },
      { name: 'Fort Worth, TX', coords: '32.7555,-97.3308' },
      { name: 'Charlotte, NC', coords: '35.2271,-80.8431' },
      { name: 'Seattle, WA', coords: '47.6062,-122.3321' },
      { name: 'Denver, CO', coords: '39.7392,-104.9903' },
      { name: 'Washington, DC', coords: '38.9072,-77.0369' },
      { name: 'Boston, MA', coords: '42.3601,-71.0589' },
      { name: 'Nashville, TN', coords: '36.1627,-86.7816' },
      { name: 'Baltimore, MD', coords: '39.2904,-76.6122' },
      { name: 'Oklahoma City, OK', coords: '35.4676,-97.5164' },
      { name: 'Portland, OR', coords: '45.5152,-122.6784' },
      { name: 'Las Vegas, NV', coords: '36.1699,-115.1398' },
      { name: 'Louisville, KY', coords: '38.2527,-85.7585' },
      { name: 'Milwaukee, WI', coords: '43.0389,-87.9065' },
      { name: 'Albuquerque, NM', coords: '35.0844,-106.6504' },
      { name: 'Tucson, AZ', coords: '32.2226,-110.9747' },
      { name: 'Fresno, CA', coords: '36.7378,-119.7871' },
      { name: 'Sacramento, CA', coords: '38.5816,-121.4944' },
      { name: 'Mesa, AZ', coords: '33.4164,-111.8312' },
      { name: 'Kansas City, MO', coords: '39.0997,-94.5786' },
      { name: 'Atlanta, GA', coords: '33.7490,-84.3880' },
      { name: 'Omaha, NE', coords: '41.2565,-95.9345' },
      { name: 'Colorado Springs, CO', coords: '38.8339,-104.8214' },
      { name: 'Raleigh, NC', coords: '35.7796,-78.6382' },
      { name: 'Miami, FL', coords: '25.7617,-80.1918' },
      { name: 'Virginia Beach, VA', coords: '36.8529,-75.9780' },
      { name: 'Oakland, CA', coords: '37.8044,-122.2711' },
      { name: 'Minneapolis, MN', coords: '44.9778,-93.2650' },
      { name: 'Tulsa, OK', coords: '36.1540,-95.9928' },
      { name: 'Wichita, KS', coords: '37.6872,-97.3301' },
      { name: 'New Orleans, LA', coords: '29.9511,-90.0715' }
    ];
  }
}

module.exports = LocationUtils;