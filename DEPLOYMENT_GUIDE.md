# 🚀 Complete Deployment Guide - SoberLivings Finder

## Step 1: Set Up Supabase Database

### 1.1 Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click "New Project"
3. Choose your organization and fill in:
   - **Name**: `soberlivings-finder` 
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users
4. Wait for the project to be created (2-3 minutes)

### 1.2 Set Up Database Schema
1. Go to your Supabase project dashboard
2. Click on **SQL Editor** in the left sidebar
3. Click **"New Query"**
4. Copy and paste the entire contents of `frontend/supabase-setup.sql`
5. Click **"Run"** - you should see success messages
6. Verify tables were created by going to **Table Editor**

### 1.3 Get Your Supabase Credentials
1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **Anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (long string)

## Step 2: Deploy to Vercel

### 2.1 Method A: GitHub Integration (Recommended)

1. **Ensure latest code is pushed**:
   ```bash
   cd /Users/shaight/claude-projects/soberlivings
   git add . && git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Connect to Vercel**:
   - Go to [vercel.com](https://vercel.com) and sign in
   - Click **"New Project"**
   - Select **"Import Git Repository"**
   - Choose your `soberlivings` repository
   - **IMPORTANT**: Set **Root Directory** to `frontend`
   - Click **"Deploy"**

3. **Configure Environment Variables**:
   - In Vercel dashboard, go to **Settings** → **Environment Variables**
   - Add these variables:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   DATABASE_URL=postgresql://postgres:your-password@db.your-project-id.supabase.co:5432/postgres
   FIRECRAWL_API_KEY=fc-your-key-here
   ```

4. **Redeploy**: Click **"Deployments"** → **"Redeploy"** to apply env vars

### 2.2 Method B: Direct CLI Deploy

```bash
cd /Users/shaight/claude-projects/soberlivings/frontend

# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# When prompted:
# ? Set up and deploy "frontend"? [Y/n] y
# ? Which scope do you want to deploy to? [Your username]
# ? Link to existing project? [y/N] n
# ? What's your project's name? soberlivings-finder
# ? In which directory is your code located? ./

# Add environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add DATABASE_URL
vercel env add FIRECRAWL_API_KEY

# Deploy to production
vercel --prod
```

## Step 3: Seed Your Database

### 3.1 Option A: Use the Seeding Script (Recommended)

1. **Set up local environment for seeding**:
   ```bash
   cd /Users/shaight/claude-projects/soberlivings/frontend
   
   # Create .env.local file
   echo "DATABASE_URL=postgresql://postgres:your-password@db.your-project-id.supabase.co:5432/postgres" > .env.local
   echo "NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co" >> .env.local
   echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key" >> .env.local
   ```

2. **Run the enhanced seeding**:
   ```bash
   # Seed from data files (fastest, most comprehensive)
   npm run seed data-files
   
   # OR comprehensive seeding (files + API for extra coverage)
   npm run seed comprehensive --include-api
   
   # OR clean and re-seed
   npm run seed clean
   ```

### 3.2 Option B: Use Web Interface
1. Visit your deployed app at `https://your-app.vercel.app`
2. Look for "Import Data" or "Admin" section
3. Click "Import Latest Data" button
4. Wait for the import to complete

## Step 4: Get Firecrawl API Key (Optional but Recommended)

1. Go to [firecrawl.dev](https://firecrawl.dev)
2. Sign up for free account
3. Get your API key (starts with `fc-`)
4. Add it to Vercel environment variables as `FIRECRAWL_API_KEY`

## Step 5: Test Your Deployment

### 5.1 Basic Functionality Test
1. **Visit your app**: `https://your-app.vercel.app`
2. **Check loading**: Page should load without errors
3. **Test search**: Try searching for facilities
4. **Check results**: Should see facility cards with data
5. **Test filtering**: Try location and service filters

### 5.2 Database Verification
1. Go to Supabase → **Table Editor** → **facilities**
2. You should see facility records
3. Check that data looks correct (names, locations, services)

### 5.3 Performance Check
1. Open browser dev tools → **Network** tab
2. Reload the page
3. Initial load should be under 3 seconds
4. Search responses should be under 1 second

## Environment Variables Reference

```env
# Required - Supabase Database
DATABASE_URL=postgresql://postgres:password@db.project-id.supabase.co:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional - Firecrawl for enhanced data
FIRECRAWL_API_KEY=fc-your-api-key-here

# Auto-configured
NEXT_PUBLIC_VERCEL_URL=true
NEXT_TELEMETRY_DISABLED=1
```

## Troubleshooting

### Database Connection Issues
```sql
-- Test in Supabase SQL Editor
SELECT COUNT(*) FROM facilities;
-- Should return number of facilities
```

### Build Errors
```bash
# Test build locally first
cd frontend
npm run build
npm run type-check
```

### No Search Results
1. Check if data was seeded: Go to Supabase → Table Editor → facilities
2. Check browser console for errors
3. Verify environment variables in Vercel
4. Re-run seeding if necessary

### Slow Performance
1. Check database indexes: Run `EXPLAIN ANALYZE` on slow queries
2. Verify materialized views: `SELECT * FROM facility_city_stats LIMIT 5;`
3. Check Vercel function logs for errors

## Post-Deployment Checklist

- [ ] ✅ Supabase project created and configured
- [ ] ✅ Database schema created with all tables
- [ ] ✅ Vercel deployment successful
- [ ] ✅ Environment variables configured
- [ ] ✅ Database seeded with facility data
- [ ] ✅ Search functionality working
- [ ] ✅ Facility details display correctly
- [ ] ✅ Mobile responsive design works
- [ ] ✅ Performance is acceptable (< 3s load time)
- [ ] ✅ No console errors in browser
- [ ] ✅ Firecrawl integration working (if configured)

## Success! 🎉

Your SoberLivings Finder is now live at:
- **Production URL**: `https://your-app.vercel.app`
- **Database**: Supabase PostgreSQL with thousands of facilities
- **Search**: Location-based facility search with AI enhancement
- **Performance**: Optimized with caching and indexes

## Next Steps

1. **Custom Domain**: Add your domain in Vercel settings
2. **Analytics**: Enable Vercel Analytics for usage insights
3. **Monitoring**: Set up alerts for errors
4. **Content**: Add more facility data sources
5. **Features**: Implement user reviews and ratings

## Support

- **Vercel Docs**: [vercel.com/docs](https://vercel.com/docs)
- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
- **Issues**: Check GitHub repository issues
- **Updates**: Regularly update dependencies and data

---

**Need help?** Check the detailed logs in Vercel dashboard and Supabase logs.
