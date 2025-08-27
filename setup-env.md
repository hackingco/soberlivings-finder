# 🔑 Environment Variables Setup Guide

## Step 1: Get Supabase Credentials (Free Database)

### Create Supabase Project:
1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project" → Sign up with GitHub
3. Click "New Project"
4. Fill in:
   - **Name**: `soberlivings-finder`
   - **Database Password**: Create a strong password
   - **Region**: Choose closest to you
5. Click "Create new project" (takes ~2 minutes)

### Get Your Keys:
1. Once created, go to **Settings** → **API**
2. Copy these values:
   - **Project URL**: `https://abcdefghijk.supabase.co`
   - **Project API Key (anon, public)**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### Create Database Tables:
1. Go to **SQL Editor** in your Supabase dashboard
2. Click "New Query" and paste this SQL:

```sql
-- Create facilities table
CREATE TABLE facilities (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT,
  phone TEXT,
  address TEXT,
  website TEXT,
  latitude FLOAT,
  longitude FLOAT,
  "residentialServices" TEXT,
  "allServices" TEXT,
  description TEXT,
  capacity INTEGER,
  amenities TEXT[],
  "acceptedInsurance" TEXT[],
  programs TEXT[],
  verified BOOLEAN DEFAULT false,
  "lastUpdated" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "searchLocation" TEXT,
  "searchCoordinates" TEXT,
  "averageRating" FLOAT
);

-- Create reviews table
CREATE TABLE reviews (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "facilityId" TEXT REFERENCES facilities(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  content TEXT,
  author TEXT,
  verified BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create search_queries table
CREATE TABLE search_queries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  query TEXT NOT NULL,
  location TEXT,
  filters JSONB,
  results INTEGER DEFAULT 0,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create scraped_data table
CREATE TABLE scraped_data (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  url TEXT UNIQUE NOT NULL,
  title TEXT,
  content TEXT,
  metadata JSONB,
  "facilityId" TEXT,
  "scrapedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_facilities_city_state ON facilities(city, state);
CREATE INDEX idx_facilities_services ON facilities USING gin(to_tsvector('english', "allServices"));
CREATE INDEX idx_reviews_facility ON reviews("facilityId");
```

3. Click "Run" → Should see "Success. No rows returned"

## Step 2: Get Firecrawl API Key (AI Web Scraping)

### Option A: Firecrawl (Recommended)
1. Go to [firecrawl.dev](https://firecrawl.dev)
2. Click "Get Started" → Sign up
3. Go to Dashboard → API Keys
4. Copy your API key: `fc-abcdef123456...`

### Option B: Skip Firecrawl (Basic Version)
If you want to skip AI enhancement for now:
- Use: `FIRECRAWL_API_KEY=demo-key-disabled`
- The app will work but won't scrape additional website data

## Step 3: Add Variables to Vercel

You have 3 options to add environment variables:

### Option A: Vercel Dashboard (Easiest)
1. Go to [vercel.com](https://vercel.com/dashboard)
2. Find your `frontend` project
3. Go to **Settings** → **Environment Variables**
4. Add these 3 variables:

```
Name: NEXT_PUBLIC_SUPABASE_URL
Value: https://your-project-id.supabase.co

Name: NEXT_PUBLIC_SUPABASE_ANON_KEY  
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Name: FIRECRAWL_API_KEY
Value: fc-your-api-key-here
```

5. Set Environment to **Production, Preview, Development**
6. Click **Save**

### Option B: Vercel CLI (Current Method)
```bash
cd /Users/shaight/claude-projects/soberlivings/frontend

# Add Supabase URL
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
# Enter: https://your-project-id.supabase.co

# Add Supabase Key  
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# Enter: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Add Firecrawl Key
npx vercel env add FIRECRAWL_API_KEY production  
# Enter: fc-your-api-key-here
```

### Option C: GitHub Repository Secrets
1. Go to your GitHub repo: https://github.com/hackingco/soberlivings-finder
2. Settings → Secrets and variables → Actions
3. Add the same 3 variables

## Step 4: Redeploy

After adding environment variables:

```bash
cd /Users/shaight/claude-projects/soberlivings/frontend
npx vercel --prod
```

Or trigger a new deployment in Vercel dashboard.

## ✅ Verification Checklist

- [ ] Supabase project created
- [ ] Database tables created successfully  
- [ ] Supabase URL and key copied
- [ ] Firecrawl API key obtained
- [ ] All 3 environment variables added to Vercel
- [ ] New deployment triggered
- [ ] App loads without errors
- [ ] "Import Latest Data" button works

## 🎯 Quick Test Values

If you want to test quickly, you can use these temporary values:

```env
# Test database (limited)
NEXT_PUBLIC_SUPABASE_URL=https://demo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=demo-key

# Disable Firecrawl for testing
FIRECRAWL_API_KEY=demo-disabled
```

But for production use, get real API keys from the services above.

## 🚨 Common Issues

**"Database connection failed"**
- Check Supabase URL format: must start with `https://`
- Verify anon key is the public key, not service role

**"Firecrawl errors"** 
- App works without Firecrawl
- Check API key format: starts with `fc-`

**"Build still failing"**
- Wait 1-2 minutes after adding env vars
- Try redeploying: `npx vercel --prod`

## 🎉 Next Steps

Once environment variables are set:
1. App will deploy successfully
2. Visit your Vercel URL
3. Click "Import Latest Data"
4. Start searching for facilities!

Your SoberLiving Finder will be live and helping people find treatment facilities! 🚀