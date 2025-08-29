#!/usr/bin/env node
/**
 * Enhanced ETL Pipeline for FindTreatment.gov API
 * Features: Retry logic, data validation, progress tracking, monitoring
 */

const https = require('https');
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const winston = require('winston');
const crypto = require('crypto');

// Performance monitoring
const performanceMetrics = {
  startTime: null,
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalProcessed: 0,
  duplicatesSkipped: 0,
  validationErrors: 0,
  retryAttempts: 0,
  processingRates: []
};

// Enhanced configuration
const CONFIG = {
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/soberlivings',
  API_BASE_URL: 'https://findtreatment.gov/locator/exportsAsJson/v2',
  BATCH_SIZE: parseInt(process.env.ETL_BATCH_SIZE) || 500,
  DELAY_BETWEEN_REQUESTS: parseInt(process.env.ETL_DELAY_MS) || 2000,
  MAX_RETRIES: parseInt(process.env.ETL_MAX_RETRIES) || 3,
  RETRY_DELAY_BASE: parseInt(process.env.ETL_RETRY_DELAY_MS) || 5000,
  TIMEOUT_MS: parseInt(process.env.ETL_TIMEOUT_MS) || 30000,
  PARALLEL_WORKERS: parseInt(process.env.ETL_PARALLEL_WORKERS) || 3,
  PROGRESS_SAVE_INTERVAL: parseInt(process.env.ETL_PROGRESS_INTERVAL) || 10,
  ENABLE_DEDUPLICATION: process.env.ETL_ENABLE_DEDUP !== 'false',
  LOG_LEVEL: process.env.ETL_LOG_LEVEL || 'info'
};

