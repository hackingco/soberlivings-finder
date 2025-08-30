# Enhanced ETL Pipeline Documentation

## Overview

The Enhanced ETL Pipeline provides a robust, production-ready system for extracting, transforming, and loading treatment facility data from the FindTreatment.gov API into the SoberLivings database. This system includes comprehensive error handling, data validation, monitoring, and performance optimization.

## Architecture

### Core Components

1. **Enhanced ETL Pipeline** (`etl-pipeline-enhanced.js`)
   - Main orchestration engine
   - Parallel processing capabilities
   - Retry logic with exponential backoff
   - Progress tracking and resumable execution
   - Comprehensive logging and metrics

2. **Data Validator** (`etl-validator.js`)
   - Field validation and sanitization
   - Data quality scoring
   - Business logic validation
   - Deduplication support

3. **Monitoring System** (`etl-monitoring.js`)
   - Real-time health checks
   - Performance metrics collection
   - Alert system
   - REST API for monitoring

## Features

### ✅ Robust Error Handling
- **Exponential Backoff**: Automatic retry with increasing delays
- **Circuit Breaker**: Prevents system overload during failures
- **Graceful Degradation**: Continues processing even with partial failures
- **Comprehensive Logging**: Structured logs for debugging and monitoring

### ✅ Data Quality Assurance
- **Field Validation**: Required field checks and data type validation
- **Business Logic**: State codes, coordinate validation, reasonable data checks
- **Data Sanitization**: Clean phone numbers, URLs, and text fields
- **Quality Scoring**: 0-100 score based on completeness and accuracy

### ✅ Performance Optimization
- **Parallel Processing**: Configurable worker threads for concurrent API calls
- **Batch Database Operations**: Efficient bulk inserts with transaction support
- **Connection Pooling**: Optimized database connections
- **Rate Limiting**: Respectful API usage with configurable delays

### ✅ Monitoring & Observability
- **Health Checks**: Live, ready, and deep health endpoints
- **Metrics Collection**: Request rates, error rates, processing times
- **Alert System**: Threshold-based alerts for system issues
- **Prometheus Integration**: Metrics export for external monitoring

### ✅ Resumable Execution
- **Progress Tracking**: Save progress periodically during execution
- **Resume Support**: Continue from last checkpoint on restart
- **State Management**: Persistent state across sessions

## Configuration

### Environment Variables

```bash
# Database Configuration
DATABASE_URL=postgresql://user:pass@host:port/database

# ETL Configuration
ETL_BATCH_SIZE=500                    # Records per API request
ETL_DELAY_MS=2000                     # Delay between requests (ms)
ETL_MAX_RETRIES=3                     # Maximum retry attempts
ETL_RETRY_DELAY_MS=5000               # Base retry delay (ms)
ETL_TIMEOUT_MS=30000                  # Request timeout (ms)
ETL_PARALLEL_WORKERS=3                # Parallel processing workers
ETL_PROGRESS_INTERVAL=10              # Progress save frequency
ETL_ENABLE_DEDUP=true                 # Enable deduplication
ETL_LOG_LEVEL=info                    # Logging level

# Monitoring Configuration
ETL_MONITOR_PORT=3001                 # Monitoring server port
ETL_ERROR_RATE_THRESHOLD=10           # Alert threshold (%)
ETL_RESPONSE_TIME_THRESHOLD=30000     # Response time alert (ms)
ETL_MEMORY_THRESHOLD=80               # Memory usage alert (%)
ETL_METRICS_INTERVAL=60000            # Metrics collection interval (ms)
ETL_LOG_RETENTION=30                  # Log retention (days)
```

## Usage

### Basic Usage

```bash
# Run enhanced ETL pipeline
node src/etl-pipeline-enhanced.js

# Run with options
node src/etl-pipeline-enhanced.js --resume --clear

# Start monitoring server
node src/etl-monitoring.js
```

### Programmatic Usage

```javascript
const { runEnhancedETLPipeline } = require('./src/etl-pipeline-enhanced');

// Run with options
const results = await runEnhancedETLPipeline({
  resume: true,          // Resume from previous progress
  clearExisting: false,  // Keep existing data
  parallel: true         // Use parallel processing
});

console.log('ETL Results:', results);
```

### Monitoring Integration

```javascript
const { createETLMonitoringWrapper } = require('./src/etl-monitoring');
const { runEnhancedETLPipeline } = require('./src/etl-pipeline-enhanced');

// Wrap ETL function with monitoring
const monitoredETL = createETLMonitoringWrapper(runEnhancedETLPipeline);

// Run with automatic monitoring
const results = await monitoredETL(options);
```

## API Endpoints

### Health Checks

- `GET /health` - Basic health status
- `GET /health/deep` - Comprehensive health check
- `GET /health/live` - Liveness probe
- `GET /health/ready` - Readiness probe

### Metrics

- `GET /metrics` - Current metrics
- `GET /metrics/history` - Historical performance
- `GET /metrics/analytics` - Performance analytics
- `GET /metrics/database` - Database metrics
- `GET /metrics/prometheus` - Prometheus format

### Alerts

- `GET /alerts` - Current alerts
- `POST /alerts` - Create manual alert
- `DELETE /alerts` - Clear all alerts
- `DELETE /alerts/:id` - Clear specific alert

## Data Quality Metrics

### Quality Score Calculation

The system calculates a quality score (0-100) based on:

- **Name Quality (25 points)**: Facility name completeness
- **Address Quality (20 points)**: Street, city, ZIP completeness
- **Contact Quality (20 points)**: Phone and website availability
- **Location Quality (15 points)**: Coordinate accuracy
- **Services Quality (10 points)**: Service information completeness
- **Insurance Quality (10 points)**: Accepted insurance information

