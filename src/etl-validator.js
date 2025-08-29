#!/usr/bin/env node
/**
 * ETL Data Validation and Quality Assurance Module
 * Provides comprehensive validation, sanitization, and quality scoring
 */

const winston = require('winston');
const crypto = require('crypto');

// Validation configuration
const VALIDATION_CONFIG = {
  REQUIRED_FIELDS: ['name_facility', 'city', 'state'],
  OPTIONAL_FIELDS: ['street1', 'zip', 'phone', 'website', 'latitude', 'longitude'],
  QUALITY_WEIGHTS: {
    name: 25,
    address: 20,
    contact: 20,
    location: 15,
    services: 10,
    insurance: 10
  },
  PHONE_REGEX: /^[\+]?[1-9]?[\d\s\-\(\)]{10,15}$/,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  URL_REGEX: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
  US_STATES: [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
  ]
};

// Logger for validation
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/etl-validation.log' }),
    new winston.transports.Console({ level: 'warn' })
  ]
});

// Validation statistics
const validationStats = {
  totalProcessed: 0,
  validRecords: 0,
  invalidRecords: 0,
  warnings: 0,
  errors: 0,
  qualityScores: [],
  errorTypes: new Map(),
  warningTypes: new Map()
};

/**
 * Main facility validation function
 */
function validateFacility(facility, location, options = {}) {
  const validationResult = {
    isValid: false,
    facility: null,
    errors: [],
    warnings: [],
    qualityScore: 0,
    validationId: generateValidationId(facility),
    timestamp: new Date().toISOString()
  };
  
  validationStats.totalProcessed++;
  
  try {
    // Step 1: Required field validation
    const requiredFieldsResult = validateRequiredFields(facility, location);
    if (requiredFieldsResult.errors.length > 0) {
      validationResult.errors.push(...requiredFieldsResult.errors);
      validationStats.invalidRecords++;
      recordValidationResults(validationResult);
      return validationResult;
    }
    
    // Step 2: Data type validation
    const dataTypeResult = validateDataTypes(facility);
    validationResult.errors.push(...dataTypeResult.errors);
    validationResult.warnings.push(...dataTypeResult.warnings);
    
    // Step 3: Business logic validation
    const businessResult = validateBusinessLogic(facility, location);
    validationResult.errors.push(...businessResult.errors);
    validationResult.warnings.push(...businessResult.warnings);
    
    // Step 4: Data quality validation
    const qualityResult = validateDataQuality(facility);
    validationResult.warnings.push(...qualityResult.warnings);
    
    // If no critical errors, transform the facility
    if (validationResult.errors.length === 0) {
      validationResult.facility = transformAndSanitizeFacility(facility, location, options);
      validationResult.qualityScore = calculateQualityScore(validationResult.facility);
      validationResult.isValid = true;
      validationStats.validRecords++;
    } else {
      validationStats.invalidRecords++;
    }
    
    // Update statistics
    validationStats.warnings += validationResult.warnings.length;
    validationStats.errors += validationResult.errors.length;
    
    if (validationResult.qualityScore > 0) {
      validationStats.qualityScores.push(validationResult.qualityScore);
    }
    
    recordValidationResults(validationResult);
    
  } catch (error) {
    validationResult.errors.push({
      type: 'VALIDATION_ERROR',
      message: `Validation process failed: ${error.message}`,
      field: 'system',
      severity: 'critical'
    });
    
    validationStats.invalidRecords++;
    logger.error('Validation process error', {
      facility: facility?.name_facility,
      error: error.message,
      validationId: validationResult.validationId
    });
  }
  
  return validationResult;
}

/**
 * Validate required fields
 */
function validateRequiredFields(facility, location) {
  const result = { errors: [], warnings: [] };
  
  // Check facility name
  if (!facility.name_facility || facility.name_facility.trim().length === 0) {
    result.errors.push({
      type: 'MISSING_REQUIRED_FIELD',
      message: 'Facility name is required',
      field: 'name_facility',
      severity: 'critical'
    });
  }
  
  // Check location information
  if (!facility.city && !location?.name) {
    result.errors.push({
      type: 'MISSING_LOCATION_INFO',
      message: 'City information is required',
      field: 'city',
      severity: 'critical'
    });
  }
  
  // Check state
  if (!facility.state && !location?.state) {
    result.errors.push({
      type: 'MISSING_STATE_INFO',
      message: 'State information is required',
      field: 'state',
      severity: 'critical'
    });
  }
  
  return result;
}

/**
 * Validate data types and formats
 */
