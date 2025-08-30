# 📦 Staging Environment Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying and managing the staging environment for the Sober Living Facilities Finder application.

## 🚀 Quick Start

### Prerequisites
- Docker Desktop installed and running
- Docker Compose v2.0+
- 4GB+ available RAM
- 10GB+ available disk space

### Initial Setup

```bash
# 1. Run setup script
./scripts/staging-setup.sh

# 2. Configure environment variables
cp .env.staging.example .env.staging
# Edit .env.staging with your values

# 3. Deploy staging
./scripts/deploy-staging.sh deploy
```

## 📁 File Structure

```
soberlivings/
├── docker-compose.staging.yml     # Staging compose configuration
├── .env.staging                   # Environment variables
├── scripts/
│   ├── deploy-staging.sh          # Main deployment script
│   ├── staging-setup.sh           # Initial setup script
│   └── staging-health-check.sh    # Health check utility
├── nginx/
│   ├── nginx.staging.conf         # Nginx configuration
│   ├── ssl-staging/               # SSL certificates
│   └── htpasswd/                  # Basic auth credentials
└── monitoring/
    └── prometheus.staging.yml     # Prometheus configuration
```

## 🔧 Configuration

### Environment Variables

Key variables in `.env.staging`:

| Variable | Description | Default |
|----------|-------------|---------|
| `STAGING_DB_PASSWORD` | PostgreSQL password | staging_password_123 |
| `STAGING_API_URL` | API endpoint URL | http://localhost:3002/api |
| `STAGING_GRAFANA_PASSWORD` | Grafana admin password | staging_admin |
| `JWT_SECRET` | JWT signing secret | (generate unique) |
| `LOG_LEVEL` | Logging verbosity | debug |

### Network Configuration

- **Application**: Port 3002
- **PostgreSQL**: Port 5433
- **Redis**: Port 6380
- **Elasticsearch**: Port 9201
- **Nginx**: Ports 8080 (HTTP), 8443 (HTTPS)
- **Grafana**: Port 3003
- **Prometheus**: Port 9091

## 🚢 Deployment Process

### Standard Deployment

```bash
# Full deployment with health checks
./scripts/deploy-staging.sh deploy
```

### Deployment Steps

1. **Pre-deployment checks**: Validates Docker, disk space, and configuration
2. **Backup creation**: Backs up database and volumes
3. **Image building**: Builds application image with staging configuration
4. **Container deployment**: Starts all services
5. **Health checks**: Validates service health
6. **Database migrations**: Runs Prisma migrations
7. **Smoke tests**: Tests endpoints and connectivity
8. **Post-deployment**: Clears caches, warms up application

### Deployment Options

```bash
# Check status
./scripts/deploy-staging.sh status

# View logs
./scripts/deploy-staging.sh logs

# Stop environment
./scripts/deploy-staging.sh stop

# Restart services
./scripts/deploy-staging.sh restart

# Rollback deployment
./scripts/deploy-staging.sh rollback
```

## 🏥 Health Monitoring

### Health Check Script

```bash
# Run comprehensive health check
./scripts/staging-health-check.sh
```

### Manual Health Checks

```bash
# Application health
curl http://localhost:3002/api/health

# Database connection
docker compose exec postgres-staging psql -U postgres -c "SELECT 1"

# Redis connection
docker compose exec redis-staging redis-cli ping

# Elasticsearch cluster
curl http://localhost:9201/_cluster/health
```

## 📊 Monitoring

### Grafana Dashboard

- **URL**: http://localhost:3003
- **Username**: admin
- **Password**: staging_admin (or configured value)

### Prometheus Metrics

- **URL**: http://localhost:9091
- **Metrics endpoint**: http://localhost:3002/api/metrics

### Available Dashboards

1. **Application Overview**: Request rates, error rates, response times
2. **Database Performance**: Query performance, connections, locks
3. **Container Metrics**: CPU, memory, network I/O
4. **Cache Metrics**: Redis hit rates, memory usage

## 🔒 Security

### Basic Authentication

Staging environment is protected with HTTP Basic Auth:
- **Username**: staging
- **Password**: staging123

To update credentials:

```bash
# Generate new password
htpasswd -c nginx/htpasswd/.htpasswd username

# Restart nginx
docker compose restart nginx-staging
```

### SSL Certificates

Staging uses self-signed certificates. To regenerate:

```bash
./scripts/generate-staging-ssl.sh
```

For production certificates, use Let's Encrypt or your certificate provider.

