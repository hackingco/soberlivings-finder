# ETL Pipeline Setup Guide

## Quick Start

This guide will help you set up the ETL pipeline to sync treatment facility data from FindTreatment.gov to your Supabase database.

## Prerequisites

1. **Supabase Database** - Already configured with facilities table
2. **API Access** - Request access at: https://findtreatment.gov/api-request-form
3. **Node.js 18+** - Required for running the pipeline

## Installation Steps

### 1. Install ETL Dependencies

```bash
cd etl
npm install
```

### 2. Configure Environment Variables

Add these to your `.env.local`:

```env
# FindTreatment API (optional - works with mock data if not provided)
FINDTREATMENT_API_KEY=your_api_key_here
FINDTREATMENT_API_URL=https://api.findtreatment.gov

# Your existing Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=https://acwtjmqtwnijzbioauwn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# ETL Configuration
ETL_BATCH_SIZE=100
ETL_RATE_LIMIT=10
ETL_API_KEY=generate_secure_key_here
```

### 3. Test the Pipeline

Run a test with limited records:

```bash
npm run etl:test
```

### 4. Deploy to Production

#### Option A: Deploy as Vercel Function

```bash
# Make script executable
chmod +x etl/deploy.sh

# Deploy to Vercel
./etl/deploy.sh
```

#### Option B: Run Locally with Scheduler

```bash
# Run once
npm run etl:run

# Schedule hourly updates
npm run etl:schedule hourly
```

## Data Flow

1. **Extract**: Fetch data from FindTreatment.gov API
2. **Transform**: Normalize fields, geocode addresses
3. **Validate**: Check data quality, remove duplicates
4. **Load**: Batch insert/update to Supabase

## Available Commands

```bash
# Run ETL once
npm run etl:run

# Full synchronization
npm run etl:full-sync

# Incremental update
npm run etl:incremental

# Test with 10 records
npm run etl:test

# Schedule recurring runs
npm run etl:schedule hourly
```

## API Endpoint

Once deployed, trigger ETL via HTTP:

```bash
curl -X POST https://your-app.vercel.app/api/etl \
  -H "x-api-key: your_etl_api_key" \
  -H "Content-Type: application/json" \
  -d '{"limit": 100}'
```

## Monitoring

Check logs in:
- Local: Console output
- Vercel: Dashboard → Functions → Logs
- Supabase: Check `etl_sync_status` table for history

## Troubleshooting

### No API Key?
The pipeline includes mock data for testing without an API key.

### Rate Limiting?
Adjust `ETL_RATE_LIMIT` in environment variables.

### Memory Issues?
Reduce `ETL_BATCH_SIZE` from 100 to 50.

## Next Steps

1. ✅ Test pipeline with mock data
2. ✅ Request API access from FindTreatment.gov
3. ✅ Deploy to production
4. ✅ Set up monitoring alerts
5. ✅ Schedule automatic updates

## Support

For issues, check:
- ETL logs in `/etl/logs/`
- Vercel function logs
- Supabase database logs