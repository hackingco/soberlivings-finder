-- Create facilities table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.facilities (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
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
    services TEXT[],
    metadata JSONB,
    source_data JSONB,
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
    accepted_insurance TEXT[],
    amenities TEXT[],
    specialties TEXT[],
    description TEXT,
    hours_of_operation JSONB,
    images TEXT[],
    reviews_count INTEGER DEFAULT 0,
    capacity INTEGER,
    available_beds INTEGER,
    treatment_approaches TEXT[],
    staff_credentials TEXT[],
    success_rate DOUBLE PRECISION,
    average_length_of_stay INTEGER,
    payment_options TEXT[],
    sliding_scale BOOLEAN DEFAULT false,
    detox_available BOOLEAN DEFAULT false,
    residential_treatment BOOLEAN DEFAULT false,
    outpatient_available BOOLEAN DEFAULT false,
    telehealth_available BOOLEAN DEFAULT false,
    accepts_medicare BOOLEAN DEFAULT false,
    accepts_medicaid BOOLEAN DEFAULT false,
    accepts_private_insurance BOOLEAN DEFAULT true,
    accepts_self_pay BOOLEAN DEFAULT true,
    lgbtq_friendly BOOLEAN DEFAULT false,
    women_only BOOLEAN DEFAULT false,
    men_only BOOLEAN DEFAULT false,
    teen_services BOOLEAN DEFAULT false,
    senior_services BOOLEAN DEFAULT false,
    spanish_services BOOLEAN DEFAULT false,
    accessibility_features TEXT[],
    accreditation TEXT[],
    license_number TEXT,
    years_in_operation INTEGER,
    owner_type TEXT,
    facility_type TEXT,
    treatment_philosophy TEXT,
    aftercare_services BOOLEAN DEFAULT false,
    family_program BOOLEAN DEFAULT false,
    sober_living BOOLEAN DEFAULT false,
    intake_process TEXT,
    typical_day_description TEXT
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_facilities_city ON public.facilities(city);
CREATE INDEX IF NOT EXISTS idx_facilities_state ON public.facilities(state);
CREATE INDEX IF NOT EXISTS idx_facilities_verified ON public.facilities(verified);
CREATE INDEX IF NOT EXISTS idx_facilities_is_residential ON public.facilities(is_residential);
CREATE INDEX IF NOT EXISTS idx_facilities_coordinates ON public.facilities(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_facilities_service_count ON public.facilities(service_count DESC);
CREATE INDEX IF NOT EXISTS idx_facilities_data_quality ON public.facilities(data_quality DESC);
CREATE INDEX IF NOT EXISTS idx_facilities_created_at ON public.facilities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_facilities_last_updated ON public.facilities(last_updated DESC);

-- Create GIN index for JSONB columns
CREATE INDEX IF NOT EXISTS idx_facilities_metadata ON public.facilities USING gin(metadata);
CREATE INDEX IF NOT EXISTS idx_facilities_source_data ON public.facilities USING gin(source_data);

-- Create text search indexes
CREATE INDEX IF NOT EXISTS idx_facilities_name_text ON public.facilities USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_facilities_services_array ON public.facilities USING gin(services);
CREATE INDEX IF NOT EXISTS idx_facilities_insurance_array ON public.facilities USING gin(accepted_insurance);

-- Enable Row Level Security (RLS)
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Enable read access for all users" ON public.facilities
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON public.facilities
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users only" ON public.facilities
    FOR UPDATE USING (true);

-- Create function for nearby facilities search (requires PostGIS extension)
CREATE OR REPLACE FUNCTION public.nearby_facilities(
    lat double precision,
    lng double precision,
    radius_km double precision DEFAULT 50
)
RETURNS SETOF facilities
LANGUAGE sql
STABLE
AS $$
    SELECT *
    FROM facilities
    WHERE 
        latitude IS NOT NULL 
        AND longitude IS NOT NULL
        AND (
            6371 * acos(
                cos(radians(lat)) * cos(radians(latitude)) * 
                cos(radians(longitude) - radians(lng)) + 
                sin(radians(lat)) * sin(radians(latitude))
            )
        ) <= radius_km
    ORDER BY 
        (
            6371 * acos(
                cos(radians(lat)) * cos(radians(latitude)) * 
                cos(radians(longitude) - radians(lng)) + 
                sin(radians(lat)) * sin(radians(latitude))
            )
        );
$$;

-- Insert sample data for testing
INSERT INTO public.facilities (
    name, city, state, zip, phone, website,
    latitude, longitude, is_residential, verified,
    services, accepted_insurance, amenities,
    description, treatment_approaches, facility_type
) VALUES 
(
    'Serenity Recovery Center',
    'San Francisco',
    'CA',
    '94102',
    '(415) 555-0123',
    'https://serenityrecovery.example.com',
    37.7749, -122.4194,
    true, true,
    ARRAY['Detox', 'Residential Treatment', 'Outpatient', 'Sober Living'],
    ARRAY['Aetna', 'Blue Cross', 'Cigna', 'Medicare', 'Medicaid'],
    ARRAY['24/7 Support', 'Private Rooms', 'Gym', 'Meditation Garden'],
    'Comprehensive addiction treatment center offering evidence-based therapies in a serene environment.',
    ARRAY['Cognitive Behavioral Therapy', '12-Step', 'Holistic'],
    'Residential Treatment Center'
),
(
    'Hope Haven Recovery',
    'Los Angeles',
    'CA', 
    '90012',
    '(213) 555-0456',
    'https://hopehaven.example.com',
    34.0522, -118.2437,
    true, true,
    ARRAY['Residential Treatment', 'Intensive Outpatient', 'Aftercare'],
    ARRAY['United Healthcare', 'Anthem', 'Kaiser'],
    ARRAY['Pool', 'Yoga Studio', 'Art Therapy Room'],
    'Luxury treatment facility specializing in dual diagnosis and trauma-informed care.',
    ARRAY['Dialectical Behavior Therapy', 'EMDR', 'Mindfulness'],
    'Luxury Rehab'
),
(
    'New Beginnings Center',
    'San Diego',
    'CA',
    '92101',
    '(619) 555-0789',
    'https://newbeginnings.example.com',
    32.7157, -117.1611,
    true, false,
    ARRAY['Detox', 'Residential', 'PHP', 'IOP'],
    ARRAY['Tricare', 'Humana', 'Private Pay'],
    ARRAY['Ocean Views', 'Fitness Center', 'Nutrition Program'],
    'Beachside recovery center focusing on holistic healing and life skills development.',
    ARRAY['Motivational Interviewing', 'Family Therapy', 'Adventure Therapy'],
    'Beach Rehab'
)
ON CONFLICT (id) DO NOTHING;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.facilities TO anon;
GRANT ALL ON public.facilities TO authenticated;

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';