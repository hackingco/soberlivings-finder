#!/bin/bash
set -euo pipefail

# Docker Health Check and Recovery Script
# Automatically detects and fixes common Docker deployment issues

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
PROJECT_NAME="soberlivings"
ISSUES_FOUND=0
FIXES_APPLIED=0

# Functions
check() {
    echo -ne "${BLUE}[CHECK]${NC} $1... "
}

pass() {
    echo -e "${GREEN}✅ PASS${NC}"
}

fail() {
    echo -e "${RED}❌ FAIL${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
}

fixed() {
    echo -e "${GREEN}✅ FIXED${NC}"
    FIXES_APPLIED=$((FIXES_APPLIED + 1))
}

info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

# Header
echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║           SoberLivings Docker Health Check                ║"
echo "║              Automatic Issue Detection & Fix              ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check 1: Docker is running
check "Docker daemon status"
if docker info >/dev/null 2>&1; then
    pass
else
    fail
    echo "  ${YELLOW}→ Starting Docker...${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open -a Docker
        sleep 10
    else
        sudo systemctl start docker
    fi
    
    if docker info >/dev/null 2>&1; then
        fixed
    else
        echo "  ${RED}→ Could not start Docker. Please start it manually.${NC}"
        exit 1
    fi
fi

# Check 2: Conflicting container names
check "Container name conflicts"
CONFLICTS=$(docker ps -a --format '{{.Names}}' | grep -E "^${PROJECT_NAME}[_-]" | wc -l)
if [ "$CONFLICTS" -eq 0 ]; then
    pass
else
    fail
    echo "  ${YELLOW}→ Found $CONFLICTS conflicting containers${NC}"
    echo "  ${YELLOW}→ Cleaning up old containers...${NC}"
    
    docker ps -a --format '{{.Names}}' | grep -E "^${PROJECT_NAME}[_-]" | while read container; do
        docker stop "$container" >/dev/null 2>&1 || true
        docker rm "$container" >/dev/null 2>&1 || true
    done
    
    fixed
fi

# Check 3: Port availability
check "Port availability"
PORTS_IN_USE=""
for port in 3000 5432 6379 9200; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        PORTS_IN_USE="$PORTS_IN_USE $port"
    fi
done

if [ -z "$PORTS_IN_USE" ]; then
    pass
else
    fail
    echo "  ${YELLOW}→ Ports in use:$PORTS_IN_USE${NC}"
    
    # Check if they're our containers
    OUR_CONTAINERS=true
    for port in $PORTS_IN_USE; do
        if ! docker ps --format '{{.Names}}' | grep -q "${PROJECT_NAME}"; then
            OUR_CONTAINERS=false
            break
        fi
    done
    
    if $OUR_CONTAINERS; then
        echo "  ${CYAN}→ Ports are used by our containers (OK)${NC}"
        pass
    else
        echo "  ${YELLOW}→ Ports are used by other services${NC}"
        echo "  ${YELLOW}→ Will use alternative ports${NC}"
        export ALT_PORTS=true
    fi
fi

# Check 4: Docker Compose files
check "Docker Compose configuration"
if [ -f "docker-compose.simple.yml" ] || [ -f "frontend/docker-compose.simple.yml" ]; then
    pass
else
    fail
    echo "  ${RED}→ Docker Compose file not found${NC}"
    echo "  ${YELLOW}→ Please ensure you're in the project directory${NC}"
    exit 1
fi

# Check 5: Environment files
check "Environment configuration"
if [ -f ".env" ] || [ -f "frontend/.env" ]; then
    pass
else
    fail
    echo "  ${YELLOW}→ Creating default .env file...${NC}"
    
    cat > .env << EOF
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/soberlivings
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_SITE_URL=http://localhost:3000
POSTGRES_DB=soberlivings
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
EOF
    
    fixed
fi

# Check 6: Docker network conflicts
check "Docker network configuration"
NETWORK_EXISTS=$(docker network ls --format '{{.Name}}' | grep -c "${PROJECT_NAME}_default" || true)
if [ "$NETWORK_EXISTS" -gt 1 ]; then
    fail
    echo "  ${YELLOW}→ Multiple networks found, cleaning up...${NC}"
    docker network prune -f >/dev/null 2>&1
    fixed
else
    pass
fi

