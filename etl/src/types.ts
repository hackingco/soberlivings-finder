/**
 * Type definitions for ETL Pipeline
 */

export interface FacilityRecord {
  // Source data fields (from API)
  id?: string;
  sourceId?: string;
  facilityName?: string;
  name?: string;
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  website?: string;
  latitude?: number | string;
  longitude?: number | string;
  
  // Service fields
  services?: string[] | string;
  detox?: boolean;
  residential?: boolean;
  outpatient?: boolean;
  telehealth?: boolean;
  hospital?: boolean;
  
  // Insurance fields
  insurance?: string[] | string;
  medicaid?: boolean;
  medicare?: boolean;
  privateInsurance?: boolean;
  
  // Additional fields
  amenities?: string[];
  specialties?: string[];
  populations?: string[];
  facilityType?: string;
  description?: string;
  verified?: boolean;
  isVerified?: boolean;
  certificationDate?: string;
  licenseNumber?: string;
  isResidential?: boolean;
}

export interface TransformedFacility {
  // Our schema fields
  id: string;
  name: string;
  street?: string;
  city: string;
  state: string;
  zip?: string;
  phone?: string;
  website?: string;
  latitude: number | null;
  longitude: number | null;
  
  // Service arrays
  services: string[];
  accepted_insurance: string[];
  amenities: string[];
  specialties: string[];
  
  // Metadata
  is_residential: boolean;
  facility_type: string;
  description: string;
  verified: boolean;
  data_quality: number;
  
  // System fields
  source_data: any;
  last_updated: Date;
  created_at: Date;
}

export interface ETLConfig {
  // API Configuration
  apiBaseUrl: string;
  apiKey: string;
  
  // Database Configuration
  supabaseUrl: string;
  supabaseServiceKey: string;
  
  // ETL Settings
  batchSize?: number;
  rateLimit?: number;
  maxRetries?: number;
  concurrency?: number;
  
  // Features
  enableGeocoding?: boolean;
  enableDeduplication?: boolean;
  enableValidation?: boolean;
}

export interface ETLMetrics {
  startTime: number;
  endTime: number;
  duration: number;
  recordsExtracted: number;
  recordsTransformed: number;
  recordsValidated: number;
  recordsLoaded: number;
  recordsRejected: number;
  apiCalls: number;
  errors: number;
}

export interface SyncStatus {
  lastSync: Date;
  recordsProcessed: number;
  recordsLoaded: number;
  recordsRejected: number;
  duration: number;
  pipeline?: string;
  created_at?: Date;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  qualityScore: number;
}

export interface GeocodingResult {
  lat: number;
  lng: number;
  confidence: number;
  source: string;
}