# 🚀 Deployment Guide - SoberLiving Finder

This guide covers deploying the SoberLiving Finder frontend to Vercel with all the necessary configurations.

## 📋 Prerequisites

- Vercel account ([vercel.com](https://vercel.com))
- GitHub repository with your code
- Database setup (PostgreSQL or Supabase)
- Firecrawl API key ([firecrawl.com](https://firecrawl.com))

## 🗄️ Database Setup Options

### Option 1: Supabase (Recommended for beginners)

1. Create a Supabase account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Settings → API to get your keys
4. Use the SQL Editor to create tables:

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
CREATE INDEX idx_facilities_location ON facilities(latitude, longitude);
CREATE INDEX idx_facilities_services ON facilities USING gin(to_tsvector('english', "allServices"));
CREATE INDEX idx_reviews_facility ON reviews("facilityId");
```

### Option 2: PostgreSQL

1. Set up a PostgreSQL database (local or cloud)
2. Run `npm run db:push` to create the schema
3. Use the DATABASE_URL from your PostgreSQL provider

## 🔑 Environment Variables

You'll need these environment variables in Vercel:

### Required Variables:
```env
# Database (choose one option)
DATABASE_URL=postgresql://user:pass@host:port/database

# OR Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Firecrawl API
FIRECRAWL_API_KEY=fc-your-api-key-here

# FindTreatment.gov API (optional - defaults are set)
FINDTREATMENT_API_URL=https://findtreatment.gov/locator/exportsAsJson/v2
```

## 🚀 Vercel Deployment Steps

### 1. Push to GitHub
```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

### 2. Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "New Project"
3. Import your GitHub repository
4. Select the `frontend` folder as the root directory

### 3. Configure Build Settings

Vercel should auto-detect Next.js, but confirm these settings:

- **Framework Preset**: Next.js
- **Root Directory**: `frontend` (if not auto-detected)
- **Build Command**: `npm run vercel-build`
- **Output Directory**: `.next` (auto-detected)
- **Install Command**: `npm install`

### 4. Add Environment Variables

In the Vercel dashboard, go to Settings → Environment Variables and add:

```
DATABASE_URL = postgresql://your-connection-string
FIRECRAWL_API_KEY = fc-your-api-key
NEXT_PUBLIC_SUPABASE_URL = https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = your-anon-key
```

### 5. Deploy

Click "Deploy" and wait for the build to complete!

## 🧪 Testing Your Deployment

1. **Visit your app** - Vercel will provide a URL like `https://your-app.vercel.app`
2. **Test search** - Try searching without importing data first
3. **Import data** - Click "Import Latest Data" to populate your database
4. **Search again** - You should now see results

## 🔧 Common Issues & Solutions

### Build Failures

**Issue**: "Module not found" errors
```bash
# Solution: Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Issue**: TypeScript errors
```bash
# Solution: Check types and run build locally first
npm run type-check
npm run build
```

### Database Connection Issues

**Issue**: "Database connection failed"
- Verify your DATABASE_URL is correct
- Check if your database allows external connections
- For Supabase, ensure you're using the connection pooler URL

**Issue**: "Table doesn't exist"
- Run the SQL commands above in your database
- For PostgreSQL, run `npm run db:push`

### API Issues

**Issue**: Firecrawl errors
- Verify your API key is correct
- Check your Firecrawl account usage limits
- The app will work without Firecrawl (just no enhanced data)

**Issue**: No search results
- Import data first using the "Import Latest Data" button
- Check browser console for error messages
- Verify database has data: `SELECT COUNT(*) FROM facilities;`

## 🌟 Optional Enhancements

### Custom Domain
1. Go to Vercel Dashboard → Domains
2. Add your custom domain
3. Configure DNS records as instructed

### Environment Management
```bash
# Install Vercel CLI for easier management
npm i -g vercel

# Pull environment variables locally
vercel env pull .env.local

# Deploy from CLI
vercel --prod
```

### Monitoring
1. Set up Vercel Analytics in your dashboard
2. Add error tracking (Sentry, LogRocket, etc.)
3. Set up uptime monitoring

## 📊 Performance Optimization

### Database Optimization
- Add indexes for frequently searched fields
- Use connection pooling for PostgreSQL
- Consider caching with Redis for high traffic

### Frontend Optimization
- Enable Vercel Edge Functions for better performance
- Use Next.js Image optimization
- Implement proper SEO meta tags

## 🔒 Security Considerations

- Never expose database credentials in client-side code
- Use environment variables for all sensitive data
- Implement rate limiting for API endpoints
- Validate all user inputs
- Use HTTPS for all connections

## 📞 Support

If you encounter issues:

1. Check the [Vercel documentation](https://vercel.com/docs)
2. Review the build logs in Vercel dashboard
3. Test locally first: `npm run build && npm start`
4. Check the GitHub repository for issues

## 🎉 You're Live!

Once deployed, your SoberLiving Finder will be live and ready to help people find treatment facilities. The app includes:

- ✅ Modern responsive design
- ✅ Real-time search and filtering
- ✅ Automatic data importing from FindTreatment.gov
- ✅ AI-enhanced facility information via Firecrawl
- ✅ Mobile-optimized interface
- ✅ Production-ready performance

**Next Steps:**
- Import initial data using the admin interface
- Share the URL with your target audience
- Monitor usage and optimize based on user feedback
- Consider adding more features like user accounts, favorites, etc.

---

**Deployment URL**: Your app will be available at `https://your-project.vercel.app`

Happy deploying! 🚀