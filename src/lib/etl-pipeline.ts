/**
 * Enhanced ETL Pipeline for SoberLivings Finder
 * Handles data from files (CSV/JSON) and API sources
 * High-performance data extraction, transformation, and loading
 */

import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { parse as parseCSV } from 'csv-parse';

interface FacilityData {
  id: string;
  name: string;
  street?: string;
  city: string;
  state: string;
  zip?: string;
  phone?: string;
  website?: string;
  latitude?: number;
  longitude?: number;
  residentialServices?: string;
  allServices?: string;
  services: string[];
  metadata?: Record<string, any>;
  sourceData?: Record<string, any>;
  dataQuality?: number;
  isResidential?: boolean;
}

interface CSVFacilityRecord {
  Name: string;
  City: string;
  State: string;
  ZIP?: string;
  Phone?: string;
  Address?: string;
  Website?: string;
  Latitude?: string;
  Longitude?: string;
  'Residential Services'?: string;
  'All Services'?: string;
}

interface JSONFacilityRecord {
  name: string;
  city: string;
  state: string;
  zip?: string;
  phone?: string;
  website?: string;
  latitude?: string;
  longitude?: string;
  residential_services?: string;
  all_services?: string;
}

interface ETLMetrics {
  startTime: number;
  endTime?: number;
  recordsProcessed: number;
  recordsFailed: number;
  batchesCompleted: number;
  errors: Error[];
}

/**
 * High-performance ETL pipeline with parallel processing
 */
export class OptimizedETLPipeline {
  private prisma: PrismaClient;
  private supabase: ReturnType<typeof createClient> | null;
  private metrics: ETLMetrics;
  private readonly BATCH_SIZE = 500;
  private readonly PARALLEL_WORKERS = 10;
  private readonly CHUNK_SIZE = 50;

  constructor(
    prisma: PrismaClient,
    supabaseUrl?: string,
    supabaseKey?: string
  ) {
    this.prisma = prisma;
    this.supabase = supabaseUrl && supabaseKey
      ? createClient(supabaseUrl, supabaseKey)
      : null;
    
    this.metrics = {
      startTime: Date.now(),
      recordsProcessed: 0,
      recordsFailed: 0,
      batchesCompleted: 0,
      errors: []
    };
  }

  /**
   * Extract data from multiple sources (files, API)
   */
  async extract(
    sources?: {
      locations?: Array<{ lat: number; lon: number; name: string }>;
      csvFile?: string;
      jsonFile?: string;
    }
  ): Promise<FacilityData[]> {
    console.log('📊 Starting multi-source extraction...');
    
    const allFacilities: FacilityData[] = [];

    // Extract from CSV file if provided
    if (sources?.csvFile) {
      console.log(`📄 Extracting from CSV: ${sources.csvFile}`);
      const csvFacilities = await this.extractFromCSV(sources.csvFile);
      allFacilities.push(...csvFacilities);
    }

    // Extract from JSON file if provided
    if (sources?.jsonFile) {
      console.log(`📄 Extracting from JSON: ${sources.jsonFile}`);
      const jsonFacilities = await this.extractFromJSON(sources.jsonFile);
      allFacilities.push(...jsonFacilities);
    }

    // Extract from API if locations provided
    if (sources?.locations && sources.locations.length > 0) {
      console.log(`🌐 Extracting from API for ${sources.locations.length} locations...`);
      const apiFacilities = await this.extractFromAPI(sources.locations);
      allFacilities.push(...apiFacilities);
    }

    // Deduplicate facilities by ID
    const uniqueFacilities = this.deduplicateFacilities(allFacilities);
    
    console.log(`✅ Extracted ${uniqueFacilities.length} unique facilities from all sources`);
    return uniqueFacilities;
  }

