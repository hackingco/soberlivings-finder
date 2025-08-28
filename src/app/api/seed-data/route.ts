/**
 * Data Seeding API Route
 * Seeds the database with facility data from files
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

interface FacilityRecord {
  name: string;
  city: string;
  state: string;
  zip?: string;
  phone?: string;
  website?: string;
  latitude?: string;
  longitude?: string;
  residential_services?: string;
  all_services?: string;
}

export async function POST(request: NextRequest) {
  try {
    console.log('🌱 Data seeding started...');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Missing Supabase credentials' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Check current count
    const { count: currentCount } = await supabase
      .from('facilities')
      .select('*', { count: 'exact', head: true });

    if (currentCount && currentCount > 50) {
      return NextResponse.json({
        success: true,
        message: 'Database already contains sufficient data',
        facilitiesCount: currentCount,
        skipped: true
      });
    }

    // Try to load data from embedded JSON (if available in deployment)
    let facilities: FacilityRecord[] = [];
    
    try {
      // For development, try to read from file system
      const dataPath = path.join(process.cwd(), '..', 'data', 'residential_facilities.json');
      if (fs.existsSync(dataPath)) {
        const fileContent = fs.readFileSync(dataPath, 'utf-8');
        facilities = JSON.parse(fileContent);
        console.log(`📁 Loaded ${facilities.length} facilities from file`);
      }
    } catch (fileError) {
      console.log('⚠️ Could not load from file, using embedded sample data');
    }

    // Fallback to sample data if no file found
    if (facilities.length === 0) {
      facilities = [
        {
          name: "Veterans Alcoholic Rehab Prog (VARP)",
          city: "Blythe",
          state: "CA",
          zip: "92225",
          phone: "760-922-8625",
          website: "http://www.varpinc.org",
          latitude: "33.5745542",
          longitude: "-114.5842843",
          residential_services: "Residential/24-hour residential; Long-term residential; Short-term residential",
          all_services: "Substance use treatment; Transitional housing, halfway house, or sober home; Treatment for co-occurring substance use plus either serious mental health illness in adults/serious emotional disturbance in children"
        },
        {
          name: "Serenity Cottages of the Desert",
          city: "Baker",
          state: "CA",
          zip: "92309",
          phone: "909-389-8582",
          website: "http://Serenitycottagesotd.com",
          latitude: "35.283744",
          longitude: "-116.0561422",
          residential_services: "Hospital inpatient/24-hour hospital inpatient; Residential/24-hour residential; Hospital inpatient treatment; Residential detoxification; Long-term residential; Short-term residential",
          all_services: "Substance use treatment; Detoxification; Treatment for co-occurring substance use plus either serious mental health illness in adults/serious emotional disturbance in children"
        },
        {
          name: "ABC Recovery Center Inc",
          city: "Indio",
          state: "CA",
          zip: "92201",
          phone: "760-342-6616",
          website: "http://abcrecoverycenter.org",
          latitude: "33.724763",
          longitude: "-116.2264864",
          residential_services: "Hospital inpatient/24-hour hospital inpatient; Residential/24-hour residential; Hospital inpatient detoxification; Hospital inpatient treatment; Residential detoxification; Long-term residential; Short-term residential",
          all_services: "Substance use treatment; Detoxification; Treatment for co-occurring substance use plus either serious mental health illness in adults/serious emotional disturbance in children"
        }
      ];
      console.log(`📋 Using ${facilities.length} sample facilities`);
    }

    // Transform and batch insert data
    const batchSize = 100;
    let insertedCount = 0;
    let errors: string[] = [];

    for (let i = 0; i < facilities.length; i += batchSize) {
      const batch = facilities.slice(i, i + batchSize);
      
      try {
        const transformedBatch = batch.map((facility, index) => {
          const services = facility.all_services 
            ? facility.all_services.split(';').map(s => s.trim()).filter(s => s.length > 0)
            : [];

          const latitude = facility.latitude ? parseFloat(facility.latitude) : null;
          const longitude = facility.longitude ? parseFloat(facility.longitude) : null;

          return {
            id: `facility-${i + index + 1}`,
            name: facility.name,
            city: facility.city,
            state: facility.state.toUpperCase().substring(0, 2),
            zip: facility.zip || null,
            phone: facility.phone || null,
            website: facility.website || null,
            latitude,
            longitude,
            services,
            residentialServices: facility.residential_services || null,
            allServices: facility.all_services || null,
            isResidential: facility.residential_services?.toLowerCase().includes('residential') || false,
            serviceCount: services.length,
            dataQuality: calculateDataQuality(facility, latitude, longitude),
            lastUpdated: new Date().toISOString()
          };
        });

        const { error } = await supabase
          .from('facilities')
          .upsert(transformedBatch, { onConflict: 'id' });

        if (error) {
          errors.push(`Batch ${Math.floor(i/batchSize) + 1}: ${error.message}`);
          console.error(`❌ Batch ${Math.floor(i/batchSize) + 1} failed:`, error.message);
        } else {
          insertedCount += transformedBatch.length;
          console.log(`✅ Batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(facilities.length/batchSize)} inserted (${transformedBatch.length} records)`);
        }

      } catch (batchError) {
        const errorMsg = batchError instanceof Error ? batchError.message : 'Unknown error';
        errors.push(`Batch ${Math.floor(i/batchSize) + 1}: ${errorMsg}`);
        console.error(`❌ Batch ${Math.floor(i/batchSize) + 1} error:`, errorMsg);
      }

      // Small delay to prevent overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Get final count
    const { count: finalCount } = await supabase
      .from('facilities')
      .select('*', { count: 'exact', head: true });

    console.log(`✅ Seeding complete. Final count: ${finalCount}`);

    return NextResponse.json({
      success: true,
      message: 'Data seeding completed',
      facilitiesProcessed: facilities.length,
      facilitiesInserted: insertedCount,
      finalCount: finalCount || 0,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Data seeding error:', error);
    return NextResponse.json(
      { 
        error: 'Data seeding failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function calculateDataQuality(facility: FacilityRecord, latitude: number | null, longitude: number | null): number {
  let score = 0;
  let maxScore = 0;

  // Required fields
  maxScore += 4;
  if (facility.name) score += 1;
  if (facility.city) score += 1;
  if (facility.state) score += 1;
  if (facility.phone) score += 1;

  // Location data
  maxScore += 2;
  if (latitude && longitude) score += 2;

  // Contact info
  maxScore += 2;
  if (facility.website) score += 1;
  if (facility.phone) score += 1;

  // Service information
  maxScore += 2;
  if (facility.all_services) score += 2;

  return maxScore > 0 ? score / maxScore : 0;
}

export async function GET(request: NextRequest) {
  // Status endpoint
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
      facilitiesCount: count || 0,
      needsSeeding: !count || count < 10,
      error: error?.message
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
