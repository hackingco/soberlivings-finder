# 🚀 Docker Quick Start - Automatic Deployment

## One-Command Deployment

```bash
# Automatic deployment with conflict resolution
./docker-start-auto.sh
```

That's it! The script will:
- ✅ Detect and resolve container conflicts
- ✅ Check port availability
- ✅ Clean up old containers
- ✅ Generate missing configuration
- ✅ Build and start all services
- ✅ Open the application in your browser

## 🔧 Automatic Solutions Included

### Problem 1: Container Name Conflicts
**Symptom**: "Container name already in use"  
**Automatic Fix**: Script detects and offers to remove old containers

### Problem 2: Port Conflicts
**Symptom**: "Port already in use"  
**Automatic Fix**: Script detects and offers alternative ports

### Problem 3: Docker Not Running
**Symptom**: "Cannot connect to Docker daemon"  
**Automatic Fix**: Script detects and prompts to start Docker

### Problem 4: Missing Environment Files
**Symptom**: "No .env file found"  
**Automatic Fix**: Script generates default configuration

### Problem 5: Orphaned Resources
**Symptom**: Random deployment failures  
**Automatic Fix**: Script cleans orphaned volumes and networks

## 🏥 Health Check & Recovery

```bash
# Run health check and auto-fix issues
./docker-health-check.sh
```

This will:
- Check all services
- Detect common issues
- Apply automatic fixes
- Report deployment status

## 📋 Manual Commands (If Needed)

### Start Services
```bash
# Simple deployment
docker compose -f docker-compose.simple.yml up -d

# Production deployment
docker compose -f docker-compose.prod.yml up -d
```

### Stop Services
```bash
docker compose down
```

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f frontend
```

### Clean Everything
```bash
# Stop and remove all containers
docker compose down -v

# Remove all Docker data (nuclear option)
docker system prune -a
```

## 🌐 Access Points

Once deployed, access your application at:

- **Frontend**: http://localhost:3000
- **API Health**: http://localhost:3000/api/health
- **API Docs**: http://localhost:3000/api/docs

## 🔄 Deployment Modes

### 1. Quick Development Mode
```bash
./docker-start-auto.sh
# Uses docker-compose.simple.yml by default
```

### 2. Full Production Mode
```bash
./docker-start-auto.sh docker-compose.prod.yml
```

### 3. Monitoring Mode
```bash
./docker-start-auto.sh docker-compose.monitoring.yml
```

## 🛠️ Troubleshooting

### If automatic script fails:

1. **Run health check first**:
   ```bash
   ./docker-health-check.sh
   ```

2. **Clean everything and retry**:
   ```bash
   docker system prune -a
   ./docker-start-auto.sh
   ```

3. **Check Docker resources**:
   - Open Docker Desktop
   - Settings → Resources
   - Ensure at least 4GB RAM allocated

4. **Manual cleanup**:
   ```bash
   # Stop all containers
   docker stop $(docker ps -aq)
   
   # Remove all containers
   docker rm $(docker ps -aq)
   
   # Start fresh
   ./docker-start-auto.sh
   ```

## ✨ Features of Automatic Deployment

### Intelligent Conflict Resolution
- Detects existing containers
- Offers multiple resolution strategies
- Handles port conflicts gracefully

### Environment Management
- Auto-generates missing .env files
- Validates configuration
- Sets secure defaults

### Health Monitoring
- Waits for services to be ready
- Runs database migrations
- Validates API endpoints

### User-Friendly Interface
- Color-coded output
- Clear progress indicators
- Actionable error messages
- Browser auto-launch option

## 🎯 Quick Actions

### Deploy and Open Browser
```bash
./docker-start-auto.sh
# Select 'y' when prompted to open browser
```

### Deploy with Live Logs
```bash
./docker-start-auto.sh
# Select 'y' when prompted to show logs
```

### Silent Deployment
```bash
./docker-start-auto.sh < /dev/null
```

## 📊 Expected Output

Successful deployment shows:
```
╔══════════════════════════════════════════════════════════╗
║         🎉 DEPLOYMENT SUCCESSFUL! 🎉                      ║
╚══════════════════════════════════════════════════════════╝

Running Containers:
NAME                    STATUS                PORTS
soberlivings_frontend   Up 10 seconds         0.0.0.0:3000->3000/tcp
soberlivings_postgres   Up 10 seconds (healthy) 0.0.0.0:5432->5432/tcp
soberlivings_redis      Up 10 seconds (healthy) 0.0.0.0:6379->6379/tcp
```

## 🔐 Security Notes

The automatic scripts:
- Never expose sensitive data
- Use secure defaults for passwords
- Keep data in Docker volumes
- Don't modify system files

## 📝 Configuration

Default ports (customizable in .env):
- Frontend: 3000
- PostgreSQL: 5432
- Redis: 6379
- Elasticsearch: 9200

## 🆘 Get Help

If you encounter issues:

1. Check the [Troubleshooting Guide](TROUBLESHOOTING.md)
2. Run the health check: `./docker-health-check.sh`
3. Check logs: `docker compose logs -f`
4. File an issue on GitHub

---

**TL;DR**: Just run `./docker-start-auto.sh` and follow the prompts! 🚀