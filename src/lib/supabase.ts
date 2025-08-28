import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Database types for better TypeScript support
export interface Database {
  public: {
    Tables: {
      facilities: {
        Row: {
          id: string
          name: string
          street?: string
          city: string
          state: string
          zip?: string
          phone?: string
          website?: string
          latitude?: number
          longitude?: number
          residentialServices?: string
          allServices?: string
          services: string[]
          metadata?: any
          sourceData?: any
          geoHash?: string
          isResidential: boolean
          serviceCount: number
          verified: boolean
          dataQuality?: number
          lastUpdated: string
          createdAt: string
          searchLocation?: string
          searchCoordinates?: string
          averageRating?: number
        }
        Insert: {
          id?: string
          name: string
          street?: string
          city: string
          state: string
          zip?: string
          phone?: string
          website?: string
          latitude?: number
          longitude?: number
          residentialServices?: string
          allServices?: string
          services?: string[]
          metadata?: any
          sourceData?: any
          geoHash?: string
          isResidential?: boolean
          serviceCount?: number
          verified?: boolean
          dataQuality?: number
          lastUpdated?: string
          createdAt?: string
          searchLocation?: string
          searchCoordinates?: string
          averageRating?: number
        }
        Update: {
          name?: string
          street?: string
          city?: string
          state?: string
          zip?: string
          phone?: string
          website?: string
          latitude?: number
          longitude?: number
          residentialServices?: string
          allServices?: string
          services?: string[]
          metadata?: any
          sourceData?: any
          geoHash?: string
          isResidential?: boolean
          serviceCount?: number
          verified?: boolean
          dataQuality?: number
          lastUpdated?: string
          searchLocation?: string
          searchCoordinates?: string
          averageRating?: number
        }
      }
      reviews: {
        Row: {
          id: string
          facilityId: string
          rating: number
          title?: string
          content?: string
          author?: string
          verified: boolean
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          facilityId: string
          rating: number
          title?: string
          content?: string
          author?: string
          verified?: boolean
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          rating?: number
          title?: string
          content?: string
          author?: string
          verified?: boolean
          updatedAt?: string
        }
      }
    }
  }
}

// Create typed Supabase client
export const supabase: SupabaseClient<Database> | null = supabaseUrl && supabaseAnonKey 
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false, // Disable session persistence for better Edge compatibility
      },
      global: {
        headers: {
          'X-Client-Info': 'soberlivings-finder/1.0.0',
        },
      },
      // Configure for production performance
      db: {
        schema: 'public',
      },
      realtime: {
        params: {
          eventsPerSecond: 10, // Limit real-time events for performance
        },
      },
    })
  : null

/**
 * Enhanced Supabase utilities with error handling and performance optimizations
 */
export class SupabaseService {
  private client: SupabaseClient<Database> | null
  private retryAttempts = 3
  private retryDelay = 1000 // ms

  constructor(client: SupabaseClient<Database> | null = supabase) {
    this.client = client
  }

