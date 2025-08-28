/**
 * Database optimization utilities for enhanced performance
 * Includes query optimization, connection pooling, and caching strategies
 */

import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'
import { supabaseService, Database } from './supabase'

interface QueryPerformanceMetrics {
  queryName: string
  duration: number
  rowsAffected?: number
  cacheHit?: boolean
  timestamp: number
}

interface DatabaseHealth {
  connectionStatus: 'connected' | 'disconnected' | 'degraded'
  responseTime: number
  activeConnections?: number
  queuedQueries?: number
  lastError?: string
  timestamp: number
}

/**
 * Enhanced Prisma client with connection pooling and monitoring
 */
export class OptimizedPrismaClient extends PrismaClient {
  private performanceMetrics: QueryPerformanceMetrics[] = []
  private connectionHealth: DatabaseHealth | null = null
  private queryCache = new Map<string, { data: any; expires: number }>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes
  private readonly MAX_METRICS = 1000

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    })

    this.setupMonitoring()
  }

  private setupMonitoring() {
    // Monitor query performance
    this.$on('query', (e) => {
      const metric: QueryPerformanceMetrics = {
        queryName: this.extractQueryName(e.query),
        duration: e.duration,
        timestamp: Date.now(),
      }

      this.performanceMetrics.push(metric)

      // Keep only last 1000 metrics
      if (this.performanceMetrics.length > this.MAX_METRICS) {
        this.performanceMetrics.shift()
      }

      // Log slow queries
      if (e.duration > 1000) {
        console.warn(`Slow query detected: ${metric.queryName} (${e.duration}ms)`)
      }
    })

    // Monitor errors
    this.$on('error', (e) => {
      console.error('Database error:', e)
      this.connectionHealth = {
        connectionStatus: 'degraded',
        responseTime: -1,
        lastError: e.message,
        timestamp: Date.now(),
      }
    })

    // Periodic health checks
    setInterval(() => this.healthCheck(), 30000) // Every 30 seconds
  }

  private extractQueryName(query: string): string {
    // Extract meaningful query name from SQL
    const trimmed = query.trim()
    if (trimmed.startsWith('SELECT')) return 'SELECT'
    if (trimmed.startsWith('INSERT')) return 'INSERT'
    if (trimmed.startsWith('UPDATE')) return 'UPDATE'
    if (trimmed.startsWith('DELETE')) return 'DELETE'
    return 'UNKNOWN'
  }

  /**
   * Execute query with caching and performance monitoring
   */
  async cachedQuery<T>(
    cacheKey: string,
    queryFn: () => Promise<T>,
    ttl: number = this.CACHE_TTL
  ): Promise<T> {
    const startTime = Date.now()

    // Check cache first
    const cached = this.queryCache.get(cacheKey)
    if (cached && cached.expires > Date.now()) {
      this.recordMetric(cacheKey, Date.now() - startTime, true)
      return cached.data
    }

    // Execute query
    const result = await queryFn()
    const duration = Date.now() - startTime

    // Cache result
    this.queryCache.set(cacheKey, {
      data: result,
      expires: Date.now() + ttl,
    })

    this.recordMetric(cacheKey, duration, false)
    return result
  }

  private recordMetric(queryName: string, duration: number, cacheHit: boolean) {
    const metric: QueryPerformanceMetrics = {
      queryName,
      duration,
      cacheHit,
      timestamp: Date.now(),
    }

    this.performanceMetrics.push(metric)

    if (this.performanceMetrics.length > this.MAX_METRICS) {
      this.performanceMetrics.shift()
    }
  }

  /**
   * Optimized facility search with proper indexing
   */
  async searchFacilitiesOptimized(params: {
    query?: string
    location?: string
    lat?: number
    lon?: number
    radius?: number
    services?: string[]
    insurance?: string[]
    limit?: number
    offset?: number
  }) {
    const cacheKey = `search:${JSON.stringify(params)}`

    return this.cachedQuery(
      cacheKey,
      async () => {
        let whereClause: any = {
          isResidential: true,
        }

        // Text search with full-text capabilities
        if (params.query) {
          whereClause.OR = [
            { name: { contains: params.query, mode: 'insensitive' } },
            { city: { contains: params.query, mode: 'insensitive' } },
            { services: { hasSome: [params.query] } },
          ]
        }

        // Location filtering
        if (params.location) {
          const locationParts = params.location.split(',').map(p => p.trim())
          if (locationParts.length >= 2) {
            whereClause.city = { contains: locationParts[0], mode: 'insensitive' }
            whereClause.state = { contains: locationParts[1], mode: 'insensitive' }
          } else {
            whereClause.OR = [
              { city: { contains: params.location, mode: 'insensitive' } },
              { state: { contains: params.location, mode: 'insensitive' } },
            ]
          }
        }

        // Service filtering
        if (params.services && params.services.length > 0) {
          whereClause.services = {
            hasSome: params.services,
          }
        }

        // Geographic search using raw SQL for better performance
        let facilities
        if (params.lat && params.lon && params.radius) {
          facilities = await this.$queryRaw`
            SELECT 
              id, name, street, city, state, zip, phone, website,
              latitude, longitude, "residentialServices", "allServices",
              services, "isResidential", verified, "dataQuality",
              "averageRating", "serviceCount",
              (
                6371 * acos(
                  cos(radians(${params.lat})) * cos(radians(latitude)) *
                  cos(radians(longitude) - radians(${params.lon})) +
                  sin(radians(${params.lat})) * sin(radians(latitude))
                )
              ) AS distance
            FROM facilities
            WHERE 
              "isResidential" = true
              AND latitude IS NOT NULL 
              AND longitude IS NOT NULL
              AND (
                6371 * acos(
                  cos(radians(${params.lat})) * cos(radians(latitude)) *
                  cos(radians(longitude) - radians(${params.lon})) +
                  sin(radians(${params.lat})) * sin(radians(latitude))
                )
              ) <= ${params.radius}
            ORDER BY distance, verified DESC, "dataQuality" DESC NULLS LAST
            LIMIT ${params.limit || 50}
            OFFSET ${params.offset || 0}
          `
        } else {
          facilities = await this.facility.findMany({
            where: whereClause,
            select: {
              id: true,
              name: true,
              street: true,
              city: true,
              state: true,
              zip: true,
              phone: true,
              website: true,
              latitude: true,
              longitude: true,
              residentialServices: true,
              allServices: true,
              services: true,
              isResidential: true,
              verified: true,
              dataQuality: true,
              averageRating: true,
              serviceCount: true,
            },
            orderBy: [
              { verified: 'desc' },
              { dataQuality: 'desc' },
              { serviceCount: 'desc' },
              { name: 'asc' },
            ],
            take: params.limit || 50,
            skip: params.offset || 0,
          })
        }

        return facilities
      },
      2 * 60 * 1000 // 2 minute cache for searches
    )
  }

  /**
   * Bulk upsert with conflict resolution and batch optimization
   */
  async bulkUpsertFacilities(facilities: any[]) {
    const batchSize = 500
    const results = []

    for (let i = 0; i < facilities.length; i += batchSize) {
      const batch = facilities.slice(i, i + batchSize)

      try {
        const result = await this.$transaction(async (tx) => {
          // Use ON CONFLICT for better performance
          return await tx.$executeRaw`
            INSERT INTO facilities (
              id, name, street, city, state, zip, phone, website,
              latitude, longitude, "residentialServices", "allServices",
              services, "isResidential", verified, "dataQuality",
              "serviceCount", metadata, "sourceData", "geoHash", "lastUpdated"
            )
            VALUES ${batch.map((_, idx) => `($${idx * 21 + 1}, $${idx * 21 + 2}, $${idx * 21 + 3}, $${idx * 21 + 4}, $${idx * 21 + 5}, $${idx * 21 + 6}, $${idx * 21 + 7}, $${idx * 21 + 8}, $${idx * 21 + 9}, $${idx * 21 + 10}, $${idx * 21 + 11}, $${idx * 21 + 12}, $${idx * 21 + 13}, $${idx * 21 + 14}, $${idx * 21 + 15}, $${idx * 21 + 16}, $${idx * 21 + 17}, $${idx * 21 + 18}, $${idx * 21 + 19}, $${idx * 21 + 20}, $${idx * 21 + 21})`).join(', ')}
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              street = EXCLUDED.street,
              city = EXCLUDED.city,
              state = EXCLUDED.state,
              zip = EXCLUDED.zip,
              phone = EXCLUDED.phone,
              website = EXCLUDED.website,
              latitude = EXCLUDED.latitude,
              longitude = EXCLUDED.longitude,
              "residentialServices" = EXCLUDED."residentialServices",
              "allServices" = EXCLUDED."allServices",
              services = EXCLUDED.services,
              "isResidential" = EXCLUDED."isResidential",
              verified = EXCLUDED.verified,
              "dataQuality" = EXCLUDED."dataQuality",
              "serviceCount" = EXCLUDED."serviceCount",
              metadata = EXCLUDED.metadata,
              "sourceData" = EXCLUDED."sourceData",
              "geoHash" = EXCLUDED."geoHash",
              "lastUpdated" = EXCLUDED."lastUpdated"
          `
        })

        results.push(result)
      } catch (error) {
        console.error(`Batch ${Math.floor(i / batchSize) + 1} failed:`, error)
        results.push(null)
      }

      // Small delay to prevent overwhelming the database
      if (i + batchSize < facilities.length) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }

    return results
  }

  /**
   * Create optimized indexes for performance
   */
  async createOptimizedIndexes() {
    const indexQueries = [
      // Geospatial index for location-based queries
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_facilities_location 
       ON facilities USING GIST (point(longitude, latitude))`,

      // Composite index for common searches
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_facilities_search 
       ON facilities(state, city, "isResidential") 
       WHERE "isResidential" = true`,

      // Full-text search index
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_facilities_text_search 
       ON facilities USING GIN (to_tsvector('english', name || ' ' || COALESCE("allServices", '')))`,

      // Services array index
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_facilities_services 
       ON facilities USING GIN(services)`,

      // Quality and verification index
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_facilities_quality 
       ON facilities(verified, "dataQuality" DESC NULLS LAST, "serviceCount" DESC) 
       WHERE "isResidential" = true`,

      // Geo-hash index for grid-based caching
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_facilities_geohash 
       ON facilities("geoHash") WHERE "geoHash" IS NOT NULL`,
    ]

    for (const query of indexQueries) {
      try {
        await this.$executeRawUnsafe(query)
        console.log('✅ Index created successfully')
      } catch (error) {
        // Index might already exist
        if (!error.message.includes('already exists')) {
          console.error('Index creation failed:', error)
        }
      }
    }
  }

  /**
   * Get performance metrics and recommendations
   */
  getPerformanceReport(): {
    metrics: QueryPerformanceMetrics[]
    avgDuration: number
    slowQueries: QueryPerformanceMetrics[]
    cacheHitRate: number
    recommendations: string[]
  } {
    const recommendations: string[] = []
    const slowQueries = this.performanceMetrics.filter(m => m.duration > 500)
    const cacheableQueries = this.performanceMetrics.filter(m => m.cacheHit !== undefined)
    const cacheHits = cacheableQueries.filter(m => m.cacheHit).length
    const cacheHitRate = cacheableQueries.length > 0 ? cacheHits / cacheableQueries.length : 0

    const avgDuration = this.performanceMetrics.reduce((sum, m) => sum + m.duration, 0) / 
      this.performanceMetrics.length

    // Generate recommendations
    if (avgDuration > 200) {
      recommendations.push('Average query time is high. Consider optimizing slow queries.')
    }

    if (slowQueries.length > this.performanceMetrics.length * 0.1) {
      recommendations.push('High number of slow queries detected. Review indexing strategy.')
    }

    if (cacheHitRate < 0.7 && cacheableQueries.length > 10) {
      recommendations.push('Cache hit rate is low. Consider increasing cache TTL or warming cache.')
    }

    return {
      metrics: this.performanceMetrics,
      avgDuration,
      slowQueries,
      cacheHitRate,
      recommendations,
    }
  }

  /**
   * Health check with connection pool status
   */
  async healthCheck(): Promise<DatabaseHealth> {
    const startTime = Date.now()

    try {
      await this.facility.findFirst({
        select: { id: true },
        take: 1,
      })

      const responseTime = Date.now() - startTime
      this.connectionHealth = {
        connectionStatus: responseTime < 500 ? 'connected' : 'degraded',
        responseTime,
        timestamp: Date.now(),
      }

      return this.connectionHealth
    } catch (error) {
      this.connectionHealth = {
        connectionStatus: 'disconnected',
        responseTime: Date.now() - startTime,
        lastError: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      }

      return this.connectionHealth
    }
  }

  /**
   * Clear query cache (useful for testing or cache invalidation)
   */
  clearCache(pattern?: string) {
    if (pattern) {
      for (const [key] of this.queryCache) {
        if (key.includes(pattern)) {
          this.queryCache.delete(key)
        }
      }
    } else {
      this.queryCache.clear()
    }
  }
}

