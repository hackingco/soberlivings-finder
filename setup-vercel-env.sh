#!/bin/bash

# Vercel Environment Variables Setup Script
# This script automatically configures all required environment variables for your Vercel project

echo "🚀 Setting up Vercel Environment Variables..."
echo "================================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${RED}❌ Vercel CLI is not installed. Please install it first:${NC}"
    echo "npm install -g vercel"
    exit 1
fi

# Project name (update if different)
PROJECT_NAME="soberlivings-finder"

echo -e "${YELLOW}📝 Adding environment variables to Vercel project: $PROJECT_NAME${NC}"
echo ""

# Function to add environment variable
add_env_var() {
    local key=$1
    local value=$2
    local environments=$3
    
    echo -n "Adding $key... "
    
    # Add for each environment
    for env in $environments; do
        vercel env add "$key" "$env" <<< "$value" 2>/dev/null
    done
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${YELLOW}(may already exist)${NC}"
    fi
}

# Read from .env.local if it exists
if [ -f ".env.local" ]; then
    echo -e "${GREEN}✓ Found .env.local file${NC}"
    source .env.local
else
    echo -e "${YELLOW}⚠ .env.local not found. Using default values.${NC}"
fi

echo ""
echo "Adding Database Configuration..."
echo "--------------------------------"
add_env_var "DATABASE_URL" "${DATABASE_URL:-postgresql://postgres:D4b6DOKh4rKIxiEq@db.acwtjmqtwnijzbioauwn.supabase.co:5432/postgres}" "production preview development"
add_env_var "DIRECT_URL" "${DIRECT_URL:-postgresql://postgres:D4b6DOKh4rKIxiEq@db.acwtjmqtwnijzbioauwn.supabase.co:5432/postgres}" "production preview development"

echo ""
echo "Adding Supabase Configuration..."
echo "--------------------------------"
add_env_var "NEXT_PUBLIC_SUPABASE_URL" "${NEXT_PUBLIC_SUPABASE_URL:-https://acwtjmqtwnijzbioauwn.supabase.co}" "production preview development"
add_env_var "NEXT_PUBLIC_SUPABASE_ANON_KEY" "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjd3RqbXF0d25panpiaW9hdXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMjk4MjMsImV4cCI6MjA3MTkwNTgyM30.seFIOOiaWhJyPscqs2XAaEAbnxVU6G45NXMe3C9JZAM}" "production preview development"
add_env_var "SUPABASE_SERVICE_ROLE_KEY" "${SUPABASE_SERVICE_ROLE_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjd3RqbXF0d25panpiaW9hdXduIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjMyOTgyMywiZXhwIjoyMDcxOTA1ODIzfQ.I3E-SABXKiZtD7920NIv22Ad0kW2DzSXjS9IvsR_ymI}" "production preview"

echo ""
echo "Adding API Keys..."
echo "------------------"
add_env_var "FIRECRAWL_API_KEY" "${FIRECRAWL_API_KEY:-fc-55d5082bb4a343f78b29ce746b292145}" "production preview development"
add_env_var "FINDTREATMENT_API_URL" "${FINDTREATMENT_API_URL:-https://findtreatment.gov/locator/exportsAsJson/v2}" "production preview development"

echo ""
echo "Adding Security Configuration..."
echo "--------------------------------"

# Generate random secrets if not provided
if [ -z "$NEXTAUTH_SECRET" ]; then
    NEXTAUTH_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "your-nextauth-secret-here")
    echo -e "${YELLOW}⚠ Generated random NEXTAUTH_SECRET${NC}"
fi

if [ -z "$ENCRYPTION_KEY" ]; then
    ENCRYPTION_KEY=$(openssl rand -hex 16 2>/dev/null || echo "32-character-encryption-key-here")
    echo -e "${YELLOW}⚠ Generated random ENCRYPTION_KEY${NC}"
fi

# Get the Vercel deployment URL
VERCEL_URL=$(vercel inspect --token $VERCEL_TOKEN 2>/dev/null | grep "Production:" | awk '{print $2}')
if [ -z "$VERCEL_URL" ]; then
    VERCEL_URL="https://$PROJECT_NAME.vercel.app"
fi

add_env_var "NEXTAUTH_URL" "${NEXTAUTH_URL:-$VERCEL_URL}" "production preview"
add_env_var "NEXTAUTH_SECRET" "$NEXTAUTH_SECRET" "production preview"
add_env_var "ENCRYPTION_KEY" "$ENCRYPTION_KEY" "production preview"

echo ""
echo "Adding Additional Configuration..."
echo "----------------------------------"
add_env_var "DATA_RETENTION_DAYS" "${DATA_RETENTION_DAYS:-365}" "production preview development"
add_env_var "NODE_ENV" "production" "production"
add_env_var "NODE_ENV" "preview" "preview"
add_env_var "NODE_ENV" "development" "development"
add_env_var "NEXT_TELEMETRY_DISABLED" "1" "production preview development"

echo ""
echo "================================================"
echo -e "${GREEN}✅ Environment variables configuration complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Review the variables in your Vercel dashboard:"
echo "   https://vercel.com/hackingco/$PROJECT_NAME/settings/environment-variables"
echo ""
echo "2. Deploy your project:"
echo "   vercel --prod"
echo ""
echo -e "${YELLOW}Note: Some variables may need to be updated with production values.${NC}"