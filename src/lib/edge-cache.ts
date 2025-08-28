/**
 * Edge-native caching strategy for SoberLivings Finder
 * Implements multi-tier caching with intelligent invalidation
 */

import { unstable_cache } from 'next/cache';

// Edge-native KV store interface (Vercel KV, Cloudflare KV, etc.)
interface EdgeKVStore {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, options?: { ex?: number }) => Promise<void>;
  del: (key: string) => Promise<void>;
  scan: (pattern: string) => Promise<string[]>;
}

/**
 * Multi-tier caching strategy
 * L1: Edge Runtime Memory (microseconds)
 * L2: Edge KV Store (milliseconds)
 * L3: Database (tens of milliseconds)
 */
export class EdgeCacheManager {
  private l1Cache: Map<string, { value: any; ttl: number }> = new Map();
  private kvStore?: EdgeKVStore;

  constructor(kvStore?: EdgeKVStore) {
    this.kvStore = kvStore;
    // Periodic cleanup of L1 cache
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.cleanupL1Cache(), 60000); // Every minute
    }
  }

  /**
   * Get data with multi-tier fallback
   */
  async get<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: {
      ttl?: number; // Time to live in seconds
      staleWhileRevalidate?: number; // Serve stale content while revalidating
      tags?: string[]; // Cache tags for invalidation
    } = {}
  ): Promise<T> {
    const { ttl = 3600, staleWhileRevalidate = 60, tags = [] } = options;

    // L1: Check memory cache
    const l1Data = this.l1Cache.get(key);
    if (l1Data && l1Data.ttl > Date.now()) {
      return l1Data.value;
    }

    // L2: Check KV store
    if (this.kvStore) {
      const kvData = await this.kvStore.get(key);
      if (kvData) {
        const parsed = JSON.parse(kvData);
        const isStale = parsed.expires < Date.now();
        
        if (!isStale || (isStale && parsed.expires + staleWhileRevalidate * 1000 > Date.now())) {
          // Update L1 cache
          this.l1Cache.set(key, {
            value: parsed.value,
            ttl: isStale ? Date.now() + 5000 : parsed.expires // Short TTL if stale
          });

          // Revalidate in background if stale
          if (isStale) {
            this.revalidateInBackground(key, fetcher, ttl, tags);
          }

          return parsed.value;
        }
      }
    }

    // L3: Fetch fresh data
    const freshData = await fetcher();
    
    // Update all cache layers
    await this.set(key, freshData, { ttl, tags });
    
    return freshData;
  }

  /**
   * Set data in all cache layers
   */
  async set<T>(
    key: string,
    value: T,
    options: {
      ttl?: number;
      tags?: string[];
    } = {}
  ): Promise<void> {
    const { ttl = 3600, tags = [] } = options;
    const expires = Date.now() + ttl * 1000;

    // Update L1
    this.l1Cache.set(key, { value, ttl: expires });

    // Update L2
    if (this.kvStore) {
      const cacheData = {
        value,
        expires,
        tags,
        timestamp: Date.now()
      };
      await this.kvStore.set(key, JSON.stringify(cacheData), { ex: ttl });
    }
  }

  /**
   * Invalidate cache by key pattern or tags
   */
  async invalidate(pattern: string | { tags: string[] }): Promise<void> {
    if (typeof pattern === 'string') {
      // Invalidate by key pattern
      for (const [key] of this.l1Cache) {
        if (key.includes(pattern)) {
          this.l1Cache.delete(key);
        }
      }
      
      if (this.kvStore) {
        const keys = await this.kvStore.scan(pattern);
        await Promise.all(keys.map(key => this.kvStore!.del(key)));
      }
    } else {
      // Invalidate by tags
      // Implementation depends on how tags are stored
      // This is a simplified version
      for (const [key, data] of this.l1Cache) {
        this.l1Cache.delete(key);
      }
    }
  }

  /**
   * Background revalidation for stale-while-revalidate
   */
  private async revalidateInBackground<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number,
    tags: string[]
  ): Promise<void> {
    try {
      const freshData = await fetcher();
      await this.set(key, freshData, { ttl, tags });
    } catch (error) {
      console.error(`Failed to revalidate cache for key ${key}:`, error);
    }
  }

  /**
   * Cleanup expired entries from L1 cache
   */
  private cleanupL1Cache(): void {
    const now = Date.now();
    for (const [key, data] of this.l1Cache) {
      if (data.ttl < now) {
        this.l1Cache.delete(key);
      }
    }
  }
}

/**
 * Geo-distributed caching for location-based queries
 */
