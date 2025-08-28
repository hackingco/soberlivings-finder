import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { scrapeFacilityWebsite } from '@/lib/firecrawl'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Check if supabase is configured
    if (!supabase) {
      return NextResponse.json({ 
        error: 'Database not configured. Please set up Supabase credentials.' 
      }, { status: 500 })
    }
    
    // Get facility from database
    const { data: facility, error: fetchError } = await supabase
      .from('facilities')
      .select('*')
      .eq('id', id)
      .single()
    
    if (fetchError || !facility) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 })
    }
    
    if (!facility?.website) {
      return NextResponse.json({ error: 'No website available for this facility' }, { status: 400 })
    }
    
    // Scrape the website
    console.log(`Scraping facility website: ${facility.website}`)
    const scrapedData = await scrapeFacilityWebsite(facility.website)
    
    // Update facility with scraped data
    const updateData = {
      description: scrapedData.description || facility.description,
      capacity: scrapedData.capacity || facility.capacity,
      amenities: scrapedData.amenities || facility.amenities || [],
      acceptedInsurance: scrapedData.acceptedInsurance || facility.acceptedInsurance || [],
      programs: scrapedData.programs || facility.programs || [],
      lastUpdated: new Date().toISOString()
    }
    
    const { data: updatedFacility, error: updateError } = await supabase
      .from('facilities')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    
    if (updateError) {
      console.error('Failed to update facility:', updateError)
      return NextResponse.json({ error: 'Failed to update facility' }, { status: 500 })
    }
    
    // Store scraped data for reference
    await supabase
      .from('scraped_data')
      .upsert({
        url: facility.website,
        title: scrapedData.title,
        content: JSON.stringify(scrapedData),
        facilityId: id,
        scrapedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, {
        onConflict: 'url'
      })
    
    return NextResponse.json({
      success: true,
      facility: updatedFacility,
      scrapedData
    })
    
  } catch (error) {
    console.error('Scrape API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}