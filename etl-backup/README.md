# ETL Pipeline Architecture for FindTreatment.gov Data

## Overview
This ETL (Extract, Transform, Load) pipeline ingests substance abuse treatment facility data from FindTreatment.gov/SAMHSA APIs and loads it into our Supabase database.

## Architecture Components

### 1. Data Sources
- **Primary**: FindTreatment.gov API (requires API key)
- **Secondary**: SAMHSA Treatment Locator API
- **Supplementary**: Public datasets from data.gov

### 2. Pipeline Stages

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   EXTRACT    │────▶│  TRANSFORM   │────▶│   VALIDATE   │────▶│     LOAD     │
│              │     │              │     │              │     │              │
│ • API Calls  │     │ • Normalize  │     │ • Schema     │     │ • Supabase   │
│ • Rate Limit │     │ • Cleanse    │     │ • Quality    │     │ • Batch/Real │
│ • Pagination │     │ • Enrich     │     │ • Duplicate  │     │ • Upsert     │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                                ▼
                        ┌──────────────┐
                        │   MONITOR    │
                        │              │
                        │ • Logging    │
                        │ • Metrics    │
                        │ • Alerts     │
                        └──────────────┘
```

### 3. Data Flow

1. **Extraction Layer**
   - Connects to FindTreatment.gov API
   - Handles authentication and rate limiting
   - Implements pagination for large datasets
   - Manages API failures with retry logic

2. **Transformation Layer**
   - Normalizes data to match our schema
   - Geocodes addresses when missing coordinates
   - Enriches with additional metadata
   - Handles data type conversions

3. **Validation Layer**
   - Validates required fields
   - Checks data quality scores
   - Identifies and handles duplicates
   - Ensures data integrity

4. **Loading Layer**
   - Batch inserts for initial load
   - Incremental updates for changes
   - Conflict resolution (upsert logic)
   - Transaction management

## Implementation Stack

- **Runtime**: Node.js with TypeScript
- **Queue**: Bull/BullMQ for job processing
- **Scheduler**: node-cron for periodic runs
- **Database**: Supabase (PostgreSQL)
- **Monitoring**: Custom metrics + logging
- **Deployment**: Vercel Functions / AWS Lambda

## Key Features

### Incremental Updates
- Track last sync timestamp
- Only fetch modified records
- Minimize API calls and processing

### Error Handling
- Retry failed API calls with exponential backoff
- Dead letter queue for failed records
- Detailed error logging and alerting

### Data Quality
- Calculate quality scores for each facility
- Flag incomplete or suspicious records
- Generate quality reports

### Performance Optimization
- Parallel processing where possible
- Connection pooling for database
- Efficient batch operations
- Caching for frequently accessed data

## Configuration

### Environment Variables
```env
# API Configuration
FINDTREATMENT_API_KEY=
FINDTREATMENT_API_URL=
SAMHSA_API_KEY=
SAMHSA_API_URL=

# Database
SUPABASE_URL=
SUPABASE_SERVICE_KEY=

# ETL Settings
ETL_BATCH_SIZE=100
ETL_RATE_LIMIT=10
ETL_RETRY_ATTEMPTS=3
ETL_SYNC_INTERVAL=3600

# Monitoring
SLACK_WEBHOOK_URL=
LOG_LEVEL=info
```

## Deployment

### Local Development
```bash
npm run etl:dev
```

### Production
```bash
npm run etl:build
npm run etl:deploy
```

### Manual Run
```bash
npm run etl:sync
```

## Monitoring & Maintenance

### Metrics Tracked
- Records processed per sync
- API call success/failure rates
- Processing time per batch
- Data quality scores
- Database write performance

### Alerts
- API authentication failures
- Rate limit exceeded
- Data quality degradation
- Sync failures
- Database connection issues

## Security Considerations

- API keys stored securely in environment variables
- Rate limiting to prevent API abuse
- Data encryption in transit
- Audit logging for compliance
- PII handling compliance

## Future Enhancements

1. **Machine Learning Integration**
   - Predict facility quality scores
   - Identify potential data issues
   - Recommend similar facilities

2. **Real-time Updates**
   - WebSocket connections for live data
   - Event-driven architecture
   - Push notifications for changes

3. **Advanced Analytics**
   - Trend analysis
   - Geographical clustering
   - Service gap identification

## Support

For issues or questions about the ETL pipeline:
- Check logs in `/etl/logs/`
- Review monitoring dashboard
- Contact the development team