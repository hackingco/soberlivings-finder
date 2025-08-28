/**
 * Edge-optimized API route for facility search
 * Runs at the edge for minimal latency
 */

import { NextRequest } from 'next/server';
import { EdgeCacheManager, GeoDistributedCache } from '@/lib/edge-cache';
import { edgeFunctionTracker } from '@/lib/performance-monitor';

export const runtime = 'edge';
export const dynamic = 'force-static';

// Initialize cache manager (would use actual KV store in production)
const cacheManager = new EdgeCacheManager();
const geoCache = new GeoDistributedCache(cacheManager);

/**
 * Optimized search handler running at the edge
 */
export async function GET(request: NextRequest) {
  return edgeFunctionTracker.track('facilities-search', async () => {
    const searchParams = request.nextUrl.searchParams;
    const lat = parseFloat(searchParams.get('lat') || '0');
    const lon = parseFloat(searchParams.get('lon') || '0');
    const radius = parseInt(searchParams.get('radius') || '50');
    const location = searchParams.get('location');

    // Validate inputs
    if (!location && (lat === 0 || lon === 0)) {
      return new Response(
        JSON.stringify({ error: 'Location or coordinates required' }),
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
          }
        }
      );
    }

    try {
      // Use geo-distributed cache for location-based queries
      const facilities = await geoCache.getNearbyFacilities(
        lat,
        lon,
        radius,
        async () => {
          // Fetch from origin API
          const response = await fetch(
            `${process.env.FINDTREATMENT_API_URL}/exportsAsJson/v2?` +
            new URLSearchParams({
              latitude: lat.toString(),
              longitude: lon.toString(),
              radius: radius.toString(),
              sType: 'residential',
            }),
            {
              next: { revalidate: 3600 }, // ISR: revalidate every hour
            }
          );

          if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
          }

          const data = await response.json();
          
          // Process and optimize data at the edge
          return processAndOptimizeFacilities(data);
        }
      );

      // Prefetch adjacent cells for better UX
      geoCache.prefetchAdjacentCells(lat, lon, radius, async (gridLat, gridLon) => {
        // Prefetch logic
        return fetch(
          `${process.env.FINDTREATMENT_API_URL}/exportsAsJson/v2?` +
          new URLSearchParams({
            latitude: gridLat.toString(),
            longitude: gridLon.toString(),
            radius: radius.toString(),
            sType: 'residential',
          })
        ).then(res => res.json());
      });

      // Return optimized response
      return new Response(
        JSON.stringify({
          facilities,
          meta: {
            total: facilities.length,
            location: { lat, lon },
            radius,
            cached: true,
            timestamp: Date.now()
          }
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
            'X-Cache-Status': 'HIT',
            'X-Edge-Location': request.headers.get('CF-Ray') || 'unknown',
          }
        }
      );
    } catch (error) {
      console.error('Search error:', error);
      
      // Return cached data if available, even if stale
      const staleKey = `facilities:${Math.floor(lat / 0.1) * 0.1}:${Math.floor(lon / 0.1) * 0.1}:${radius}`;
      const staleData = await cacheManager.get(
        staleKey,
        async () => null,
        { ttl: 0 }
      );

      if (staleData && Array.isArray(staleData)) {
        return new Response(
          JSON.stringify({
            facilities: staleData,
            meta: {
              total: staleData.length,
              location: { lat, lon },
              radius,
              cached: true,
              stale: true,
              timestamp: Date.now()
            }
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 's-maxage=300, stale-while-revalidate=86400',
              'X-Cache-Status': 'STALE',
            }
          }
        );
      }

      // Return error response
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch facilities',
          message: error instanceof Error ? error.message : 'Unknown error'
        }),
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
          }
        }
      );
    }
  });
}

/**
 * Process and optimize facility data at the edge
 */
function processAndOptimizeFacilities(data: any[]): any[] {
  if (!Array.isArray(data)) return [];

  return data
    .filter((facility: any) => {
      // Filter for residential facilities
      const services = facility.services || [];
      return services.some((s: string) => 
        s.toLowerCase().includes('residential') ||
        s.toLowerCase().includes('sober living')
      );
    })
    .map((facility: any) => ({
      // Optimize payload size by including only necessary fields
      id: facility.id,
      name: facility.name,
      address: {
        street: facility.street,
        city: facility.city,
        state: facility.state,
        zip: facility.zip
      },
      location: {
        lat: facility.latitude,
        lon: facility.longitude
      },
      phone: facility.phone,
      website: facility.website,
      services: facility.services?.filter((s: string) => 
        s.toLowerCase().includes('residential')
      ),
      // Add computed fields at the edge
      distance: null, // Will be computed client-side
      rating: facility.rating || null,
      capacity: facility.capacity || null,
    }))
    .slice(0, 100); // Limit results for performance
}

/**
 * Handle CORS preflight for edge function
 */
export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400', // 24 hours
    }
  });
}