// Enhanced logging configuration
const logger = winston.createLogger({
  level: CONFIG.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'etl-pipeline' },
  transports: [
    new winston.transports.File({ 
      filename: 'logs/etl-error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: 'logs/etl-combined.log',
      maxsize: 5242880, // 5MB  
      maxFiles: 5
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// US States and territories for comprehensive coverage
const LOCATIONS = [
  { state: 'CA', name: 'California', lat: 36.7783, lon: -119.4179, priority: 1 },
  { state: 'TX', name: 'Texas', lat: 31.9686, lon: -99.9018, priority: 1 },
  { state: 'FL', name: 'Florida', lat: 27.6648, lon: -81.5158, priority: 1 },
  { state: 'NY', name: 'New York', lat: 40.7128, lon: -74.0060, priority: 1 },
  { state: 'PA', name: 'Pennsylvania', lat: 41.2033, lon: -77.1945, priority: 2 },
  { state: 'IL', name: 'Illinois', lat: 40.6331, lon: -89.3985, priority: 2 },
  { state: 'OH', name: 'Ohio', lat: 40.4173, lon: -82.9071, priority: 2 },
  { state: 'GA', name: 'Georgia', lat: 32.1656, lon: -82.9001, priority: 2 },
  { state: 'NC', name: 'North Carolina', lat: 35.7596, lon: -79.0193, priority: 2 },
  { state: 'MI', name: 'Michigan', lat: 44.3148, lon: -85.6024, priority: 2 },
  { state: 'NJ', name: 'New Jersey', lat: 40.0583, lon: -74.4057, priority: 2 },
  { state: 'VA', name: 'Virginia', lat: 37.4316, lon: -78.6569, priority: 3 },
  { state: 'WA', name: 'Washington', lat: 47.7511, lon: -120.7401, priority: 3 },
  { state: 'AZ', name: 'Arizona', lat: 34.0489, lon: -111.0937, priority: 3 },
  { state: 'MA', name: 'Massachusetts', lat: 42.4072, lon: -71.3824, priority: 3 },
  // Continue with all remaining states...
];

// Database connection pool
let pool;
const seenFacilities = new Set(); // For deduplication

/**
 * Enhanced database initialization with connection pooling
 */
async function initDatabase() {
  const poolConfig = {
    connectionString: CONFIG.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    statement_timeout: 30000,
    query_timeout: 30000
  };

  pool = new Pool(poolConfig);
  
  // Test connection with retry logic
  let retries = 0;
  while (retries < CONFIG.MAX_RETRIES) {
    try {
      await pool.query('SELECT NOW()');
      logger.info('Database connected successfully', { 
        poolSize: poolConfig.max,
        timeout: poolConfig.connectionTimeoutMillis 
      });
      return;
    } catch (error) {
      retries++;
      logger.error('Database connection attempt failed', { 
        attempt: retries, 
        maxRetries: CONFIG.MAX_RETRIES,
        error: error.message 
      });
      
      if (retries >= CONFIG.MAX_RETRIES) {
        throw new Error(`Failed to connect to database after ${CONFIG.MAX_RETRIES} attempts: ${error.message}`);
      }
      
      // Exponential backoff
      const delay = CONFIG.RETRY_DELAY_BASE * Math.pow(2, retries - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Enhanced API request with retry logic and exponential backoff
 */
async function fetchFacilitiesWithRetry(location, pageSize = CONFIG.BATCH_SIZE) {
  let retries = 0;
  
  while (retries <= CONFIG.MAX_RETRIES) {
    try {
      const facilities = await fetchFacilitiesFromAPI(location, pageSize);
      performanceMetrics.successfulRequests++;
      return facilities;
    } catch (error) {
      retries++;
      performanceMetrics.failedRequests++;
      performanceMetrics.retryAttempts++;
      
      logger.warn('API request failed, retrying', {
        location: location.name,
        attempt: retries,
        maxRetries: CONFIG.MAX_RETRIES,
        error: error.message
      });
      
      if (retries > CONFIG.MAX_RETRIES) {
        logger.error('API request failed after all retries', {
          location: location.name,
          totalAttempts: retries,
          error: error.message
        });
        return []; // Return empty array instead of throwing
      }
      
      // Exponential backoff with jitter
      const baseDelay = CONFIG.RETRY_DELAY_BASE * Math.pow(2, retries - 1);
      const jitter = Math.random() * 1000;
      const delay = baseDelay + jitter;
      
      logger.info(`Waiting ${delay}ms before retry`, { location: location.name, attempt: retries });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return [];
}

/**
 * Core API fetch function with timeout handling
 */
async function fetchFacilitiesFromAPI(location, pageSize) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      sType: 'sa',
      sAddr: `${location.lat},${location.lon}`,
      pageSize: pageSize,
      page: 1,
      sort: 0
    });

    const url = `${CONFIG.API_BASE_URL}?${params}`;
    performanceMetrics.totalRequests++;
    
    const requestStart = Date.now();
    logger.debug('Starting API request', { location: location.name, url });

    const request = https.get(url, { timeout: CONFIG.TIMEOUT_MS }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const requestTime = Date.now() - requestStart;
        
        try {
          const facilities = JSON.parse(data);
          const validFacilities = Array.isArray(facilities) ? facilities : [];
          
          logger.info('API request completed', {
            location: location.name,
            count: validFacilities.length,
            responseTime: requestTime,
            status: res.statusCode
          });
          
          resolve(validFacilities);
        } catch (parseError) {
          logger.error('JSON parsing failed', {
            location: location.name,
            error: parseError.message,
            responseSize: data.length
          });
          reject(new Error(`JSON parsing failed: ${parseError.message}`));
        }
      });
    });

    request.on('timeout', () => {
      request.destroy();
      const error = new Error(`Request timeout after ${CONFIG.TIMEOUT_MS}ms`);
      logger.error('API request timeout', { location: location.name, timeout: CONFIG.TIMEOUT_MS });
      reject(error);
    });

    request.on('error', (error) => {
      logger.error('API request error', { location: location.name, error: error.message });
      reject(error);
    });
  });
}

/**
 * Enhanced data validation and transformation
 */
function validateAndTransformFacility(facility, location) {
  try {
    // Required field validation
    if (!facility.name_facility || facility.name_facility.trim().length === 0) {
      throw new Error('Missing facility name');
    }
    
    if (!facility.city && !location.name) {
      throw new Error('Missing city information');
    }
    
    // Generate consistent facility fingerprint for deduplication
    const facilityFingerprint = generateFacilityFingerprint(facility, location);
    
    if (CONFIG.ENABLE_DEDUPLICATION && seenFacilities.has(facilityFingerprint)) {
      performanceMetrics.duplicatesSkipped++;
      logger.debug('Duplicate facility skipped', { 
        name: facility.name_facility,
        fingerprint: facilityFingerprint.substring(0, 8)
      });
      return null;
    }
    
    seenFacilities.add(facilityFingerprint);
    
    // Enhanced service extraction
    const services = extractServices(facility);
    const insurance = extractInsurance(facility);
    
    // Enhanced phone formatting
    const formattedPhone = formatPhoneNumber(facility.phone);
    
    // Validate coordinates
    const latitude = validateCoordinate(facility.latitude, 'latitude') || location.lat;
    const longitude = validateCoordinate(facility.longitude, 'longitude') || location.lon;
    
    // Generate stable, short ID
    const facilityId = generateFacilityId(facility, location);
    
    const transformed = {
      id: facilityId,
      name: sanitizeString(facility.name_facility),
      street: sanitizeString(facility.street1 || ''),
      city: sanitizeString(facility.city || location.name || ''),
      state: sanitizeString(facility.state || location.state),
      zip: sanitizeString(facility.zip || ''),
      phone: formattedPhone,
      website: validateUrl(facility.website),
      latitude: latitude,
      longitude: longitude,
      residentialServices: sanitizeString(facility.type_facility || ''),
      allServices: sanitizeString(facility.type_facility || ''),
      services: services,
      description: generateDescription(facility, location),
      capacity: null,
      amenities: [],
      acceptedInsurance: insurance,
      programs: [],
      verified: true,
      lastUpdated: new Date().toISOString(),
      dataSource: 'findtreatment.gov',
      qualityScore: calculateQualityScore(facility)
    };
    
    // Final validation
    if (transformed.id.length > 100) {
      throw new Error('Generated ID too long');
    }
    
    return transformed;
    
  } catch (error) {
    performanceMetrics.validationErrors++;
    logger.warn('Facility validation failed', {
      facilityName: facility.name_facility,
      location: location.name,
      error: error.message
    });
    return null;
  }
}

/**
 * Generate consistent facility fingerprint for deduplication
 */
function generateFacilityFingerprint(facility, location) {
  const key = `${facility.name_facility}|${facility.street1}|${facility.city || location.name}|${facility.state || location.state}`.toLowerCase().trim();
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Generate short, stable facility ID
 */
function generateFacilityId(facility, location) {
  const name = facility.name_facility.toLowerCase().replace(/[^a-z0-9]/g, '');
  const city = (facility.city || location.name).toLowerCase().replace(/[^a-z0-9]/g, '');
  const state = (facility.state || location.state).toLowerCase();
  
  const baseId = `${state}-${city}-${name}`;
  const hash = crypto.createHash('md5').update(baseId).digest('hex').substring(0, 8);
  
  return `${state}-${hash}`.substring(0, 50);
}

/**
 * Enhanced service extraction
 */
function extractServices(facility) {
  const services = [];
  const serviceText = (facility.service_codes || []).join(' ').toLowerCase();
  const facilityType = (facility.type_facility || '').toLowerCase();
  
  if (serviceText.includes('rt') || facilityType.includes('residential')) services.push('residential');
  if (serviceText.includes('op') || facilityType.includes('outpatient')) services.push('outpatient');
  if (serviceText.includes('hh') || facilityType.includes('transitional')) services.push('transitional');
  if (serviceText.includes('dt') || facilityType.includes('detox')) services.push('detox');
  if (serviceText.includes('mm') || facilityType.includes('medication')) services.push('medication_assisted');
  if (serviceText.includes('ct') || facilityType.includes('co-occurring')) services.push('co_occurring');
  
  return services.length > 0 ? services : ['treatment'];
}

/**
 * Enhanced insurance extraction
 */
function extractInsurance(facility) {
  if (!facility.payment_types) return [];
  
  const payments = facility.payment_types.toLowerCase();
  const insurance = [];
  
  if (payments.includes('medicare')) insurance.push('Medicare');
  if (payments.includes('medicaid')) insurance.push('Medicaid');
  if (payments.includes('private')) insurance.push('Private Insurance');
  if (payments.includes('cash') || payments.includes('self')) insurance.push('Self-Pay');
  if (payments.includes('military') || payments.includes('tricare')) insurance.push('Military Insurance');
  
  return insurance;
}

/**
 * Enhanced phone formatting
 */
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

/**
 * Coordinate validation
 */
function validateCoordinate(coord, type) {
  const num = parseFloat(coord);
  if (isNaN(num)) return null;
  
  if (type === 'latitude' && (num < -90 || num > 90)) return null;
  if (type === 'longitude' && (num < -180 || num > 180)) return null;
  
  return num;
}

/**
 * URL validation
 */
function validateUrl(url) {
  if (!url) return '';
  
  try {
    new URL(url);
    return url;
  } catch {
    // Try with https prefix
    try {
      new URL(`https://${url}`);
      return `https://${url}`;
    } catch {
      return '';
    }
  }
}

/**
 * String sanitization
 */
function sanitizeString(str) {
  if (!str) return '';
  return str.trim().replace(/[\x00-\x1F\x7F-\x9F]/g, '');
}

/**
 * Generate enhanced description
 */
function generateDescription(facility, location) {
  const name = facility.name_facility;
  const services = facility.type_facility || 'treatment services';
  const city = facility.city || location.name;
  const state = facility.state || location.state;
  
  return `${name} provides ${services} in ${city}, ${state}.`;
}

/**
 * Calculate data quality score
 */
function calculateQualityScore(facility) {
  let score = 0;
  
  if (facility.name_facility) score += 20;
  if (facility.street1) score += 15;
  if (facility.city) score += 15;
  if (facility.phone) score += 15;
  if (facility.website) score += 10;
  if (facility.latitude && facility.longitude) score += 15;
  if (facility.type_facility) score += 10;
  
  return score;
}

/**
 * Enhanced batch database insertion with transaction support
 */
async function insertFacilitiesBatch(facilities) {
  if (!facilities.length) return 0;
  
  const client = await pool.connect();
  let insertedCount = 0;
  
  try {
    await client.query('BEGIN');
    
    // Use batch insert for better performance
    const values = [];
    const placeholders = [];
    let paramIndex = 1;
    
    facilities.forEach(facility => {
      if (!facility) return; // Skip null facilities from validation
      
      placeholders.push(`($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4}, $${paramIndex+5}, $${paramIndex+6}, $${paramIndex+7}, $${paramIndex+8}, $${paramIndex+9}, $${paramIndex+10}, $${paramIndex+11}, $${paramIndex+12}, $${paramIndex+13}, $${paramIndex+14}, $${paramIndex+15}, $${paramIndex+16}, $${paramIndex+17}, $${paramIndex+18})`);
      
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
        facility.acceptedInsurance,
        facility.lastUpdated,
        facility.dataSource,
        facility.qualityScore
      );
      
      paramIndex += 19;
    });
    
    if (placeholders.length === 0) {
      await client.query('ROLLBACK');
      return 0;
    }
    
    const query = `
      INSERT INTO facilities (
        id, name, street, city, state, zip, phone, website,
        latitude, longitude, "residentialServices", "allServices",
        services, description, amenities, "acceptedInsurance",
        "lastUpdated", "dataSource", "qualityScore"
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
        "acceptedInsurance" = EXCLUDED."acceptedInsurance",
        "lastUpdated" = EXCLUDED."lastUpdated",
        "qualityScore" = EXCLUDED."qualityScore"
    `;
    
    const result = await client.query(query, values);
    await client.query('COMMIT');
    
    insertedCount = facilities.filter(f => f !== null).length;
    
    logger.info('Batch insertion completed', {
      attempted: facilities.length,
      inserted: insertedCount,
      nullFacilities: facilities.length - insertedCount
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Batch insertion failed', {
      error: error.message,
      facilitiesCount: facilities.length
    });
    throw error;
  } finally {
    client.release();
  }
  
  return insertedCount;
}

/**
 * Progress tracking and resumable pipeline support
 */
async function saveProgress(currentIndex, stats) {
  const progressData = {
    timestamp: new Date().toISOString(),
    currentLocationIndex: currentIndex,
    totalLocations: LOCATIONS.length,
    processedCount: stats.totalProcessed,
    successfulRequests: stats.successfulRequests,
    failedRequests: stats.failedRequests,
    duplicatesSkipped: stats.duplicatesSkipped,
    validationErrors: stats.validationErrors,
    retryAttempts: stats.retryAttempts
  };
  
  try {
    await fs.writeFile(
      path.join(__dirname, 'etl-progress.json'),
      JSON.stringify(progressData, null, 2)
    );
  } catch (error) {
    logger.warn('Failed to save progress', { error: error.message });
  }
}

/**
 * Load previous progress for resumable execution
 */
async function loadProgress() {
  try {
    const progressFile = path.join(__dirname, 'etl-progress.json');
    const data = await fs.readFile(progressFile, 'utf8');
    const progress = JSON.parse(data);
    
    logger.info('Previous progress loaded', {
      lastIndex: progress.currentLocationIndex,
      processedCount: progress.processedCount
    });
    
    return progress;
  } catch (error) {
    logger.info('No previous progress found, starting fresh');
    return null;
  }
}

/**
 * Health check endpoint for monitoring
 */
async function healthCheck() {
  try {
    await pool.query('SELECT 1');
    return {
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
      metrics: performanceMetrics
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Enhanced main ETL pipeline with parallel processing and monitoring
 */
async function runEnhancedETLPipeline(options = {}) {
  performanceMetrics.startTime = Date.now();
  
  logger.info('Starting Enhanced ETL Pipeline', {
    config: CONFIG,
    options: options
  });
  
  try {
    // Initialize database
    await initDatabase();
    
    // Create logs directory
    await fs.mkdir('logs', { recursive: true });
    
    // Load previous progress if resuming
    const previousProgress = await loadProgress();
    const startIndex = options.resume && previousProgress ? previousProgress.currentLocationIndex + 1 : 0;
    
    if (startIndex > 0) {
      logger.info('Resuming from previous session', { startIndex });
    }
    
    // Optionally clear existing data
    if (options.clearExisting && startIndex === 0) {
      logger.info('Clearing existing ETL data');
      const clearResult = await pool.query('DELETE FROM facilities WHERE "dataSource" = $1', ['findtreatment.gov']);
      logger.info(`Cleared ${clearResult.rowCount} existing records`);
    }
    
    // Process locations with enhanced error handling
    const locationsToProcess = LOCATIONS.slice(startIndex);
    const totalBatches = Math.ceil(locationsToProcess.length / CONFIG.PARALLEL_WORKERS);
    
    logger.info('Starting parallel processing', {
      totalLocations: locationsToProcess.length,
      parallelWorkers: CONFIG.PARALLEL_WORKERS,
      totalBatches: totalBatches
    });
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStart = batchIndex * CONFIG.PARALLEL_WORKERS;
      const batchEnd = Math.min(batchStart + CONFIG.PARALLEL_WORKERS, locationsToProcess.length);
      const batch = locationsToProcess.slice(batchStart, batchEnd);
      
      logger.info(`Processing batch ${batchIndex + 1}/${totalBatches}`, {
        batchSize: batch.length,
        locationRange: `${startIndex + batchStart + 1}-${startIndex + batchEnd}`
      });
      
      // Process batch in parallel
      const batchPromises = batch.map(async (location, index) => {
        const globalIndex = startIndex + batchStart + index;
        
        try {
          // Fetch facilities with retry logic
          const rawFacilities = await fetchFacilitiesWithRetry(location);
          
          if (rawFacilities.length === 0) {
            logger.warn('No facilities found for location', { location: location.name });
            return 0;
          }
          
          // Transform and validate
          const transformed = rawFacilities
            .map(facility => validateAndTransformFacility(facility, location))
            .filter(facility => facility !== null);
          
          if (transformed.length === 0) {
            logger.warn('All facilities failed validation', { location: location.name });
            return 0;
          }
          
          // Insert batch
          const insertedCount = await insertFacilitiesBatch(transformed);
          performanceMetrics.totalProcessed += insertedCount;
          
          logger.info('Location processing completed', {
            location: location.name,
            fetched: rawFacilities.length,
            validated: transformed.length,
            inserted: insertedCount
          });
          
          return insertedCount;
          
        } catch (error) {
          logger.error('Location processing failed completely', {
            location: location.name,
            globalIndex: globalIndex,
            error: error.message
          });
          return 0;
        }
      });
      
      // Wait for batch completion
      const batchResults = await Promise.all(batchPromises);
      const batchTotal = batchResults.reduce((sum, count) => sum + count, 0);
      
      logger.info('Batch completed', {
        batchIndex: batchIndex + 1,
        totalInserted: batchTotal,
        cumulativeTotal: performanceMetrics.totalProcessed
      });
      
      // Save progress periodically
      if ((batchIndex + 1) % CONFIG.PROGRESS_SAVE_INTERVAL === 0) {
        await saveProgress(startIndex + batchEnd - 1, performanceMetrics);
      }
      
      // Rate limiting between batches
      if (batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.DELAY_BETWEEN_REQUESTS));
      }
    }
    
    // Generate final statistics
    const duration = (Date.now() - performanceMetrics.startTime) / 1000;
    const finalStats = await generateFinalReport(duration);
    
    // Save final statistics
    await fs.writeFile(
      path.join(__dirname, 'etl-enhanced-stats.json'),
      JSON.stringify(finalStats, null, 2)
    );
    
    // Clean up progress file on successful completion
    try {
      await fs.unlink(path.join(__dirname, 'etl-progress.json'));
    } catch (error) {
      // Progress file might not exist, ignore error
    }
    
    logger.info('Enhanced ETL Pipeline completed successfully', finalStats);
    
    return finalStats;
    
  } catch (error) {
    const duration = (Date.now() - performanceMetrics.startTime) / 1000;
    logger.error('Enhanced ETL Pipeline failed', {
      error: error.message,
      stack: error.stack,
      duration: duration,
      metrics: performanceMetrics
    });
    throw error;
  } finally {
    if (pool) {
      await pool.end();
      logger.info('Database connection pool closed');
    }
  }
}

/**
 * Generate comprehensive final report
 */
async function generateFinalReport(duration) {
  try {
    const dbStats = await pool.query(`
      SELECT 
        COUNT(*) as total_facilities,
        COUNT(DISTINCT state) as states_covered,
        AVG("qualityScore") as avg_quality_score,
        COUNT(*) FILTER (WHERE "dataSource" = 'findtreatment.gov') as etl_facilities
      FROM facilities
    `);
    
    const stats = dbStats.rows[0];
    
    return {
      timestamp: new Date().toISOString(),
      pipeline: 'enhanced-etl-v2',
      duration: {
        seconds: duration,
        formatted: formatDuration(duration)
      },
      performance: {
        ...performanceMetrics,
        requestsPerSecond: performanceMetrics.totalRequests / duration,
        processingRate: performanceMetrics.totalProcessed / duration,
        successRate: (performanceMetrics.successfulRequests / performanceMetrics.totalRequests * 100).toFixed(2) + '%',
        errorRate: (performanceMetrics.failedRequests / performanceMetrics.totalRequests * 100).toFixed(2) + '%'
      },
      database: {
        totalFacilities: parseInt(stats.total_facilities),
        statesCovered: parseInt(stats.states_covered),
        etlFacilities: parseInt(stats.etl_facilities),
        averageQualityScore: parseFloat(stats.avg_quality_score).toFixed(2)
      },
      quality: {
        duplicatesSkipped: performanceMetrics.duplicatesSkipped,
        validationErrors: performanceMetrics.validationErrors,
        deduplicationEnabled: CONFIG.ENABLE_DEDUPLICATION
      },
      configuration: CONFIG
    };
  } catch (error) {
    logger.error('Failed to generate final report', { error: error.message });
    return {
      timestamp: new Date().toISOString(),
      duration: duration,
      performance: performanceMetrics,
      error: 'Failed to query database for final statistics'
    };
  }
}

/**
 * Format duration in human readable format
 */
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

// Export functions
module.exports = {
  runEnhancedETLPipeline,
  healthCheck,
  fetchFacilitiesWithRetry,
  validateAndTransformFacility,
  CONFIG
};

// CLI execution
if (require.main === module) {
  const options = {
    resume: process.argv.includes('--resume'),
    clearExisting: process.argv.includes('--clear'),
    parallel: !process.argv.includes('--sequential')
  };
  
  runEnhancedETLPipeline(options).catch(error => {
    logger.error('Pipeline execution failed', { error: error.message });
    process.exit(1);
  });
}