  /**
   * Extract data from CSV file
   */
  async extractFromCSV(filePath: string): Promise<FacilityData[]> {
    const facilities: FacilityData[] = [];
    
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      
      return new Promise((resolve, reject) => {
        parseCSV(fileContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true
        }, (err, records: CSVFacilityRecord[]) => {
          if (err) {
            reject(err);
            return;
          }

          const facilities = records.map((record, index) => {
            return this.transformCSVRecord(record, index);
          }).filter(Boolean) as FacilityData[];

          resolve(facilities);
        });
      });
    } catch (error) {
      console.error('CSV extraction error:', error);
      this.metrics.errors.push(error as Error);
      return [];
    }
  }

  /**
   * Extract data from JSON file
   */
  async extractFromJSON(filePath: string): Promise<FacilityData[]> {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const records: JSONFacilityRecord[] = JSON.parse(fileContent);
      
      const facilities = records.map((record, index) => {
        return this.transformJSONRecord(record, index);
      }).filter(Boolean) as FacilityData[];

      return facilities;
    } catch (error) {
      console.error('JSON extraction error:', error);
      this.metrics.errors.push(error as Error);
      return [];
    }
  }

  /**
   * Extract data from FindTreatment.gov API with parallel fetching
   */
  async extractFromAPI(locations: Array<{ lat: number; lon: number; name: string }>): Promise<FacilityData[]> {
    const allFacilities: FacilityData[] = [];
    const chunks = this.chunkArray(locations, this.PARALLEL_WORKERS);
    
    // Process locations in parallel chunks
    for (const chunk of chunks) {
      const promises = chunk.map(async (location) => {
        try {
          return await this.fetchFacilitiesForLocation(location);
        } catch (error) {
          console.error(`Failed to fetch ${location.name}:`, error);
          this.metrics.errors.push(error as Error);
          return [];
        }
      });

      const results = await Promise.allSettled(promises);
      
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          allFacilities.push(...result.value);
        }
      });

      // Rate limiting to avoid API throttling
      await this.delay(100);
    }

    return allFacilities;
  }

  /**
   * Transform data with validation and enrichment
   */
  async transform(facilities: FacilityData[]): Promise<FacilityData[]> {
    console.log(`🔄 Transforming ${facilities.length} facilities...`);
    
    const transformed = await Promise.all(
      facilities.map(async (facility) => {
        try {
          // Validate required fields
          if (!this.validateFacility(facility)) {
            this.metrics.recordsFailed++;
            return null;
          }

          // Enrich data
          const enriched = await this.enrichFacility(facility);
          
          // Normalize data
          const normalized = this.normalizeFacility(enriched);
          
          this.metrics.recordsProcessed++;
          return normalized;
        } catch (error) {
          console.error(`Transform error for ${facility.id}:`, error);
          this.metrics.recordsFailed++;
          return null;
        }
      })
    );

    const valid = transformed.filter(f => f !== null) as FacilityData[];
    console.log(`✅ Transformed ${valid.length} valid facilities`);
    
    return valid;
  }

  /**
   * Load data with optimized batch inserts
   */
  async load(facilities: FacilityData[]): Promise<void> {
    console.log(`📥 Loading ${facilities.length} facilities to database...`);
    
    const batches = this.chunkArray(facilities, this.BATCH_SIZE);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      try {
        // Try Prisma first, fallback to Supabase if connection fails
        let prismaFailed = false;
        
        try {
          // Use transaction for batch insert
          await this.prisma.$transaction(async (tx) => {
            // Delete existing records for these IDs (upsert pattern)
            const ids = batch.map(f => f.id);
            await tx.facility.deleteMany({
              where: { id: { in: ids } }
            });

            // Bulk create new records
            await tx.facility.createMany({
              data: batch.map(f => ({
                id: f.id,
                name: f.name,
                street: f.street,
                city: f.city,
                state: f.state,
                zip: f.zip,
                phone: f.phone,
                website: f.website,
                latitude: f.latitude,
                longitude: f.longitude,
                residentialServices: f.residentialServices,
                allServices: f.allServices,
                services: f.services,
                metadata: f.metadata,
                sourceData: f.sourceData,
                geoHash: f.metadata?.geoHash,
                isResidential: f.isResidential || false,
                serviceCount: f.services.length,
                dataQuality: f.dataQuality,
                lastUpdated: new Date(),
              })),
              skipDuplicates: true,
            });
          });
          console.log(`✅ Prisma batch ${i + 1}/${batches.length} loaded (${batch.length} records)`);
        } catch (prismaError) {
          console.warn(`⚠️ Prisma connection failed for batch ${i + 1}, trying Supabase...`);
          prismaFailed = true;
        }

        // Load to Supabase (either as primary or fallback)
        if (this.supabase && (prismaFailed || !this.prisma)) {
          await this.loadToSupabase(batch);
        }

        this.metrics.batchesCompleted++;
        
      } catch (error) {
        console.error(`Failed to load batch ${i + 1} to both Prisma and Supabase:`, error);
        this.metrics.errors.push(error as Error);
      }

      // Prevent database overload
      await this.delay(50);
    }
    
    console.log(`✅ Load complete: ${this.metrics.batchesCompleted} batches`);
  }

  /**
   * Transform CSV record to FacilityData
   */
  private transformCSVRecord(record: CSVFacilityRecord, index: number): FacilityData | null {
    try {
      if (!record.Name || !record.City || !record.State) {
        return null;
      }

      const services = this.extractServicesFromText(record['All Services'] || '');
      const latitude = record.Latitude ? parseFloat(record.Latitude) : undefined;
      const longitude = record.Longitude ? parseFloat(record.Longitude) : undefined;

      return {
        id: this.generateIdFromRecord(record.Name, record.City, record.State),
        name: record.Name.trim(),
        street: record.Address?.trim(),
        city: record.City.trim(),
        state: record.State.toUpperCase().substring(0, 2),
        zip: record.ZIP?.replace(/[^0-9-]/g, '') || undefined,
        phone: this.normalizePhone(record.Phone),
        website: this.normalizeWebsite(record.Website),
        latitude,
        longitude,
        residentialServices: record['Residential Services'],
        allServices: record['All Services'],
        services,
        isResidential: this.isResidentialFacility(record['Residential Services'], services),
        sourceData: record,
        metadata: {
          source: 'csv',
          extractedAt: new Date().toISOString(),
          recordIndex: index,
          geoHash: latitude && longitude ? this.generateGeoHash(latitude, longitude) : undefined
        },
        dataQuality: this.calculateDataQuality(record, latitude, longitude)
      };
    } catch (error) {
      console.error(`Error transforming CSV record ${index}:`, error);
      return null;
    }
  }

  /**
   * Transform JSON record to FacilityData
   */
  private transformJSONRecord(record: JSONFacilityRecord, index: number): FacilityData | null {
    try {
      if (!record.name || !record.city || !record.state) {
        return null;
      }

      const services = this.extractServicesFromText(record.all_services || '');
      const latitude = record.latitude ? parseFloat(record.latitude) : undefined;
      const longitude = record.longitude ? parseFloat(record.longitude) : undefined;

      return {
        id: this.generateIdFromRecord(record.name, record.city, record.state),
        name: record.name.trim(),
        city: record.city.trim(),
        state: record.state.toUpperCase().substring(0, 2),
        zip: record.zip?.replace(/[^0-9-]/g, '') || undefined,
        phone: this.normalizePhone(record.phone),
        website: this.normalizeWebsite(record.website),
        latitude,
        longitude,
        residentialServices: record.residential_services,
        allServices: record.all_services,
        services,
        isResidential: this.isResidentialFacility(record.residential_services, services),
        sourceData: record,
        metadata: {
          source: 'json',
          extractedAt: new Date().toISOString(),
          recordIndex: index,
          geoHash: latitude && longitude ? this.generateGeoHash(latitude, longitude) : undefined
        },
        dataQuality: this.calculateDataQuality(record, latitude, longitude)
      };
    } catch (error) {
      console.error(`Error transforming JSON record ${index}:`, error);
      return null;
    }
  }

  /**
   * Extract services from semicolon-separated text
   */
  private extractServicesFromText(servicesText: string): string[] {
    if (!servicesText) return [];
    
    return servicesText
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .slice(0, 50); // Limit services to prevent extremely long arrays
  }

  /**
   * Check if facility is residential based on services
   */
  private isResidentialFacility(residentialServices?: string, services?: string[]): boolean {
    const residentialKeywords = [
      'residential', 'inpatient', '24-hour', 'halfway house', 
      'sober home', 'transitional housing', 'long-term', 'short-term'
    ];

    const checkText = (text: string) => 
      residentialKeywords.some(keyword => 
        text.toLowerCase().includes(keyword.toLowerCase())
      );

    if (residentialServices && checkText(residentialServices)) {
      return true;
    }

    if (services) {
      return services.some(service => checkText(service));
    }

    return false;
  }

  /**
   * Calculate data quality score (0-1)
   */
  private calculateDataQuality(record: any, latitude?: number, longitude?: number): number {
    let score = 0;
    let maxScore = 0;

    // Required fields
    maxScore += 4;
    if (record.name || record.Name) score += 1;
    if (record.city || record.City) score += 1;
    if (record.state || record.State) score += 1;
    if (record.phone || record.Phone) score += 1;

    // Location data
    maxScore += 2;
    if (latitude && longitude) score += 2;

    // Contact info
    maxScore += 2;
    if (record.website || record.Website) score += 1;
    if (record.phone || record.Phone) score += 1;

    // Service information
    maxScore += 2;
    if (record.all_services || record['All Services']) score += 2;

    return maxScore > 0 ? score / maxScore : 0;
  }

  /**
   * Generate consistent ID from record data
   */
  private generateIdFromRecord(name: string, city: string, state: string): string {
    const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanCity = city.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanState = state.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    return `${cleanName}-${cleanCity}-${cleanState}`;
  }

  /**
   * Execute full ETL pipeline with flexible sources
   */
  async executeWithSources(sources: {
    locations?: Array<{ lat: number; lon: number; name: string }>;
    csvFile?: string;
    jsonFile?: string;
  }): Promise<ETLMetrics> {
    console.log('🚀 Starting enhanced ETL pipeline...');
    this.metrics.startTime = Date.now();

    try {
      // Extract from all sources
      const rawData = await this.extract(sources);
      
      // Transform
      const transformedData = await this.transform(rawData);
      
      // Load
      await this.load(transformedData);
      
      // Create indexes for performance
      await this.createIndexes();
      
      // Update materialized views
      await this.updateMaterializedViews();
      
    } catch (error) {
      console.error('ETL Pipeline failed:', error);
      this.metrics.errors.push(error as Error);
    }

    this.metrics.endTime = Date.now();
    const duration = (this.metrics.endTime - this.metrics.startTime) / 1000;
    
    console.log(`
    ✅ ETL Pipeline Complete
    ⏱️  Duration: ${duration}s
    📊 Records Processed: ${this.metrics.recordsProcessed}
    ❌ Records Failed: ${this.metrics.recordsFailed}
    📦 Batches Completed: ${this.metrics.batchesCompleted}
    🐛 Errors: ${this.metrics.errors.length}
    `);

    return this.metrics;
  }

  /**
   * Execute full ETL pipeline (legacy method for API-only)
   */
  async execute(locations: Array<{ lat: number; lon: number; name: string }>): Promise<ETLMetrics> {
    return this.executeWithSources({ locations });
  }

  /**
   * Fetch facilities for a specific location
   */
  private async fetchFacilitiesForLocation(
    location: { lat: number; lon: number; name: string }
  ): Promise<FacilityData[]> {
    const response = await fetch(
      `https://findtreatment.gov/locator/exportsAsJson/v2?` +
      new URLSearchParams({
        latitude: location.lat.toString(),
        longitude: location.lon.toString(),
        radius: '50',
        sType: 'residential',
        limit: '2000'
      })
    );

    if (!response.ok) {
      throw new Error(`API request failed for ${location.name}: ${response.status}`);
    }

    const data = await response.json();
    
    return data.map((item: any) => ({
      id: item.fid || this.generateId(item),
      name: item.name1,
      street: item.street1,
      city: item.city,
      state: item.state,
      zip: item.zip,
      phone: item.phone,
      website: item.website,
      latitude: parseFloat(item.latitude),
      longitude: parseFloat(item.longitude),
      services: this.extractServices(item),
      metadata: {
        sourceLocation: location.name,
        extractedAt: new Date().toISOString(),
        raw: item
      }
    }));
  }

  /**
   * Validate facility data
   */
  private validateFacility(facility: FacilityData): boolean {
    return !!(
      facility.id &&
      facility.name &&
      facility.city &&
      facility.state &&
      facility.latitude &&
      facility.longitude
    );
  }

  /**
   * Enrich facility data with additional information
   */
  private async enrichFacility(facility: FacilityData): Promise<FacilityData> {
    // Add computed fields
    facility.metadata = {
      ...facility.metadata,
      geoHash: facility.latitude && facility.longitude ? this.generateGeoHash(facility.latitude, facility.longitude) : undefined,
      isResidential: facility.services.some(s => 
        s.toLowerCase().includes('residential')
      ),
      serviceCount: facility.services.length,
    };

    return facility;
  }

  /**
   * Normalize facility data
   */
  private normalizeFacility(facility: FacilityData): FacilityData {
    return {
      ...facility,
      name: facility.name.trim(),
      street: facility.street?.trim() || '',
      city: facility.city.trim(),
      state: facility.state.toUpperCase().substring(0, 2),
      zip: facility.zip?.replace(/[^0-9-]/g, '') || '',
      phone: this.normalizePhone(facility.phone),
      website: this.normalizeWebsite(facility.website),
      services: facility.services.map(s => s.trim()).filter(s => s.length > 0)
    };
  }

  /**
   * Load data to Supabase using REST API
   */
  private async loadToSupabase(facilities: FacilityData[]): Promise<void> {
    if (!this.supabase) return;
    
    console.log(`📤 Loading ${facilities.length} facilities to Supabase via REST API...`);
    
    try {
      // TODO: Fix Supabase type compatibility issues
      // For now, use a type assertion to work around the TypeScript issues
      const facilityData = facilities.map(f => ({
        id: f.id,
        name: f.name,
        street: f.street,
        city: f.city,
        state: f.state,
        zip: f.zip,
        phone: f.phone,
        website: f.website,
        latitude: f.latitude,
        longitude: f.longitude,
        services: f.services,
        "residentialServices": f.residentialServices,
        "allServices": f.allServices,
        "isResidential": f.isResidential,
        "serviceCount": f.services.length,
        "dataQuality": f.dataQuality,
        metadata: f.metadata,
        "lastUpdated": new Date().toISOString()
      }));

      // Type assertion to bypass TypeScript issues
      const { data, error } = await (this.supabase as any)
        .from('facilities')
        .upsert(facilityData);

      if (error) {
        console.error('Supabase upsert error:', error);
        throw error;
      } else {
        console.log(`✅ Successfully loaded ${facilities.length} facilities to Supabase`);
      }
    } catch (error) {
      console.error('Supabase connection error:', error);
      throw error;
    }
  }

  /**
   * Create database indexes for performance
   */
  private async createIndexes(): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_facilities_location 
        ON facilities USING GIST (
          point(longitude, latitude)
        );
      `;

      await this.prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_facilities_state_city 
        ON facilities(state, city);
      `;

      await this.prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_facilities_services 
        ON facilities USING GIN(services);
      `;

      console.log('✅ Database indexes created');
    } catch (error) {
      console.error('Index creation error:', error);
    }
  }

  /**
   * Update materialized views for fast queries
   */
  private async updateMaterializedViews(): Promise<void> {
    try {
      // Create materialized view for city aggregates
      await this.prisma.$executeRaw`
        CREATE MATERIALIZED VIEW IF NOT EXISTS facility_city_stats AS
        SELECT 
          state,
          city,
          COUNT(*) as facility_count,
          COUNT(DISTINCT services) as unique_services,
          AVG(latitude) as center_lat,
          AVG(longitude) as center_lon
        FROM facilities
        GROUP BY state, city;
      `;

      // Refresh the view
      await this.prisma.$executeRaw`
        REFRESH MATERIALIZED VIEW CONCURRENTLY facility_city_stats;
      `;

      console.log('✅ Materialized views updated');
    } catch (error) {
      console.error('Materialized view error:', error);
    }
  }

  // Utility functions
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateId(item: any): string {
    return `${item.name1}-${item.city}-${item.state}`.toLowerCase().replace(/[^a-z0-9]/g, '-');
  }

  private extractServices(item: any): string[] {
    const services: string[] = [];
    
    // Extract all service fields
    for (const key in item) {
      if (key.startsWith('service_') && item[key]) {
        services.push(item[key]);
      }
    }
    
    return services;
  }

  private generateGeoHash(lat: number, lon: number): string {
    // Simple geohash implementation (you'd use a library in production)
    return `${Math.floor(lat * 100)}-${Math.floor(lon * 100)}`;
  }

  private normalizePhone(phone?: string): string {
    if (!phone) return '';
    return phone.replace(/[^0-9]/g, '').substring(0, 10);
  }

  private normalizeWebsite(website?: string): string {
    if (!website) return '';
    if (!website.startsWith('http')) {
      return `https://${website}`;
    }
    return website;
  }

  private deduplicateFacilities(facilities: FacilityData[]): FacilityData[] {
    const seen = new Set<string>();
    return facilities.filter(f => {
      if (seen.has(f.id)) {
        return false;
      }
      seen.add(f.id);
      return true;
    });
  }
}

