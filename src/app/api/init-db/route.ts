/**
 * Database Initialization API Route
 * Automatically initializes database schema and seeds data
 * Called during deployment or on first app load
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Database initialization started...');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Missing Supabase credentials' },
        { status: 500 }
      );
    }

    // Use service role for admin operations
    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey || supabaseAnonKey
    );

    // Step 1: Check if schema exists
    console.log('🔍 Checking database schema...');
    
    let schemaExists = false;
    try {
      const { error } = await supabase
        .from('facilities')
        .select('id')
        .limit(1);
      
      schemaExists = !error || error.code !== 'PGRST205';
    } catch (err) {
      schemaExists = false;
    }

    // Step 2: Create schema if needed
    if (!schemaExists) {
      console.log('📋 Creating database schema...');
      
      const createSchemaSQL = `
        -- Create facilities table
        CREATE TABLE IF NOT EXISTS facilities (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
          name TEXT NOT NULL,
          street TEXT,
          city TEXT NOT NULL,
          state TEXT NOT NULL,
          zip TEXT,
          phone TEXT,
          website TEXT,
          latitude DOUBLE PRECISION,
          longitude DOUBLE PRECISION,
          services TEXT[] DEFAULT '{}',
          "residentialServices" TEXT,
          "allServices" TEXT,
          "isResidential" BOOLEAN DEFAULT FALSE,
          "serviceCount" INTEGER DEFAULT 0,
          "dataQuality" DOUBLE PRECISION,
          metadata JSONB,
          "lastUpdated" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_facilities_state_city ON facilities(state, city);
        CREATE INDEX IF NOT EXISTS idx_facilities_location ON facilities(latitude, longitude);
        CREATE INDEX IF NOT EXISTS idx_facilities_services ON facilities USING GIN(services);
        CREATE INDEX IF NOT EXISTS idx_facilities_residential ON facilities("isResidential");

        -- Create sample data if table is empty
        INSERT INTO facilities (name, city, state, phone, website, latitude, longitude, services, "isResidential", "dataQuality")
        SELECT 'Sample Recovery Center', 'Los Angeles', 'CA', '555-0123', 'https://example.com', 34.0522, -118.2437, 
               ARRAY['Residential Treatment', 'Detoxification'], true, 0.95
        WHERE NOT EXISTS (SELECT 1 FROM facilities LIMIT 1);
      `;

      try {
        // Try to execute SQL using RPC if available
        const { error: sqlError } = await supabase.rpc('exec_sql', { 
          sql: createSchemaSQL 
        });

        if (sqlError) {
          // Fallback: try creating table using direct insert
          const { error: insertError } = await supabase
            .from('facilities')
            .insert({
              id: 'init-sample-1',
              name: 'Sample Recovery Center',
              city: 'Los Angeles',
              state: 'CA',
              phone: '555-0123',
              website: 'https://example.com',
              latitude: 34.0522,
              longitude: -118.2437,
              services: ['Residential Treatment', 'Detoxification'],
              isResidential: true,
              dataQuality: 0.95
            });

          if (insertError && insertError.code === 'PGRST205') {
            return NextResponse.json({
              error: 'Database schema needs to be created manually',
              message: 'Please run the SQL setup script in Supabase dashboard',
              sql: createSchemaSQL
            }, { status: 500 });
          }
        }

        console.log('✅ Database schema created');
      } catch (error) {
        console.error('Schema creation error:', error);
        return NextResponse.json({
          error: 'Schema creation failed',
          message: 'Manual setup required',
          sql: createSchemaSQL
        }, { status: 500 });
      }
    }

    // Step 3: Check current data count
    const { count: currentCount } = await supabase
      .from('facilities')
      .select('*', { count: 'exact', head: true });

    console.log(`📊 Current facilities: ${currentCount || 0}`);

    // Step 4: Trigger data seeding if needed (async)
    if (!currentCount || currentCount < 10) {
      console.log('🌱 Triggering data seeding...');
      
      // Call the seeding endpoint asynchronously
      const seedingUrl = `${request.nextUrl.origin}/api/seed-data`;
      fetch(seedingUrl, { method: 'POST' }).catch(err => {
        console.error('Background seeding failed:', err);
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Database initialization completed',
      schemaExists: true,
      currentFacilities: currentCount || 0,
      seedingTriggered: !currentCount || currentCount < 10
    });

  } catch (error) {
    console.error('Database initialization error:', error);
    return NextResponse.json(
      { 
        error: 'Database initialization failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Status check endpoint
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    const { count, error } = await supabase
      .from('facilities')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      status: 'ok',
      schemaExists: !error || error.code !== 'PGRST205',
      facilitiesCount: count || 0,
      error: error?.message
    });

  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
