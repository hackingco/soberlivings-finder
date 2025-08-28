import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function setupDatabase() {
  console.log('🚀 Setting up Supabase database...')
  
  try {
    // Read SQL file
    const sqlPath = path.join(process.cwd(), 'setup-supabase.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')
    
    // Execute SQL commands
    console.log('📋 Creating tables and indexes...')
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql }).single()
    
    if (error) {
      // If exec_sql doesn't exist, try direct table creation
      console.log('⚠️  exec_sql not available, trying direct table operations...')
      
      // Check if table exists
      const { data: tables, error: tableError } = await supabase
        .from('facilities')
        .select('id')
        .limit(1)
      
      if (tableError?.code === 'PGRST205') {
        console.error('❌ Table does not exist and cannot be created via API')
        console.log('\n📝 Please run the following SQL in your Supabase SQL editor:')
        console.log('   1. Go to https://app.supabase.com/project/acwtjmqtwnijzbioauwn/sql')
        console.log('   2. Copy and paste the contents of setup-supabase.sql')
        console.log('   3. Click "Run" to execute the SQL')
        console.log('\n📄 SQL file location: setup-supabase.sql')
        return false
      }
      
      if (!tableError) {
        console.log('✅ Table already exists')
        
        // Insert sample data if table is empty
        const { count } = await supabase
          .from('facilities')
          .select('*', { count: 'exact', head: true })
        
        if (count === 0) {
          console.log('📝 Inserting sample data...')
          const { error: insertError } = await supabase
            .from('facilities')
            .insert([
              {
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
                services: ['Detox', 'Residential Treatment', 'Outpatient', 'Sober Living'],
                accepted_insurance: ['Aetna', 'Blue Cross', 'Cigna', 'Medicare', 'Medicaid'],
                amenities: ['24/7 Support', 'Private Rooms', 'Gym', 'Meditation Garden'],
                description: 'Comprehensive addiction treatment center offering evidence-based therapies in a serene environment.',
                treatment_approaches: ['Cognitive Behavioral Therapy', '12-Step', 'Holistic'],
                facility_type: 'Residential Treatment Center'
              },
              {
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
                services: ['Residential Treatment', 'Intensive Outpatient', 'Aftercare'],
                accepted_insurance: ['United Healthcare', 'Anthem', 'Kaiser'],
                amenities: ['Pool', 'Yoga Studio', 'Art Therapy Room'],
                description: 'Luxury treatment facility specializing in dual diagnosis and trauma-informed care.',
                treatment_approaches: ['Dialectical Behavior Therapy', 'EMDR', 'Mindfulness'],
                facility_type: 'Luxury Rehab'
              },
              {
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
                services: ['Detox', 'Residential', 'PHP', 'IOP'],
                accepted_insurance: ['Tricare', 'Humana', 'Private Pay'],
                amenities: ['Ocean Views', 'Fitness Center', 'Nutrition Program'],
                description: 'Beachside recovery center focusing on holistic healing and life skills development.',
                treatment_approaches: ['Motivational Interviewing', 'Family Therapy', 'Adventure Therapy'],
                facility_type: 'Beach Rehab'
              }
            ])
          
          if (insertError) {
            console.error('❌ Failed to insert sample data:', insertError)
          } else {
            console.log('✅ Sample data inserted successfully')
          }
        } else {
          console.log(`ℹ️  Table already contains ${count} records`)
        }
        
        return true
      }
    }
    
    console.log('✅ Database setup completed successfully')
    return true
    
  } catch (error) {
    console.error('❌ Error setting up database:', error)
    return false
  }
}

// Run setup
setupDatabase().then(success => {
  if (success) {
    console.log('\n🎉 Supabase database setup complete!')
    console.log('Your facilities table is ready to use.')
  } else {
    console.log('\n⚠️  Manual setup required')
    console.log('Please follow the instructions above to complete the setup.')
  }
  process.exit(success ? 0 : 1)
})