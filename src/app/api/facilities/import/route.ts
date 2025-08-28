import { NextRequest, NextResponse } from 'next/server'
import { mockFacilities } from '@/lib/mock-data'

// Fallback to mock data when services are not configured
const USE_MOCK_DATA = !process.env.NEXT_PUBLIC_SUPABASE_URL

// Interfaces for future use when services are configured
// interface ServiceItem {
//   f2: string
//   f3: string
// }

// interface FindTreatmentFacility {
//   name1: string
//   city: string
//   state: string
//   zip?: string
//   phone?: string
//   address?: string
//   website?: string
//   latitude?: string
//   longitude?: string
//   services?: ServiceItem[]
// }

export async function POST(request: NextRequest) {
  try {
    await request.json() // Parse request body but don't use location for mock data
    
    // Use mock data when services are not configured
    if (USE_MOCK_DATA) {
      console.log('Using mock data for import simulation')
      
      // Simulate a delay like real API
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Return success with mock data
      return NextResponse.json({
        success: true,
        imported: mockFacilities.length,
        facilities: mockFacilities,
        mock: true,
        message: 'Mock data imported successfully. Configure Supabase and Firecrawl for real data import.'
      })
    }
    
    // Original import logic would go here when services are configured
    return NextResponse.json({ 
      error: 'Import services not configured. Please set up Supabase and Firecrawl credentials.' 
    }, { status: 500 })
    
  } catch (error) {
    console.error('Import API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}