# Vercel Environment Variables

Copy these environment variables to your Vercel project settings:
https://vercel.com/[your-username]/soberlivings-finder/settings/environment-variables

## Required Environment Variables

```bash
# Database Configuration
DATABASE_URL="postgresql://postgres:D4b6DOKh4rKIxiEq@db.acwtjmqtwnijzbioauwn.supabase.co:5432/postgres"
DIRECT_URL="postgresql://postgres:D4b6DOKh4rKIxiEq@db.acwtjmqtwnijzbioauwn.supabase.co:5432/postgres"

# Supabase Configuration (Public)
NEXT_PUBLIC_SUPABASE_URL="https://acwtjmqtwnijzbioauwn.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjd3RqbXF0d25panpiaW9hdXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMjk4MjMsImV4cCI6MjA3MTkwNTgyM30.seFIOOiaWhJyPscqs2XAaEAbnxVU6G45NXMe3C9JZAM"

# Supabase Service Role (Secret - Add to Production & Preview only)
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjd3RqbXF0d25panpiaW9hdXduIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjMyOTgyMywiZXhwIjoyMDcxOTA1ODIzfQ.I3E-SABXKiZtD7920NIv22Ad0kW2DzSXjS9IvsR_ymI"

# Firecrawl API Configuration
FIRECRAWL_API_KEY="fc-55d5082bb4a343f78b29ce746b292145"

# FindTreatment.gov API
FINDTREATMENT_API_URL="https://findtreatment.gov/locator/exportsAsJson/v2"

# NextAuth Configuration (Update with your domain)
NEXTAUTH_URL="https://your-app-name.vercel.app"
NEXTAUTH_SECRET="generate-a-secure-random-string-here"

# HIPAA Compliance - Encryption Key (Generate a secure 32-char key)
ENCRYPTION_KEY="generate-32-character-secure-key"

# Data Retention
DATA_RETENTION_DAYS="365"

# Node Environment
NODE_ENV="production"
```

## How to Add to Vercel:

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add each variable above with its corresponding value
4. Select which environments to apply to:
   - ✅ Production
   - ✅ Preview
   - ✅ Development (optional)

## Important Notes:

- **NEXT_PUBLIC_** prefixed variables are exposed to the browser
- **SUPABASE_SERVICE_ROLE_KEY** should only be added to Production & Preview
- Generate a secure **NEXTAUTH_SECRET** using: `openssl rand -base64 32`
- Generate a secure **ENCRYPTION_KEY** (32 chars exactly) for HIPAA compliance
- Update **NEXTAUTH_URL** with your actual Vercel deployment URL

## After Adding Variables:

1. Redeploy your project from Vercel dashboard
2. Or use CLI: `vercel --prod --force`