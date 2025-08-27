# SoberLiving Finder - Frontend

A modern Next.js application for finding residential treatment facilities and sober living homes nationwide.

## 🚀 Features

- **🔍 Advanced Search** - Search by location, services, insurance accepted
- **🤖 AI-Enhanced Data** - Automatic website scraping with Firecrawl
- **📊 Real-time Database** - PostgreSQL/Supabase for fast queries
- **🗺️ Interactive UI** - Modern responsive design with Tailwind CSS
- **📱 Mobile-First** - Optimized for all devices
- **⚡ Fast Performance** - Built with Next.js 14 and React Server Components

## 🛠️ Tech Stack

- **Framework**: Next.js 14 with App Router
- **Database**: PostgreSQL with Prisma ORM (or Supabase)
- **Styling**: Tailwind CSS + shadcn/ui components
- **API Integration**: FindTreatment.gov REST API
- **Web Scraping**: Firecrawl for facility enrichment
- **Deployment**: Vercel (optimized)
- **TypeScript**: Full type safety

## 📦 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL database (or Supabase account)
- Firecrawl API key

### 1. Environment Setup

```bash
cp .env.example .env.local
```

Fill in your environment variables:

```env
# Database (choose one)
DATABASE_URL="postgresql://user:pass@localhost:5432/soberlivings"

# OR Supabase
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"

# Firecrawl
FIRECRAWL_API_KEY="fc-your-api-key"
```

### 2. Install & Setup

```bash
npm install
npm run db:setup  # Sets up database schema
npm run dev       # Start development server
```

### 3. Import Data

Visit `http://localhost:3000` and click "Import Latest Data" to populate your database with facilities from FindTreatment.gov.

## 🗄️ Database Schema

The application uses a PostgreSQL database with these main tables:

- **facilities** - Core facility information
- **reviews** - User reviews and ratings  
- **scraped_data** - Firecrawl enrichment data
- **search_queries** - Search analytics

## 🔌 API Endpoints

- `GET /api/facilities/search` - Search facilities with filters
- `POST /api/facilities/import` - Import data from FindTreatment.gov
- `POST /api/facilities/[id]/scrape` - Enrich facility with Firecrawl

## 🚀 Deployment to Vercel

### Automatic Deployment

1. Push to GitHub repository
2. Connect to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy automatically on push

### Manual Deployment

```bash
npm install -g vercel
vercel --prod
```

### Environment Variables for Production

Set these in your Vercel dashboard:

```
DATABASE_URL=postgresql://...
FIRECRAWL_API_KEY=fc-...
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## 🔍 Using the Application

### Search Facilities
1. Enter search terms (facility name, services, etc.)
2. Add location (city, state, or coordinates) 
3. Use advanced filters for services and insurance
4. View results with contact info and directions

### Import Fresh Data
- Click "Import Latest Data" to fetch from FindTreatment.gov
- Data is automatically filtered for residential facilities
- Firecrawl enriches each facility with website data

### Facility Cards
Each facility shows:
- Name, location, and contact information
- Services offered and insurance accepted  
- Ratings and reviews (if available)
- Direct links for phone calls and directions

## 🏗️ Architecture

```
frontend/
├── src/
│   ├── app/              # Next.js 14 App Router
│   │   ├── api/          # API routes
│   │   ├── layout.tsx    # Root layout
│   │   └── page.tsx      # Home page
│   ├── components/       # Reusable UI components
│   │   ├── ui/           # Base UI components
│   │   ├── FacilityCard.tsx
│   │   └── FacilitySearch.tsx
│   └── lib/              # Utilities and config
│       ├── supabase.ts
│       ├── firecrawl.ts
│       └── utils.ts
├── prisma/
│   └── schema.prisma     # Database schema
├── public/               # Static assets
└── package.json
```

## 🔧 Development

### Available Scripts

```bash
npm run dev         # Start development server
npm run build       # Build for production  
npm run start       # Start production server
npm run lint        # Run ESLint
npm run type-check  # Run TypeScript checks
npm run db:push     # Push schema to database
npm run db:studio   # Open Prisma Studio
```

### Key Features Implementation

1. **Search Functionality**
   - Real-time search with debouncing
   - Advanced filters (location, services, insurance)
   - Pagination and sorting

2. **Data Import Pipeline**
   - Fetch from FindTreatment.gov API
   - Filter for residential facilities
   - Enrich with Firecrawl web scraping
   - Store in PostgreSQL with deduplication

3. **Modern UI/UX**
   - Responsive design with Tailwind CSS
   - Loading states and error handling
   - Interactive facility cards
   - One-click directions and contact

## 🚨 Important Notes

- **Rate Limiting**: Firecrawl has rate limits - import data gradually
- **Database Size**: PostgreSQL recommended for large datasets
- **Caching**: Consider Redis for production caching
- **Monitoring**: Set up error tracking (Sentry, etc.)

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable  
5. Submit a pull request

## 📞 Support

For issues or questions:
- Create an issue on GitHub
- Check the documentation
- Review environment setup

---

**Ready to deploy?** Push to GitHub and connect to Vercel for automatic deployments! 🚀