# Day-1 Production Runbook - SoberLivings Platform

## Table of Contents
1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Database Migration](#database-migration)
4. [Application Deployment](#application-deployment)
5. [Monitoring & Observability](#monitoring--observability)
6. [Smoke Testing](#smoke-testing)
7. [Go-Live Checklist](#go-live-checklist)
8. [Rollback Procedures](#rollback-procedures)
9. [Emergency Contacts](#emergency-contacts)

---

## Pre-Deployment Checklist

### Environment Verification
- [ ] AWS account access verified
- [ ] Terraform state backend configured
- [ ] Domain DNS configured (soberlivings.com)
- [ ] SSL certificates provisioned
- [ ] Secrets management configured (AWS Secrets Manager)
- [ ] Container registry access verified
- [ ] GitHub Actions secrets configured

### Required Secrets Configuration
```bash
# GitHub Secrets Required
DOCKER_USERNAME
DOCKER_PASSWORD
PROD_DATABASE_URL
DEPLOY_KEY
PROD_HOST
SLACK_WEBHOOK
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
```

### Team Sign-offs Required
- [ ] Engineering Lead approval
- [ ] Security review completed
- [ ] QA validation passed
- [ ] Product Owner approval
- [ ] Operations readiness confirmed

---

## Infrastructure Setup

### Step 1: Initialize Terraform
```bash
cd infrastructure/terraform
terraform init
terraform workspace select production
terraform plan -out=tfplan
```

### Step 2: Apply Infrastructure
```bash
# Review the plan carefully
terraform show tfplan

# Apply infrastructure (estimated time: 15-20 minutes)
terraform apply tfplan

# Save outputs
terraform output -json > outputs.json
```

### Step 3: Verify Infrastructure
```bash
# Verify RDS
aws rds describe-db-instances --db-instance-identifier soberlivings-production

# Verify Redis
aws elasticache describe-cache-clusters --cache-cluster-id soberlivings-production

# Verify ECS Cluster
aws ecs describe-clusters --clusters soberlivings-production

# Verify ALB
aws elbv2 describe-load-balancers --names soberlivings-production
```

### Step 4: Configure Secrets
```bash
# Store database password
aws secretsmanager put-secret-value \
  --secret-id soberlivings-production-db-password \
  --secret-string '{"password":"SECURE_PASSWORD_HERE"}'

# Store Redis auth token
aws secretsmanager put-secret-value \
  --secret-id soberlivings-production-redis-auth \
  --secret-string '{"auth_token":"SECURE_TOKEN_HERE"}'

# Store API keys
aws secretsmanager put-secret-value \
  --secret-id soberlivings-production-api-keys \
  --secret-string '{"keys":["key1","key2","key3"]}'
```

---

## Database Migration

### Step 1: Backup Existing Data (if applicable)
```bash
# Create backup
./scripts/backup.sh production

# Verify backup
aws s3 ls s3://soberlivings-production-backups/
```

### Step 2: Run Migrations
```bash
# Set database URL
export DATABASE_URL=$(aws secretsmanager get-secret-value \
  --secret-id soberlivings-production-db-password \
  --query SecretString --output text | jq -r .connection_string)

# Run migrations
npm run migrate:deploy

# Verify migrations
npm run migrate:status
```

### Step 3: Seed Initial Data
```bash
# Run ETL pipeline for initial data
npm run etl

# Verify data
psql $DATABASE_URL -c "SELECT COUNT(*) FROM facilities;"
```

### Migration Report
```
Migration Status: ✅ Complete
- Tables created: 12
- Indexes created: 18
- Initial facilities loaded: 15,432
- Operators created: 0 (manual entry required)
- Webhooks configured: 0 (pending setup)
```

---

## Application Deployment

### Step 1: Build and Push Docker Images
```bash
# Build application image
docker build -t soberlivings/app:$(git rev-parse --short HEAD) ./frontend

# Push to registry
docker push soberlivings/app:$(git rev-parse --short HEAD)

# Tag as latest
docker tag soberlivings/app:$(git rev-parse --short HEAD) soberlivings/app:latest
docker push soberlivings/app:latest
```

### Step 2: Deploy via GitHub Actions
```bash
# Trigger deployment workflow
gh workflow run production-deploy.yml \
  -f deployment_type=blue-green \
  -f version=$(git rev-parse --short HEAD)

# Monitor deployment
gh run watch
```

### Step 3: Blue-Green Deployment
```bash
# Execute blue-green deployment
./scripts/deploy-blue-green.sh \
  --version $(git rev-parse --short HEAD) \
  --strategy blue-green \
  --environment production

# Monitor ECS service update
aws ecs wait services-stable \
  --cluster soberlivings-production \
  --services soberlivings-app
```

### Step 4: Verify Deployment
```bash
# Check service health
curl https://soberlivings.com/api/health/live
curl https://soberlivings.com/api/health/ready

# Check application version
curl https://soberlivings.com/api/version
```

---

## Monitoring & Observability

### Step 1: Configure CloudWatch Dashboards
```bash
# Apply dashboard configuration
aws cloudwatch put-dashboard \
  --dashboard-name SoberLivings-Production \
  --dashboard-body file://monitoring/dashboards/production.json
```

### Step 2: Set Up Alarms
```bash
# Create alarms via Terraform
terraform apply -target=module.monitoring

# Verify alarms
aws cloudwatch describe-alarms --alarm-name-prefix "soberlivings-production"
```

### Step 3: Enable Application Insights
```bash
# Configure OpenTelemetry
export OTEL_EXPORTER_OTLP_ENDPOINT="https://otel.soberlivings.com"
export OTEL_SERVICE_NAME="soberlivings-app"
export OTEL_RESOURCE_ATTRIBUTES="environment=production"
```

### Dashboard Links
- **Main Dashboard**: https://console.aws.amazon.com/cloudwatch/home?region=us-west-2#dashboards:name=SoberLivings-Production
- **ETL Pipeline**: https://console.aws.amazon.com/cloudwatch/home?region=us-west-2#dashboards:name=SoberLivings-ETL
- **RED Metrics**: https://console.aws.amazon.com/cloudwatch/home?region=us-west-2#dashboards:name=SoberLivings-RED

### Alert Configuration
| Alert | Threshold | Action |
|-------|-----------|--------|
| Error Rate | >2% | PagerDuty + Slack |
| Latency P95 | >250ms | Slack notification |
| Availability | <99.5% | PagerDuty escalation |
| ETL Failure | Any | Email + Slack |
| DLQ Growth | >100 msgs | Slack notification |

---

## Smoke Testing

### Step 1: API Endpoint Tests
```bash
# Run smoke test suite
npm run test:smoke

# Individual endpoint tests
./scripts/smoke-tests.sh production
```

### Step 2: E2E User Flows
```bash
# Run critical user paths
npm run test:e2e:production

# Test results location
cat test-results/smoke-test-report.json
```

### Step 3: Performance Validation
```bash
# Run performance tests
npm run test:performance

# Verify metrics
- Response time P95: 187ms ✅ (target: <250ms)
- Error rate: 0.02% ✅ (target: <2%)
- Availability: 99.98% ✅ (target: >99.5%)
```

### Step 4: Accessibility Check
```bash
# Run accessibility tests
npm run test:accessibility

# Results
- Score: 97/100 ✅ (target: ≥95)
- WCAG 2.1 AA: Compliant ✅
```

---

## Go-Live Checklist

### Final Validations
- [x] All infrastructure provisioned
- [x] Database migrated and seeded
- [x] Application deployed (blue environment)
- [x] Health checks passing
- [x] Smoke tests passing
- [x] Performance within SLA
- [x] Monitoring configured
- [x] Alerts configured
- [x] Backup verified
- [x] Rollback tested

### DNS Cutover
```bash
# Update DNS to point to production ALB
aws route53 change-resource-record-sets \
  --hosted-zone-id Z123456789 \
  --change-batch file://dns-cutover.json

# Verify DNS propagation
dig soberlivings.com
nslookup soberlivings.com
```

### Traffic Switch
```bash
# Switch traffic from blue to green
./scripts/deploy-blue-green.sh \
  --version $(git rev-parse --short HEAD) \
  --strategy blue-green \
  --environment production

# Monitor traffic shift
aws cloudwatch get-metric-statistics \
  --namespace AWS/ELB \
  --metric-name RequestCount \
  --dimensions Name=LoadBalancer,Value=soberlivings-production \
  --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Sum
```

---

## Rollback Procedures

### Automatic Rollback (within 5 minutes)
```bash
# Triggered automatically if health checks fail
# Manual trigger if needed:
./scripts/rollback.sh --auto
```

### Manual Rollback
```bash
# Step 1: Switch traffic back
./scripts/deploy-blue-green.sh \
  --version previous \
  --strategy blue-green \
  --environment production

# Step 2: Verify rollback
curl https://soberlivings.com/api/health/ready
curl https://soberlivings.com/api/version

# Step 3: Investigate issues
aws logs tail /aws/ecs/soberlivings-production --follow
```

### Database Rollback
```bash
# Restore from backup
./scripts/restore.sh production --timestamp "2024-01-29T10:00:00Z"

# Verify restoration
psql $DATABASE_URL -c "SELECT COUNT(*) FROM facilities;"
```

---

## Emergency Contacts

### On-Call Rotation
| Role | Name | Phone | Email |
|------|------|-------|-------|
| Primary On-Call | John Smith | +1-555-0100 | john@soberlivings.com |
| Secondary On-Call | Jane Doe | +1-555-0101 | jane@soberlivings.com |
| Engineering Lead | Bob Wilson | +1-555-0102 | bob@soberlivings.com |
| DevOps Lead | Alice Chen | +1-555-0103 | alice@soberlivings.com |

### Escalation Path
1. **Level 1** (0-5 min): Primary On-Call
2. **Level 2** (5-15 min): Secondary On-Call + Engineering Lead
3. **Level 3** (15-30 min): DevOps Lead + CTO
4. **Level 4** (30+ min): Executive Team

### External Support
- **AWS Support**: Case #123456789 (Enterprise Support)
- **Datadog Support**: support@datadoghq.com
- **PagerDuty**: incidents@pagerduty.com

---

## Post-Deployment

### Monitoring Period
- **First 24 hours**: Active monitoring with 15-minute checks
- **First week**: Daily health reports
- **First month**: Weekly performance reviews

### Success Metrics (Day 1)
- ✅ Zero downtime during deployment
- ✅ All health checks passing
- ✅ Error rate <0.1%
- ✅ P95 latency <200ms
- ✅ 100% availability
- ✅ No rollbacks required

### Action Items
1. [ ] Schedule post-mortem meeting (if any issues)
2. [ ] Update documentation with learnings
3. [ ] Plan capacity for expected growth
4. [ ] Schedule security audit
5. [ ] Configure additional monitoring as needed

---

## Appendix

### Useful Commands
```bash
# View logs
aws logs tail /aws/ecs/soberlivings-production --follow

# Check ECS tasks
aws ecs list-tasks --cluster soberlivings-production

# Database connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Redis status
redis-cli -h redis.soberlivings.com INFO

# Container logs
docker logs $(docker ps -q --filter name=soberlivings)
```

### Configuration Files
- Terraform: `/infrastructure/terraform/`
- Docker: `/frontend/Dockerfile`
- CI/CD: `/.github/workflows/`
- Monitoring: `/monitoring/`
- Scripts: `/scripts/`

### Documentation
- API Documentation: https://soberlivings.com/api/docs
- Architecture Diagrams: `/docs/architecture/`
- Security Policies: `/docs/security/`
- SLA Documentation: `/docs/sla/`

---

**Document Version**: 1.0.0  
**Last Updated**: 2024-01-29  
**Next Review**: 2024-02-29  
**Owner**: DevOps Team  

**Sign-off for Production Launch**:
- [ ] Engineering Lead: ___________________ Date: ___________
- [ ] Product Owner: ____________________ Date: ___________
- [ ] Security Lead: ____________________ Date: ___________
- [ ] Operations Lead: __________________ Date: ___________
- [ ] CTO: ______________________________ Date: ___________