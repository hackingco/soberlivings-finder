#!/bin/bash

echo "🔧 Fixing environment variables..."

# Add to each environment separately
add_var() {
    local key=$1
    local value=$2
    shift 2
    for env in "$@"; do
        echo -n "$value" | vercel env add "$key" "$env" 2>/dev/null || echo "  ⚠️  $key already exists for $env"
    done
}

echo "📦 Adding Database Configuration..."
add_var "DATABASE_URL" "postgresql://postgres:D4b6DOKh4rKIxiEq@db.acwtjmqtwnijzbioauwn.supabase.co:5432/postgres" production preview development
add_var "DIRECT_URL" "postgresql://postgres:D4b6DOKh4rKIxiEq@db.acwtjmqtwnijzbioauwn.supabase.co:5432/postgres" production preview development

echo "🔐 Adding Supabase Configuration..."
add_var "NEXT_PUBLIC_SUPABASE_URL" "https://acwtjmqtwnijzbioauwn.supabase.co" production preview development
add_var "NEXT_PUBLIC_SUPABASE_ANON_KEY" "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjd3RqbXF0d25panpiaW9hdXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMjk4MjMsImV4cCI6MjA3MTkwNTgyM30.seFIOOiaWhJyPscqs2XAaEAbnxVU6G45NXMe3C9JZAM" production preview development
add_var "SUPABASE_SERVICE_ROLE_KEY" "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjd3RqbXF0d25panpiaW9hdXduIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjMyOTgyMywiZXhwIjoyMDcxOTA1ODIzfQ.I3E-SABXKiZtD7920NIv22Ad0kW2DzSXjS9IvsR_ymI" production preview

echo "🌐 Adding API Configuration..."
add_var "FIRECRAWL_API_KEY" "fc-55d5082bb4a343f78b29ce746b292145" production preview development
add_var "FINDTREATMENT_API_URL" "https://findtreatment.gov/locator/exportsAsJson/v2" production preview development

echo "⚙️ Adding Other Configuration..."
add_var "DATA_RETENTION_DAYS" "365" production preview development
add_var "NEXT_TELEMETRY_DISABLED" "1" production preview development
add_var "SKIP_ENV_VALIDATION" "true" production preview development

echo "🔑 Adding Auth Configuration..."
add_var "NEXTAUTH_URL" "https://soberlivings-finder.vercel.app" production
add_var "NEXTAUTH_SECRET" "your-nextauth-secret-change-this" production preview
add_var "ENCRYPTION_KEY" "32-character-encryption-key-here" production preview

echo "✅ Environment variables fixed!"