# 🔄 Workflow Automation Guide

## Sober Living Facilities Finder - Next Steps Workflows

This directory contains automated workflows for completing the deployment and management of the Sober Living Facilities Finder application.

## 📋 Table of Contents

- [Overview](#overview)
- [Available Workflows](#available-workflows)
- [Quick Start](#quick-start)
- [Workflow Descriptions](#workflow-descriptions)
- [CI/CD Pipeline](#cicd-pipeline)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## Overview

These workflows automate the remaining tasks needed to bring the Sober Living Facilities Finder to production:

- ✅ **Data Population** - Import facility data from APIs
- ✅ **Testing** - Comprehensive test automation
- ✅ **Building** - Production container creation
- ✅ **Deployment** - Staging and production deployment
- ✅ **Monitoring** - Performance and health monitoring
- ✅ **CI/CD** - Continuous integration and deployment

## Available Workflows

### 🚀 Quick Commands

```bash
# Make scripts executable
chmod +x workflows/automation-scripts.sh

# Setup development environment
./workflows/automation-scripts.sh setup

# Populate sample data
./workflows/automation-scripts.sh populate

# Run all tests
./workflows/automation-scripts.sh test

# Build for production
./workflows/automation-scripts.sh build

# Deploy to staging
./workflows/automation-scripts.sh staging

# Monitor performance
./workflows/automation-scripts.sh monitor

# Run complete workflow
./workflows/automation-scripts.sh all
```

## Workflow Descriptions

### 1. 📊 Data Population Workflow

**Purpose**: Populate the database with real facility data

```bash
# Fetch facilities from FindTreatment.gov API
node src/fetchFacilities.js --location "California" --limit 500

# Import to database
docker exec soberlivings_frontend npm run db:seed

# Verify import
docker exec soberlivings_postgres psql -U postgres -d soberlivings \
  -c "SELECT COUNT(*) FROM facilities;"
```

**Expected Result**: 100+ facilities imported

### 2. 🧪 Testing Workflow

**Purpose**: Run comprehensive test suite

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Load testing
npx artillery run tests/load/api-load-test.yml
```

**Success Criteria**:
- All tests pass
- API response time < 200ms
- Zero critical vulnerabilities

### 3. 🏗️ Build Workflow

**Purpose**: Create production-optimized containers

```bash
# Build production images
docker build -f frontend/Dockerfile \
  --target production \
  -t soberlivings/frontend:latest \
  ./frontend

# Push to registry
docker push registry.hub.docker.com/soberlivings/frontend:latest
```

**Output**: Optimized containers < 100MB

### 4. 🚢 Deployment Workflow

**Purpose**: Deploy to staging/production

```bash
# Deploy to staging
docker compose -f docker-compose.staging.yml up -d

# Run health checks
curl https://staging.soberlivings.com/api/health

# Deploy to production (with approval)
docker compose -f docker-compose.prod.yml up -d
```

**Deployment Strategy**: Blue-Green with automatic rollback

### 5. 📈 Monitoring Workflow

**Purpose**: Track performance and health

```bash
# Start monitoring stack
docker compose -f docker-compose.monitoring.yml up -d

# Access dashboards
open http://localhost:3001  # Grafana
open http://localhost:9090  # Prometheus
```

**Metrics Tracked**:
- Response times
- Error rates
- Database performance
- Container resources

## CI/CD Pipeline

### GitHub Actions Integration

The CI/CD pipeline automatically:

1. **On Push to `develop`**:
   - Run tests
   - Build containers
   - Deploy to staging
   
2. **On Push to `main`**:
   - Run tests
   - Build containers
   - Deploy to production
   - Create release

3. **On Pull Request**:
   - Code quality checks
   - Security scanning
   - Performance testing

### Setup GitHub Actions

```bash
# Copy workflow to GitHub
cp workflows/ci-cd-pipeline.yml .github/workflows/

# Set secrets in GitHub
# - DOCKER_REGISTRY_TOKEN
# - STAGING_SERVER_SSH
# - PRODUCTION_SERVER_SSH
```

## Monitoring

### 📊 Key Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| API Response Time | < 200ms | > 500ms |
| Error Rate | < 1% | > 5% |
| Database Queries | < 100ms | > 500ms |
| Container CPU | < 70% | > 90% |
| Container Memory | < 80% | > 95% |

### 🔔 Alert Configuration

```yaml
# monitoring/alert-rules.yml
alerts:
  - name: HighErrorRate
    condition: error_rate > 0.05
    action: notify_slack
    
  - name: SlowResponse
    condition: response_time_p95 > 500
    action: page_oncall
    
  - name: DatabaseDown
    condition: database_health != "healthy"
    action: immediate_alert
```

## Troubleshooting

### Common Issues

#### 1. Container Build Fails
```bash
# Clear Docker cache
docker system prune -a

# Rebuild without cache
docker build --no-cache -f frontend/Dockerfile ./frontend
```

#### 2. Database Connection Issues
```bash
# Check PostgreSQL logs
docker logs soberlivings_postgres

# Restart database
docker restart soberlivings_postgres
```

#### 3. Deployment Rollback
```bash
# Automatic rollback triggered
./workflows/automation-scripts.sh rollback

# Manual rollback
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.backup.yml up -d
```

## 📝 Next Steps Checklist

- [ ] **Week 1**: Data population and testing
  - [ ] Import 500+ facilities
  - [ ] Run full test suite
  - [ ] Fix any failing tests

- [ ] **Week 2**: Staging deployment
  - [ ] Deploy to staging environment
  - [ ] Performance testing
  - [ ] Security scanning

- [ ] **Week 3**: Production preparation
  - [ ] Set up monitoring
  - [ ] Configure backups
  - [ ] Create runbooks

- [ ] **Week 4**: Production launch
  - [ ] Deploy to production
  - [ ] Monitor metrics
  - [ ] Gather feedback

## 🎯 Success Criteria

The project is considered complete when:

✅ 500+ facilities in database
✅ All tests passing (100% success)
✅ API response time < 200ms (p95)
✅ Error rate < 1%
✅ Uptime > 99.9%
✅ Monitoring dashboards configured
✅ CI/CD pipeline automated
✅ Documentation complete

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [GitHub Actions Guide](https://docs.github.com/en/actions)
- [Prometheus Monitoring](https://prometheus.io/docs/)
- [PostgreSQL Best Practices](https://www.postgresql.org/docs/)

---

**Generated by SPARC Workflow Manager**
*Last Updated: 2025-08-29*