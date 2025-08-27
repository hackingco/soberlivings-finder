# 🚀 Quick Deploy to Vercel - SoberLiving Finder

## ✅ Current Status
- ✅ **Code committed to GitHub**: https://github.com/hackingco/soberlivings-finder
- ✅ **Build tested locally** and working
- ✅ **Vercel configuration** ready

## 🎯 Simple 3-Step Deployment

### Step 1: Set Up Database (5 minutes)

**Option A: Supabase (Recommended)**
1. Go to [supabase.com](https://supabase.com) → Create account
2. Create new project → Copy these values:
   - **Project URL**: `https://your-project.supabase.co`
   - **Anon Key**: `eyJhbGciOi...` (from Settings → API)
3. Run this SQL in SQL Editor:
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

### Step 2: Get Firecrawl API Key (2 minutes)
1. Go to [firecrawl.dev](https://firecrawl.dev) → Sign up
2. Copy your API key: `fc-abcd1234...`

### Step 3: Deploy to Vercel (3 minutes)
1. **Go to [vercel.com](https://vercel.com)** → Login with GitHub
2. **Click "New Project"** → Import `hackingco/soberlivings-finder`
3. **IMPORTANT**: Set **Root Directory** to `frontend`
4. **Add Environment Variables**:
   ```
   NEXT_PUBLIC_SUPABASE_URL = https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciOi...your-anon-key
   FIRECRAWL_API_KEY = fc-your-api-key
   ```
5. **Click Deploy!**

## 🎉 That's It!

Your app will be live at: `https://your-project.vercel.app`

### First Steps After Deployment:
1. **Visit your app** → Click "Import Latest Data"
2. **Test search** → Try searching for "San Francisco, CA"
3. **Verify features** → Check facility cards and contact info

## 📊 What You Get

- ✅ **Modern search interface** for treatment facilities
- ✅ **Real-time data import** from FindTreatment.gov
- ✅ **AI-enhanced facility info** via Firecrawl
- ✅ **Mobile-responsive design**
- ✅ **Production-ready performance**

## 🔧 If Issues Occur

**Build fails:**
- Check environment variables are set correctly
- Verify Supabase project URL format

**No search results:**
- Click "Import Latest Data" first
- Check browser console for errors

**Database errors:**
- Verify SQL table creation completed
- Check Supabase connection

## 📞 Support
- GitHub repo: https://github.com/hackingco/soberlivings-finder
- Issues: Use GitHub Issues tab
- Documentation: See README.md

---

**Ready to deploy?** Just follow the 3 steps above! 🚀