/**
 * Database maintenance and optimization utilities
 */
export class DatabaseMaintenance {
  private client: OptimizedPrismaClient

  constructor(client: OptimizedPrismaClient) {
    this.client = client
  }

  /**
   * Analyze and optimize table statistics
   */
  async analyzeTablesPerformance() {
    try {
      // Get table statistics
      const stats = await this.client.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_tuples,
          n_dead_tup as dead_tuples,
          last_vacuum,
          last_autovacuum,
          last_analyze,
          last_autoanalyze
        FROM pg_stat_user_tables 
        WHERE schemaname = 'public'
      `

      // Run ANALYZE on tables that haven't been analyzed recently
      await this.client.$executeRaw`ANALYZE facilities`

      return stats
    } catch (error) {
      console.error('Table analysis failed:', error)
      return null
    }
  }

  /**
   * Clean up orphaned data and optimize storage
   */
  async cleanupDatabase() {
    try {
      // Remove facilities with invalid data
      const cleanupResult = await this.client.facility.deleteMany({
        where: {
          OR: [
            { name: { equals: '' } },
            { city: { equals: '' } },
            { state: { equals: '' } },
            { AND: [{ latitude: null }, { longitude: null }] },
          ],
        },
      })

      // Update data quality scores for facilities without scores
      await this.client.$executeRaw`
        UPDATE facilities 
        SET "dataQuality" = (
          CASE 
            WHEN phone IS NOT NULL AND website IS NOT NULL AND latitude IS NOT NULL THEN 0.9
            WHEN phone IS NOT NULL AND latitude IS NOT NULL THEN 0.7
            WHEN latitude IS NOT NULL THEN 0.5
            ELSE 0.3
          END
        )
        WHERE "dataQuality" IS NULL
      `

      return {
        deletedFacilities: cleanupResult.count,
        timestamp: new Date(),
      }
    } catch (error) {
      console.error('Database cleanup failed:', error)
      return null
    }
  }

  /**
   * Generate materialized views for common queries
   */
  async createMaterializedViews() {
    const views = [
      // Facility stats by state/city
      `CREATE MATERIALIZED VIEW IF NOT EXISTS facility_stats_by_location AS
       SELECT 
         state,
         city,
         COUNT(*) as total_facilities,
         COUNT(CASE WHEN verified THEN 1 END) as verified_facilities,
         AVG("dataQuality") as avg_quality,
         AVG("averageRating") as avg_rating,
         array_agg(DISTINCT unnest(services)) as available_services
       FROM facilities 
       WHERE "isResidential" = true
       GROUP BY state, city
       ORDER BY total_facilities DESC`,

      // Popular services
      `CREATE MATERIALIZED VIEW IF NOT EXISTS popular_services AS
       SELECT 
         unnest(services) as service,
         COUNT(*) as facility_count,
         AVG("averageRating") as avg_rating
       FROM facilities 
       WHERE "isResidential" = true AND services IS NOT NULL
       GROUP BY unnest(services)
       ORDER BY facility_count DESC`,
    ]

    for (const view of views) {
      try {
        await this.client.$executeRawUnsafe(view)
        console.log('✅ Materialized view created')
      } catch (error) {
        if (!error.message.includes('already exists')) {
          console.error('Materialized view creation failed:', error)
        }
      }
    }
  }

  /**
   * Refresh materialized views (should be run periodically)
   */
  async refreshMaterializedViews() {
    const refreshCommands = [
      'REFRESH MATERIALIZED VIEW CONCURRENTLY facility_stats_by_location',
      'REFRESH MATERIALIZED VIEW CONCURRENTLY popular_services',
    ]

    for (const command of refreshCommands) {
      try {
        await this.client.$executeRawUnsafe(command)
        console.log('✅ Materialized view refreshed')
      } catch (error) {
        console.error('Materialized view refresh failed:', error)
      }
    }
  }
}

// Export singleton instances
export const optimizedPrisma = new OptimizedPrismaClient()
export const dbMaintenance = new DatabaseMaintenance(optimizedPrisma)

// Graceful shutdown
process.on('beforeExit', async () => {
  await optimizedPrisma.$disconnect()
})

process.on('SIGINT', async () => {
  await optimizedPrisma.$disconnect()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await optimizedPrisma.$disconnect()
  process.exit(0)
})