/**
 * Enhanced pre-seeding strategy for database
 */
export class DatabaseSeeder {
  private pipeline: OptimizedETLPipeline;

  constructor(pipeline: OptimizedETLPipeline) {
    this.pipeline = pipeline;
  }

  /**
   * Seed database from data files
   */
  async seedFromDataFiles(dataDir: string = './data'): Promise<void> {
    console.log('🌱 Seeding database from data files...');
    
    const csvPath = path.join(dataDir, 'residential_facilities.csv');
    const jsonPath = path.join(dataDir, 'residential_facilities.json');
    
    const sources: {
      csvFile?: string;
      jsonFile?: string;
    } = {};

    // Check which files exist
    if (fs.existsSync(csvPath)) {
      sources.csvFile = csvPath;
      console.log(`📄 Found CSV file: ${csvPath}`);
    }
    
    if (fs.existsSync(jsonPath)) {
      sources.jsonFile = jsonPath;
      console.log(`📄 Found JSON file: ${jsonPath}`);
    }

    if (!sources.csvFile && !sources.jsonFile) {
      console.warn('⚠️  No data files found. Falling back to API seeding.');
      await this.seedMajorCities();
      return;
    }

    await this.pipeline.executeWithSources(sources);
  }

  /**
   * Seed database with major US cities (API-based)
   */
  async seedMajorCities(): Promise<void> {
    const majorCities = [
      { lat: 34.0522, lon: -118.2437, name: 'Los Angeles, CA' },
      { lat: 40.7128, lon: -74.0060, name: 'New York, NY' },
      { lat: 41.8781, lon: -87.6298, name: 'Chicago, IL' },
      { lat: 29.7604, lon: -95.3698, name: 'Houston, TX' },
      { lat: 33.4484, lon: -112.0740, name: 'Phoenix, AZ' },
      { lat: 39.9526, lon: -75.1652, name: 'Philadelphia, PA' },
      { lat: 29.4241, lon: -98.4936, name: 'San Antonio, TX' },
      { lat: 32.7157, lon: -117.1611, name: 'San Diego, CA' },
      { lat: 32.7767, lon: -96.7970, name: 'Dallas, TX' },
      { lat: 37.3382, lon: -121.8863, name: 'San Jose, CA' },
      { lat: 30.2672, lon: -97.7431, name: 'Austin, TX' },
      { lat: 30.3322, lon: -81.6557, name: 'Jacksonville, FL' },
      { lat: 37.7749, lon: -122.4194, name: 'San Francisco, CA' },
      { lat: 39.9612, lon: -82.9988, name: 'Columbus, OH' },
      { lat: 35.2271, lon: -80.8431, name: 'Charlotte, NC' },
      { lat: 39.7684, lon: -86.1581, name: 'Indianapolis, IN' },
      { lat: 47.6062, lon: -122.3321, name: 'Seattle, WA' },
      { lat: 39.7392, lon: -104.9903, name: 'Denver, CO' },
      { lat: 38.9072, lon: -77.0369, name: 'Washington, DC' },
      { lat: 42.3601, lon: -71.0589, name: 'Boston, MA' },
      { lat: 32.7555, lon: -97.3308, name: 'Fort Worth, TX' },
      { lat: 42.3314, lon: -83.0458, name: 'Detroit, MI' },
      { lat: 45.5152, lon: -122.6784, name: 'Portland, OR' },
      { lat: 36.1699, lon: -115.1398, name: 'Las Vegas, NV' },
      { lat: 35.1495, lon: -90.0490, name: 'Memphis, TN' },
      { lat: 38.2527, lon: -85.7585, name: 'Louisville, KY' },
      { lat: 39.0997, lon: -94.5786, name: 'Kansas City, MO' },
      { lat: 43.0389, lon: -87.9065, name: 'Milwaukee, WI' },
      { lat: 35.4676, lon: -97.5164, name: 'Oklahoma City, OK' },
      { lat: 25.7617, lon: -80.1918, name: 'Miami, FL' },
      { lat: 44.9778, lon: -93.2650, name: 'Minneapolis, MN' },
      { lat: 26.1224, lon: -80.1373, name: 'Fort Lauderdale, FL' },
      { lat: 33.7490, lon: -84.3880, name: 'Atlanta, GA' },
      { lat: 38.6270, lon: -90.1994, name: 'St. Louis, MO' },
      { lat: 39.2904, lon: -76.6122, name: 'Baltimore, MD' },
      { lat: 27.9506, lon: -82.4572, name: 'Tampa, FL' },
      { lat: 35.1107, lon: -106.6100, name: 'Albuquerque, NM' },
      { lat: 36.1627, lon: -86.7816, name: 'Nashville, TN' },
      { lat: 40.7608, lon: -111.8910, name: 'Salt Lake City, UT' },
      { lat: 30.2672, lon: -97.7431, name: 'New Orleans, LA' },
      { lat: 40.4406, lon: -79.9959, name: 'Pittsburgh, PA' },
      { lat: 35.7796, lon: -78.6382, name: 'Raleigh, NC' },
      { lat: 38.5816, lon: -121.4944, name: 'Sacramento, CA' },
      { lat: 41.2565, lon: -95.9345, name: 'Omaha, NE' },
      { lat: 28.5383, lon: -81.3792, name: 'Orlando, FL' },
    ];

    await this.pipeline.execute(majorCities);
  }

