import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Interface for search filters (used for documentation)
// interface SearchFilters {
//   location?: string
//   radius?: number
//   services?: string[]
//   acceptsInsurance?: string[]
// }

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const location = searchParams.get('location') || ''
    const radius = parseInt(searchParams.get('radius') || '25')
    const services = searchParams.get('services')?.split(',').filter(Boolean) || []
    const insurance = searchParams.get('insurance')?.split(',').filter(Boolean) || []
    
    // Build the base query
    let supabaseQuery = supabase
      .from('facilities')
      .select('*')
      .order('name')
    
    // Apply text search filter
    if (query) {
      supabaseQuery = supabaseQuery.or(
        `name.ilike.%${query}%,city.ilike.%${query}%,residentialServices.ilike.%${query}%,allServices.ilike.%${query}%`
      )
    }
    
    // Apply location filter (basic city/state matching for now)
    if (location) {
      const locationParts = location.split(',').map(part => part.trim())
      if (locationParts.length >= 2) {
        const city = locationParts[0]
        const state = locationParts[1]
        supabaseQuery = supabaseQuery
          .ilike('city', `%${city}%`)
          .ilike('state', `%${state}%`)
      } else {
        // Single location term - search both city and state
        supabaseQuery = supabaseQuery.or(
          `city.ilike.%${location}%,state.ilike.%${location}%`
        )
      }
    }
    
    // Apply service filters
    if (services.length > 0) {
      const serviceFilter = services.map(service => 
        `residentialServices.ilike.%${service}%,allServices.ilike.%${service}%`
      ).join(',')
      supabaseQuery = supabaseQuery.or(serviceFilter)
    }
    
    // Apply insurance filters
    if (insurance.length > 0) {
      const insuranceFilter = insurance.map(ins => 
        `acceptedInsurance.cs.{${ins}}`
      ).join(',')
      supabaseQuery = supabaseQuery.or(insuranceFilter)
    }
    
    // Limit results
    supabaseQuery = supabaseQuery.limit(50)
    
    const { data: facilities, error } = await supabaseQuery
    
    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Database query failed' }, { status: 500 })
    }
    
    // Calculate distances if coordinates are available
    // This is a simplified version - in production you'd use PostGIS or similar
    const enrichedFacilities = facilities?.map(facility => ({
      ...facility,
      distance: Math.random() * 50 // Placeholder distance calculation
    }))
    
    return NextResponse.json({
      facilities: enrichedFacilities || [],
      count: enrichedFacilities?.length || 0,
      query: {
        text: query,
        location,
        radius,
        services,
        insurance
      }
    })
    
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}