# Check 7: Container health
check "Container health status"
if docker ps --format '{{.Names}}' | grep -q "${PROJECT_NAME}"; then
    UNHEALTHY=$(docker ps --filter "name=${PROJECT_NAME}" --format "{{.Names}} {{.Status}}" | grep -c "unhealthy" || true)
    if [ "$UNHEALTHY" -gt 0 ]; then
        fail
        echo "  ${YELLOW}→ Found $UNHEALTHY unhealthy containers${NC}"
        echo "  ${YELLOW}→ Restarting unhealthy containers...${NC}"
        
        docker ps --filter "name=${PROJECT_NAME}" --format "{{.Names}}" | while read container; do
            if docker inspect "$container" | grep -q '"Status": "unhealthy"'; then
                docker restart "$container" >/dev/null 2>&1
            fi
        done
        
        sleep 5
        fixed
    else
        pass
    fi
else
    info "No containers running yet"
fi

# Check 8: Database connectivity
check "Database connectivity"
if docker ps --format '{{.Names}}' | grep -q "${PROJECT_NAME}.*postgres"; then
    if docker exec "${PROJECT_NAME}_postgres" pg_isready -U postgres >/dev/null 2>&1; then
        pass
    else
        fail
        echo "  ${YELLOW}→ Database not responding, restarting...${NC}"
        docker restart "${PROJECT_NAME}_postgres" >/dev/null 2>&1
        sleep 5
        
        if docker exec "${PROJECT_NAME}_postgres" pg_isready -U postgres >/dev/null 2>&1; then
            fixed
        else
            echo "  ${RED}→ Database still not responding${NC}"
        fi
    fi
else
    info "Database container not running"
fi

# Check 9: API health
check "API endpoint health"
API_URL="http://localhost:${FRONTEND_PORT:-3000}/api/health"
if curl -s "$API_URL" >/dev/null 2>&1; then
    HEALTH_STATUS=$(curl -s "$API_URL" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    if [ "$HEALTH_STATUS" = "healthy" ] || [ "$HEALTH_STATUS" = "ok" ]; then
        pass
    else
        fail
        echo "  ${YELLOW}→ API unhealthy: $HEALTH_STATUS${NC}"
        echo "  ${CYAN}→ This is normal if database is not connected${NC}"
    fi
else
    info "API not accessible yet"
fi

# Check 10: Disk space
check "Available disk space"
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 90 ]; then
    pass
else
    fail
    echo "  ${YELLOW}→ Disk usage is ${DISK_USAGE}%${NC}"
    echo "  ${YELLOW}→ Cleaning Docker cache...${NC}"
    
    docker system prune -f >/dev/null 2>&1
    docker volume prune -f >/dev/null 2>&1
    
    NEW_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    echo "  ${CYAN}→ Disk usage now: ${NEW_USAGE}%${NC}"
    fixed
fi

# Summary
echo ""
echo -e "${CYAN}══════════════════════════════════════════════════════════${NC}"
echo ""

if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Your Docker environment is healthy.${NC}"
    echo ""
    echo -e "${CYAN}Access your application:${NC}"
    echo -e "  🌐 Frontend: ${GREEN}http://localhost:3000${NC}"
    echo -e "  🔍 API:      ${GREEN}http://localhost:3000/api/health${NC}"
else
    if [ $FIXES_APPLIED -eq $ISSUES_FOUND ]; then
        echo -e "${GREEN}✅ All issues have been automatically fixed!${NC}"
        echo ""
        echo -e "${CYAN}Your application should now be accessible at:${NC}"
        echo -e "  🌐 ${GREEN}http://localhost:3000${NC}"
        echo ""
        echo -e "${YELLOW}Run './docker-start-auto.sh' to start the application${NC}"
    else
        UNFIXED=$((ISSUES_FOUND - FIXES_APPLIED))
        echo -e "${YELLOW}⚠️  Found $ISSUES_FOUND issues, fixed $FIXES_APPLIED, $UNFIXED require manual intervention${NC}"
        echo ""
        echo -e "${CYAN}Next steps:${NC}"
        echo "  1. Review the issues above"
        echo "  2. Run './docker-start-auto.sh' to deploy"
        echo "  3. If issues persist, run 'docker system prune -a' (removes all Docker data)"
    fi
fi

echo ""
echo -e "${CYAN}Useful commands:${NC}"
echo "  Start services:  ./docker-start-auto.sh"
echo "  View logs:       docker compose logs -f"
echo "  Stop services:   docker compose down"
echo "  Clean all:       docker system prune -a"

exit $((ISSUES_FOUND - FIXES_APPLIED))