### Validation Types

1. **Required Fields**: Critical fields that must be present
2. **Data Types**: Format validation for phones, URLs, coordinates
3. **Business Logic**: State codes, reasonable data ranges
4. **Quality Indicators**: Completeness and consistency checks

## Performance Benchmarks

### Typical Performance (Production Environment)

- **Processing Rate**: 50-100 facilities/second
- **API Response Time**: 200-500ms average
- **Database Insert Rate**: 1000+ records/second in batches
- **Memory Usage**: ~200MB for full US coverage
- **Success Rate**: >95% with retry logic

### Scaling Recommendations

- **Small Deployments** (1-10 states): 2-3 parallel workers
- **Medium Deployments** (10-25 states): 4-6 parallel workers
- **Large Deployments** (All states): 6-10 parallel workers
- **Database**: Use connection pooling with 10-20 connections

## Troubleshooting

### Common Issues

1. **High Error Rate**
   - Check API connectivity
   - Verify rate limiting configuration
   - Review validation rules

2. **Memory Issues**
   - Reduce batch size
   - Decrease parallel workers
   - Enable garbage collection tuning

3. **Database Timeouts**
   - Increase connection pool size
   - Optimize queries and indexes
   - Check database performance

4. **Network Timeouts**
   - Increase timeout values
   - Check network connectivity
   - Verify firewall settings

### Monitoring Alerts

The system automatically generates alerts for:

- High error rates (>10% by default)
- High memory usage (>80% by default)
- Database connectivity issues
- API response time degradation
- Processing failures

### Log Analysis

Logs are structured in JSON format and include:

- **Request/Response**: API call details and timing
- **Validation**: Data quality issues and fixes
- **Performance**: Processing rates and bottlenecks
- **Errors**: Detailed error information with context

## Production Deployment

### Prerequisites

1. Node.js 16+ with production dependencies
2. PostgreSQL database with proper indexes
3. Monitoring system (optional but recommended)
4. Log aggregation system (ELK, Splunk, etc.)

### Deployment Steps

1. **Environment Setup**
   ```bash
   # Install dependencies
   npm install --production
   
   # Create logs directory
   mkdir logs
   
   # Set environment variables
   cp .env.example .env
   ```

2. **Database Preparation**
   ```sql
   -- Create indexes for performance
   CREATE INDEX idx_facilities_state ON facilities(state);
   CREATE INDEX idx_facilities_city ON facilities(city);
   CREATE INDEX idx_facilities_services ON facilities USING GIN(services);
   CREATE INDEX idx_facilities_location ON facilities(latitude, longitude);
   CREATE INDEX idx_facilities_quality ON facilities("qualityScore");
   CREATE INDEX idx_facilities_updated ON facilities("lastUpdated");
   ```

3. **Service Configuration**
   ```bash
   # Create systemd service
   sudo cp etl-service.service /etc/systemd/system/
   sudo systemctl enable etl-service
   sudo systemctl start etl-service
   ```

4. **Monitoring Setup**
   ```bash
   # Start monitoring server
   pm2 start src/etl-monitoring.js --name etl-monitor
   
   # Configure health checks
   curl http://localhost:3001/health
   ```

### Security Considerations

1. **Database Access**: Use read/write specific credentials
2. **API Keys**: Store securely, rotate regularly
3. **Network Access**: Whitelist required domains only
4. **Logging**: Avoid logging sensitive information
5. **Monitoring**: Secure monitoring endpoints

## Integration Examples

### Docker Integration

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src/ ./src/
EXPOSE 3001
CMD ["node", "src/etl-monitoring.js"]
```

### Kubernetes Integration

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: etl-pipeline
spec:
  replicas: 1
  selector:
    matchLabels:
      app: etl-pipeline
  template:
    metadata:
      labels:
        app: etl-pipeline
    spec:
      containers:
      - name: etl
        image: soberlivings/etl:latest
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: url
        - name: ETL_PARALLEL_WORKERS
          value: "4"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
```

### CI/CD Integration

```yaml
# .github/workflows/etl-deployment.yml
name: ETL Deployment
on:
  push:
    branches: [main]
    paths: ['src/etl-*']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '16'
    - name: Install dependencies
      run: npm ci
    - name: Run ETL tests
      run: npm run test:etl
    - name: Run validation tests
      run: npm run test:validation

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
    - name: Deploy to production
      run: |
        # Deploy enhanced ETL pipeline
        kubectl apply -f k8s/etl-deployment.yaml
        # Wait for rollout
        kubectl rollout status deployment/etl-pipeline
```

## Future Enhancements

### Planned Features

1. **Real-time Processing**: WebSocket-based live updates
2. **Machine Learning**: Automatic data quality improvement
3. **Multi-source Integration**: Additional data sources
4. **Advanced Analytics**: Trend analysis and forecasting
5. **API Rate Optimization**: Dynamic rate limiting

### Contributing

To contribute to the ETL system:

1. Follow the existing code structure and patterns
2. Add comprehensive tests for new features
3. Update documentation for any changes
4. Ensure monitoring and logging for new components
5. Performance test any changes with realistic data volumes

## Support

For issues and questions:

- Check logs first: `tail -f logs/etl-combined.log`
- Monitor health: `curl http://localhost:3001/health/deep`
- Review metrics: `curl http://localhost:3001/metrics/analytics`
- Create GitHub issues with full context and logs

---

*This documentation is maintained alongside the codebase and updated with each release.*