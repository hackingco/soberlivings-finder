/**
 * Public API client for FindTreatment.gov
 * No API key required - uses public endpoints
 */

import axios from 'axios';
import { Logger } from './utils/logger';
import { mockFacilities } from './mockData';

const logger = new Logger('PublicAPI');

/**
 * Fetch facilities from FindTreatment.gov public API
 * Based on official API documentation v1.9
 */
export async function fetchPublicFacilities(options: {
  state?: string;
  city?: string;
  zip?: string;
  lat?: number;
  lng?: number;
  limit?: number;
}) {
  // Use the official API endpoint from documentation
  const baseUrl = 'https://findtreatment.gov/locator/exportsAsJson/v2';
  
  // Build location coordinates
  let sAddr = '';
  if (options.lat && options.lng) {
    sAddr = `${options.lng},${options.lat}`;
  } else if (options.zip) {
    // Use zip code center (would need geocoding in production)
    sAddr = '37.7749,-122.4194'; // Default to SF
  } else if (options.city && options.state) {
    // Default coordinates for major cities
    sAddr = '37.7749,-122.4194'; // Default to SF
  } else {
    // Default to California center
    sAddr = '37.7749,-122.4194';
  }
  
  // Build query parameters according to API spec
  const params: any = {
    sAddr: sAddr,
    limitType: 2, // Distance-based search
    limitValue: 50000, // 50km radius (about 31 miles)
    sType: 'sa', // Substance abuse facilities
    pageSize: options.limit || 100,
    page: 1,
    sort: 0 // Sort by nearest distance
  };
  
  try {
    logger.info(`Fetching from FindTreatment.gov API v2 with params:`, params);
    
    const response = await axios.get(baseUrl, { 
      params: params,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; ETL/1.0)'
      },
      timeout: 30000
    });
    
    if (response.data) {
      // The API returns data in a specific format
      const data = response.data;
      let facilities = [];
      
      // Handle the API response structure
      if (data.rows && Array.isArray(data.rows)) {
        facilities = data.rows;
        logger.info(`Received ${facilities.length} facilities from page ${data.page} of ${data.totalPages}`);
      } else if (Array.isArray(data)) {
        facilities = data;
        logger.info(`Received ${facilities.length} facilities`);
      }
      
      if (facilities.length > 0) {
        return facilities;
      }
    }
  } catch (error: any) {
    logger.warn(`Failed to fetch from FindTreatment.gov API:`, error.message);
  }
  
  // Fallback to mock data if API fails
  logger.warn('API failed, returning mock data');
  return mockFacilities.slice(0, options.limit || 10);
}

/**
 * Try alternative public endpoints
 */