function validateDataTypes(facility) {
  const result = { errors: [], warnings: [] };
  
  // Validate coordinates
  if (facility.latitude !== undefined && facility.latitude !== null) {
    const lat = parseFloat(facility.latitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      result.warnings.push({
        type: 'INVALID_LATITUDE',
        message: `Invalid latitude value: ${facility.latitude}`,
        field: 'latitude',
        severity: 'warning'
      });
    }
  }
  
  if (facility.longitude !== undefined && facility.longitude !== null) {
    const lon = parseFloat(facility.longitude);
    if (isNaN(lon) || lon < -180 || lon > 180) {
      result.warnings.push({
        type: 'INVALID_LONGITUDE',
        message: `Invalid longitude value: ${facility.longitude}`,
        field: 'longitude',
        severity: 'warning'
      });
    }
  }
  
  // Validate phone number
  if (facility.phone && !VALIDATION_CONFIG.PHONE_REGEX.test(facility.phone)) {
    result.warnings.push({
      type: 'INVALID_PHONE_FORMAT',
      message: `Phone number format may be invalid: ${facility.phone}`,
      field: 'phone',
      severity: 'warning'
    });
  }
  
  // Validate website URL
  if (facility.website && !VALIDATION_CONFIG.URL_REGEX.test(facility.website)) {
    // Try to fix common URL issues
    const fixedUrl = fixCommonUrlIssues(facility.website);
    if (VALIDATION_CONFIG.URL_REGEX.test(fixedUrl)) {
      facility.website = fixedUrl; // Auto-fix
    } else {
      result.warnings.push({
        type: 'INVALID_URL_FORMAT',
        message: `Website URL format may be invalid: ${facility.website}`,
        field: 'website',
        severity: 'warning'
      });
    }
  }
  
  // Validate ZIP code
  if (facility.zip && !/^\d{5}(-\d{4})?$/.test(facility.zip)) {
    result.warnings.push({
      type: 'INVALID_ZIP_FORMAT',
      message: `ZIP code format may be invalid: ${facility.zip}`,
      field: 'zip',
      severity: 'warning'
    });
  }
  
  return result;
}

/**
 * Validate business logic rules
 */
function validateBusinessLogic(facility, location) {
  const result = { errors: [], warnings: [] };
  
  // Validate state codes
  const facilityState = facility.state || location?.state;
  if (facilityState && !VALIDATION_CONFIG.US_STATES.includes(facilityState.toUpperCase())) {
    result.warnings.push({
      type: 'INVALID_STATE_CODE',
      message: `Unrecognized state code: ${facilityState}`,
      field: 'state',
      severity: 'warning'
    });
  }
  
  // Check for reasonable facility name length
  if (facility.name_facility && facility.name_facility.length > 200) {
    result.warnings.push({
      type: 'LONG_FACILITY_NAME',
      message: `Facility name is unusually long (${facility.name_facility.length} characters)`,
      field: 'name_facility',
      severity: 'warning'
    });
  }
  
  // Check for obviously invalid data
  if (facility.name_facility && facility.name_facility.toLowerCase().includes('test')) {
    result.warnings.push({
      type: 'POSSIBLE_TEST_DATA',
      message: 'Facility name contains "test" - may be test data',
      field: 'name_facility',
      severity: 'warning'
    });
  }
  
  // Validate coordinate consistency with location
  if (facility.latitude && facility.longitude && location) {
    const distance = calculateDistance(
      parseFloat(facility.latitude),
      parseFloat(facility.longitude),
      location.lat,
      location.lon
    );
    
    // Flag if facility is more than 200 miles from search location
    if (distance > 200) {
      result.warnings.push({
        type: 'LOCATION_INCONSISTENCY',
        message: `Facility location is ${distance.toFixed(0)} miles from search location`,
        field: 'coordinates',
        severity: 'warning'
      });
    }
  }
  
  return result;
}

/**
 * Validate data quality indicators
 */
function validateDataQuality(facility) {
  const result = { errors: [], warnings: [] };
  
  // Check for missing contact information
  if (!facility.phone && !facility.website) {
    result.warnings.push({
      type: 'MISSING_CONTACT_INFO',
      message: 'No phone number or website provided',
      field: 'contact',
      severity: 'warning'
    });
  }
  
  // Check for missing address information
  if (!facility.street1 && !facility.zip) {
    result.warnings.push({
      type: 'INCOMPLETE_ADDRESS',
      message: 'Missing street address and ZIP code',
      field: 'address',
      severity: 'warning'
    });
  }
  
  // Check for missing service information
  if (!facility.type_facility && !facility.service_codes) {
    result.warnings.push({
      type: 'MISSING_SERVICE_INFO',
      message: 'No service type or service codes provided',
      field: 'services',
      severity: 'warning'
    });
  }
  
  return result;
}

/**
 * Transform and sanitize facility data
 */
