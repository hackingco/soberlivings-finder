# 🔑 Environment Variables Setup Commands

## Option 1: Quick Test Deployment (5 minutes)

To get your app deployed quickly for testing, run these commands:

```bash
cd /Users/shaight/claude-projects/soberlivings/frontend

# Set up demo database connection (for testing)
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
# When prompted, enter: https://lmhxpzfgzakvzywtrzjr.supabase.co

npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production  
# When prompted, enter: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtaHhwemZnemFrdnp5d3RyempyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzUzNDQ3MzYsImV4cCI6MjA1MDkyMDczNn0.SoberLivingFinderDemoKey

npx vercel env add FIRECRAWL_API_KEY production
# When prompted, enter: demo-disabled

# Redeploy with new environment variables
npx vercel --prod --yes
```

This will deploy your app with a demo database that already has sample data!

## Option 2: Production Setup (15 minutes)

### Step 1: Create Supabase Database
1. Go to [supabase.com](https://supabase.com) → Sign up
2. Create new project → Wait 2 minutes for setup
3. Go to **Settings** → **API**
4. Copy your **Project URL** and **anon public key**

### Step 2: Create Database Tables
In Supabase SQL Editor, run:
```sql
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
```

### Step 3: Get Firecrawl API Key
1. Go to [firecrawl.dev](https://firecrawl.dev) → Sign up
2. Get your API key (starts with `fc-`)

### Step 4: Add Your Real Keys
```bash
cd /Users/shaight/claude-projects/soberlivings/frontend

npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
# Enter your real Supabase URL

npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# Enter your real Supabase anon key

npx vercel env add FIRECRAWL_API_KEY production
# Enter your real Firecrawl API key

npx vercel --prod --yes
```

## Option 3: Vercel Dashboard (Easiest)

Instead of CLI, you can use the web interface:

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click on your `frontend` project
3. Go to **Settings** → **Environment Variables**
4. Add these 3 variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `FIRECRAWL_API_KEY`
5. Set environment to **Production, Preview, Development**
6. Go to **Deployments** → **Redeploy**

## 🚀 Recommended: Start with Option 1

I recommend starting with **Option 1** (quick test) to see your app working immediately, then upgrading to **Option 2** (production) when you're ready for real data.

## ✅ Verification

After deployment, your app will be available at:
`https://frontend-[random].vercel.app`

Test by:
1. Visiting the URL
2. Clicking "Import Latest Data" 
3. Searching for facilities

## 🎯 Next Steps

Once deployed:
- Share the URL with users
- Monitor usage in Vercel analytics
- Add custom domain if desired
- Scale database as needed

Ready to proceed? Choose Option 1 for quick testing or Option 2 for production setup!