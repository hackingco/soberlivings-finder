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

-- Create basic indexes
CREATE INDEX idx_facilities_city ON public.facilities(city);
CREATE INDEX idx_facilities_state ON public.facilities(state);
CREATE INDEX idx_facilities_verified ON public.facilities(verified);

-- Enable RLS
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;

-- Create public read policy
CREATE POLICY "Public read access" ON public.facilities
    FOR SELECT USING (true);

-- Grant permissions
GRANT SELECT ON public.facilities TO anon;
GRANT SELECT ON public.facilities TO authenticated;