function transformAndSanitizeFacility(facility, location, options) {
  const sanitized = {
    // Core identification
    id: generateFacilityId(facility, location),
    name: sanitizeString(facility.name_facility),
    
    // Address information
    street: sanitizeString(facility.street1 || ''),
    city: sanitizeString(facility.city || location?.name || ''),
    state: sanitizeString(facility.state || location?.state || '').toUpperCase(),
    zip: sanitizeZipCode(facility.zip || ''),
    
    // Contact information
    phone: formatPhoneNumber(facility.phone || ''),
    website: sanitizeUrl(facility.website || ''),
    
    // Geographic coordinates
    latitude: sanitizeCoordinate(facility.latitude, location?.lat),
    longitude: sanitizeCoordinate(facility.longitude, location?.lon),
    
    // Service information
    residentialServices: sanitizeString(facility.type_facility || ''),
    allServices: sanitizeString(facility.type_facility || ''),
    services: extractServices(facility),
    
    // Enhanced metadata
    description: generateDescription(facility, location),
    capacity: null, // Not available in source data
    amenities: [],
    acceptedInsurance: extractInsurance(facility),
    programs: extractPrograms(facility),
    
    // Quality and tracking
    verified: true,
    lastUpdated: new Date().toISOString(),
    dataSource: 'findtreatment.gov',
    qualityScore: 0, // Will be calculated separately
    
    // Validation metadata
    validationId: generateValidationId(facility),
    processingFlags: generateProcessingFlags(facility, location)
  };
  
  return sanitized;
}

/**
 * Calculate comprehensive quality score
 */
function calculateQualityScore(facility) {
  let score = 0;
  const weights = VALIDATION_CONFIG.QUALITY_WEIGHTS;
  
  // Name quality (25 points)
  if (facility.name && facility.name.length > 5) {
    score += weights.name;
  } else if (facility.name) {
    score += weights.name * 0.5;
  }
  
  // Address quality (20 points)
  let addressScore = 0;
  if (facility.street) addressScore += 7;
  if (facility.city) addressScore += 7;
  if (facility.zip) addressScore += 6;
  score += Math.min(addressScore, weights.address);
  
  // Contact quality (20 points)
  let contactScore = 0;
  if (facility.phone) contactScore += 10;
  if (facility.website) contactScore += 10;
  score += Math.min(contactScore, weights.contact);
  
  // Location quality (15 points)
  if (facility.latitude && facility.longitude) {
    score += weights.location;
  }
  
  // Services quality (10 points)
  if (facility.services && facility.services.length > 0) {
    score += weights.services;
  } else if (facility.residentialServices || facility.allServices) {
    score += weights.services * 0.5;
  }
  
  // Insurance quality (10 points)
  if (facility.acceptedInsurance && facility.acceptedInsurance.length > 0) {
    score += weights.insurance;
  }
  
  return Math.round(score);
}

/**
 * Utility functions
 */

function generateValidationId(facility) {
  const key = `${facility.name_facility || 'unknown'}-${Date.now()}-${Math.random()}`;
  return crypto.createHash('md5').update(key).digest('hex').substring(0, 12);
}

