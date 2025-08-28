#!/bin/bash

# Vercel Environment Variables Setup Script
# Run this after setting up Supabase to configure Vercel env vars

echo "🔧 Setting up Vercel Environment Variables"
echo "=========================================="

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ .env.local file not found!"
    echo "Please create .env.local with your Supabase credentials first."
    exit 1
fi

# Source the .env.local file to get variables
source .env.local

echo "📋 Adding environment variables to Vercel..."

# Add each environment variable to Vercel
if [ ! -z "$DATABASE_URL" ]; then
    echo "Adding DATABASE_URL..."
    echo "$DATABASE_URL" | vercel env add DATABASE_URL production
fi

if [ ! -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    echo "Adding NEXT_PUBLIC_SUPABASE_URL..."
    echo "$NEXT_PUBLIC_SUPABASE_URL" | vercel env add NEXT_PUBLIC_SUPABASE_URL production
fi

if [ ! -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
    echo "Adding NEXT_PUBLIC_SUPABASE_ANON_KEY..."
    echo "$NEXT_PUBLIC_SUPABASE_ANON_KEY" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
fi

if [ ! -z "$FIRECRAWL_API_KEY" ]; then
    echo "Adding FIRECRAWL_API_KEY..."
    echo "$FIRECRAWL_API_KEY" | vercel env add FIRECRAWL_API_KEY production
fi

echo "✅ Environment variables added to Vercel!"
echo ""
echo "Next steps:"
echo "1. Redeploy your app: vercel --prod"
echo "2. Test the deployed application"
echo "3. Run database seeding if needed"
