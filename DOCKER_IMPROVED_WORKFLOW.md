# 🐳 Improved Docker Development & Deployment Workflow

## Overview

This document outlines the enhanced Docker workflow for the Sober Living Facilities Finder application, featuring multi-stage builds, comprehensive monitoring, CI/CD integration, and production-ready configurations.

## 🚀 Quick Start

### Development Environment

```bash
# Start development with hot-reload
docker-compose up

# Or use the override file explicitly
docker-compose -f docker-compose.yml -f docker-compose.override.yml up

# Start with monitoring stack
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up
```

### Production Environment

```bash
# Build and start production containers
docker-compose -f docker-compose.yml up -d

# Or use the deployment script
./scripts/docker-deploy.sh
```

## 📦 Docker Configuration Files

### Core Files

| File | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage production build with security best practices |
| `Dockerfile.dev` | Development build with hot-reload and debugging |
| `docker-compose.yml` | Production-ready base configuration |
| `docker-compose.override.yml` | Development overrides (auto-loaded) |
| `docker-compose.monitoring.yml` | Complete monitoring stack |
| `docker-compose.test.yml` | CI/CD testing configuration |
| `.dockerignore` | Optimized build context exclusions |

## 🏗️ Multi-Stage Build Architecture

### Production Dockerfile Stages

1. **deps** - Install production dependencies with caching
2. **builder** - Build the Next.js application
3. **runner** - Minimal production runtime with security hardening

### Key Features

- ✅ Non-root user execution
- ✅ Health checks integrated
- ✅ Build cache optimization
- ✅ Minimal attack surface
- ✅ Multi-platform support (AMD64/ARM64)

## 🔧 Development Features

### Hot Reload Configuration

```yaml
volumes:
  - ./frontend:/app
  - /app/node_modules  # Preserve container node_modules
  - /app/.next         # Preserve build cache
```

### Debugging Support

- Node.js debugger on port 9229
- Source maps enabled
- Chrome DevTools integration

### Development Tools

- **Adminer** (8080): Database management UI
- **MailHog** (8025): Email testing interface
- **Grafana** (3001): Metrics visualization
- **Prometheus** (9090): Metrics collection

## 📊 Monitoring Stack

### Components

```mermaid
graph TB
    App[Application] --> Prometheus
    Postgres --> PostgresExporter[Postgres Exporter]
    Redis --> RedisExporter[Redis Exporter]
    Docker --> cAdvisor
    
    PostgresExporter --> Prometheus
    RedisExporter --> Prometheus
    cAdvisor --> Prometheus
    
    Prometheus --> Grafana
    
    App --> Loki
    Promtail --> Loki
    Loki --> Grafana
```

### Metrics Collection

- Application metrics via `/api/metrics`
- PostgreSQL metrics via postgres-exporter
- Redis metrics via redis-exporter
- Container metrics via cAdvisor
- Log aggregation via Loki/Promtail

## 🚀 CI/CD Pipeline

### GitHub Actions Workflow

```yaml
jobs:
  test:       # Run tests in containers
  build:      # Build and push to registry
  security:   # Vulnerability scanning
  deploy:     # Production deployment
```

### Features

- ✅ Automated testing
- ✅ Multi-platform builds
- ✅ Container registry integration
- ✅ Security scanning with Trivy
- ✅ Automated deployments

## 🔒 Security Best Practices

### Container Security

1. **Non-root user** - Containers run as unprivileged user
2. **Read-only filesystem** - Where possible
3. **No unnecessary packages** - Minimal base images
4. **Security scanning** - Automated vulnerability checks
5. **Secrets management** - Environment variables, not hardcoded

### Network Security

```yaml
networks:
  soberlivings:
    driver: bridge
    ipam:
      config:
        - subnet: 172.25.0.0/16
```

## 🎯 Deployment Workflow

### Using the Deployment Script

