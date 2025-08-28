#!/usr/bin/env node

/**
 * Supabase Data Verification Script
 * Checks if data was successfully loaded to Supabase via REST API
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function verifySupabaseData() {
  console.log('🔍 Verifying Supabase Data Loading');
  console.log('===================================\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.log('❌ Missing Supabase credentials in .env.local');
    console.log('Required: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  console.log(`🔗 Connecting to: ${supabaseUrl}`);
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  try {
    // Test connection and get facility count
    console.log('📊 Checking facilities table...');
    const { data, error, count } = await supabase
      .from('facilities')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log('❌ Error querying facilities:', error.message);
      
      // Check if table exists
      console.log('\n🔍 Checking if facilities table exists...');
      const { data: tables, error: tablesError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'facilities');

      if (tablesError) {
        console.log('❌ Could not check table existence:', tablesError.message);
      } else if (!tables || tables.length === 0) {
        console.log('❌ Facilities table does not exist');
        console.log('💡 You may need to run the SQL setup script: frontend/supabase-setup.sql');
      } else {
        console.log('✅ Facilities table exists');
      }
      
      return;
    }

    console.log(`✅ Successfully connected to Supabase!`);
    console.log(`📊 Total facilities in database: ${count || 0}`);

    if (count && count > 0) {
      // Get some sample data
      console.log('\n📋 Sample facility data:');
      const { data: sample } = await supabase
        .from('facilities')
        .select('name, city, state, phone, website')
        .limit(3);

      if (sample && sample.length > 0) {
        sample.forEach((facility, i) => {
          console.log(`\n  ${i + 1}. ${facility.name}`);
          console.log(`     Location: ${facility.city}, ${facility.state}`);
          console.log(`     Phone: ${facility.phone || 'N/A'}`);
          console.log(`     Website: ${facility.website || 'N/A'}`);
        });
      }

      // Get state distribution
      console.log('\n🗺️ Facilities by state:');
      const { data: states } = await supabase
        .from('facilities')
        .select('state')
        .limit(1000);

      if (states) {
        const stateCount = states.reduce((acc, f) => {
          acc[f.state] = (acc[f.state] || 0) + 1;
          return acc;
        }, {});

        Object.entries(stateCount)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .forEach(([state, count]) => {
            console.log(`     ${state}: ${count} facilities`);
          });
      }

      console.log('\n🎉 Data verification successful!');
      console.log('✅ Your Supabase database is populated and working');
      
    } else {
      console.log('\n⚠️ No facilities found in database');
      console.log('This could mean:');
      console.log('  1. Data loading failed');
      console.log('  2. Table structure mismatch');
      console.log('  3. Permissions issue');
    }

  } catch (error) {
    console.log('❌ Connection error:', error.message);
  }

  console.log('\n🔗 Supabase Dashboard: ' + supabaseUrl.replace('https://', 'https://supabase.com/dashboard/project/').replace('.supabase.co', ''));
  console.log('🚀 Your Vercel deployment: https://soberlivings-finder-5xjz2g3ms-hackingco.vercel.app');
}

verifySupabaseData().catch(console.error);