function generateFacilityId(facility, location) {
  const name = (facility.name_facility || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const city = ((facility.city || location?.name) || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const state = ((facility.state || location?.state) || '').toLowerCase();
  
  const baseId = `${state}-${city}-${name}`;
  const hash = crypto.createHash('md5').update(baseId).digest('hex').substring(0, 8);
  
  return `${state}-${hash}`.substring(0, 50);
}

function sanitizeString(str) {
  if (!str) return '';
  return str.trim()
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .substring(0, 255); // Limit length
}

function sanitizeZipCode(zip) {
  if (!zip) return '';
  const cleaned = zip.replace(/[^\d-]/g, '');
  return /^\d{5}(-\d{4})?$/.test(cleaned) ? cleaned : '';
}

function sanitizeCoordinate(coord, fallback) {
  if (coord === undefined || coord === null) return fallback || null;
  
  const num = parseFloat(coord);
  if (isNaN(num)) return fallback || null;
  
  return num;
}

function sanitizeUrl(url) {
  if (!url) return '';
  
  // Fix common URL issues
  const fixed = fixCommonUrlIssues(url);
  
  try {
    new URL(fixed);
    return fixed;
  } catch {
    return '';
  }
}

function fixCommonUrlIssues(url) {
  if (!url) return '';
  
  let fixed = url.trim();
  
  // Add protocol if missing
  if (!fixed.match(/^https?:\/\//)) {
    fixed = `https://${fixed}`;
  }
  
  // Remove common suffixes that break URLs
  fixed = fixed.replace(/[.,;]$/, '');
  
  return fixed;
}

function formatPhoneNumber(phone) {
  if (!phone) return '';
  
  const digits = phone.replace(/[^0-9]/g, '');
  
  if (digits.length === 10) {
    return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
  }
  
  return phone; // Return original if can't format
}

function extractServices(facility) {
  const services = [];
  const serviceText = (facility.service_codes || []).join(' ').toLowerCase();
  const facilityType = (facility.type_facility || '').toLowerCase();
  
  const serviceMap = {
    'residential': ['rt', 'residential', 'inpatient'],
    'outpatient': ['op', 'outpatient'],
    'transitional': ['hh', 'halfway', 'transitional', 'sober living'],
    'detox': ['dt', 'detox', 'detoxification'],
    'medication_assisted': ['mm', 'medication', 'methadone', 'suboxone'],
    'co_occurring': ['ct', 'co-occurring', 'dual diagnosis', 'mental health']
  };
  
  for (const [serviceType, keywords] of Object.entries(serviceMap)) {
    if (keywords.some(keyword => serviceText.includes(keyword) || facilityType.includes(keyword))) {
      services.push(serviceType);
    }
  }
  
  return services.length > 0 ? services : ['treatment'];
}

function extractInsurance(facility) {
  if (!facility.payment_types) return [];
  
  const payments = facility.payment_types.toLowerCase();
  const insurance = [];
  
  const insuranceMap = {
    'Medicare': ['medicare'],
    'Medicaid': ['medicaid'],
    'Private Insurance': ['private', 'insurance', 'commercial'],
    'Self-Pay': ['cash', 'self-pay', 'self pay', 'private pay'],
    'Military Insurance': ['military', 'tricare', 'va', 'veterans']
  };
  
  for (const [insuranceType, keywords] of Object.entries(insuranceMap)) {
    if (keywords.some(keyword => payments.includes(keyword))) {
      insurance.push(insuranceType);
    }
  }
  
  return insurance;
}

function extractPrograms(facility) {
  const programs = [];
  const facilityType = (facility.type_facility || '').toLowerCase();
  
  if (facilityType.includes('adolescent') || facilityType.includes('youth')) {
    programs.push('Youth/Adolescent');
  }
  
  if (facilityType.includes('women') || facilityType.includes('female')) {
    programs.push('Women-Only');
  }
  
  if (facilityType.includes('men') || facilityType.includes('male')) {
    programs.push('Men-Only');
  }
  
  if (facilityType.includes('lgbtq') || facilityType.includes('lgbt')) {
    programs.push('LGBTQ-Friendly');
  }
  
  return programs;
}

function generateDescription(facility, location) {
  const name = facility.name_facility;
  const services = facility.type_facility || 'treatment services';
  const city = facility.city || location?.name;
  const state = facility.state || location?.state;
  
  return `${name} provides ${services} in ${city}, ${state}.`;
}

function generateProcessingFlags(facility, location) {
  const flags = [];
  
  if (!facility.phone && !facility.website) flags.push('missing_contact');
  if (!facility.street1) flags.push('missing_address');
  if (!facility.latitude || !facility.longitude) flags.push('missing_coordinates');
  if (!facility.type_facility) flags.push('missing_services');
  
  return flags;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function recordValidationResults(result) {
  // Record error types
  result.errors.forEach(error => {
    const count = validationStats.errorTypes.get(error.type) || 0;
    validationStats.errorTypes.set(error.type, count + 1);
  });
  
  // Record warning types
  result.warnings.forEach(warning => {
    const count = validationStats.warningTypes.get(warning.type) || 0;
    validationStats.warningTypes.set(warning.type, count + 1);
  });
  
  // Log significant issues
  if (result.errors.length > 0) {
    logger.warn('Facility validation failed', {
      validationId: result.validationId,
      errors: result.errors.length,
      warnings: result.warnings.length
    });
  }
}

/**
 * Get validation statistics
 */
function getValidationStatistics() {
  return {
    ...validationStats,
    averageQualityScore: validationStats.qualityScores.length > 0 ?
      validationStats.qualityScores.reduce((a, b) => a + b, 0) / validationStats.qualityScores.length : 0,
    successRate: validationStats.totalProcessed > 0 ?
      (validationStats.validRecords / validationStats.totalProcessed * 100) : 0,
    errorBreakdown: Object.fromEntries(validationStats.errorTypes),
    warningBreakdown: Object.fromEntries(validationStats.warningTypes),
    timestamp: new Date().toISOString()
  };
}

/**
 * Reset validation statistics
 */
function resetValidationStatistics() {
  validationStats.totalProcessed = 0;
  validationStats.validRecords = 0;
  validationStats.invalidRecords = 0;
  validationStats.warnings = 0;
  validationStats.errors = 0;
  validationStats.qualityScores = [];
  validationStats.errorTypes.clear();
  validationStats.warningTypes.clear();
}

// Export functions
module.exports = {
  validateFacility,
  getValidationStatistics,
  resetValidationStatistics,
  calculateQualityScore,
  sanitizeString,
  formatPhoneNumber,
  VALIDATION_CONFIG
};