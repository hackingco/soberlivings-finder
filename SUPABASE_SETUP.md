# Supabase Database Setup Instructions

## Quick Setup

### Step 1: Access Supabase SQL Editor

1. Go to: https://app.supabase.com/project/acwtjmqtwnijzbioauwn/sql/new
2. Or navigate to your Supabase Dashboard → SQL Editor → New Query

### Step 2: Run the Following SQL

Copy and paste this entire SQL script into the SQL editor and click "Run":

```sql
-- Drop existing table if needed (uncomment if you want to reset)
-- DROP TABLE IF EXISTS public.facilities CASCADE;

-- Create facilities table
CREATE TABLE IF NOT EXISTS public.facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    street TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip TEXT,
    phone TEXT,
    website TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    residential_services TEXT,
    all_services TEXT,
    services TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    source_data JSONB DEFAULT '{}',
    geo_hash TEXT,
    is_residential BOOLEAN DEFAULT false,
    service_count INTEGER DEFAULT 0,
    verified BOOLEAN DEFAULT false,
    data_quality DOUBLE PRECISION,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    search_location TEXT,
    search_coordinates TEXT,
    average_rating DOUBLE PRECISION,
    accepted_insurance TEXT[] DEFAULT '{}',
    amenities TEXT[] DEFAULT '{}',
    specialties TEXT[] DEFAULT '{}',
    description TEXT,
    facility_type TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_facilities_city ON public.facilities(city);
CREATE INDEX IF NOT EXISTS idx_facilities_state ON public.facilities(state);
CREATE INDEX IF NOT EXISTS idx_facilities_verified ON public.facilities(verified);
CREATE INDEX IF NOT EXISTS idx_facilities_coordinates ON public.facilities(latitude, longitude);

-- Enable Row Level Security
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
DROP POLICY IF EXISTS "Public read access" ON public.facilities;
CREATE POLICY "Public read access" ON public.facilities
    FOR SELECT USING (true);

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON public.facilities TO anon;
GRANT ALL ON public.facilities TO authenticated;

-- Insert sample data
INSERT INTO public.facilities (
    name, city, state, zip, phone, website,
    latitude, longitude, is_residential, verified,
    services, accepted_insurance, amenities,
    description, facility_type, service_count, data_quality
) VALUES 
(
    'Serenity Recovery Center',
    'San Francisco', 'CA', '94102',
    '(415) 555-0123', 'https://serenityrecovery.example.com',
    37.7749, -122.4194, true, true,
    ARRAY['Detox', 'Residential Treatment', 'Outpatient'],
    ARRAY['Aetna', 'Blue Cross', 'Cigna'],
    ARRAY['24/7 Support', 'Private Rooms', 'Gym'],
    'Comprehensive addiction treatment center.',
    'Residential Treatment Center', 3, 0.95
),
(
    'Hope Haven Recovery',
    'Los Angeles', 'CA', '90012',
    '(213) 555-0456', 'https://hopehaven.example.com',
    34.0522, -118.2437, true, true,
    ARRAY['Residential', 'IOP', 'Aftercare'],
    ARRAY['United Healthcare', 'Anthem'],
    ARRAY['Pool', 'Yoga Studio'],
    'Luxury treatment facility.',
    'Luxury Rehab', 3, 0.92
),
(
    'New Beginnings Center',
    'San Diego', 'CA', '92101',
    '(619) 555-0789', 'https://newbeginnings.example.com',
    32.7157, -117.1611, true, false,
    ARRAY['Detox', 'Residential', 'PHP'],
    ARRAY['Tricare', 'Private Pay'],
    ARRAY['Ocean Views', 'Fitness Center'],
    'Beachside recovery center.',
    'Beach Rehab', 3, 0.88
),
(
    'Phoenix Rising Treatment',
    'Sacramento', 'CA', '95814',
    '(916) 555-0234', 'https://phoenixrising.example.com',
    38.5816, -121.4944, false, true,
    ARRAY['Outpatient', 'IOP', 'Group Therapy'],
    ARRAY['Kaiser', 'Medicare'],
    ARRAY['Parking', 'Coffee Bar'],
    'Outpatient addiction services.',
    'Outpatient Center', 3, 0.85
),
(
    'Wellness Path Recovery',
    'Oakland', 'CA', '94612',
    '(510) 555-0567', 'https://wellnesspath.example.com',
    37.8044, -122.2711, true, true,
    ARRAY['Detox', 'Residential', 'Sober Living'],
    ARRAY['Medicaid', 'Blue Shield'],
    ARRAY['Garden', 'Library', 'Art Studio'],
    'Holistic recovery center.',
    'Holistic Treatment', 3, 0.90
),
(
    'Bay Area Recovery Services',
    'San Jose', 'CA', '95110',
    '(408) 555-0890', 'https://bayarearecovery.example.com',
    37.3382, -121.8863, false, false,
    ARRAY['MAT', 'Counseling', 'Case Management'],
    ARRAY['Covered California', 'Medi-Cal'],
    ARRAY['Childcare', 'Transportation'],
    'Community-based treatment services.',
    'Community Center', 3, 0.82
)
ON CONFLICT DO NOTHING;

-- Verify setup
SELECT COUNT(*) as total_facilities FROM public.facilities;
```

### Step 3: Verify Setup

After running the SQL, you should see:
- "Success. No rows returned" for the CREATE and INSERT statements
- A count showing the number of facilities in the table

### Step 4: Test the API

1. Visit your deployed app
2. The search should now work with real data from Supabase
3. No more "Could not find table" errors

## Troubleshooting

If you get permission errors:
1. Go to Authentication → Policies in Supabase
2. Ensure the "Public read access" policy is enabled
3. Check that RLS is enabled on the facilities table

If the table already exists:
1. You can drop it first with: `DROP TABLE public.facilities CASCADE;`
2. Then run the create script again

## Alternative: Using Supabase Dashboard

1. Go to Table Editor in Supabase
2. Click "New Table"
3. Name it "facilities"
4. Add the columns manually based on the schema above
5. Enable RLS and add the public read policy