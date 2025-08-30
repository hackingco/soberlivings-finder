# Sober Living Facilities Finder

A comprehensive full-stack application for finding and managing sober living and residential treatment facilities across the United States. Built with Next.js 14, PostgreSQL/Supabase, and integrated with the FindTreatment.gov API.

## 🚀 Project Overview

This project consists of two main components:
1. **Backend CLI Tool** - Node.js tool for fetching and exporting facility data
2. **Frontend Web Application** - Modern Next.js application with real-time search and interactive features

## ✨ Key Features

### Frontend Application
- 🔍 **Advanced Search** - Search by location, services, insurance accepted
- 🗺️ **Interactive Maps** - Visual facility locations with clustering
- 📊 **Real-time Database** - PostgreSQL/Supabase for fast queries
- 🤖 **AI-Enhanced Data** - Automatic website scraping with Firecrawl
- 📱 **Mobile-First Design** - Responsive UI optimized for all devices
- ⚡ **High Performance** - Built with Next.js 14 and React Server Components
- 🔒 **Secure API** - Rate limiting, authentication, and data validation

### CLI Tool
- 📍 Search facilities by location (coordinates or address)
- 🏠 Filter specifically for residential treatment services
- 📊 Export data in JSON and CSV formats
- 🔄 Batch processing for multiple cities
- 📈 ETL pipeline for data enrichment

## 🛠️ Tech Stack

- **Frontend Framework**: Next.js 14 with App Router
- **Database**: PostgreSQL with Prisma ORM / Supabase
- **Styling**: Tailwind CSS + shadcn/ui components
- **Backend**: Node.js with Express
- **API Integration**: FindTreatment.gov REST API
- **Web Scraping**: Firecrawl API
- **Deployment**: Vercel (optimized for edge functions)
- **Type Safety**: TypeScript throughout

## 📦 Installation

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database or Supabase account
- Git

### Clone the Repository
```bash
git clone https://github.com/hackingco/soberlivings-finder.git
cd soberlivings-finder
```

### Install Dependencies
```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
```

## 🚀 Quick Start

### Option 1: Frontend Web Application

1. **Set up environment variables**:
```bash
cd frontend
cp .env.example .env.local
# Edit .env.local with your database and API credentials
```

2. **Set up the database**:
```bash
npm run db:setup
```

3. **Start the development server**:
```bash
npm run dev
# Open http://localhost:3000
```

### Option 2: CLI Tool

### Basic Search (San Francisco area)
```bash
npm run fetch
```

### Search by coordinates
```bash
node index.js search --location "34.0522,-118.2437"  # Los Angeles
```

### Search by address
```bash
node index.js search --location "Chicago, IL"
node index.js search --location "New York, NY"
node index.js search --location "Miami, FL"
```

### Batch Search Multiple Cities
```bash
# Search all major US cities (45+ cities)
node index.js batch --cities

# Search specific locations
node index.js batch --locations "Seattle, WA,Portland, OR,Denver, CO"

# Search from file
node index.js batch --file examples/sample-locations.txt
```

### View Available Cities
```bash
node index.js cities
```

### Export options
```bash
# JSON only
node index.js search --location "37.7749,-122.4194" --no-csv

# CSV only  
node index.js search --location "37.7749,-122.4194" --no-json
```

## Output

The tool creates two files in the `data/` directory:

- `residential_facilities.json` - Structured JSON data
- `residential_facilities.csv` - Spreadsheet-compatible format

### Sample Output Structure

```json
{
  "name": "Example Recovery Center",
  "city": "San Francisco", 
  "state": "CA",
  "zip": "94102",
  "phone": "(555) 123-4567",
  "address": "123 Recovery St",
  "website": "https://example.com",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "residential_services": "Residential short-term treatment; Residential long-term treatment",
  "all_services": "Outpatient; Residential short-term treatment; Substance abuse counseling approach"
}
```

## API Reference

The tool uses the FindTreatment.gov API:
- Base URL: `https://findtreatment.gov/locator/exportsAsJson/v2`
- Filters for facilities with residential services
- Returns up to 2000 results per search

## Usage as Module

```javascript
const SoberLivingFinder = require('./src/fetchFacilities');

const finder = new SoberLivingFinder();

// Search and get data
const facilities = await finder.searchResidentialFacilities("37.7749,-122.4194");

// Or just fetch raw data
const rawData = await finder.fetchFacilities("37.7749,-122.4194");
const filtered = finder.filterResidentialFacilities(rawData);
```

## Commands

### Single Location Search
- `npm run fetch` - Quick search with default location (SF)
- `npm start` - Run the CLI tool with help
- `node index.js search --help` - See all search options
- `node index.js search -l "City, State"` - Search by address
- `node index.js search -l "lat,lng"` - Search by coordinates

### Batch Operations
- `node index.js batch --cities` - Search all major US cities
- `node index.js batch -l "city1,city2,city3"` - Search multiple cities
- `node index.js batch -f locations.txt` - Search from file
- `node index.js cities` - List available major cities

### Export Options
- `--no-json` - Skip JSON export
- `--no-csv` - Skip CSV export