## 🔄 Rollback Procedures

### Automatic Rollback

The deployment script automatically rolls back on failure:

```bash
# Manual rollback to previous deployment
./scripts/deploy-staging.sh rollback
```

### Manual Rollback Steps

1. **Stop current deployment**:
   ```bash
   docker compose -f docker-compose.staging.yml down
   ```

2. **Restore database backup**:
   ```bash
   gunzip -c backups/staging/latest/database.sql.gz | \
     docker compose exec -T postgres-staging psql -U postgres -d soberlivings_staging
   ```

3. **Restore volumes**:
   ```bash
   docker run --rm -v soberlivings_postgres_staging_data:/data \
     -v $(pwd)/backups/staging/latest:/backup alpine \
     tar xzf /backup/postgres-volume.tar.gz -C /data
   ```

4. **Restart services**:
   ```bash
   docker compose -f docker-compose.staging.yml up -d
   ```

## 📝 Logging

### View Logs

```bash
# All services
docker compose -f docker-compose.staging.yml logs -f

# Specific service
docker compose logs -f app

# Deployment logs
tail -f logs/staging-deployment-*.log
```

### Log Locations

- **Deployment logs**: `./logs/staging-deployment-*.log`
- **Container logs**: Docker container logs
- **Nginx access logs**: Inside nginx container at `/var/log/nginx/`
- **Application logs**: Structured JSON to stdout

## 🧪 Testing

### Run Tests in Staging

```bash
# Execute test suite
docker compose exec app npm test

# Run specific tests
docker compose exec app npm test -- --grep "API"
```

### Load Testing

```bash
# Simple load test
ab -n 1000 -c 10 http://localhost:3002/api/health
```

## 🔧 Troubleshooting

### Common Issues

1. **Port conflicts**:
   ```bash
   # Find process using port
   lsof -i :3002
   
   # Kill process
   kill -9 <PID>
   ```

2. **Container not starting**:
   ```bash
   # Check logs
   docker compose logs app
   
   # Inspect container
   docker compose ps
   ```

3. **Database connection issues**:
   ```bash
   # Test connection
   docker compose exec postgres-staging pg_isready
   
   # Check credentials
   cat .env.staging | grep DB
   ```

4. **Out of memory**:
   ```bash
   # Check memory usage
   docker stats
   
   # Increase Docker memory in Docker Desktop settings
   ```

### Debug Mode

```bash
# Start with verbose logging
LOG_LEVEL=trace ./scripts/deploy-staging.sh deploy

# Attach to container
docker compose exec app sh

# View environment variables
docker compose exec app env
```

## 🔄 Updates

### Update Application

```bash
# Pull latest code
git pull origin staging

# Rebuild and deploy
./scripts/deploy-staging.sh deploy
```

### Update Dependencies

```bash
# Update npm packages
docker compose exec app npm update

# Update Docker images
docker compose pull
```

## 📊 Performance Tuning

### Resource Limits

Adjust in `docker-compose.staging.yml`:

```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
```

### Database Optimization

```sql
-- Analyze tables
ANALYZE;

-- Check slow queries
SELECT * FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;
```

### Cache Configuration

```bash
# Redis memory limit
docker compose exec redis-staging redis-cli CONFIG SET maxmemory 256mb
```

## 📋 Checklist

### Pre-Deployment

- [ ] Code reviewed and approved
- [ ] Tests passing in CI
- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] Monitoring configured
- [ ] Backup verified

### Post-Deployment

- [ ] Health checks passing
- [ ] Smoke tests completed
- [ ] Monitoring dashboards active
- [ ] Logs reviewed for errors
- [ ] Performance baseline established
- [ ] Team notified

## 🆘 Support

### Logs and Reports

- **Deployment logs**: `./logs/staging-deployment-*.log`
- **Deployment reports**: `./logs/staging-deployment-report-*.txt`
- **Container status**: `docker compose ps`

### Emergency Contacts

- **DevOps Team**: devops@soberlivings.com
- **On-call Engineer**: Check PagerDuty
- **Slack Channel**: #staging-deployments

---

## Summary

The staging environment provides a production-like testing ground with:

✅ **Automated deployment** with health checks and rollback
✅ **Comprehensive monitoring** with Grafana and Prometheus
✅ **Security features** including basic auth and SSL
✅ **Easy rollback** procedures for quick recovery
✅ **Full logging** and debugging capabilities

Use this environment to validate changes before production deployment.