async function tryAlternativeEndpoints(options: any) {
  const alternatives = [
    {
      url: 'https://findtreatment.samhsa.gov/locator/exportsAsJson',
      params: {
        sType: 'SA',
        sAddr: options.state || 'CA'
      }
    },
    {
      url: 'https://findtreatment.gov/api/facilities',
      params: {
        state: options.state || 'CA',
        limit: options.limit || 100
      }
    }
  ];
  
  for (const alt of alternatives) {
    try {
      logger.info(`Trying alternative endpoint: ${alt.url}`);
      const response = await axios.get(alt.url, { 
        params: alt.params,
        timeout: 10000,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (response.data) {
        return response.data;
      }
    } catch (error) {
      logger.warn(`Alternative endpoint failed: ${alt.url}`);
    }
  }
  
  logger.warn('All endpoints failed, returning empty array');
  return [];
}

/**
 * Transform public API response to our format
 */
export function transformPublicApiResponse(data: any): any[] {
  if (!data) return [];
  
  // Handle different response formats
  if (Array.isArray(data)) {
    return data.map(transformFacility);
  } else if (data.facilities) {
    return data.facilities.map(transformFacility);
  } else if (data.results) {
    return data.results.map(transformFacility);
  }
  
  return [];
}

/**
 * Transform a single facility from public API format
 * Based on the official API response structure
 */
function transformFacility(facility: any): any {
  return {
    // Map fields from API response
    id: facility._irow || facility.id || Math.random().toString(36),
    facilityName: facility.name1 || facility.facilityName || facility.name,
    name2: facility.name2, // Secondary name
    street1: facility.street1 || facility.address1 || facility.street,
    street2: facility.street2 || facility.address2,
    city: facility.city,
    state: facility.state,
    zip: facility.zip,
    phone: facility.phone || facility.phoneNumber,
    intake1: facility.intake1, // Intake phone
    hotline1: facility.hotline1, // Hotline phone
    website: facility.website || facility.url,
    
    // Coordinates
    latitude: parseFloat(facility.latitude) || facility.lat,
    longitude: parseFloat(facility.longitude) || facility.lng || facility.lon,
    
    // Distance from search point
    miles: facility.miles,
    
    // Facility type
    type_facility: facility.type_facility,
    
    // Services - may be in different formats
    services: parseServices(facility),
    
    // Treatment types
    detox: hasService(facility, 'detox') || facility.detox === '1',
    residential: hasService(facility, 'residential') || facility.residential === '1',
    outpatient: hasService(facility, 'outpatient') || facility.outpatient === '1',
    telehealth: hasService(facility, 'telehealth') || facility.telehealth === '1',
    
    // Insurance
    insurance: parseInsurance(facility),
    medicaid: hasInsurance(facility, 'medicaid') || facility.medicaid === '1',
    medicare: hasInsurance(facility, 'medicare') || facility.medicare === '1',
    privateInsurance: hasInsurance(facility, 'private') || facility.privateIns === '1',
    
    // Additional info
    facilityType: facility.facilityType || facility.typeLabel,
    verified: facility.verified || false,
    
    // Keep original data for reference
    _original: facility
  };
}

/**
 * Parse services from various formats
 */
function parseServices(facility: any): string[] {
  const services: string[] = [];
  
  // Check service fields
  const serviceFields = [
    'services', 'servicesCd', 'servicesProvided', 
    'typeServices', 'categories'
  ];
  
  for (const field of serviceFields) {
    if (facility[field]) {
      if (Array.isArray(facility[field])) {
        services.push(...facility[field]);
      } else if (typeof facility[field] === 'string') {
        services.push(...facility[field].split(/[,;|]/).map((s: string) => s.trim()));
      }
    }
  }
  
  // Check individual service flags
  if (facility.detox === '1') services.push('Detox');
  if (facility.residential === '1') services.push('Residential Treatment');
  if (facility.outpatient === '1') services.push('Outpatient');
  if (facility.mat === '1') services.push('Medication-Assisted Treatment');
  if (facility.telehealth === '1') services.push('Telehealth');
  
  return [...new Set(services)].filter(s => s);
}

/**
 * Parse insurance from various formats
 */
function parseInsurance(facility: any): string[] {
  const insurance: string[] = [];
  
  const insuranceFields = [
    'insurance', 'paymentTypes', 'paymentAccepted',
    'insuranceAccepted', 'payment'
  ];
  
  for (const field of insuranceFields) {
    if (facility[field]) {
      if (Array.isArray(facility[field])) {
        insurance.push(...facility[field]);
      } else if (typeof facility[field] === 'string') {
        insurance.push(...facility[field].split(/[,;|]/).map((i: string) => i.trim()));
      }
    }
  }
  
  // Check individual insurance flags
  if (facility.medicaid === '1') insurance.push('Medicaid');
  if (facility.medicare === '1') insurance.push('Medicare');
  if (facility.privateIns === '1') insurance.push('Private Insurance');
  if (facility.selfPay === '1') insurance.push('Self Pay');
  
  return [...new Set(insurance)].filter(i => i);
}

/**
 * Check if facility has a specific service
 */
function hasService(facility: any, service: string): boolean {
  const services = parseServices(facility);
  return services.some(s => 
    s.toLowerCase().includes(service.toLowerCase())
  );
}

/**
 * Check if facility accepts specific insurance
 */
function hasInsurance(facility: any, insurance: string): boolean {
  const accepted = parseInsurance(facility);
  return accepted.some(i => 
    i.toLowerCase().includes(insurance.toLowerCase())
  );
}