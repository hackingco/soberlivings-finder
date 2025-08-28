import { NextRequest, NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase'
import { mockFacilities } from '@/lib/mock-data'
import { performanceMonitor } from '@/lib/performance-monitor'

// Use Supabase if available, fallback to mock data
const USE_SUPABASE = !!process.env.NEXT_PUBLIC_SUPABASE_URL

interface SearchFilters {
  location?: string
  radius?: number
  services?: string[]
  acceptsInsurance?: string[]
}

interface SearchQuery {
  text?: string
  location?: string
  lat?: number
  lon?: number
  radius?: number
  services?: string[]
  insurance?: string[]
  limit?: number
}

/**
 * Enhanced search API with Supabase integration, fallback to mock data,
 * performance monitoring, and comprehensive error handling
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse and validate search parameters
    const searchQuery: SearchQuery = {
      text: searchParams.get('q') || '',
      location: searchParams.get('location') || '',
      lat: searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : undefined,
      lon: searchParams.get('lon') ? parseFloat(searchParams.get('lon')!) : undefined,
      radius: parseInt(searchParams.get('radius') || '25'),
      services: searchParams.get('services')?.split(',').filter(Boolean) || [],
      insurance: searchParams.get('insurance')?.split(',').filter(Boolean) || [],
      limit: parseInt(searchParams.get('limit') || '50')
    }

    // Validate input parameters
    if (searchQuery.limit && (searchQuery.limit < 1 || searchQuery.limit > 100)) {
      return NextResponse.json({ 
        error: 'Limit must be between 1 and 100' 
      }, { status: 400 })
    }

    if (searchQuery.radius && (searchQuery.radius < 1 || searchQuery.radius > 500)) {
      return NextResponse.json({ 
        error: 'Radius must be between 1 and 500 miles' 
      }, { status: 400 })
    }

    // Try Supabase first if configured
    if (USE_SUPABASE) {
      console.log('🔍 Using Supabase for search:', { 
        query: searchQuery.text?.substring(0, 50),
        location: searchQuery.location,
        hasCoords: !!(searchQuery.lat && searchQuery.lon)
      })
      
      try {
        const { data: facilities, error } = await supabaseService.searchFacilities({
          query: searchQuery.text,
          location: searchQuery.location,
          lat: searchQuery.lat,
          lon: searchQuery.lon,
          radius: searchQuery.radius,
          services: searchQuery.services,
          insurance: searchQuery.insurance,
          limit: searchQuery.limit
        })

        if (error) {
          console.warn('Supabase search failed, falling back to mock data:', error)
          // Fall through to mock data
        } else if (facilities) {
          const duration = Date.now() - startTime
          
          // Log performance metrics
          if (typeof window !== 'undefined' && performanceMonitor) {
            performanceMonitor.recordMetric('api.search.supabase', duration, {
              resultCount: facilities.length.toString(),
              hasLocation: (!!searchQuery.location).toString()
            })
          }

          return NextResponse.json({
            facilities,
            count: facilities.length,
            query: searchQuery,
            source: 'supabase',
            duration,
            cached: false
          }, {
            headers: {
              'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
              'X-Source': 'supabase',
              'X-Duration': duration.toString()
            }
          })
        }
      } catch (supabaseError) {
        console.error('Supabase connection error, falling back to mock data:', supabaseError)
        // Continue to mock data fallback
      }
    }
    
    // Fallback to mock data
    console.log('📋 Using mock data for search')
    
    const mockResults = await searchMockData(searchQuery)
    const duration = Date.now() - startTime
    
    // Log performance metrics
    if (typeof window !== 'undefined' && performanceMonitor) {
      performanceMonitor.recordMetric('api.search.mock', duration, {
        resultCount: mockResults.facilities.length.toString()
      })
    }

    return NextResponse.json({
      ...mockResults,
      source: 'mock',
      duration,
      cached: false
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        'X-Source': 'mock',
        'X-Duration': duration.toString()
      }
    })
    
  } catch (error) {
    console.error('Search API error:', error)
    
    const errorResponse = {
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    }
    
    return NextResponse.json(errorResponse, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-store',
        'X-Error': 'true'
      }
    })
  }
}

/**
 * Enhanced mock data search with better filtering and performance
 */
async function searchMockData(searchQuery: SearchQuery) {
  let filteredFacilities = [...mockFacilities]
  
  // Apply text search filter with fuzzy matching
  if (searchQuery.text) {
    const searchTerms = searchQuery.text.toLowerCase().split(' ').filter(Boolean)
    filteredFacilities = filteredFacilities.filter(facility => {
      const searchText = `
        ${facility.name} 
        ${facility.city} 
        ${facility.state} 
        ${facility.residentialServices || ''} 
        ${facility.allServices || ''}
      `.toLowerCase()
      
      return searchTerms.every(term => searchText.includes(term))
    })
  }
  
  // Apply location filter with improved matching
  if (searchQuery.location) {
    const locationParts = searchQuery.location.split(',').map(part => part.trim().toLowerCase())
    
    if (locationParts.length >= 2) {
      const [city, state] = locationParts
      filteredFacilities = filteredFacilities.filter(facility =>
        facility.city.toLowerCase().includes(city) &&
        (facility.state.toLowerCase().includes(state) || 
         facility.state.toLowerCase() === state)
      )
    } else {
      const location = locationParts[0]
      filteredFacilities = filteredFacilities.filter(facility =>
        facility.city.toLowerCase().includes(location) ||
        facility.state.toLowerCase().includes(location) ||
        facility.zip?.includes(location)
      )
    }
  }
  
  // Apply geographic filtering if coordinates provided
  if (searchQuery.lat && searchQuery.lon && searchQuery.radius) {
    filteredFacilities = filteredFacilities.filter(facility => {
      if (!facility.latitude || !facility.longitude) return false
      
      const distance = calculateDistance(
        searchQuery.lat!,
        searchQuery.lon!,
        facility.latitude,
        facility.longitude
      )
      
      // Add distance to facility for sorting
      ;(facility as any).distance = distance
      
      return distance <= searchQuery.radius!
    })
  }
  
  // Apply service filters with partial matching
  if (searchQuery.services && searchQuery.services.length > 0) {
    filteredFacilities = filteredFacilities.filter(facility => {
      const facilityServices = [
        ...(facility.residentialServices?.split(';') || []),
        ...(facility.allServices?.split(';') || [])
      ].map(s => s.trim().toLowerCase())
      
      return searchQuery.services!.some(searchService =>
        facilityServices.some(facilityService =>
          facilityService.includes(searchService.toLowerCase()) ||
          searchService.toLowerCase().includes(facilityService)
        )
      )
    })
  }
  
  // Apply insurance filters
  if (searchQuery.insurance && searchQuery.insurance.length > 0) {
    filteredFacilities = filteredFacilities.filter(facility =>
      searchQuery.insurance!.some(ins =>
        facility.acceptedInsurance?.some(acceptedIns =>
          acceptedIns.toLowerCase().includes(ins.toLowerCase()) ||
          ins.toLowerCase().includes(acceptedIns.toLowerCase())
        )
      )
    )
  }
  
  // Enhanced sorting algorithm
  const sortedFacilities = filteredFacilities
    .sort((a, b) => {
      // Prioritize verified facilities
      if (a.verified !== b.verified) {
        return b.verified ? 1 : -1
      }
      
      // Then by distance if available
      const aDistance = (a as any).distance || 0
      const bDistance = (b as any).distance || 0
      if (aDistance !== bDistance) {
        return aDistance - bDistance
      }
      
      // Then by data quality if available
      const aQuality = (a as any).dataQuality || 0
      const bQuality = (b as any).dataQuality || 0
      if (aQuality !== bQuality) {
        return bQuality - aQuality
      }
      
      // Finally by name alphabetically
      return a.name.localeCompare(b.name)
    })
    .slice(0, searchQuery.limit || 50)

  return {
    facilities: sortedFacilities,
    count: sortedFacilities.length,
    totalCount: filteredFacilities.length,
    query: searchQuery,
    mock: true
  }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959 // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

/**
 * OPTIONS handler for CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  })
}