export class GeoDistributedCache {
  private cacheManager: EdgeCacheManager;
  private readonly GRID_SIZE = 0.1; // ~11km grid cells

  constructor(cacheManager: EdgeCacheManager) {
    this.cacheManager = cacheManager;
  }

  /**
   * Get nearby facilities with geo-aware caching
   */
  async getNearbyFacilities(
    lat: number,
    lon: number,
    radius: number,
    fetcher: () => Promise<any>
  ): Promise<any> {
    // Round to grid cell for cache key
    const gridLat = Math.floor(lat / this.GRID_SIZE) * this.GRID_SIZE;
    const gridLon = Math.floor(lon / this.GRID_SIZE) * this.GRID_SIZE;
    
    const cacheKey = `facilities:${gridLat}:${gridLon}:${radius}`;
    
    return this.cacheManager.get(
      cacheKey,
      fetcher,
      {
        ttl: 3600, // 1 hour
        staleWhileRevalidate: 300, // 5 minutes
        tags: ['facilities', `grid:${gridLat}:${gridLon}`]
      }
    );
  }

  /**
   * Prefetch adjacent grid cells for smoother UX
   */
  async prefetchAdjacentCells(
    lat: number,
    lon: number,
    radius: number,
    fetcher: (lat: number, lon: number) => Promise<any>
  ): Promise<void> {
    const gridLat = Math.floor(lat / this.GRID_SIZE) * this.GRID_SIZE;
    const gridLon = Math.floor(lon / this.GRID_SIZE) * this.GRID_SIZE;
    
    const adjacentCells = [
      [gridLat - this.GRID_SIZE, gridLon],
      [gridLat + this.GRID_SIZE, gridLon],
      [gridLat, gridLon - this.GRID_SIZE],
      [gridLat, gridLon + this.GRID_SIZE],
    ];

    // Prefetch in background
    Promise.all(
      adjacentCells.map(([lat, lon]) =>
        this.cacheManager.get(
          `facilities:${lat}:${lon}:${radius}`,
          () => fetcher(lat, lon),
          { ttl: 1800 } // 30 minutes for prefetched data
        ).catch(() => {}) // Ignore prefetch errors
      )
    );
  }
}

/**
 * Next.js specific cache utilities
 */
export const facilitiesCache = unstable_cache(
  async (location: string) => {
    // This will be cached at the edge
    return fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/facilities/search?location=${location}`);
  },
  ['facilities'],
  {
    revalidate: 3600, // 1 hour
    tags: ['facilities']
  }
);

/**
 * Smart cache warming strategy
 */
export class CacheWarmer {
  private popularLocations = [
    { lat: 34.0522, lon: -118.2437, name: 'Los Angeles' },
    { lat: 40.7128, lon: -74.0060, name: 'New York' },
    { lat: 41.8781, lon: -87.6298, name: 'Chicago' },
    { lat: 29.7604, lon: -95.3698, name: 'Houston' },
    { lat: 33.4484, lon: -112.0740, name: 'Phoenix' },
  ];

  constructor(private cacheManager: EdgeCacheManager) {}

  /**
   * Warm cache for popular locations
   */
  async warmPopularLocations(): Promise<void> {
    const warmingPromises = this.popularLocations.map(async (location) => {
      const key = `facilities:${location.lat}:${location.lon}:50`;
      return this.cacheManager.get(
        key,
        async () => {
          // Fetch facilities for this location
          return fetch(`/api/facilities/search?lat=${location.lat}&lon=${location.lon}&radius=50`);
        },
        { ttl: 7200 } // 2 hours for popular locations
      );
    });

    await Promise.allSettled(warmingPromises);
  }

  /**
   * Predictive cache warming based on user patterns
   */
  async predictiveWarm(userLocation: { lat: number; lon: number }): Promise<void> {
    // Implement ML-based prediction of next likely searches
    // For now, warm nearby major cities
    const nearbyMajorCities = this.popularLocations
      .map(city => ({
        ...city,
        distance: this.calculateDistance(userLocation, city)
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);

    await Promise.allSettled(
      nearbyMajorCities.map(city => 
        this.cacheManager.get(
          `facilities:${city.lat}:${city.lon}:50`,
          async () => fetch(`/api/facilities/search?lat=${city.lat}&lon=${city.lon}`),
          { ttl: 3600 }
        )
      )
    );
  }

  private calculateDistance(
    point1: { lat: number; lon: number },
    point2: { lat: number; lon: number }
  ): number {
    // Haversine formula for distance calculation
    const R = 6371; // Earth's radius in km
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLon = (point2.lon - point1.lon) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
}