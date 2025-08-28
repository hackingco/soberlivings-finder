# Enhanced ETL Pipeline Documentation

## Overview

The Enhanced ETL (Extract, Transform, Load) pipeline for SoberLivings Finder has been significantly improved to handle multiple data sources and provide robust data processing capabilities.

## Key Improvements

### 1. Multi-Source Data Extraction
- **CSV File Support**: Direct import from `data/residential_facilities.csv`
- **JSON File Support**: Direct import from `data/residential_facilities.json`
- **API Integration**: FindTreatment.gov API for live data
- **Flexible Combinations**: Mix and match data sources as needed

### 2. Enhanced Data Schema
The Prisma schema has been updated to better reflect the rich data available:

```typescript
model Facility {
  // Core identification
  id          String   @id @default(cuid())
  name        String
  street      String?
  city        String
  state       String
  zip         String?
  phone       String?
  website     String?
  latitude    Float?
  longitude   Float?
  
  // Service information
  residentialServices String?
  allServices        String?
  services           String[] @default([])
  
  // Enhanced metadata
  metadata          Json?
  sourceData        Json?
  geoHash          String?
  isResidential    Boolean  @default(false)
  serviceCount     Int      @default(0)
  dataQuality      Float?   // Score 0-1
  
  // Timestamps and verification
  verified          Boolean  @default(false)
  lastUpdated       DateTime @default(now()) @updatedAt
  createdAt         DateTime @default(now())
}
```

### 3. Intelligent Data Transformation
- **Service Extraction**: Parses semicolon-separated service lists
- **Data Quality Scoring**: Automatically scores data completeness (0-1)
- **Residential Detection**: Automatically identifies residential facilities
- **Geographic Enhancement**: Generates geohashes for location clustering
- **Data Normalization**: Cleans phone numbers, websites, addresses

### 4. Robust Error Handling
- **Batch Processing**: Handles large datasets in manageable chunks
- **Error Recovery**: Continues processing despite individual record failures
- **Comprehensive Logging**: Detailed metrics and error reporting
- **Transaction Safety**: Database operations wrapped in transactions

## Usage

### Installation
```bash
cd frontend
npm install  # Installs csv-parse, tsx, and other new dependencies
```

### Database Setup
```bash
# Generate Prisma client and push schema
npm run db:setup
```

### Seeding Commands

#### 1. Seed from Data Files (Recommended)
```bash
npm run seed data-files [data-directory]
```
- Uses existing CSV/JSON files in the data directory
- Fastest and most comprehensive option
- Example: `npm run seed data-files ../data`

#### 2. Comprehensive Seeding
```bash
npm run seed comprehensive [data-directory] [--include-api]
```
- Uses data files + optionally includes API data
- Best for maximum coverage
- Example: `npm run seed comprehensive ../data --include-api`

#### 3. API-Only Seeding (Legacy)
```bash
npm run seed major-cities    # Major US cities
npm run seed states          # All state capitals
npm run seed custom "City,lat,lon" "City2,lat2,lon2"
```

#### 4. Clean and Re-seed
```bash
npm run seed clean [data-directory]
```
- Removes all existing facilities
- Re-seeds from data files

### Advanced Usage

#### Custom ETL Pipeline
```typescript
import { createETLPipeline, createDatabaseSeeder } from './lib/etl-pipeline';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const pipeline = createETLPipeline(prisma);

// Seed from multiple sources
await pipeline.executeWithSources({
  csvFile: './data/facilities.csv',
  jsonFile: './data/facilities.json',
  locations: [
    { lat: 40.7128, lon: -74.0060, name: 'New York, NY' }
  ]
});
```

## Data Quality Features

### Quality Scoring
Each facility receives a data quality score (0-1) based on:
- Required fields (name, city, state, phone): 40%
- Location data (latitude, longitude): 20%
- Contact information (website, phone): 20%
- Service information completeness: 20%

### Validation Rules
- **Required Fields**: Name, city, state must be present
- **Geographic Data**: Latitude/longitude validated if present
- **Phone Numbers**: Normalized to 10-digit format
- **Websites**: Automatically prefixed with https://
- **State Codes**: Normalized to 2-letter uppercase

### Deduplication
Facilities are deduplicated based on:
- Generated ID from name + city + state (normalized)
- Prevents duplicate entries from multiple sources

## Performance Optimizations

### Database Indexes
Automatically creates indexes for:
- Geographic queries: `(latitude, longitude)` using GIST
- Location searches: `(state, city)`
- Service filtering: `services` using GIN
- Residential filtering: `isResidential`

### Materialized Views
Creates materialized views for fast analytics:
- `facility_city_stats`: Aggregated city-level statistics
- Facility counts per city/state
- Service diversity metrics
- Geographic centers

### Batch Processing
- **Batch Size**: 500 records per transaction
- **Parallel Workers**: 10 concurrent API requests
- **Rate Limiting**: Prevents API throttling
- **Memory Management**: Processes large files in chunks

## Monitoring and Metrics

### ETL Metrics
Each run provides comprehensive metrics:
```typescript
interface ETLMetrics {
  startTime: number;
  endTime?: number;
  recordsProcessed: number;
  recordsFailed: number;
  batchesCompleted: number;
  errors: Error[];
}
```

### Database Statistics
Post-seeding statistics include:
- Total facilities loaded
- Cities covered
- States covered
- Data quality distribution

## File Structure

```
frontend/
├── src/
│   ├── lib/
│   │   └── etl-pipeline.ts        # Enhanced ETL pipeline
│   ├── scripts/
│   │   └── seed-database.ts       # Seeding CLI tool
│   └── prisma/
│       └── schema.prisma          # Updated schema
├── package.json                   # New dependencies
└── ETL_DOCUMENTATION.md          # This file
```

## Troubleshooting

### Common Issues

1. **Missing Data Files**
   - Ensure CSV/JSON files exist in the specified directory
   - Check file permissions and format

2. **Database Connection**
   - Verify DATABASE_URL environment variable
   - Ensure PostgreSQL is running

3. **Memory Issues with Large Files**
   - ETL processes files in chunks
   - Adjust BATCH_SIZE if needed

4. **API Rate Limits**
   - Pipeline includes automatic rate limiting
   - Adjust delay timing if needed

### Error Recovery
- Failed batches are logged but don't stop the process
- Individual record failures are tracked in metrics
- Transactions ensure database consistency

## Best Practices

1. **Start with Data Files**: Always prefer file-based seeding for speed and completeness
2. **Monitor Quality**: Check data quality scores after seeding
3. **Incremental Updates**: Use API seeding for new locations only
4. **Backup First**: Always backup before running `clean` command
5. **Test Small**: Test with small data subsets first

## Future Enhancements

- Real-time data sync capabilities
- Advanced deduplication algorithms
- Data validation rules engine
- Automated data quality reports
- Web-based ETL monitoring dashboard
