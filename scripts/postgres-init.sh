#!/bin/bash
# PostgreSQL initialization script for development

set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Enable required extensions
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "postgis";
    CREATE EXTENSION IF NOT EXISTS "pg_trgm";
    CREATE EXTENSION IF NOT EXISTS "btree_gin";
    
    -- Create application user (if different from postgres)
    -- CREATE USER app_user WITH PASSWORD 'app_password';
    -- GRANT ALL PRIVILEGES ON DATABASE soberlivings TO app_user;
    
    -- Create schemas
    CREATE SCHEMA IF NOT EXISTS public;
    CREATE SCHEMA IF NOT EXISTS audit;
    
    -- Performance settings for development
    ALTER SYSTEM SET shared_buffers = '256MB';
    ALTER SYSTEM SET effective_cache_size = '1GB';
    ALTER SYSTEM SET maintenance_work_mem = '64MB';
    ALTER SYSTEM SET random_page_cost = 1.1;
    ALTER SYSTEM SET effective_io_concurrency = 200;
    
    -- Logging settings for development
    ALTER SYSTEM SET log_statement = 'all';
    ALTER SYSTEM SET log_duration = on;
    ALTER SYSTEM SET log_min_duration_statement = 100;
    
    SELECT pg_reload_conf();
    
    -- Create initial tables if they don't exist
    CREATE TABLE IF NOT EXISTS facilities (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        city VARCHAR(100),
        state VARCHAR(2),
        zip VARCHAR(10),
        phone VARCHAR(20),
        website VARCHAR(255),
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        services JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Create spatial index
    CREATE INDEX IF NOT EXISTS idx_facilities_location 
    ON facilities USING GIST (ST_MakePoint(longitude, latitude));
    
    -- Create text search index
    CREATE INDEX IF NOT EXISTS idx_facilities_name_search 
    ON facilities USING GIN (to_tsvector('english', name));
    
    EOSQL