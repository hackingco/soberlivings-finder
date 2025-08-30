# Environment Configuration Guide

## Overview

This guide covers the CLI-driven workflow for seamless switching between local PostgreSQL and Supabase databases in the Sober Living Facilities Finder application.

## Current Setup

The application supports two database environments:
- **Local PostgreSQL**: For development and staging (currently active)
- **Supabase**: For production deployment (requires authentication setup)

## Quick Commands

### Check Current Environment
```bash
make show-env
```

### Switch to Local PostgreSQL
```bash
make api-env-local
```

### Switch to Supabase
```bash
make api-env-supabase
```

### Test Database Connectivity
```bash
# Test local PostgreSQL
make test-local-db

# Test Supabase connection
make test-supabase
```

## Environment Files

### Configuration Files
- `frontend/.env.production.localdb` - Local PostgreSQL configuration
- `frontend/.env.production.supabase` - Supabase production configuration
- `frontend/.env.local` - Active environment (copied from above)
- `frontend/.env.production` - Production build configuration

### Local PostgreSQL Configuration
```env
# frontend/.env.production.localdb
DATABASE_URL="postgresql://postgres:postgres@postgres-staging:5432/soberlivings_staging?schema=public&sslmode=disable"
DIRECT_URL="postgresql://postgres:postgres@postgres-staging:5432/soberlivings_staging?schema=public&sslmode=disable"
NEXT_PUBLIC_API_URL="http://localhost:3001/api"
```

### Supabase Configuration
```env
# frontend/.env.production.supabase
DATABASE_URL="postgresql://postgres:PASSWORD@db.acwtjmqtwnijzbioauwn.supabase.co:5432/postgres?sslmode=require"
NEXT_PUBLIC_SUPABASE_URL="https://acwtjmqtwnijzbioauwn.supabase.co"
NEXT_PUBLIC_API_URL="https://api.soberlivings.com"
```

## Complete Setup Workflows

### Initial Supabase CLI Setup (One-time)
```bash
# 1. Login to Supabase CLI (opens browser)
supabase login

# OR for CI/non-interactive environments:
export SUPABASE_ACCESS_TOKEN="your-personal-access-token"

# 2. Link your project (from repo root)
make supabase-link
```

### Local Development Setup
```bash
# 1. Switch to local database
make api-env-local

# 2. Start PostgreSQL and Redis
docker compose -f docker-compose.staging.yml up -d postgres-staging redis-staging

# 3. Run migrations
cd frontend && npx prisma db push

# 4. Seed database
make seed-staging

# 5. Verify setup
make test-local-db
```

### Supabase Production Setup
```bash
# 1. Switch to Supabase
make api-env-supabase

# 2. Deploy Prisma migrations
cd frontend && npx prisma migrate deploy

# 3. Optional: Generate SQL snapshot for Supabase CLI
make prisma-to-sql

# 4. Optional: Push SQL to Supabase
make supabase-push

# 5. Verify connection
make test-supabase
```

### Quick Switching Commands
```bash
# Switch to local DB and verify
make api-env-local
make test-local-db
curl -s "http://localhost:3001/api/health" | jq .

# Switch to Supabase and verify
make api-env-supabase
make test-supabase
curl -s "http://localhost:3001/api/health" | jq .
```

## Database Migration Management

### Prisma to SQL Migration
```bash
# Generate SQL from Prisma schema
make prisma-to-sql
```

### Deploy Migrations
```bash
# To current DATABASE_URL
make prisma-deploy

# To Supabase
make supabase-push
```

### Pull Remote Schema
```bash
# From Supabase
make supabase-pull
```

## Troubleshooting

### DNS Resolution Issues in Docker
If you encounter `getaddrinfo ENOTFOUND db.acwtjmqtwnijzbioauwn.supabase.co`:

1. **Add DNS configuration to docker-compose.override.yml:**
```yaml
services:
  app:
    dns:
      - 1.1.1.1
      - 8.8.8.8
```

2. **Use local PostgreSQL as workaround:**
```bash
make api-env-local
make setup-local
```

### Port Conflicts
Default ports:
- Local PostgreSQL: 5433
- Redis: 6380
- Frontend: 3000/3001
- WordPress: 8080

To change ports, edit `docker-compose.staging.yml`:
```yaml
services:
  postgres-staging:
    ports:
      - "5433:5432"  # Change first number for host port
```

### Database Connection Test
```bash
# Test from Docker container
docker-compose exec app sh -lc 'pg_isready -h postgres-staging -p 5432 -U postgres'

# Test API health
curl -s "http://localhost:3001/api/health" | jq '.'
```

## Environment Variables Reference

### Database
- `DATABASE_URL` - Primary database connection string
- `DIRECT_URL` - Direct database connection (bypasses connection pooling)

### Supabase
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (backend only)

### API Configuration
- `NEXT_PUBLIC_API_URL` - Public API endpoint
- `NEXT_PUBLIC_WS_URL` - WebSocket endpoint

### External Services
- `FIRECRAWL_API_KEY` - Firecrawl API for web scraping
- `FINDTREATMENT_API_URL` - FindTreatment.gov API endpoint

## Security Notes

1. **Never commit `.env.local` or `.env.production` files**
2. **Use `.env.*.template` files for examples**
3. **Store production secrets in environment variables**
4. **Rotate Supabase service role keys regularly**
5. **Use SSL for production database connections**

## Makefile Targets Reference

### Environment Management
- `make show-env` - Display current configuration
- `make api-env-local` - Switch to local PostgreSQL
- `make api-env-supabase` - Switch to Supabase
- `make setup-local` - Complete local setup
- `make setup-supabase` - Complete Supabase setup (requires auth)

### Database Operations
- `make test-local-db` - Test local PostgreSQL
- `make test-supabase` - Test Supabase connection
- `make prisma-deploy` - Deploy Prisma migrations
- `make prisma-to-sql` - Generate SQL from Prisma
- `make seed-staging` - Seed current database with test data

### Supabase CLI
- `make supabase-link` - Link to project (requires auth token)
- `make supabase-push` - Push migrations to Supabase
- `make supabase-pull` - Pull remote schema
- `make supabase-secrets` - Set Supabase secrets
- `make supabase-connection` - Get connection strings

### Docker Operations (Now using Compose v2)
- All docker-compose commands updated to `docker compose`
- Improved error handling and compatibility

## Next Steps

1. **For Development**: Use local PostgreSQL (current setup)
2. **For Production**: Configure Supabase with proper DNS resolution
3. **For Testing**: Maintain both environments with easy switching

## Support

For issues or questions:
- Check `TROUBLESHOOTING_GUIDE.md` for common problems
- Review `docker-compose.override.yml` for Docker configuration
- Verify environment files match templates