# Troubleshooting Guide

## Common Issues and Solutions

### 1. Database Connection Issues

#### Problem: `getaddrinfo ENOTFOUND db.acwtjmqtwnijzbioauwn.supabase.co`
**Cause**: DNS resolution failure in Docker containers when trying to connect to Supabase.

**Solutions**:
1. **Add DNS configuration to Docker:**
   ```yaml
   # docker-compose.override.yml
   services:
     app:
       dns:
         - 1.1.1.1
         - 8.8.8.8
   ```

2. **Switch to local PostgreSQL:**
   ```bash
   make api-env-local
   make setup-local
   ```

3. **Test connectivity:**
   ```bash
   # From host
   nslookup db.acwtjmqtwnijzbioauwn.supabase.co
   
   # From container
   docker-compose exec app getent hosts db.acwtjmqtwnijzbioauwn.supabase.co
   ```

#### Problem: PostgreSQL connection refused
**Solutions**:
1. **Check if PostgreSQL is running:**
   ```bash
   docker ps | grep postgres
   make test-local-db
   ```

2. **Start PostgreSQL:**
   ```bash
   docker-compose -f docker-compose.staging.yml up -d postgres-staging
   ```

3. **Verify port availability:**
   ```bash
   lsof -i :5433
   ```

### 2. Port Conflicts

#### Problem: Port already allocated
**Common conflicting ports**:
- 3000/3001 - Frontend
- 5432/5433 - PostgreSQL
- 6379/6380 - Redis
- 8080 - WordPress

**Solutions**:
1. **Find process using port:**
   ```bash
   lsof -i :PORT_NUMBER
   # or
   sudo netstat -tulpn | grep PORT_NUMBER
   ```

2. **Kill process:**
   ```bash
   kill -9 PID
   ```

3. **Change port in docker-compose:**
   ```yaml
   services:
     postgres-staging:
       ports:
         - "5434:5432"  # Change to unused port
   ```

### 3. CSS/Styling Not Loading

#### Problem: No styling on landing page in Docker
**Cause**: Volume mount conflict with Next.js build output.

**Solution**:
Remove problematic volume mount in `docker-compose.override.yml`:
```yaml
services:
  app:
    volumes:
      # Remove this line:
      # - ./frontend/.next:/app/.next
      - ./frontend:/app
```

### 4. WordPress Plugin Issues

#### Problem: WordPress shortcode not working
**Solutions**:
1. **Activate plugin:**
   ```bash
   make activate
   ```

2. **Check plugin status:**
   ```bash
   docker-compose exec wordpress wp plugin list --allow-root
   ```

3. **Create test page:**
   ```bash
   make page
   ```

4. **Enable CORS in API:**
   ```javascript
   // frontend/src/app/api/v1/facilities/route.ts
   headers: {
     'Access-Control-Allow-Origin': '*',
   }
   ```

### 5. Migration Issues

#### Problem: Prisma migration fails
**Solutions**:
1. **Reset database:**
   ```bash
   cd frontend
   npx prisma db push --force-reset
   ```

2. **Use db push instead of migrate:**
   ```bash
   npx prisma db push --accept-data-loss
   ```

3. **Check DATABASE_URL:**
   ```bash
   make show-env
   echo $DATABASE_URL
   ```

### 6. Seed Data Issues

#### Problem: No facilities showing in API
**Solutions**:
1. **Run seed script:**
   ```bash
   cd frontend && npm run db:seed
   ```

2. **Verify data in database:**
   ```bash
   docker-compose exec postgres-staging psql -U postgres soberlivings_staging -c "SELECT COUNT(*) FROM facilities;"
   ```

3. **Check API response:**
   ```bash
   curl "http://localhost:3001/api/v1/facilities?state=CA&limit=5" | jq '.'
   ```

### 7. Environment Variable Issues

#### Problem: Wrong database being used
**Solutions**:
1. **Check current environment:**
   ```bash
   make show-env
   ```

2. **Switch environment:**
   ```bash
   # To local
   make api-env-local
   
   # To Supabase
   make api-env-supabase
   ```

3. **Restart application:**
   ```bash
   docker-compose restart app
   ```

### 8. Docker Issues

#### Problem: Containers not starting
**Solutions**:
1. **Check logs:**
   ```bash
   docker-compose logs -f [service_name]
   ```

2. **Clean up:**
   ```bash
   docker-compose down -v
   docker system prune -f
   ```

3. **Rebuild:**
   ```bash
   docker-compose build --no-cache
   docker-compose up -d
   ```

### 9. API Health Check Failures

#### Problem: API health endpoint shows degraded
**Expected degraded services**:
- Redis (if not running)
- Supabase (if using local PostgreSQL)

**Check individual services:**
```bash
# Database
curl "http://localhost:3001/api/health" | jq '.checks.database'

# Cache
curl "http://localhost:3001/api/health" | jq '.checks.cache'

# Supabase
curl "http://localhost:3001/api/health" | jq '.checks.supabase'
```

### 10. npm/yarn Issues

#### Problem: Module not found errors
**Solutions**:
1. **Clean install:**
   ```bash
   cd frontend
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Clear cache:**
   ```bash
   npm cache clean --force
   ```

3. **Check Node version:**
   ```bash
   node --version  # Should be 20.x
   ```

## Quick Diagnostic Commands

### System Status
```bash
# Check all services
docker-compose ps

# API health
curl -s "http://localhost:3001/api/health" | jq '.'

# Database connectivity
make test-local-db

# Current environment
make show-env
```

### Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f postgres-staging

# WordPress
docker-compose -f wordpress-plugin/docker-compose.yml logs -f wordpress
```

### Database
```bash
# Connect to PostgreSQL
docker-compose exec postgres-staging psql -U postgres soberlivings_staging

# List tables
\dt

# Count facilities
SELECT COUNT(*) FROM facilities;

# Exit
\q
```

## Emergency Recovery

### Complete Reset
```bash
# Stop everything
docker-compose down -v
cd wordpress-plugin && docker-compose down -v

# Clean Docker
docker system prune -af

# Restart from scratch
make setup-local
cd wordpress-plugin && make up && make setup
```

### Database Recovery
```bash
# Backup current database
make backup

# Restore from backup
make restore

# Re-seed if needed
cd frontend && npm run db:seed
```

## Getting Help

1. **Check logs first** - Most issues are evident in logs
2. **Verify environment** - Ensure correct database is configured
3. **Test connectivity** - Use health endpoints and test commands
4. **Clean restart** - When in doubt, clean and rebuild

## Related Documentation

- `ENVIRONMENT_CONFIGURATION.md` - Environment setup guide
- `DEPLOYMENT_PROCEDURES.md` - Deployment processes
- `API_DOCUMENTATION.md` - API endpoint reference
- `ARCHITECTURE.md` - System architecture overview