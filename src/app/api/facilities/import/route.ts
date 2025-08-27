import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { scrapeFacilityWebsite } from '@/lib/firecrawl'

interface ServiceItem {
  f2: string
  f3: string
}

interface FindTreatmentFacility {
  name1: string
  city: string
  state: string
  zip?: string
  phone?: string
  address?: string
  website?: string
  latitude?: string
  longitude?: string
  services?: ServiceItem[]
}

export async function POST(request: NextRequest) {
  try {
    const { location = "37.7749,-122.4194" } = await request.json()
    
    // Fetch from FindTreatment.gov API
    const apiUrl = new URL('https://findtreatment.gov/locator/exportsAsJson/v2')
    apiUrl.searchParams.set('sAddr', location)
    apiUrl.searchParams.set('limitType', '0')
    apiUrl.searchParams.set('limitValue', '23')
    apiUrl.searchParams.set('sType', 'sa')
    apiUrl.searchParams.set('pageSize', '2000')
    apiUrl.searchParams.set('page', '1')
    
    const response = await fetch(apiUrl.toString())
    const data = await response.json()
    
    if (!data.rows) {
      return NextResponse.json({ error: 'No data received from API' }, { status: 400 })
    }
    
    console.log(`Fetched ${data.rows.length} facilities from FindTreatment.gov`)
    
    // Filter for residential facilities
    const residentialFacilities = data.rows
      .filter((facility: FindTreatmentFacility) => facility.services !== null)
      .filter((facility: FindTreatmentFacility) => {
        return facility.services?.some(service => 
          service.f3?.toLowerCase().includes('residential')
        )
      })
    
    console.log(`Found ${residentialFacilities.length} residential facilities`)
    
    // Process and enrich facilities
    const processedFacilities = []
    
    for (const facility of residentialFacilities.slice(0, 10)) { // Limit to 10 for demo
      try {
        // Extract residential services
        const residentialServices = facility.services
          ?.filter((service: ServiceItem) => 
            service.f2 === "SET" && 
            service.f3?.toLowerCase().includes('residential')
          )
          .map((service: ServiceItem) => service.f3)
          .join('; ')
        
        const allServices = facility.services
          ?.map((service: ServiceItem) => service.f3)
          .filter(Boolean)
          .join('; ')
        
        // Basic facility data
        const facilityData = {
          name: facility.name1,
          city: facility.city,
          state: facility.state,
          zip: facility.zip,
          phone: facility.phone,
          address: facility.address,
          website: facility.website,
          latitude: facility.latitude ? parseFloat(facility.latitude) : null,
          longitude: facility.longitude ? parseFloat(facility.longitude) : null,
          residentialServices,
          allServices,
          searchLocation: location,
          searchCoordinates: location,
          verified: false,
          lastUpdated: new Date().toISOString()
        }
        
        // Enrich with Firecrawl data if website is available
        if (facility.website) {
          try {
            console.log(`Scraping website: ${facility.website}`)
            const scrapedData = await scrapeFacilityWebsite(facility.website)
            
            Object.assign(facilityData, {
              description: scrapedData.description,
              capacity: scrapedData.capacity,
              amenities: scrapedData.amenities || [],
              acceptedInsurance: scrapedData.acceptedInsurance || [],
              programs: scrapedData.programs || []
            })
          } catch (scrapingError) {
            console.warn(`Failed to scrape ${facility.website}:`, scrapingError)
          }
        }
        
        processedFacilities.push(facilityData)
        
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (processingError) {
        console.warn(`Failed to process facility ${facility.name1}:`, processingError)
      }
    }
    
    // Insert into database
    const { data: insertedFacilities, error: insertError } = await supabase
      .from('facilities')
      .upsert(processedFacilities, {
        onConflict: 'name,city,state',
        ignoreDuplicates: false
      })
      .select()
    
    if (insertError) {
      console.error('Database insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save facilities' }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      imported: processedFacilities.length,
      facilities: insertedFacilities
    })
    
  } catch (error) {
    console.error('Import API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}