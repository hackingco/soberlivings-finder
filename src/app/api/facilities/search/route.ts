import { NextRequest, NextResponse } from 'next/server'
import { mockFacilities } from '@/lib/mock-data'

// Fallback to mock data when Supabase is not configured
const USE_MOCK_DATA = !process.env.NEXT_PUBLIC_SUPABASE_URL

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
    
    // Use mock data when Supabase is not configured
    if (USE_MOCK_DATA) {
      console.log('Using mock data for search')
      
      let filteredFacilities = [...mockFacilities]
      
      // Apply text search filter
      if (query) {
        filteredFacilities = filteredFacilities.filter(facility =>
          facility.name.toLowerCase().includes(query.toLowerCase()) ||
          facility.city.toLowerCase().includes(query.toLowerCase()) ||
          facility.residentialServices?.toLowerCase().includes(query.toLowerCase()) ||
          facility.allServices?.toLowerCase().includes(query.toLowerCase())
        )
      }
      
      // Apply location filter
      if (location) {
        const locationParts = location.split(',').map(part => part.trim())
        if (locationParts.length >= 2) {
          const city = locationParts[0].toLowerCase()
          const state = locationParts[1].toLowerCase()
          filteredFacilities = filteredFacilities.filter(facility =>
            facility.city.toLowerCase().includes(city) &&
            facility.state.toLowerCase().includes(state)
          )
        } else {
          filteredFacilities = filteredFacilities.filter(facility =>
            facility.city.toLowerCase().includes(location.toLowerCase()) ||
            facility.state.toLowerCase().includes(location.toLowerCase())
          )
        }
      }
      
      // Apply service filters
      if (services.length > 0) {
        filteredFacilities = filteredFacilities.filter(facility =>
          services.some(service =>
            facility.residentialServices?.toLowerCase().includes(service.toLowerCase()) ||
            facility.allServices?.toLowerCase().includes(service.toLowerCase())
          )
        )
      }
      
      // Apply insurance filters
      if (insurance.length > 0) {
        filteredFacilities = filteredFacilities.filter(facility =>
          insurance.some(ins =>
            facility.acceptedInsurance?.some(acceptedIns =>
              acceptedIns.toLowerCase().includes(ins.toLowerCase())
            )
          )
        )
      }
      
      // Sort by distance and limit results
      const sortedFacilities = filteredFacilities
        .sort((a, b) => (a.distance || 0) - (b.distance || 0))
        .slice(0, 50)
      
      return NextResponse.json({
        facilities: sortedFacilities,
        count: sortedFacilities.length,
        query: {
          text: query,
          location,
          radius,
          services,
          insurance
        },
        mock: true
      })
    }
    
    // Original Supabase code would go here when configured
    // For now, just return an error to encourage proper setup
    return NextResponse.json({ 
      error: 'Database not configured. Please set up Supabase credentials.' 
    }, { status: 500 })
    
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}