  /**
   * Incremental seeding for new locations
   */
  async seedNewLocations(locations: Array<{ lat: number; lon: number; name: string }>): Promise<void> {
    await this.pipeline.execute(locations);
  }

  /**
   * Comprehensive seeding using both data files and API
   */
  async seedComprehensive(dataDir: string = './data', includeAPI: boolean = false): Promise<void> {
    console.log('🚀 Starting comprehensive database seeding...');
    
    const csvPath = path.join(dataDir, 'residential_facilities.csv');
    const jsonPath = path.join(dataDir, 'residential_facilities.json');
    
    const sources: {
      csvFile?: string;
      jsonFile?: string;
      locations?: Array<{ lat: number; lon: number; name: string }>;
    } = {};

    // Include data files
    if (fs.existsSync(csvPath)) {
      sources.csvFile = csvPath;
      console.log(`📄 Including CSV file: ${csvPath}`);
    }
    
    if (fs.existsSync(jsonPath)) {
      sources.jsonFile = jsonPath;
      console.log(`📄 Including JSON file: ${jsonPath}`);
    }

    // Optionally include API data for additional coverage
    if (includeAPI) {
      console.log('🌐 Including API data for additional coverage...');
      sources.locations = [
        { lat: 34.0522, lon: -118.2437, name: 'Los Angeles, CA' },
        { lat: 40.7128, lon: -74.0060, name: 'New York, NY' },
        { lat: 41.8781, lon: -87.6298, name: 'Chicago, IL' },
        { lat: 29.7604, lon: -95.3698, name: 'Houston, TX' },
        { lat: 33.4484, lon: -112.0740, name: 'Phoenix, AZ' },
        // Add more strategic locations as needed
      ];
    }

    if (!sources.csvFile && !sources.jsonFile && !sources.locations) {
      throw new Error('No data sources available for seeding');
    }

    await this.pipeline.executeWithSources(sources);
  }
}

// Export singleton instances for use
export const createETLPipeline = (
  prisma: PrismaClient,
  supabaseUrl?: string,
  supabaseKey?: string
) => {
  return new OptimizedETLPipeline(prisma, supabaseUrl, supabaseKey);
};

export const createDatabaseSeeder = (pipeline: OptimizedETLPipeline) => {
  return new DatabaseSeeder(pipeline);
};