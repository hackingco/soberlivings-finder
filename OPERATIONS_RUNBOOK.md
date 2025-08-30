# SoberLivings Operations Runbook

Comprehensive operational procedures for managing the SoberLivings platform in production.

## Table of Contents

1. [Daily Operations](#daily-operations)
2. [System Monitoring](#system-monitoring)
3. [Data Management](#data-management)
4. [Performance Management](#performance-management)
5. [Security Operations](#security-operations)
6. [Backup & Recovery](#backup--recovery)
7. [Incident Response](#incident-response)
8. [Maintenance Procedures](#maintenance-procedures)
9. [Scaling Operations](#scaling-operations)
10. [Compliance & Auditing](#compliance--auditing)

## Daily Operations

### Morning Checklist (9:00 AM ET)

1. **System Health Check**
   ```bash
   # Check overall system health
   curl https://api.soberlivings.com/api/health
   
   # Verify database connectivity
   curl https://api.soberlivings.com/api/health/ready
   
   # Check API response times
   curl -w "%{time_total}\n" -o /dev/null -s https://api.soberlivings.com/api/facilities/search?location=CA
   ```

2. **Review Monitoring Dashboards**
   - **Main Dashboard**: https://console.aws.amazon.com/cloudwatch/home?region=us-west-2#dashboards:name=SoberLivings-Production
   - **ETL Pipeline**: https://console.aws.amazon.com/cloudwatch/home?region=us-west-2#dashboards:name=SoberLivings-ETL
   - **Performance Metrics**: Check average response times, error rates, and throughput

3. **Check Error Logs**
   ```bash
   # Check application errors from last 24 hours
   aws logs filter-log-events \
     --log-group-name /aws/lambda/soberlivings-production \
     --start-time $(date -d "24 hours ago" +%s)000 \
     --filter-pattern "[ERROR]"
   
   # Check database slow queries
   aws logs filter-log-events \
     --log-group-name /aws/rds/instance/soberlivings-production/slowquery \
     --start-time $(date -d "24 hours ago" +%s)000
   ```

4. **Verify ETL Pipeline Status**
   ```bash
   # Check last ETL run
   curl https://api.soberlivings.com/api/v1/etl/status
   
   # Verify data freshness
   psql $DATABASE_URL -c "
     SELECT 
       'facilities' as table_name,
       COUNT(*) as total_count,
       COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '24 hours') as updated_today
     FROM facilities;
   "
   ```

### Evening Checklist (6:00 PM ET)

1. **Performance Review**
   - Check day's peak usage times
   - Review any performance anomalies
   - Verify auto-scaling events

2. **Backup Verification**
   ```bash
   # Verify latest backup
   aws s3 ls s3://soberlivings-production-backups/ --recursive | tail -10
   
   # Check backup integrity
   aws rds describe-db-snapshots \
     --db-instance-identifier soberlivings-production \
     --snapshot-type automated \
     --max-items 3
   ```

3. **Security Review**
   - Review failed authentication attempts
   - Check rate limiting triggers
   - Verify SSL certificate validity

### Weekly Operations (Mondays)

1. **Comprehensive System Review**
   - Generate weekly performance report
   - Review capacity planning metrics
   - Update documentation as needed

2. **Data Quality Check**
   ```bash
   # Run data validation tests
   npm run test:data-validation
   
   # Check for duplicate facilities
   psql $DATABASE_URL -c "
     SELECT name, city, state, COUNT(*) 
     FROM facilities 
     GROUP BY name, city, state 
     HAVING COUNT(*) > 1
     ORDER BY COUNT(*) DESC;
   "
   ```

3. **Security Audit**
   - Review access logs
   - Update security policies if needed
   - Check for unused API keys

## System Monitoring

### Key Performance Indicators (KPIs)

| Metric | Target | Alert Threshold | Critical Threshold |
|--------|--------|----------------|-------------------|
| API Response Time (P95) | < 250ms | > 500ms | > 1000ms |
| Error Rate | < 0.5% | > 2% | > 5% |
| Availability | 99.9% | < 99.5% | < 99% |
| Database CPU | < 70% | > 80% | > 90% |
| Memory Usage | < 80% | > 85% | > 95% |

### Monitoring Commands

```bash
# Real-time system metrics
watch -n 5 '
echo "=== System Status ==="
curl -s https://api.soberlivings.com/api/health | jq .
echo ""
echo "=== Recent Errors ==="
aws logs tail /aws/ecs/soberlivings-production --since 5m | grep ERROR | tail -3
'

# Database performance
psql $DATABASE_URL -c "
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats 
WHERE schemaname = 'public' 
  AND tablename = 'facilities'
ORDER BY n_distinct DESC;
"

# Redis cache performance (if using Redis)
redis-cli info stats | grep -E "(keyspace|memory)"
```

### Alert Configuration

1. **CloudWatch Alarms**
   ```bash
   # Create high error rate alarm
   aws cloudwatch put-metric-alarm \
     --alarm-name "SoberLivings-HighErrorRate" \
     --alarm-description "API error rate > 2%" \
     --metric-name ErrorRate \
     --namespace "SoberLivings/API" \
     --statistic Average \
     --period 300 \
     --threshold 2.0 \
     --comparison-operator GreaterThanThreshold \
     --evaluation-periods 2
   ```

2. **Custom Monitoring Script**
   ```bash
   #!/bin/bash
   # monitor.sh - Run every 5 minutes via cron
   
   RESPONSE_TIME=$(curl -w "%{time_total}" -o /dev/null -s https://api.soberlivings.com/api/health)
   
   if (( $(echo "$RESPONSE_TIME > 1.0" | bc -l) )); then
     echo "High response time: ${RESPONSE_TIME}s" | \
       curl -X POST https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK \
       -d "{\"text\": \"SoberLivings API slow response: ${RESPONSE_TIME}s\"}"
   fi
   ```

## Data Management

### ETL Pipeline Operations

1. **Manual ETL Trigger**
   ```bash
   # Trigger full data refresh
   curl -X POST https://api.soberlivings.com/api/v1/etl \
     -H "X-API-Key: $ADMIN_API_KEY" \
     -d '{
       "operation": "full-import",
       "sources": ["findtreatment.gov"],
       "config": {
         "validateData": true,
         "enableEnrichment": true
       }
     }'
   
   # Check progress
   curl https://api.soberlivings.com/api/v1/etl/status
   ```

2. **Data Validation**
   ```sql
   -- Check for data anomalies
   SELECT 
     COUNT(*) as total_facilities,
     COUNT(*) FILTER (WHERE latitude IS NULL OR longitude IS NULL) as missing_coords,
     COUNT(*) FILTER (WHERE phone IS NULL AND website IS NULL) as no_contact,
     COUNT(*) FILTER (WHERE verified = true) as verified_count,
     AVG(CASE WHEN latitude BETWEEN 24 AND 49 AND longitude BETWEEN -125 AND -66 THEN 1 ELSE 0 END) as us_coords_ratio
   FROM facilities;
   
   -- Check for recent data quality issues
   SELECT 
     date_trunc('day', updated_at) as update_day,
     COUNT(*) as updates,
     COUNT(*) FILTER (WHERE verified = false) as unverified
   FROM facilities 
   WHERE updated_at > NOW() - INTERVAL '7 days'
   GROUP BY date_trunc('day', updated_at)
   ORDER BY update_day DESC;
   ```

3. **Data Cleanup**
   ```bash
   # Remove duplicate entries
   psql $DATABASE_URL -c "
   WITH duplicates AS (
     SELECT id, ROW_NUMBER() OVER (
       PARTITION BY name, city, state 
       ORDER BY verified DESC, updated_at DESC
     ) as rn
     FROM facilities
   )
   DELETE FROM facilities 
   WHERE id IN (
     SELECT id FROM duplicates WHERE rn > 1
   );
   "
   
   # Archive old data
   psql $DATABASE_URL -c "
   INSERT INTO facilities_archive 
   SELECT * FROM facilities 
   WHERE updated_at < NOW() - INTERVAL '2 years'
     AND verified = false;
   
   DELETE FROM facilities 
   WHERE updated_at < NOW() - INTERVAL '2 years'
     AND verified = false;
   "
   ```

### Database Maintenance

1. **Index Management**
   ```sql
   -- Check index usage
   SELECT schemaname, tablename, attname, n_distinct, correlation
   FROM pg_stats 
   WHERE schemaname = 'public' 
   ORDER BY n_distinct DESC;
   
   -- Rebuild indexes if needed
   REINDEX INDEX CONCURRENTLY idx_facilities_location;
   REINDEX INDEX CONCURRENTLY idx_facilities_services;
   
   -- Analyze table statistics
   ANALYZE facilities;
   ```

2. **Query Optimization**
   ```sql
   -- Find slow queries
   SELECT query, mean_time, calls, total_time
   FROM pg_stat_statements
   ORDER BY total_time DESC
   LIMIT 10;
   
   -- Check for missing indexes
   SELECT schemaname, tablename, attname, n_distinct, correlation
   FROM pg_stats 
   WHERE schemaname = 'public' 
     AND n_distinct > 100
     AND correlation < 0.1;
   ```

## Performance Management

### Response Time Optimization

1. **Database Query Optimization**
   ```sql
   -- Enable query logging for slow queries
   SET log_min_duration_statement = 500; -- Log queries > 500ms
   
   -- Check query plans for main search
   EXPLAIN (ANALYZE, BUFFERS) 
   SELECT * FROM facilities 
   WHERE city ILIKE '%Los Angeles%' 
     AND 'residential' = ANY(services)
   ORDER BY verified DESC, name ASC
   LIMIT 50;
   ```

2. **Cache Management**
   ```bash
   # Redis cache statistics (if using Redis)
   redis-cli info memory
   redis-cli info stats
   
   # Clear cache if needed
   redis-cli FLUSHDB
   
   # Pre-warm common searches
   curl "https://api.soberlivings.com/api/facilities/search?location=Los%20Angeles,%20CA"
   curl "https://api.soberlivings.com/api/facilities/search?location=New%20York,%20NY"
   curl "https://api.soberlivings.com/api/facilities/search?services=residential"
   ```

3. **Application Performance Monitoring**
   ```bash
   # Check Node.js memory usage
   curl https://api.soberlivings.com/api/health | jq '.checks.memory'
   
   # Monitor event loop lag
   curl https://api.soberlivings.com/api/metrics | grep nodejs_eventloop_lag
   ```

### Load Testing

1. **API Load Test**
   ```bash
   # Install k6 for load testing
   brew install k6  # or apt-get install k6
   
   # Create load test script
   cat > load-test.js << 'EOF'
   import http from 'k6/http';
   import { check } from 'k6';
   
   export let options = {
     stages: [
       { duration: '2m', target: 10 },
       { duration: '5m', target: 50 },
       { duration: '2m', target: 0 },
     ],
   };
   
   export default function() {
     let response = http.get('https://api.soberlivings.com/api/facilities/search?location=CA');
     check(response, {
       'status is 200': (r) => r.status === 200,
       'response time < 1000ms': (r) => r.timings.duration < 1000,
     });
   }
   EOF
   
   # Run load test
   k6 run load-test.js
   ```

2. **Database Load Test**
   ```bash
   # Use pgbench for database load testing
   pgbench -h your-db-host -U postgres -d soberlivings -c 10 -j 2 -T 60
   ```

## Security Operations

### Access Management

1. **API Key Rotation**
   ```bash
   # Generate new API key
   curl -X POST https://api.soberlivings.com/api/v1/admin/keys/rotate \
     -H "Authorization: Bearer $ADMIN_JWT" \
     -d '{"keyId": "key-to-rotate"}'
   
   # List active API keys
   curl https://api.soberlivings.com/api/v1/admin/keys \
     -H "Authorization: Bearer $ADMIN_JWT"
   ```

2. **Authentication Monitoring**
   ```bash
   # Check failed authentication attempts
   aws logs filter-log-events \
     --log-group-name /aws/ecs/soberlivings-production \
     --filter-pattern "[timestamp, requestId, level=ERROR, msg=\"Authentication failed\"]" \
     --start-time $(date -d "1 hour ago" +%s)000
   
   # Monitor rate limiting
   curl https://api.soberlivings.com/api/metrics | grep rate_limit
   ```

### SSL Certificate Management

```bash
# Check SSL certificate expiration
echo | openssl s_client -connect api.soberlivings.com:443 2>/dev/null | \
  openssl x509 -noout -dates

# Verify SSL chain
ssl-cert-check -s api.soberlivings.com -p 443
```

## Backup & Recovery

### Automated Backups

1. **Database Backups**
   ```bash
   # Create manual backup
   aws rds create-db-snapshot \
     --db-instance-identifier soberlivings-production \
     --db-snapshot-identifier manual-backup-$(date +%Y%m%d-%H%M)
   
   # List recent backups
   aws rds describe-db-snapshots \
     --db-instance-identifier soberlivings-production \
     --snapshot-type automated \
     --max-items 5
   ```

2. **Application Data Backup**
   ```bash
   # Backup configuration files
   aws s3 cp /etc/soberlivings/ s3://soberlivings-production-backups/config/ --recursive
   
   # Backup logs (important ones only)
   aws s3 cp /var/log/soberlivings/ s3://soberlivings-production-backups/logs/$(date +%Y%m%d)/ --recursive
   ```

### Recovery Procedures

1. **Database Recovery**
   ```bash
   # Restore from specific backup
   aws rds restore-db-instance-from-db-snapshot \
     --db-instance-identifier soberlivings-production-restored \
     --db-snapshot-identifier manual-backup-20240129-1430
   
   # Point-in-time recovery
   aws rds restore-db-instance-to-point-in-time \
     --source-db-instance-identifier soberlivings-production \
     --target-db-instance-identifier soberlivings-production-pit \
     --restore-time 2024-01-29T14:30:00Z
   ```

2. **Application Recovery**
   ```bash
   # Restore from backup
   aws s3 sync s3://soberlivings-production-backups/config/ /etc/soberlivings/
   
   # Restart services
   systemctl restart soberlivings-api
   systemctl restart nginx
   ```

## Incident Response

### Incident Classification

| Severity | Description | Response Time | Examples |
|----------|-------------|---------------|----------|
| P0 - Critical | Complete service outage | < 15 minutes | API completely down, database unreachable |
| P1 - High | Significant functionality impaired | < 1 hour | Search not working, high error rates |
| P2 - Medium | Some functionality affected | < 4 hours | Slow responses, single feature down |
| P3 - Low | Minor issues or improvements | < 24 hours | UI glitches, non-critical errors |

### Incident Response Steps

1. **Detection & Triage**
   ```bash
   # Quick system check
   curl -f https://api.soberlivings.com/api/health || echo "ALERT: API down"
   
   # Check error rates
   aws cloudwatch get-metric-statistics \
     --namespace "SoberLivings/API" \
     --metric-name ErrorRate \
     --start-time $(date -d "15 minutes ago" +%Y-%m-%dT%H:%M:%S) \
     --end-time $(date +%Y-%m-%dT%H:%M:%S) \
     --period 300 \
     --statistics Average
   ```

2. **Communication**
   ```bash
   # Send Slack notification
   curl -X POST https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK \
     -H 'Content-Type: application/json' \
     -d '{
       "text": "🚨 P0 Incident: API experiencing high error rates",
       "attachments": [
         {
           "color": "danger",
           "fields": [
             {"title": "Severity", "value": "P0", "short": true},
             {"title": "Component", "value": "API", "short": true}
           ]
         }
       ]
     }'
   ```

3. **Investigation**
   ```bash
   # Check recent deployments
   kubectl get deployments -n production
   kubectl rollout history deployment/soberlivings-api -n production
   
   # Check logs for errors
   kubectl logs -f deployment/soberlivings-api -n production --tail=100
   
   # Check database health
   psql $DATABASE_URL -c "SELECT pg_is_in_recovery(), pg_last_wal_receive_lsn();"
   ```

4. **Resolution**
   ```bash
   # Rollback if needed
   kubectl rollout undo deployment/soberlivings-api -n production
   
   # Scale up if capacity issue
   kubectl scale deployment/soberlivings-api --replicas=5 -n production
   
   # Clear cache if data corruption
   redis-cli FLUSHALL
   ```

## Maintenance Procedures

### Scheduled Maintenance Windows

**Monthly Maintenance**: First Sunday of each month, 2:00-4:00 AM ET

1. **Pre-Maintenance Checklist**
   - [ ] Create database backup
   - [ ] Notify users of maintenance window
   - [ ] Prepare rollback plan
   - [ ] Test changes in staging

2. **Maintenance Tasks**
   ```bash
   # Update dependencies
   npm audit fix
   
   # Database maintenance
   psql $DATABASE_URL -c "VACUUM ANALYZE;"
   psql $DATABASE_URL -c "REINDEX DATABASE soberlivings;"
   
   # Log rotation
   logrotate /etc/logrotate.d/soberlivings
   
   # Clear old cache entries
   redis-cli --scan --pattern "cache:*" | \
     xargs -I {} redis-cli --raw TTL {} | \
     awk '$1 < 0 {print NR}' | \
     head -1000 | \
     xargs -I {} redis-cli DEL cache:{}
   ```

3. **Post-Maintenance Verification**
   ```bash
   # Run health checks
   npm run test:integration
   
   # Verify key functionality
   curl "https://api.soberlivings.com/api/facilities/search?location=test"
   
   # Monitor error rates for 30 minutes
   watch -n 60 'curl https://api.soberlivings.com/api/metrics | grep error_rate'
   ```

## Scaling Operations

### Auto-Scaling Configuration

1. **Application Scaling**
   ```bash
   # Configure horizontal pod autoscaler
   kubectl autoscale deployment soberlivings-api \
     --cpu-percent=70 \
     --min=2 \
     --max=10 \
     -n production
   
   # Check scaling status
   kubectl get hpa -n production
   ```

2. **Database Scaling**
   ```bash
   # Scale database instance up
   aws rds modify-db-instance \
     --db-instance-identifier soberlivings-production \
     --db-instance-class db.r5.xlarge \
     --apply-immediately
   
   # Add read replica
   aws rds create-db-instance-read-replica \
     --db-instance-identifier soberlivings-production-read \
     --source-db-instance-identifier soberlivings-production
   ```

### Capacity Planning

1. **Monitor Key Metrics**
   ```bash
   # Check current resource usage
   kubectl top nodes
   kubectl top pods -n production
   
   # Database metrics
   aws cloudwatch get-metric-statistics \
     --namespace "AWS/RDS" \
     --metric-name CPUUtilization \
     --dimensions Name=DBInstanceIdentifier,Value=soberlivings-production \
     --start-time $(date -d "1 day ago" +%Y-%m-%dT%H:%M:%S) \
     --end-time $(date +%Y-%m-%dT%H:%M:%S) \
     --period 3600 \
     --statistics Average,Maximum
   ```

2. **Forecast Resource Needs**
   ```sql
   -- Analyze growth trends
   SELECT 
     date_trunc('week', created_at) as week,
     COUNT(*) as new_facilities,
     SUM(COUNT(*)) OVER (ORDER BY date_trunc('week', created_at)) as cumulative
   FROM facilities
   WHERE created_at > NOW() - INTERVAL '12 weeks'
   GROUP BY date_trunc('week', created_at)
   ORDER BY week;
   ```

## Compliance & Auditing

### Access Logs

```bash
# Generate access report
aws logs filter-log-events \
  --log-group-name /aws/ecs/soberlivings-production \
  --filter-pattern '[timestamp, requestId, method, path, status>=200 status<300]' \
  --start-time $(date -d "1 week ago" +%s)000 \
  --end-time $(date +%s)000 > access_report_$(date +%Y%m%d).json

# API usage by key
curl https://api.soberlivings.com/api/v1/admin/analytics/usage \
  -H "Authorization: Bearer $ADMIN_JWT" \
  --data '{"timeframe": "7d", "groupBy": "apiKey"}'
```

### Data Privacy Compliance

```bash
# Check for PII in logs
aws logs filter-log-events \
  --log-group-name /aws/ecs/soberlivings-production \
  --filter-pattern '[email~"*@*", phone~"*-*-*"]' \
  --start-time $(date -d "1 day ago" +%s)000

# Generate data inventory report
psql $DATABASE_URL -c "
SELECT 
  table_name,
  column_name,
  data_type,
  CASE 
    WHEN column_name ILIKE '%email%' OR 
         column_name ILIKE '%phone%' OR
         column_name ILIKE '%address%' 
    THEN 'PII'
    ELSE 'Non-PII'
  END as data_classification
FROM information_schema.columns 
WHERE table_schema = 'public'
ORDER BY table_name, column_name;
"
```

### Audit Trail

```sql
-- Check administrative actions
SELECT 
  action,
  user_id,
  resource_type,
  resource_id,
  created_at,
  metadata
FROM audit_log
WHERE created_at > NOW() - INTERVAL '30 days'
  AND action IN ('CREATE', 'UPDATE', 'DELETE')
ORDER BY created_at DESC
LIMIT 100;
```

## Emergency Contacts

| Role | Name | Phone | Email | Escalation |
|------|------|-------|-------|------------|
| Primary On-Call | DevOps Lead | +1-555-0100 | devops@soberlivings.com | 0-15 min |
| Secondary On-Call | Sr. Developer | +1-555-0101 | dev@soberlivings.com | 15-30 min |
| Database Admin | DBA | +1-555-0102 | dba@soberlivings.com | For DB issues |
| Security Team | Security Lead | +1-555-0103 | security@soberlivings.com | For security incidents |
| Engineering Manager | Eng Manager | +1-555-0104 | engineering@soberlivings.com | 30+ min escalation |

## Documentation

- **Architecture**: `/docs/architecture.md`
- **API Documentation**: `/API_DOCUMENTATION.md`
- **Deployment Guide**: `/DEPLOYMENT_GUIDE.md`
- **Troubleshooting**: `/TROUBLESHOOTING_GUIDE.md`

---

**Document Version**: 1.0.0  
**Last Updated**: January 29, 2024  
**Next Review**: February 29, 2024  
**Owner**: DevOps Team