### Examples
```bash
# Search Los Angeles area
node index.js search -l "Los Angeles, CA"

# Search by coordinates only, no CSV
node index.js search -l "40.7128,-74.0060" --no-csv

# Batch search West Coast cities
node index.js batch -l "Seattle,Portland,San Francisco,Los Angeles,San Diego"

# Search all major cities (comprehensive nationwide data)
node index.js batch --cities
```

## Data Fields

The tool extracts and processes these key fields:
- **name** - Facility name
- **city, state, zip** - Location details  
- **phone** - Contact number
- **address** - Street address
- **website** - Facility website
- **latitude/longitude** - Geographic coordinates
- **residential_services** - Specific residential programs offered
- **all_services** - Complete list of services

## 🚢 Deployment

### Deploy to Vercel (Recommended)

1. **Push to GitHub**:
```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

2. **Connect to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Set root directory to `frontend`
   - Configure environment variables
   - Deploy

### Deploy with Docker

```bash
cd frontend
docker-compose up -d
```

For detailed deployment instructions, see [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

## 📚 Complete Documentation Suite

This project includes comprehensive production-ready documentation:

### Core Documentation
- **[API Documentation](./API_DOCUMENTATION.md)** - Complete API reference with examples
- **[Operations Runbook](./OPERATIONS_RUNBOOK.md)** - Daily operations and system management
- **[Deployment Procedures](./DEPLOYMENT_PROCEDURES.md)** - Step-by-step deployment guide
- **[Troubleshooting Guide](./TROUBLESHOOTING_GUIDE.md)** - Common issues and solutions

### Configuration & Environment
- **[Environment Configuration](./ENVIRONMENT_CONFIGURATION.md)** - Complete environment variable reference
- **[Day 1 Production Runbook](./DAY1_PRODUCTION_RUNBOOK.md)** - Production launch procedures
- **[Deployment Guide](./DEPLOYMENT_GUIDE.md)** - Quick deployment guide

### Quality Assurance Reports
- **[QA Final Report](./QA_FINAL_REPORT.md)** - Quality assessment results
- **[API Validation Report](./API_VALIDATION_REPORT.md)** - API testing results
- **[Top Cities Validation Report](./TOP_CITIES_VALIDATION_REPORT.md)** - Data validation results

### Infrastructure & Deployment
- **[Docker Development Guide](./DOCKER_DEVELOPMENT_GUIDE.md)** - Docker setup and usage
- **[Deployment Final Checklist](./DEPLOYMENT_FINAL_CHECKLIST.md)** - Pre-deployment verification

Each document provides detailed, actionable information for different aspects of the system lifecycle.

## 📊 API Documentation

### Main API Endpoints

#### Search Facilities
```
GET /api/facilities/search
Query params: location, services, insurance, limit
```

#### Import Data
```
POST /api/facilities/import
Body: { location: "city, state" }
```

#### Health Check
```
GET /api/health
```

For complete API documentation, visit `/api/docs` when running the application.

## 🧪 Testing

### Run Tests
```bash
# Frontend tests
cd frontend
npm test

# E2E tests
npm run test:e2e

# Load testing
npm run test:load
```

### QA Report
See [QA_FINAL_REPORT.md](./QA_FINAL_REPORT.md) for the latest quality assessment.

## 📁 Project Structure

```
soberlivings-finder/
├── frontend/               # Next.js web application
│   ├── src/
│   │   ├── app/           # App router pages and API routes
│   │   ├── components/    # React components
│   │   └── lib/           # Utility functions and services
│   ├── prisma/            # Database schema and migrations
│   ├── public/            # Static assets
│   └── tests/             # Test suites
├── etl-backup/            # ETL pipeline for data processing
├── services/              # Microservices (search, AI/ML, realtime)
├── data/                  # Exported facility data
└── docs/                  # Documentation
```

## 🔧 Environment Variables

### Required Variables
```env
# Database
DATABASE_URL=postgresql://...
# OR Supabase
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Optional: Firecrawl for data enrichment
FIRECRAWL_API_KEY=fc-...
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](./CONTRIBUTING.md) for details.

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## 📈 Performance

- **API Response Time**: < 500ms average
- **Search Performance**: < 100ms for database queries
- **Quality Score**: 87% (See QA report)
- **Lighthouse Score**: 95+ on all metrics

## 🔒 Security

- Rate limiting on all API endpoints
- Input validation and sanitization
- SQL injection protection via Prisma ORM
- CORS configuration for production
- Environment variable protection

## 📝 License

MIT License - see [LICENSE](./LICENSE) file for details

## 🙏 Acknowledgments

- Data provided by [FindTreatment.gov](https://findtreatment.gov)
- Built with [Next.js](https://nextjs.org) and [Supabase](https://supabase.com)
- UI components from [shadcn/ui](https://ui.shadcn.com)

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/hackingco/soberlivings-finder/issues)
- **Documentation**: [Wiki](https://github.com/hackingco/soberlivings-finder/wiki)
- **Email**: support@example.com

---

**Last Updated**: August 28, 2025  
**Version**: 1.0.0  
**Status**: Production Ready ✅# CI/CD Test Sat Aug 30 00:43:22 PDT 2025
