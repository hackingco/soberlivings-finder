-- SoberLivings Finder - Supabase Database Setup
-- Run this SQL in Supabase SQL Editor to create all required tables with indexes

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS search_queries CASCADE;
DROP TABLE IF EXISTS scraped_data CASCADE;
DROP TABLE IF EXISTS facilities CASCADE;

-- Create facilities table with enhanced schema
CREATE TABLE facilities (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  name TEXT NOT NULL,
  street TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT,
  phone TEXT,
  website TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  
  -- Service information
  "residentialServices" TEXT,
  "allServices" TEXT,
  services TEXT[] DEFAULT '{}',
  
  -- Enhanced metadata
  metadata JSONB,
  "sourceData" JSONB,
  "geoHash" TEXT,
  "isResidential" BOOLEAN DEFAULT FALSE,
  "serviceCount" INTEGER DEFAULT 0,
  
  -- Data quality and verification
  verified BOOLEAN DEFAULT FALSE,
  "dataQuality" DOUBLE PRECISION,
  "lastUpdated" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Search metadata
  "searchLocation" TEXT,
  "searchCoordinates" TEXT,
  
  -- Reviews aggregate
  "averageRating" DOUBLE PRECISION,
  
  -- Additional fields for compatibility
  description TEXT,
  capacity INTEGER,
  amenities TEXT[] DEFAULT '{}',
  "acceptedInsurance" TEXT[] DEFAULT '{}',
  programs TEXT[] DEFAULT '{}'
);

-- Create reviews table
CREATE TABLE reviews (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  "facilityId" TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  content TEXT,
  author TEXT,
  verified BOOLEAN DEFAULT FALSE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create search queries table
CREATE TABLE search_queries (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  query TEXT NOT NULL,
  location TEXT,
  filters JSONB,
  results INTEGER DEFAULT 0,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create scraped data table
CREATE TABLE scraped_data (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  url TEXT UNIQUE NOT NULL,
  title TEXT,
  content TEXT,
  metadata JSONB,
  "facilityId" TEXT,
  "scrapedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_facilities_state_city ON facilities(state, city);
CREATE INDEX IF NOT EXISTS idx_facilities_location ON facilities(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_facilities_services ON facilities USING GIN(services);
CREATE INDEX IF NOT EXISTS idx_facilities_residential ON facilities("isResidential");
CREATE INDEX IF NOT EXISTS idx_facilities_verified ON facilities(verified);
CREATE INDEX IF NOT EXISTS idx_facilities_quality ON facilities("dataQuality");
CREATE INDEX IF NOT EXISTS idx_facilities_updated ON facilities("lastUpdated");

-- Create geographic index if PostGIS is available
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'postgis'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_facilities_geom ON facilities USING GIST (ST_MakePoint(longitude, latitude))';
  END IF;
END $$;

-- Create indexes for reviews
CREATE INDEX IF NOT EXISTS idx_reviews_facility ON reviews("facilityId");
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_created ON reviews("createdAt");

-- Create indexes for search queries
CREATE INDEX IF NOT EXISTS idx_search_queries_created ON search_queries("createdAt");
CREATE INDEX IF NOT EXISTS idx_search_queries_location ON search_queries(location);

-- Create indexes for scraped data
CREATE INDEX IF NOT EXISTS idx_scraped_data_facility ON scraped_data("facilityId");
CREATE INDEX IF NOT EXISTS idx_scraped_data_url ON scraped_data(url);

-- Create materialized view for city statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS facility_city_stats AS
SELECT 
  state,
  city,
  COUNT(*) as facility_count,
  COUNT(DISTINCT unnest(services)) as unique_services,
  AVG(latitude) as center_lat,
  AVG(longitude) as center_lon,
  AVG("dataQuality") as avg_quality,
  COUNT(*) FILTER (WHERE "isResidential" = TRUE) as residential_count
FROM facilities
WHERE latitude IS NOT NULL AND longitude IS NOT NULL
GROUP BY state, city;

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_facility_city_stats_state_city 
ON facility_city_stats(state, city);

-- Create function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_facility_stats()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY facility_city_stats;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-refresh stats when facilities change
DROP TRIGGER IF EXISTS trigger_refresh_facility_stats ON facilities;
CREATE TRIGGER trigger_refresh_facility_stats
  AFTER INSERT OR UPDATE OR DELETE ON facilities
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_facility_stats();

-- Insert some sample data for testing
INSERT INTO facilities (
  name, street, city, state, zip, phone, website, 
  latitude, longitude, "isResidential", services, 
  "dataQuality", verified
) VALUES 
(
  'Test Recovery Center', 
  '123 Main St', 
  'Los Angeles', 
  'CA', 
  '90210', 
  '555-0123',
  'https://example.com',
  34.0522, 
  -118.2437, 
  TRUE, 
  ARRAY['Residential Treatment', 'Detoxification', 'Counseling'],
  0.85,
  TRUE
),
(
  'Sample Treatment Facility',
  '456 Oak Ave',
  'New York',
  'NY',
  '10001',
  '555-0456',
  'https://sample.com',
  40.7128,
  -74.0060,
  TRUE,
  ARRAY['Outpatient Treatment', 'Group Therapy', 'Individual Counseling'],
  0.92,
  TRUE
);

-- Refresh the materialized view
REFRESH MATERIALIZED VIEW facility_city_stats;

-- Grant necessary permissions (if using RLS)
-- ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE search_queries ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE scraped_data ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (uncomment if needed)
-- CREATE POLICY "Public read access for facilities" ON facilities FOR SELECT USING (true);
-- CREATE POLICY "Public read access for reviews" ON reviews FOR SELECT USING (true);

ANALYZE facilities;
ANALYZE reviews;
ANALYZE search_queries;
ANALYZE scraped_data;

-- Display setup completion message
DO $$
BEGIN
  RAISE NOTICE 'SoberLivings database setup completed successfully!';
  RAISE NOTICE 'Tables created: facilities, reviews, search_queries, scraped_data';
  RAISE NOTICE 'Indexes created for optimal performance';
  RAISE NOTICE 'Materialized view created: facility_city_stats';
  RAISE NOTICE 'Sample data inserted for testing';
END $$;
