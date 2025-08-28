import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET() {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Missing Supabase configuration' },
      { status: 500 }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  try {
    // Check if table exists by trying to query it
    const { data: existing, error: checkError } = await supabase
      .from('facilities')
      .select('id')
      .limit(1)

    if (checkError?.code === 'PGRST205') {
      // Table doesn't exist
      return NextResponse.json({
        error: 'Table does not exist',
        message: 'Please create the facilities table in Supabase',
        instructions: [
          '1. Go to your Supabase dashboard',
          '2. Navigate to SQL Editor',
          '3. Copy the SQL from setup-supabase.sql',
          '4. Run the SQL to create the table'
        ]
      }, { status: 400 })
    }

    // Table exists, check if it has data
    const { count } = await supabase
      .from('facilities')
      .select('*', { count: 'exact', head: true })

    if (count === 0) {
      // Insert sample data
      const sampleData = [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'Serenity Recovery Center',
          city: 'San Francisco',
          state: 'CA',
          zip: '94102',
          phone: '(415) 555-0123',
          website: 'https://serenityrecovery.example.com',
          latitude: 37.7749,
          longitude: -122.4194,
          is_residential: true,
          verified: true,
          services: ['Detox', 'Residential Treatment', 'Outpatient'],
          accepted_insurance: ['Aetna', 'Blue Cross', 'Cigna'],
          amenities: ['24/7 Support', 'Private Rooms', 'Gym'],
          description: 'Comprehensive addiction treatment center.',
          facility_type: 'Residential Treatment Center',
          service_count: 3,
          data_quality: 0.95
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
          name: 'Hope Haven Recovery',
          city: 'Los Angeles',
          state: 'CA',
          zip: '90012',
          phone: '(213) 555-0456',
          website: 'https://hopehaven.example.com',
          latitude: 34.0522,
          longitude: -118.2437,
          is_residential: true,
          verified: true,
          services: ['Residential', 'IOP', 'Aftercare'],
          accepted_insurance: ['United Healthcare', 'Anthem'],
          amenities: ['Pool', 'Yoga Studio'],
          description: 'Luxury treatment facility.',
          facility_type: 'Luxury Rehab',
          service_count: 3,
          data_quality: 0.92
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440003',
          name: 'New Beginnings Center',
          city: 'San Diego',
          state: 'CA',
          zip: '92101',
          phone: '(619) 555-0789',
          website: 'https://newbeginnings.example.com',
          latitude: 32.7157,
          longitude: -117.1611,
          is_residential: true,
          verified: false,
          services: ['Detox', 'Residential', 'PHP'],
          accepted_insurance: ['Tricare', 'Private Pay'],
          amenities: ['Ocean Views', 'Fitness Center'],
          description: 'Beachside recovery center.',
          facility_type: 'Beach Rehab',
          service_count: 3,
          data_quality: 0.88
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440004',
          name: 'Phoenix Rising Treatment',
          city: 'Sacramento',
          state: 'CA',
          zip: '95814',
          phone: '(916) 555-0234',
          website: 'https://phoenixrising.example.com',
          latitude: 38.5816,
          longitude: -121.4944,
          is_residential: false,
          verified: true,
          services: ['Outpatient', 'IOP', 'Group Therapy'],
          accepted_insurance: ['Kaiser', 'Medicare'],
          amenities: ['Parking', 'Coffee Bar'],
          description: 'Outpatient addiction services.',
          facility_type: 'Outpatient Center',
          service_count: 3,
          data_quality: 0.85
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440005',
          name: 'Wellness Path Recovery',
          city: 'Oakland',
          state: 'CA',
          zip: '94612',
          phone: '(510) 555-0567',
          website: 'https://wellnesspath.example.com',
          latitude: 37.8044,
          longitude: -122.2711,
          is_residential: true,
          verified: true,
          services: ['Detox', 'Residential', 'Sober Living'],
          accepted_insurance: ['Medicaid', 'Blue Shield'],
          amenities: ['Garden', 'Library', 'Art Studio'],
          description: 'Holistic recovery center.',
          facility_type: 'Holistic Treatment',
          service_count: 3,
          data_quality: 0.90
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440006',
          name: 'Bay Area Recovery Services',
          city: 'San Jose',
          state: 'CA',
          zip: '95110',
          phone: '(408) 555-0890',
          website: 'https://bayarearecovery.example.com',
          latitude: 37.3382,
          longitude: -121.8863,
          is_residential: false,
          verified: false,
          services: ['MAT', 'Counseling', 'Case Management'],
          accepted_insurance: ['Covered California', 'Medi-Cal'],
          amenities: ['Childcare', 'Transportation'],
          description: 'Community-based treatment services.',
          facility_type: 'Community Center',
          service_count: 3,
          data_quality: 0.82
        }
      ]

      const { error: insertError } = await supabase
        .from('facilities')
        .insert(sampleData)

      if (insertError) {
        console.error('Insert error:', insertError)
        return NextResponse.json({
          error: 'Failed to insert sample data',
          details: insertError.message
        }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: 'Database setup complete with sample data',
        recordsInserted: sampleData.length
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Database already set up',
      recordCount: count
    })

  } catch (error) {
    console.error('Setup error:', error)
    return NextResponse.json({
      error: 'Database setup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST() {
  // Same logic as GET but for POST requests
  return GET()
}