  /**
   * Execute query with retry logic and error handling
   */
  private async executeWithRetry<T>(
    operation: () => Promise<{ data: T | null; error: any }>,
    operationName: string
  ): Promise<{ data: T | null; error: any }> {
    let lastError: any = null

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const result = await operation()
        
        if (!result.error) {
          return result
        }
        
        lastError = result.error
        
        // Don't retry on certain error types
        if (result.error?.code === 'PGRST116' || // Row not found
            result.error?.code === '23505' ||    // Unique constraint violation
            result.error?.message?.includes('invalid input syntax')) {
          break
        }
        
        if (attempt < this.retryAttempts) {
          console.warn(`${operationName} attempt ${attempt} failed, retrying...`, result.error)
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt))
        }
      } catch (error) {
        lastError = error
        if (attempt < this.retryAttempts) {
          console.warn(`${operationName} attempt ${attempt} failed with exception, retrying...`, error)
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt))
        }
      }
    }

    return { data: null, error: lastError }
  }

  /**
   * Search facilities with advanced filtering and performance optimization
   */
  async searchFacilities({
    query = '',
    location = '',
    services = [],
    insurance = [],
    radius = 25,
    limit = 50,
    lat,
    lon
  }: {
    query?: string
    location?: string
    services?: string[]
    insurance?: string[]
    radius?: number
    limit?: number
    lat?: number
    lon?: number
  }) {
    if (!this.client) {
      return { data: null, error: new Error('Supabase client not initialized') }
    }

    return this.executeWithRetry(async () => {
      let queryBuilder = this.client!
        .from('facilities')
        .select(`
          id,
          name,
          street,
          city,
          state,
          zip,
          phone,
          website,
          latitude,
          longitude,
          residentialServices,
          allServices,
          services,
          isResidential,
          verified,
          dataQuality,
          averageRating,
          serviceCount
        `)
        .eq('isResidential', true)
        .limit(limit)

      // Text search
      if (query) {
        queryBuilder = queryBuilder.or(
          `name.ilike.%${query}%,city.ilike.%${query}%,services.cs.{${query}}`
        )
      }

      // Location filtering
      if (location) {
        const locationParts = location.split(',').map(p => p.trim())
        if (locationParts.length >= 2) {
          queryBuilder = queryBuilder
            .ilike('city', `%${locationParts[0]}%`)
            .ilike('state', `%${locationParts[1]}%`)
        } else {
          queryBuilder = queryBuilder.or(
            `city.ilike.%${location}%,state.ilike.%${location}%`
          )
        }
      }

      // Service filtering
      if (services.length > 0) {
        queryBuilder = queryBuilder.overlaps('services', services)
      }

      // Geographic filtering (if coordinates provided)
      if (lat && lon && radius) {
        // Use PostGIS for radius-based search (requires PostGIS extension)
        queryBuilder = queryBuilder.rpc('nearby_facilities', {
          lat,
          lng: lon,
          radius_km: radius * 1.60934, // Convert miles to km
        })
      }

      // Order by data quality and verification status
      queryBuilder = queryBuilder
        .order('verified', { ascending: false })
        .order('dataQuality', { ascending: false, nullsLast: true })
        .order('serviceCount', { ascending: false })

      return await queryBuilder
    }, 'searchFacilities')
  }

  /**
   * Get facility by ID with related data
   */
  async getFacilityById(id: string) {
    if (!this.client) {
      return { data: null, error: new Error('Supabase client not initialized') }
    }

    return this.executeWithRetry(async () => {
      return await this.client!
        .from('facilities')
        .select(`
          *,
          reviews (
            id,
            rating,
            title,
            content,
            author,
            verified,
            createdAt
          )
        `)
        .eq('id', id)
        .single()
    }, 'getFacilityById')
  }

  /**
   * Insert or update facility with conflict resolution
   */
  async upsertFacility(facility: Database['public']['Tables']['facilities']['Insert']) {
    if (!this.client) {
      return { data: null, error: new Error('Supabase client not initialized') }
    }

    return this.executeWithRetry(async () => {
      return await this.client!
        .from('facilities')
        .upsert(facility, {
          onConflict: 'id',
          ignoreDuplicates: false
        })
        .select()
        .single()
    }, 'upsertFacility')
  }

  /**
   * Bulk upsert facilities for ETL operations
   */
  async bulkUpsertFacilities(facilities: Database['public']['Tables']['facilities']['Insert'][]) {
    if (!this.client) {
      return { data: null, error: new Error('Supabase client not initialized') }
    }

    const batchSize = 1000 // Supabase limit
    const results = []

    for (let i = 0; i < facilities.length; i += batchSize) {
      const batch = facilities.slice(i, i + batchSize)
      
      const result = await this.executeWithRetry(async () => {
        return await this.client!
          .from('facilities')
          .upsert(batch, {
            onConflict: 'id',
            ignoreDuplicates: false
          })
      }, `bulkUpsertFacilities_batch_${Math.floor(i / batchSize) + 1}`)

      results.push(result)

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < facilities.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    return {
      data: results,
      error: results.some(r => r.error) ? results.find(r => r.error)?.error : null
    }
  }

  /**
   * Get aggregated facility statistics
   */
  async getFacilityStats() {
    if (!this.client) {
      return { data: null, error: new Error('Supabase client not initialized') }
    }

    return this.executeWithRetry(async () => {
      const { data, error } = await this.client!.rpc('get_facility_stats')
      return { data, error }
    }, 'getFacilityStats')
  }

  /**
   * Health check for Supabase connection
   */
  async healthCheck(): Promise<boolean> {
    if (!this.client) return false

    try {
      const { error } = await this.client
        .from('facilities')
        .select('id')
        .limit(1)
      
      return !error
    } catch {
      return false
    }
  }
}

// Export singleton service
export const supabaseService = new SupabaseService(supabase)