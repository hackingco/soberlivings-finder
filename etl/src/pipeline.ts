/**
 * ETL Pipeline for FindTreatment.gov Data
 * 
 * This pipeline extracts treatment facility data from various sources,
 * transforms it to match our schema, and loads it into Supabase.
 */

import { createClient } from '@supabase/supabase-js';
import axios, { AxiosInstance } from 'axios';
import pLimit from 'p-limit';
import { Logger } from './utils/logger';
import { DataValidator } from './utils/validator';
import { MetricsCollector } from './utils/metrics';
import { RateLimiter } from './utils/rateLimiter';
import { mockFacilities, getMockApiResponse } from './mockData';
import { fetchPublicFacilities, transformPublicApiResponse } from './publicApi';
import { 
  FacilityRecord, 
  TransformedFacility, 
  ETLConfig,
  ETLMetrics,
  SyncStatus 
} from './types';

export class ETLPipeline {
  private supabase;
  private apiClient: AxiosInstance;
  private logger: Logger;
  private validator: DataValidator;
  private metrics: MetricsCollector;
  private rateLimiter: RateLimiter;
  private config: ETLConfig;
  private concurrencyLimit;

  constructor(config: ETLConfig) {
    this.config = config;
    this.logger = new Logger('ETLPipeline');
    this.validator = new DataValidator();
    this.metrics = new MetricsCollector();
    this.rateLimiter = new RateLimiter(config.rateLimit || 10);
    this.concurrencyLimit = pLimit(config.concurrency || 5);

    // Initialize Supabase client
    this.supabase = createClient(
      config.supabaseUrl,
      config.supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Initialize API client with interceptors
    this.apiClient = axios.create({
      baseURL: config.apiBaseUrl,
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    // Add retry interceptor
    this.apiClient.interceptors.response.use(
      response => response,
      async error => {
        const { config, response } = error;
        const retries = config.__retryCount || 0;

        if (retries < this.config.maxRetries && response?.status >= 500) {
          config.__retryCount = retries + 1;
          const delay = Math.pow(2, retries) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.apiClient(config);
        }

        throw error;
      }
    );
  }

  /**
   * Main ETL execution method
   */
  async run(options: { 
    fullSync?: boolean; 
    fromDate?: Date;
    limit?: number;
  } = {}): Promise<ETLMetrics> {
    const startTime = Date.now();
    this.logger.info('Starting ETL pipeline', options);
    
    try {
      // Step 1: Extract data
      const extractedData = await this.extract(options);
      this.logger.info(`Extracted ${extractedData.length} records`);

      // Step 2: Transform data
      const transformedData = await this.transform(extractedData);
      this.logger.info(`Transformed ${transformedData.length} records`);

      // Step 3: Validate data
      const validatedData = await this.validate(transformedData);
      this.logger.info(`Validated ${validatedData.valid.length} records, rejected ${validatedData.invalid.length}`);

      // Step 4: Load data
      const loadResult = await this.load(validatedData.valid);
      this.logger.info(`Loaded ${loadResult.inserted} new, ${loadResult.updated} updated records`);

      // Step 5: Update sync status
      await this.updateSyncStatus({
        lastSync: new Date(),
        recordsProcessed: extractedData.length,
        recordsLoaded: loadResult.inserted + loadResult.updated,
        recordsRejected: validatedData.invalid.length,
        duration: Date.now() - startTime
      });

      // Collect and return metrics
      const metrics = this.metrics.collect();
      this.logger.info('ETL pipeline completed successfully', metrics);
      return metrics;

    } catch (error) {
      this.logger.error('ETL pipeline failed', error);
      throw error;
    }
  }

  /**
   * Extract phase - Fetch data from API
   */
  private async extract(options: any): Promise<FacilityRecord[]> {
    const records: FacilityRecord[] = [];
    
    // Try public API first (no key required)
    try {
      this.logger.info('Attempting to fetch from public API...');
      
      const publicData = await fetchPublicFacilities({
        state: 'CA', // Default to California
        limit: options.limit || 100
      });
      
      if (publicData && publicData.length > 0) {
        const transformed = transformPublicApiResponse(publicData);
        records.push(...transformed);
        
        this.metrics.increment('api.calls');
        this.metrics.increment('records.extracted', transformed.length);
        this.logger.info(`Extracted ${transformed.length} records from public API`);
        
        return records;
      }
    } catch (error) {
      this.logger.warn('Public API failed, falling back to alternatives', error);
    }
    
    // Check if API key is configured for private API
    const hasApiKey = this.config.apiKey && this.config.apiKey !== '';
    
    if (!hasApiKey) {
      this.logger.warn('No API key and public API failed, using mock data for testing');
      
      // Use mock data as fallback
      const mockResponse = getMockApiResponse(1, options.limit || 10);
      records.push(...mockResponse.data);
      
      this.metrics.increment('records.extracted', mockResponse.data.length);
      this.logger.info(`Extracted ${mockResponse.data.length} mock records`);
      
      return records;
    }
    
    // Private API extraction with key
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      await this.rateLimiter.wait();

      try {
        const response = await this.apiClient.get('/facilities', {
          params: {
            page,
            limit: options.limit || 100,
            modifiedSince: options.fromDate?.toISOString()
          }
        });

        const { data, pagination } = response.data;
        records.push(...data);

        hasMore = pagination.hasNextPage && (!options.limit || records.length < options.limit);
        page++;

        this.metrics.increment('api.calls');
        this.metrics.increment('records.extracted', data.length);

      } catch (error) {
        this.metrics.increment('api.errors');
        this.logger.error(`Failed to extract page ${page}`, error);
        
        // Continue with partial data if some pages fail
        if (records.length > 0) {
          hasMore = false;
        } else {
          // Final fallback to mock data
          this.logger.warn('All API attempts failed, using mock data');
          const mockResponse = getMockApiResponse(1, options.limit || 10);
          records.push(...mockResponse.data);
          this.metrics.increment('records.extracted', mockResponse.data.length);
        }
      }
    }

    return records;
  }

  /**
   * Transform phase - Normalize and enrich data
   */
  private async transform(records: FacilityRecord[]): Promise<TransformedFacility[]> {
    const transformTasks = records.map(record => 
      this.concurrencyLimit(() => this.transformRecord(record))
    );

    const results = await Promise.allSettled(transformTasks);
    
    const transformed: TransformedFacility[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        transformed.push(result.value);
        this.metrics.increment('records.transformed');
      } else {
        this.metrics.increment('transform.errors');
        this.logger.error('Transform failed for record', result.reason);
      }
    }

    return transformed;
  }

  /**
   * Transform a single record
   */
  private async transformRecord(record: FacilityRecord): Promise<TransformedFacility> {
    // Normalize fields
    const transformed: TransformedFacility = {
      // Map external ID to our ID format
      id: this.generateId(record),
      
      // Basic information
      name: this.cleanText(record.facilityName || record.name),
      street: this.cleanText(record.street1),
      city: this.cleanText(record.city),
      state: this.normalizeState(record.state),
      zip: this.normalizeZip(record.zip),
      phone: this.normalizePhone(record.phone),
      website: this.normalizeUrl(record.website),
      
      // Coordinates
      latitude: this.parseCoordinate(record.latitude),
      longitude: this.parseCoordinate(record.longitude),
      
      // Services and features
      services: this.parseServices(record),
      accepted_insurance: this.parseInsurance(record),
      amenities: this.parseAmenities(record),
      specialties: this.parseSpecialties(record),
      
      // Facility details
      is_residential: this.determineResidential(record),
      facility_type: this.determineFacilityType(record),
      description: this.generateDescription(record),
      
      // Quality metrics
      verified: this.determineVerified(record),
      data_quality: this.calculateQualityScore(record),
      
      // Metadata
      source_data: record,
      last_updated: new Date(),
      created_at: new Date()
    };

    // Geocode if coordinates missing
    if (!transformed.latitude || !transformed.longitude) {
      const coords = await this.geocodeAddress(transformed);
      if (coords) {
        transformed.latitude = coords.lat;
        transformed.longitude = coords.lng;
      }
    }

    return transformed;
  }

  /**
   * Validate phase - Check data quality and integrity
   */
  private async validate(records: TransformedFacility[]): Promise<{
    valid: TransformedFacility[];
    invalid: Array<{ record: TransformedFacility; errors: string[] }>;
  }> {
    const valid: TransformedFacility[] = [];
    const invalid: Array<{ record: TransformedFacility; errors: string[] }> = [];

    for (const record of records) {
      const validation = this.validator.validate(record);
      
      if (validation.isValid) {
        valid.push(record);
        this.metrics.increment('records.valid');
      } else {
        invalid.push({ record, errors: validation.errors });
        this.metrics.increment('records.invalid');
        this.logger.warn(`Validation failed for ${record.name}`, validation.errors);
      }
    }

    // Check for duplicates
    const deduped = await this.removeDuplicates(valid);
    const duplicatesRemoved = valid.length - deduped.length;
    
    if (duplicatesRemoved > 0) {
      this.metrics.increment('records.duplicates', duplicatesRemoved);
      this.logger.info(`Removed ${duplicatesRemoved} duplicate records`);
    }

    return { valid: deduped, invalid };
  }

  /**
   * Load phase - Insert/update data in Supabase
   */
  private async load(records: TransformedFacility[]): Promise<{
    inserted: number;
    updated: number;
    failed: number;
  }> {
    const batchSize = this.config.batchSize || 100;
    const batches = this.createBatches(records, batchSize);
    
    let inserted = 0;
    let updated = 0;
    let failed = 0;

    for (const [index, batch] of batches.entries()) {
      try {
        this.logger.info(`Processing batch ${index + 1}/${batches.length}`);
        
        // Upsert batch
        const { data, error } = await this.supabase
          .from('facilities')
          .upsert(batch, {
            onConflict: 'id',
            returning: 'minimal'
          });

        if (error) {
          throw error;
        }

        // Track metrics (would need to query to determine insert vs update)
        inserted += batch.length; // Simplified - in reality would track separately
        this.metrics.increment('records.loaded', batch.length);

      } catch (error) {
        failed += batch.length;
        this.metrics.increment('load.errors', batch.length);
        this.logger.error(`Failed to load batch ${index + 1}`, error);
        
        // Try individual inserts for failed batch
        for (const record of batch) {
          try {
            await this.supabase.from('facilities').upsert(record);
            failed--;
            inserted++;
          } catch (individualError) {
            this.logger.error(`Failed to load record ${record.id}`, individualError);
          }
        }
      }
    }

    return { inserted, updated, failed };
  }

  /**
   * Helper methods
   */

  private generateId(record: any): string {
    // Generate consistent ID from source data
    const source = record.sourceId || record.id || '';
    const name = record.name || record.facilityName || '';
    const location = `${record.city}-${record.state}`.toLowerCase();
    return `${source}-${name}-${location}`.replace(/[^a-z0-9-]/gi, '-');
  }

  private cleanText(text: any): string {
    if (!text) return '';
    return String(text).trim().replace(/\s+/g, ' ');
  }

  private normalizeState(state: any): string {
    if (!state) return '';
    // Convert to uppercase abbreviation
    return String(state).toUpperCase().substring(0, 2);
  }

  private normalizeZip(zip: any): string {
    if (!zip) return '';
    return String(zip).replace(/[^0-9-]/g, '').substring(0, 10);
  }

  private normalizePhone(phone: any): string {
    if (!phone) return '';
    // Remove non-digits and format
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  }

  private normalizeUrl(url: any): string {
    if (!url) return '';
    const urlString = String(url).trim();
    if (!urlString.match(/^https?:\/\//)) {
      return `https://${urlString}`;
    }
    return urlString;
  }

  private parseCoordinate(coord: any): number | null {
    const parsed = parseFloat(coord);
    return isNaN(parsed) ? null : parsed;
  }

  private parseServices(record: any): string[] {
    const services: string[] = [];
    
    // Parse from various possible fields
    if (record.services) {
      if (Array.isArray(record.services)) {
        services.push(...record.services);
      } else if (typeof record.services === 'string') {
        services.push(...record.services.split(',').map((s: string) => s.trim()));
      }
    }

    // Check specific service flags
    if (record.detox) services.push('Detox');
    if (record.residential) services.push('Residential Treatment');
    if (record.outpatient) services.push('Outpatient');
    if (record.telehealth) services.push('Telehealth');
    
    return [...new Set(services)]; // Remove duplicates
  }

  private parseInsurance(record: any): string[] {
    const insurance: string[] = [];
    
    if (record.insurance) {
      if (Array.isArray(record.insurance)) {
        insurance.push(...record.insurance);
      } else if (typeof record.insurance === 'string') {
        insurance.push(...record.insurance.split(',').map((i: string) => i.trim()));
      }
    }

    if (record.medicaid) insurance.push('Medicaid');
    if (record.medicare) insurance.push('Medicare');
    if (record.privateInsurance) insurance.push('Private Insurance');
    
    return [...new Set(insurance)];
  }

  private parseAmenities(record: any): string[] {
    const amenities: string[] = [];
    
    if (record.amenities) {
      if (Array.isArray(record.amenities)) {
        amenities.push(...record.amenities);
      }
    }

    return amenities;
  }

  private parseSpecialties(record: any): string[] {
    const specialties: string[] = [];
    
    if (record.specialties || record.populations) {
      const field = record.specialties || record.populations;
      if (Array.isArray(field)) {
        specialties.push(...field);
      }
    }

    return specialties;
  }

  private determineResidential(record: any): boolean {
    return Boolean(
      record.residential || 
      record.isResidential ||
      record.services?.includes('Residential') ||
      record.facilityType?.toLowerCase().includes('residential')
    );
  }

  private determineFacilityType(record: any): string {
    if (record.facilityType) return record.facilityType;
    
    if (this.determineResidential(record)) {
      return 'Residential Treatment Center';
    } else if (record.outpatient) {
      return 'Outpatient Center';
    } else if (record.hospital) {
      return 'Hospital';
    }
    
    return 'Treatment Facility';
  }

  private generateDescription(record: any): string {
    const parts: string[] = [];
    
    if (record.description) {
      parts.push(record.description);
    } else {
      parts.push(`${record.name || 'Treatment facility'} in ${record.city}, ${record.state}.`);
      
      if (record.services?.length > 0) {
        parts.push(`Services include: ${record.services.slice(0, 3).join(', ')}.`);
      }
    }
    
    return parts.join(' ').trim();
  }

  private determineVerified(record: any): boolean {
    return Boolean(
      record.verified ||
      record.isVerified ||
      record.certificationDate ||
      record.licenseNumber
    );
  }

  private calculateQualityScore(record: any): number {
    let score = 0;
    let factors = 0;
    
    // Check completeness of required fields
    if (record.name) { score += 1; factors += 1; }
    if (record.city && record.state) { score += 1; factors += 1; }
    if (record.phone) { score += 1; factors += 1; }
    if (record.services?.length > 0) { score += 1; factors += 1; }
    if (record.latitude && record.longitude) { score += 1; factors += 1; }
    if (record.website) { score += 0.5; factors += 0.5; }
    if (record.insurance?.length > 0) { score += 0.5; factors += 0.5; }
    if (this.determineVerified(record)) { score += 1; factors += 1; }
    
    return factors > 0 ? score / factors : 0;
  }

  private async geocodeAddress(facility: TransformedFacility): Promise<{ lat: number; lng: number } | null> {
    // Implement geocoding logic here
    // For now, return null to skip geocoding
    return null;
  }

  private async removeDuplicates(records: TransformedFacility[]): Promise<TransformedFacility[]> {
    const seen = new Set<string>();
    const unique: TransformedFacility[] = [];
    
    for (const record of records) {
      const key = `${record.name}-${record.city}-${record.state}`.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(record);
      }
    }
    
    return unique;
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private async updateSyncStatus(status: SyncStatus): Promise<void> {
    try {
      await this.supabase
        .from('etl_sync_status')
        .insert({
          ...status,
          pipeline: 'findtreatment',
          created_at: new Date()
        });
    } catch (error) {
      this.logger.error('Failed to update sync status', error);
    }
  }
}