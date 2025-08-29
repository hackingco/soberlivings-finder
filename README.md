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

## Installation

```bash
npm install
```

## Quick Start

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

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License