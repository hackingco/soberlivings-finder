#!/bin/bash
# Staging environment health check script

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🏥 Checking Staging Environment Health..."
echo "========================================"

# Function to check service
check_service() {
    local service=$1
    local port=$2
    local endpoint=${3:-""}
    
    if nc -z localhost $port 2>/dev/null; then
        if [ -n "$endpoint" ]; then
            if curl -s -f "http://localhost:${port}${endpoint}" > /dev/null 2>&1; then
                echo -e "${GREEN}✓${NC} ${service} is healthy (port ${port})"
                return 0
            else
                echo -e "${YELLOW}⚠${NC} ${service} is running but endpoint check failed"
                return 1
            fi
        else
            echo -e "${GREEN}✓${NC} ${service} is healthy (port ${port})"
            return 0
        fi
    else
        echo -e "${RED}✗${NC} ${service} is not responding on port ${port}"
        return 1
    fi
}

# Check all services
check_service "Application" 3002 "/api/health"
check_service "PostgreSQL" 5433
check_service "Redis" 6380
check_service "Elasticsearch" 9201 "/_cluster/health"
check_service "Nginx" 8080 "/health"
check_service "Prometheus" 9091 "/-/healthy"
check_service "Grafana" 3003 "/api/health"

echo ""
echo "Container Status:"
docker-compose -f docker-compose.staging.yml ps

echo ""
echo "Resource Usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" | grep staging || true

echo ""
echo "========================================"
echo "Health check complete!"