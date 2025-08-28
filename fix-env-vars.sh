#!/bin/bash

echo "Fixing environment variables..."

# Database
echo -n "postgresql://postgres:D4b6DOKh4rKIxiEq@db.acwtjmqtwnijzbioauwn.supabase.co:5432/postgres" | vercel env add DATABASE_URL production preview development
echo -n "postgresql://postgres:D4b6DOKh4rKIxiEq@db.acwtjmqtwnijzbioauwn.supabase.co:5432/postgres" | vercel env add DIRECT_URL production preview development

# Supabase
echo -n "https://acwtjmqtwnijzbioauwn.supabase.co" | vercel env add NEXT_PUBLIC_SUPABASE_URL production preview development
echo -n "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjd3RqbXF0d25panpiaW9hdXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMjk4MjMsImV4cCI6MjA3MTkwNTgyM30.seFIOOiaWhJyPscqs2XAaEAbnxVU6G45NXMe3C9JZAM" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production preview development
echo -n "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjd3RqbXF0d25panpiaW9hdXduIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjMyOTgyMywiZXhwIjoyMDcxOTA1ODIzfQ.I3E-SABXKiZtD7920NIv22Ad0kW2DzSXjS9IvsR_ymI" | vercel env add SUPABASE_SERVICE_ROLE_KEY production preview

# APIs
echo -n "fc-55d5082bb4a343f78b29ce746b292145" | vercel env add FIRECRAWL_API_KEY production preview development
echo -n "https://findtreatment.gov/locator/exportsAsJson/v2" | vercel env add FINDTREATMENT_API_URL production preview development

# Other
echo -n "365" | vercel env add DATA_RETENTION_DAYS production preview development
echo -n "1" | vercel env add NEXT_TELEMETRY_DISABLED production preview development
echo -n "true" | vercel env add SKIP_ENV_VALIDATION production preview development

# Auth (placeholder values - update in dashboard)
echo -n "https://soberlivings-finder.vercel.app" | vercel env add NEXTAUTH_URL production
echo -n "your-nextauth-secret-change-this" | vercel env add NEXTAUTH_SECRET production preview
echo -n "32-character-encryption-key-here" | vercel env add ENCRYPTION_KEY production preview

echo "✅ Environment variables fixed!"