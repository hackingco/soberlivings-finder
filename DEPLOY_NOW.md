# 🚀 Deploy SoberLiving Finder to Vercel - Quick Start

## Step 1: Setup Database (Choose One Option)

### Option A: Supabase (Recommended - Free & Easy)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Go to Settings → API and copy these values:
   - Project URL: `https://your-project.supabase.co`
   - Anon public key: `eyJhbGciOi...`
4. Go to SQL Editor and run this script to create tables:

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

-- Create other tables
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

CREATE TABLE search_queries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  query TEXT NOT NULL,
  location TEXT,
  filters JSONB,
  results INTEGER DEFAULT 0,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
```

### Option B: Railway PostgreSQL

1. Go to [railway.app](https://railway.app) and create account
2. Create new project → Add PostgreSQL
3. Copy the DATABASE_URL from the Connect tab

## Step 2: Get Firecrawl API Key

1. Go to [firecrawl.dev](https://firecrawl.dev) and sign up
2. Get your API key (looks like `fc-abcd1234...`)

## Step 3: Deploy to Vercel

### Method 1: GitHub Deploy (Recommended)

1. **Push to GitHub** (if you haven't):
   ```bash
   cd /Users/shaight/claude-projects/soberlivings
   
   # If no GitHub repo yet:
   gh repo create soberlivings --public --source=. --remote=origin --push
   
   # Or if repo exists:
   git push origin main
   ```

2. **Connect to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - **Important**: Set Root Directory to `frontend`

3. **Environment Variables** - Add these in Vercel dashboard:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   FIRECRAWL_API_KEY=fc-your-api-key
   ```

4. **Deploy** - Click Deploy!

### Method 2: Direct CLI Deploy

```bash
cd /Users/shaight/claude-projects/soberlivings/frontend

# Login to Vercel (follow prompts)
npx vercel login

# Deploy (follow prompts, answer "Yes" to questions)
npx vercel

# When prompted:
# ? Set up and deploy "frontend"? [Y/n] y
# ? Which scope? Your username
# ? Link to existing project? [y/N] n
# ? What's your project's name? soberlivings-finder
# ? In which directory is your code located? ./

# Add environment variables
npx vercel env add NEXT_PUBLIC_SUPABASE_URL
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY  
npx vercel env add FIRECRAWL_API_KEY

# Deploy to production
npx vercel --prod
```

## Step 4: Test Your Deployment

1. **Visit your app** at the Vercel URL (e.g., `https://soberlivings-finder.vercel.app`)
2. **Import data**: Click "Import Latest Data" button
3. **Search**: Try searching for facilities in different cities
4. **Verify**: Check that Firecrawl enhancement is working

## Environment Variables You Need

```env
# Required - Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Required - Firecrawl
FIRECRAWL_API_KEY=fc-your-api-key

# Optional - already configured
FINDTREATMENT_API_URL=https://findtreatment.gov/locator/exportsAsJson/v2
```

## 🎯 Quick Verification Checklist

- [ ] Database tables created successfully
- [ ] Vercel deployment shows "Ready" status
- [ ] App loads without console errors
- [ ] "Import Latest Data" button works
- [ ] Search returns results after import
- [ ] Facility cards show proper information
- [ ] Mobile responsive design works

## 🚨 Common Issues & Quick Fixes

**Build fails with TypeScript errors:**
```bash
# Local test first
npm run build
```

**Database connection errors:**
- Check Supabase URL and keys are correct
- Verify tables were created properly

**No search results:**
- Click "Import Latest Data" first
- Check browser console for errors

**Firecrawl not working:**
- App will work without it
- Check API key is correct
- Verify Firecrawl account has credits

## 🎉 Success!

Once deployed, your SoberLiving Finder will be live at:
- **Vercel URL**: `https://your-project.vercel.app`
- **Custom domain** (optional): Configure in Vercel dashboard

The app includes:
- ✅ Search thousands of treatment facilities
- ✅ Location-based filtering  
- ✅ AI-enhanced facility data
- ✅ Mobile-responsive design
- ✅ Real-time data import
- ✅ Production-ready performance

**Next Steps:**
1. Import initial data using the admin interface
2. Test search functionality thoroughly
3. Share with your target audience
4. Monitor usage in Vercel analytics

---

**Need help?** Check the complete DEPLOYMENT.md guide or Vercel documentation.