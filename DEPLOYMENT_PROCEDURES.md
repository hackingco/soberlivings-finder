# SoberLivings Deployment Procedures

Complete deployment procedures for all environments with step-by-step instructions, rollback procedures, and verification steps.

## Table of Contents

1. [Overview](#overview)
2. [Pre-Deployment](#pre-deployment)
3. [Development Deployment](#development-deployment)
4. [Staging Deployment](#staging-deployment)
5. [Production Deployment](#production-deployment)
6. [Post-Deployment](#post-deployment)
7. [Rollback Procedures](#rollback-procedures)
8. [Emergency Procedures](#emergency-procedures)
9. [Environment Management](#environment-management)

## Overview

### Deployment Strategy

- **Development**: Continuous deployment on every commit to `develop` branch
- **Staging**: Deployment on every commit to `main` branch
- **Production**: Manual deployment with approval process and blue-green strategy

### Infrastructure

- **Frontend**: Next.js deployed on Vercel
- **Backend**: Node.js API on AWS ECS/Docker
- **Database**: PostgreSQL on AWS RDS with Supabase
- **Cache**: Redis ElastiCache
- **CDN**: CloudFront distribution

## Pre-Deployment

### Pre-Deployment Checklist

- [ ] All tests passing (unit, integration, e2e)
- [ ] Code review completed and approved
- [ ] Environment variables updated
- [ ] Database migrations tested
- [ ] Performance tests completed
- [ ] Security scan passed
- [ ] Backup created
- [ ] Rollback plan prepared
- [ ] Stakeholders notified (for production)

### Environment Variables Validation

```bash
# Validate all required environment variables
./scripts/validate-env.sh production

# Check for missing secrets
aws secretsmanager list-secrets --region us-west-2 | \
  jq '.SecretList[] | select(.Name | startswith("soberlivings-production"))'
```

### Database Migration Preparation

```bash
# Check pending migrations
npm run prisma:migrate:status

# Test migrations in staging
npm run prisma:migrate:deploy --preview-feature

# Generate migration if needed
npm run prisma:migrate:dev --name "add_new_feature"
```

### Build Verification

```bash
# Test local build
cd frontend
npm run build
npm run type-check

# Test Docker build
docker build -t soberlivings:test .
docker run --rm -p 3000:3000 soberlivings:test &
sleep 10
curl http://localhost:3000/api/health
```

## Development Deployment

### Automatic Development Deployment

Development deployments are automatic via GitHub Actions on commits to `develop` branch.

#### Manual Development Deployment

```bash
# 1. Checkout develop branch
git checkout develop
git pull origin develop

# 2. Install dependencies
npm install
cd frontend && npm install

# 3. Run tests
npm run test
npm run test:e2e

# 4. Deploy to development
cd frontend
vercel --prod --token=$VERCEL_TOKEN

# 5. Update development database
npm run prisma:db:push
npm run seed:dev
```

#### Development Environment Validation

```bash
# Health check
curl https://dev-api.soberlivings.com/api/health

# Functionality test
curl "https://dev-api.soberlivings.com/api/facilities/search?location=CA&limit=5"

# Database connectivity
psql $DEV_DATABASE_URL -c "SELECT COUNT(*) FROM facilities;"
```

## Staging Deployment

### Automatic Staging Deployment

Staging deployments trigger automatically on commits to `main` branch via GitHub Actions.

#### Manual Staging Deployment

```bash
# 1. Ensure main branch is ready
git checkout main
git pull origin main

# 2. Build and test
npm run build
npm run test:staging

# 3. Deploy via GitHub Actions
gh workflow run staging-deploy.yml \
  --ref main \
  -f environment=staging

# 4. Monitor deployment
gh run watch
```

#### Staging Environment Setup

```bash
# 1. Infrastructure deployment
cd infrastructure/terraform
terraform workspace select staging
terraform apply -var-file=staging.tfvars

# 2. Database setup
export DATABASE_URL=$STAGING_DATABASE_URL
npm run prisma:migrate:deploy
npm run seed:staging

# 3. Application deployment
docker build -t soberlivings/app:staging-$(git rev-parse --short HEAD) .
docker push soberlivings/app:staging-$(git rev-parse --short HEAD)
```

### Staging Validation

```bash
# Comprehensive staging tests
npm run test:staging:full

# Load testing
k6 run --env BASE_URL=https://staging-api.soberlivings.com load-test.js

# Security scan
npm audit --audit-level=high
```

## Production Deployment

### Production Deployment Overview

Production deployments use a blue-green deployment strategy with manual approval gates.

### Step 1: Pre-Production Validation

```bash
# 1. Final test suite
npm run test:production

# 2. Security validation
./scripts/security-scan.sh

# 3. Performance benchmarks
./scripts/performance-test.sh staging

# 4. Database migration dry run
npm run prisma:migrate:diff --preview-feature
```

### Step 2: Production Infrastructure

```bash
# 1. Terraform infrastructure update
cd infrastructure/terraform
terraform workspace select production
terraform plan -var-file=production.tfvars -out=tfplan

# Review plan carefully
terraform show tfplan

# Apply if approved
terraform apply tfplan
```

### Step 3: Blue-Green Deployment

```bash
# 1. Build production image
docker build -t soberlivings/app:$(git rev-parse HEAD) ./frontend
docker tag soberlivings/app:$(git rev-parse HEAD) soberlivings/app:production

# 2. Push to registry
docker push soberlivings/app:$(git rev-parse HEAD)
docker push soberlivings/app:production

# 3. Deploy to green environment
./scripts/deploy-blue-green.sh \
  --version $(git rev-parse HEAD) \
  --environment production \
  --strategy blue-green \
  --target green

# 4. Verify green environment
./scripts/health-check.sh https://green.api.soberlivings.com

# 5. Run smoke tests on green
npm run test:smoke -- --baseUrl=https://green.api.soberlivings.com
```

### Step 4: Traffic Switch

```bash
# 1. Gradual traffic switch (10% to green)
./scripts/deploy-blue-green.sh \
  --version $(git rev-parse HEAD) \
  --environment production \
  --strategy canary \
  --traffic-split 10

# 2. Monitor metrics for 10 minutes
./scripts/monitor-deployment.sh --duration=600

# 3. Increase to 50% if metrics are good
./scripts/deploy-blue-green.sh \
  --version $(git rev-parse HEAD) \
  --environment production \
  --strategy canary \
  --traffic-split 50

# 4. Full switch if all looks good
./scripts/deploy-blue-green.sh \
  --version $(git rev-parse HEAD) \
  --environment production \
  --strategy blue-green \
  --complete-switch
```

### Step 5: Database Migration

```bash
# 1. Create backup before migration
aws rds create-db-snapshot \
  --db-instance-identifier soberlivings-production \
  --db-snapshot-identifier pre-migration-$(date +%Y%m%d-%H%M)

# 2. Run migrations
export DATABASE_URL=$PRODUCTION_DATABASE_URL
npm run prisma:migrate:deploy

# 3. Verify migration
npm run prisma:migrate:status
```

### Step 6: Post-Deployment Validation

```bash
# 1. Health checks
curl https://api.soberlivings.com/api/health
curl https://api.soberlivings.com/api/health/ready

# 2. Functional tests
npm run test:production:smoke

# 3. Performance validation
./scripts/performance-test.sh production

# 4. Monitor for 1 hour
./scripts/monitor-deployment.sh --duration=3600
```

## Post-Deployment

### Immediate Post-Deployment (0-30 minutes)

1. **Monitor Key Metrics**
   ```bash
   # Error rate monitoring
   aws cloudwatch get-metric-statistics \
     --namespace "SoberLivings/API" \
     --metric-name ErrorRate \
     --start-time $(date -d "30 minutes ago" +%Y-%m-%dT%H:%M:%S) \
     --end-time $(date +%Y-%m-%dT%H:%M:%S) \
     --period 300 \
     --statistics Average
   
   # Response time monitoring
   aws cloudwatch get-metric-statistics \
     --namespace "SoberLivings/API" \
     --metric-name ResponseTime \
     --start-time $(date -d "30 minutes ago" +%Y-%m-%dT%H:%M:%S) \
     --end-time $(date +%Y-%m-%dT%H:%M:%S) \
     --period 300 \
     --statistics Average
   ```

2. **Verify Core Functionality**
   ```bash
   # API endpoints
   curl "https://api.soberlivings.com/api/facilities/search?location=CA"
   curl "https://api.soberlivings.com/api/health"
   
   # Database connectivity
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM facilities LIMIT 1;"
   
   # Frontend functionality
   curl -I https://soberlivings.com
   ```

3. **Check Application Logs**
   ```bash
   # Application logs
   kubectl logs -f deployment/soberlivings-api -n production --tail=100
   
   # Error logs
   aws logs filter-log-events \
     --log-group-name /aws/ecs/soberlivings-production \
     --filter-pattern "ERROR" \
     --start-time $(date -d "30 minutes ago" +%s)000
   ```

### Extended Monitoring (30 minutes - 24 hours)

1. **Performance Metrics**
   - Monitor response times for degradation
   - Check database query performance
   - Verify cache hit rates
   - Monitor resource utilization

2. **Business Metrics**
   - Track search success rates
   - Monitor user engagement
   - Check conversion rates
   - Validate data quality

3. **Alerting Verification**
   ```bash
   # Test alerting (in staging first)
   curl -X POST https://staging-api.soberlivings.com/test/generate-error
   
   # Verify alerts are received
   # Check Slack, email, PagerDuty notifications
   ```

## Rollback Procedures

### Automatic Rollback

Automatic rollbacks trigger when:
- Health checks fail for > 5 minutes
- Error rate > 5% for > 10 minutes
- Response time > 2000ms for > 5 minutes

### Manual Rollback

#### Quick Rollback (Blue-Green)

```bash
# 1. Switch traffic back to blue environment
./scripts/deploy-blue-green.sh \
  --environment production \
  --strategy rollback \
  --target blue

# 2. Verify rollback
curl https://api.soberlivings.com/api/health
./scripts/smoke-tests.sh production

# 3. Investigate issues in green environment
kubectl logs deployment/soberlivings-api-green -n production
```

#### Database Rollback

```bash
# 1. Check if database rollback is needed
npm run prisma:migrate:status

# 2. If migrations need to be rolled back
# WARNING: Only do this if you're certain!
npm run prisma:migrate:reset --force

# 3. Restore from backup if necessary
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier soberlivings-production-rollback \
  --db-snapshot-identifier pre-migration-20240129-1430

# 4. Update connection strings to point to rollback instance
# (requires infrastructure update)
```

#### Code Rollback

```bash
# 1. Revert to previous version
git log --oneline -10
git checkout <previous-commit-hash>

# 2. Build and deploy previous version
docker build -t soberlivings/app:rollback-$(git rev-parse --short HEAD) .
docker push soberlivings/app:rollback-$(git rev-parse --short HEAD)

# 3. Deploy rollback version
./scripts/deploy-blue-green.sh \
  --version rollback-$(git rev-parse --short HEAD) \
  --environment production \
  --strategy emergency-rollback
```

## Emergency Procedures

### Critical System Outage

1. **Immediate Response (0-5 minutes)**
   ```bash
   # Check system status
   curl -f https://api.soberlivings.com/api/health || echo "CRITICAL: API DOWN"
   
   # Check infrastructure
   aws ecs describe-services --cluster soberlivings-production
   aws rds describe-db-instances --db-instance-identifier soberlivings-production
   ```

2. **Communication (5-10 minutes)**
   ```bash
   # Send alerts
   curl -X POST https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK \
     -d '{"text": "🚨 CRITICAL: SoberLivings API is DOWN"}'
   
   # Update status page
   curl -X POST https://api.statuspage.io/v1/pages/YOUR_PAGE_ID/incidents \
     -H "Authorization: OAuth YOUR_TOKEN" \
     -d '{"incident": {"name": "API Outage", "status": "investigating"}}'
   ```

3. **Investigation & Resolution (10+ minutes)**
   ```bash
   # Quick fixes to try
   # 1. Restart services
   kubectl rollout restart deployment/soberlivings-api -n production
   
   # 2. Scale up if resource issue
   kubectl scale deployment/soberlivings-api --replicas=5 -n production
   
   # 3. Switch to DR region if necessary
   ./scripts/disaster-recovery.sh --region us-east-1
   ```

### Data Corruption Emergency

1. **Immediate Actions**
   ```bash
   # Stop all writes
   kubectl patch deployment soberlivings-api -n production -p \
     '{"spec":{"template":{"metadata":{"annotations":{"maintenance.mode":"true"}}}}}'
   
   # Create emergency backup
   aws rds create-db-snapshot \
     --db-instance-identifier soberlivings-production \
     --db-snapshot-identifier emergency-backup-$(date +%Y%m%d-%H%M%S)
   ```

2. **Assessment**
   ```sql
   -- Check data integrity
   SELECT 
     COUNT(*) as total,
     COUNT(*) FILTER (WHERE name IS NULL) as missing_names,
     COUNT(*) FILTER (WHERE latitude IS NULL OR longitude IS NULL) as missing_coords
   FROM facilities;
   ```

3. **Recovery**
   ```bash
   # Restore from last good backup
   aws rds restore-db-instance-from-db-snapshot \
     --db-instance-identifier soberlivings-production-emergency \
     --db-snapshot-identifier last-good-backup
   ```

## Environment Management

### Environment Configuration

| Environment | Branch | Auto-Deploy | Database | Domain |
|-------------|--------|-------------|----------|---------|
| Development | `develop` | Yes | PostgreSQL (local) | `dev-api.soberlivings.com` |
| Staging | `main` | Yes | PostgreSQL (AWS RDS) | `staging-api.soberlivings.com` |
| Production | `main` (manual) | No | PostgreSQL (AWS RDS) | `api.soberlivings.com` |

### Environment Variables

```bash
# Development
export NODE_ENV=development
export DATABASE_URL="postgresql://localhost:5432/soberlivings_dev"
export REDIS_URL="redis://localhost:6379"

# Staging
export NODE_ENV=staging
export DATABASE_URL="postgresql://user:pass@staging-db.amazonaws.com:5432/soberlivings"
export REDIS_URL="redis://staging-redis.amazonaws.com:6379"

# Production
export NODE_ENV=production
export DATABASE_URL="postgresql://user:pass@prod-db.amazonaws.com:5432/soberlivings"
export REDIS_URL="redis://prod-redis.amazonaws.com:6379"
```

### Database Environments

```bash
# Development database setup
createdb soberlivings_dev
npm run prisma:migrate:dev
npm run seed:dev

# Staging database setup
export DATABASE_URL=$STAGING_DATABASE_URL
npm run prisma:migrate:deploy
npm run seed:staging

# Production database setup
export DATABASE_URL=$PRODUCTION_DATABASE_URL
npm run prisma:migrate:deploy
npm run seed:production
```

### Secrets Management

```bash
# Development (local .env files)
cp .env.example .env.local

# Staging & Production (AWS Secrets Manager)
aws secretsmanager create-secret \
  --name "soberlivings-production-db-password" \
  --secret-string '{"password":"your-secure-password"}'

aws secretsmanager create-secret \
  --name "soberlivings-production-api-keys" \
  --secret-string '{"keys":["key1","key2","key3"]}'
```

## Deployment Scripts

### Key Deployment Scripts

- `./scripts/deploy-blue-green.sh` - Blue-green deployment script
- `./scripts/health-check.sh` - Health verification script
- `./scripts/smoke-tests.sh` - Post-deployment smoke tests
- `./scripts/rollback.sh` - Emergency rollback script
- `./scripts/monitor-deployment.sh` - Deployment monitoring

### GitHub Actions Workflows

- `.github/workflows/development-deploy.yml` - Dev deployment
- `.github/workflows/staging-deploy.yml` - Staging deployment
- `.github/workflows/production-deploy.yml` - Production deployment
- `.github/workflows/rollback.yml` - Emergency rollback workflow

## Verification Checklists

### Pre-Deployment Checklist

- [ ] All automated tests passing
- [ ] Code review approved
- [ ] Security scan completed
- [ ] Performance tests passed
- [ ] Database migrations tested
- [ ] Environment variables updated
- [ ] Secrets rotated (if needed)
- [ ] Backup created
- [ ] Rollback plan ready
- [ ] Team notified

### Post-Deployment Checklist

- [ ] Health checks passing
- [ ] Smoke tests completed
- [ ] Performance within SLA
- [ ] Error rates normal
- [ ] Database connections stable
- [ ] Cache functioning
- [ ] Monitoring active
- [ ] Alerts configured
- [ ] Documentation updated
- [ ] Success communicated

## Contact Information

### Deployment Team

| Role | Name | Email | Phone |
|------|------|-------|-------|
| DevOps Lead | Lead Engineer | devops@soberlivings.com | +1-555-0100 |
| Release Manager | Release Mgr | releases@soberlivings.com | +1-555-0101 |
| Database Admin | DBA | dba@soberlivings.com | +1-555-0102 |
| Security Lead | Security | security@soberlivings.com | +1-555-0103 |

### Escalation Contacts

- **P0 Issues**: devops-oncall@soberlivings.com
- **Database Issues**: dba-emergency@soberlivings.com
- **Security Issues**: security-emergency@soberlivings.com

## Related Documentation

- [Day 1 Production Runbook](./DAY1_PRODUCTION_RUNBOOK.md)
- [Operations Runbook](./OPERATIONS_RUNBOOK.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [Troubleshooting Guide](./TROUBLESHOOTING_GUIDE.md)

---

**Document Version**: 1.0.0  
**Last Updated**: January 29, 2024  
**Next Review**: February 29, 2024  
**Owner**: DevOps Team