```bash
# Deploy with health checks and rollback
./scripts/docker-deploy.sh

# Custom compose file
COMPOSE_FILE=docker-compose.prod.yml ./scripts/docker-deploy.sh

# Named stack
STACK_NAME=production ./scripts/docker-deploy.sh
```

### Features

- Automatic health checks
- Rollback on failure
- Configuration backup
- Service status reporting

## 📈 Performance Optimization

### Build Optimization

```dockerfile
# Cache mount for npm
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production

# Cache mount for Next.js
RUN --mount=type=cache,target=/app/.next/cache \
    npm run build
```

### Runtime Optimization

```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
    reservations:
      cpus: '1'
      memory: 1G
```

## 🧪 Testing

### Local Testing

```bash
# Run tests in containers
docker-compose -f docker-compose.yml -f docker-compose.test.yml up --abort-on-container-exit
```

### CI/CD Testing

Tests run automatically on:
- Push to main/develop branches
- Pull requests
- Release creation

## 📝 Environment Variables

### Required Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@postgres:5432/db
POSTGRES_PASSWORD=secure_password

# Redis
REDIS_URL=redis://redis:6379

# Application
NEXT_PUBLIC_API_URL=https://api.example.com
NODE_ENV=production
```

### Development Variables

```env
NODE_ENV=development
DEBUG=true
WATCHPACK_POLLING=true
NEXT_TELEMETRY_DISABLED=1
```

## 🔍 Troubleshooting

### Common Issues

1. **Port conflicts**
   ```bash
   # Check port usage
   lsof -i :3000
   
   # Change port in docker-compose.override.yml
   ports:
     - "3001:3000"
   ```

2. **Volume permissions**
   ```bash
   # Fix permissions
   docker-compose exec app chown -R node:node /app
   ```

3. **Memory issues**
   ```bash
   # Increase Docker memory
   # Docker Desktop > Preferences > Resources > Memory
   ```

### Debug Commands

```bash
# View logs
docker-compose logs -f app

# Shell access
docker-compose exec app sh

# Health status
docker-compose ps

# Resource usage
docker stats
```

## 🚢 Production Deployment

### Container Registry

```bash
# Build and tag
docker build -t ghcr.io/org/app:latest .

# Push to registry
docker push ghcr.io/org/app:latest

# Deploy from registry
docker-compose pull
docker-compose up -d
```

### Health Monitoring

```bash
# Check health endpoint
curl http://localhost:3000/api/health

# View metrics
curl http://localhost:3000/api/metrics
```

## 📊 Monitoring Dashboards

### Grafana Setup

1. Access: http://localhost:3001
2. Login: admin/admin
3. Pre-configured dashboards:
   - Application Overview
   - Database Performance
   - Container Metrics
   - Log Analytics

### Prometheus Queries

```promql
# Request rate
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m])

# Memory usage
container_memory_usage_bytes{name="soberlivings-app"}
```

## 🔄 Updates and Maintenance

### Rolling Updates

```bash
# Update images
docker-compose pull

# Rolling restart
docker-compose up -d --no-deps --build app
```

### Backup and Restore

```bash
# Backup volumes
docker run --rm -v soberlivings_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz -C /data .

# Restore volumes
docker run --rm -v soberlivings_postgres_data:/data -v $(pwd):/backup alpine tar xzf /backup/postgres-backup.tar.gz -C /data
```

## 📚 Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/)
- [Next.js Docker Example](https://github.com/vercel/next.js/tree/canary/examples/with-docker)
- [Container Security Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)

---

## Summary

The improved Docker workflow provides:

✅ **Multi-stage builds** - Optimized image sizes and build times
✅ **Development tools** - Hot-reload, debugging, and database management
✅ **Monitoring stack** - Complete observability with Grafana/Prometheus
✅ **CI/CD integration** - Automated testing and deployment
✅ **Security hardening** - Non-root users, scanning, and minimal surfaces
✅ **Production ready** - Health checks, resource limits, and rollback capability

This setup ensures a smooth development experience while maintaining production-grade reliability and security.