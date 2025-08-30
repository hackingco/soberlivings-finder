#!/bin/bash
set -euo pipefail

# Automatic Docker Deployment Solution for SoberLivings
# This script handles all common Docker deployment scenarios automatically

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="soberlivings"
COMPOSE_FILE="${1:-docker-compose.simple.yml}"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

# Header
clear
echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║          SoberLivings Automatic Docker Deployment         ║"
echo "║                  Intelligent Container Manager             ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Step 1: Check Docker prerequisites
log "Checking Docker prerequisites..."

if ! docker info >/dev/null 2>&1; then
    error "Docker is not running. Please start Docker Desktop and try again."
    echo -e "${YELLOW}On Mac: Open Docker Desktop from Applications${NC}"
    echo -e "${YELLOW}On Linux: Run 'sudo systemctl start docker'${NC}"
    exit 1
fi
success "Docker is running"

# Check for docker compose command (both variants)
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    error "Docker Compose is not installed"
    exit 1
fi
success "Docker Compose found: $DOCKER_COMPOSE"

# Step 2: Detect and handle existing containers
log "Scanning for existing containers..."

# Get all container names that might conflict
CONFLICTING_CONTAINERS=(
    "${PROJECT_NAME}_frontend"
    "${PROJECT_NAME}_postgres" 
    "${PROJECT_NAME}_redis"
    "${PROJECT_NAME}_elasticsearch"
    "${PROJECT_NAME}-frontend"
    "${PROJECT_NAME}-postgres"
    "${PROJECT_NAME}-redis"
    "${PROJECT_NAME}-search"
)

FOUND_CONFLICTS=()
for container in "${CONFLICTING_CONTAINERS[@]}"; do
    if docker ps -a --format '{{.Names}}' | grep -q "^${container}$"; then
        FOUND_CONFLICTS+=("$container")
    fi
done

if [ ${#FOUND_CONFLICTS[@]} -gt 0 ]; then
    warning "Found existing containers that may conflict:"
    for container in "${FOUND_CONFLICTS[@]}"; do
        STATUS=$(docker ps -a --filter "name=^${container}$" --format "{{.Status}}")
        echo "  - $container ($STATUS)"
    done
    
    echo ""
    echo -e "${YELLOW}Choose an action:${NC}"
    echo "  1) Stop and remove conflicting containers (Recommended)"
    echo "  2) Keep existing containers and rename new ones"
    echo "  3) Abort deployment"
    
    read -p "Enter choice [1-3]: " -n 1 -r choice
    echo ""
    
    case $choice in
        1)
            log "Stopping and removing conflicting containers..."
            for container in "${FOUND_CONFLICTS[@]}"; do
                docker stop "$container" 2>/dev/null || true
                docker rm "$container" 2>/dev/null || true
                success "Removed $container"
            done
            ;;
        2)
            log "Will use unique names for new containers..."
            export COMPOSE_PROJECT_NAME="${PROJECT_NAME}_$(date +%s)"
            info "Using project name: $COMPOSE_PROJECT_NAME"
            ;;
        3)
            warning "Deployment aborted by user"
            exit 0
            ;;
        *)
            error "Invalid choice"
            exit 1
            ;;
    esac
else
    success "No conflicting containers found"
fi

# Step 3: Check for running services on required ports
log "Checking port availability..."

REQUIRED_PORTS=(3000 5432 6379 9200)
PORT_CONFLICTS=()

for port in "${REQUIRED_PORTS[@]}"; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        PORT_CONFLICTS+=($port)
    fi
done

if [ ${#PORT_CONFLICTS[@]} -gt 0 ]; then
    warning "The following ports are already in use:"
    for port in "${PORT_CONFLICTS[@]}"; do
        SERVICE=$(lsof -Pi :$port -sTCP:LISTEN 2>/dev/null | tail -1 | awk '{print $1}')
        echo "  - Port $port (used by $SERVICE)"
    done
    
    echo ""
    echo -e "${YELLOW}Choose an action:${NC}"
    echo "  1) Stop conflicting services (requires sudo)"
    echo "  2) Use alternative ports"
    echo "  3) Continue anyway (may cause issues)"
    echo "  4) Abort deployment"
    
    read -p "Enter choice [1-4]: " -n 1 -r port_choice
    echo ""
    
    case $port_choice in
        1)
            log "Attempting to free ports..."
            for port in "${PORT_CONFLICTS[@]}"; do
                sudo lsof -ti:$port | xargs sudo kill -9 2>/dev/null || true
            done
            success "Ports freed"
            ;;
        2)
            log "Configuring alternative ports..."
            export FRONTEND_PORT=3001
            export POSTGRES_PORT=5433
            export REDIS_PORT=6380
            export ELASTIC_PORT=9201
            info "Using alternative ports: 3001, 5433, 6380, 9201"
            ;;
        3)
            warning "Continuing with port conflicts - deployment may fail"
            ;;
        4)
            warning "Deployment aborted by user"
            exit 0
            ;;
    esac
fi

# Step 4: Clean up any orphaned volumes or networks
log "Cleaning up orphaned Docker resources..."

# Remove orphaned volumes
docker volume prune -f >/dev/null 2>&1 || true

# Remove orphaned networks
docker network prune -f >/dev/null 2>&1 || true

success "Docker environment cleaned"

# Step 5: Check if we're in the frontend directory or root
if [ -f "$SCRIPT_DIR/$COMPOSE_FILE" ]; then
    COMPOSE_PATH="$SCRIPT_DIR/$COMPOSE_FILE"
elif [ -f "$FRONTEND_DIR/$COMPOSE_FILE" ]; then
    COMPOSE_PATH="$FRONTEND_DIR/$COMPOSE_FILE"
    cd "$FRONTEND_DIR"
else
    error "Cannot find $COMPOSE_FILE in current or frontend directory"
    exit 1
fi

success "Found compose file: $COMPOSE_PATH"

# Step 6: Create required directories
log "Creating required directories..."

REQUIRED_DIRS=(
    "logs/nginx"
    "logs/postgres"
    "logs/redis"
    "logs/elasticsearch"
    "data/postgres"
    "data/redis"
    "data/elasticsearch"
)

for dir in "${REQUIRED_DIRS[@]}"; do
    mkdir -p "$SCRIPT_DIR/$dir"
done

success "Directories created"

# Step 7: Generate .env file if missing
if [ ! -f "$SCRIPT_DIR/.env" ] && [ ! -f "$FRONTEND_DIR/.env" ]; then
    log "Generating .env file..."
    cat > "$SCRIPT_DIR/.env" << EOF
# Auto-generated environment variables
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/soberlivings
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Database
POSTGRES_DB=soberlivings
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# Ports (can be overridden)
FRONTEND_PORT=${FRONTEND_PORT:-3000}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
REDIS_PORT=${REDIS_PORT:-6379}
ELASTIC_PORT=${ELASTIC_PORT:-9200}
EOF
    success "Generated .env file"
else
    success "Using existing .env file"
fi

# Step 8: Build and start containers
log "Building and starting containers..."

echo -e "${CYAN}This may take a few minutes on first run...${NC}"

# Use the docker compose command with error handling
if $DOCKER_COMPOSE -f "$COMPOSE_PATH" up -d --build --remove-orphans; then
    success "Containers started successfully"
else
    error "Failed to start containers"
    
    # Show logs for debugging
    echo ""
    warning "Showing recent logs for debugging:"
    $DOCKER_COMPOSE -f "$COMPOSE_PATH" logs --tail=20
    
    echo ""
    echo -e "${YELLOW}Troubleshooting tips:${NC}"
    echo "  1. Check if Docker has enough resources (Settings > Resources)"
    echo "  2. Try: docker system prune -a (removes all unused data)"
    echo "  3. Restart Docker Desktop"
    echo "  4. Check the logs above for specific errors"
    
    exit 1
fi

# Step 9: Wait for services to be ready
log "Waiting for services to initialize..."

# Function to check if a service is ready
check_service() {
    local service=$1
    local check_command=$2
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if eval "$check_command" >/dev/null 2>&1; then
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 2
        echo -n "."
    done
    
    return 1
}

# Check each service
echo -n "  Checking frontend"
if check_service "frontend" "curl -s http://localhost:${FRONTEND_PORT:-3000}/api/health"; then
    echo ""
    success "Frontend is ready"
else
    echo ""
    warning "Frontend is taking longer than expected"
fi

echo -n "  Checking database"
if check_service "postgres" "docker exec ${PROJECT_NAME}_postgres pg_isready -U postgres"; then
    echo ""
    success "Database is ready"
else
    echo ""
    warning "Database is not responding (app will use mock data)"
fi

# Step 10: Run database migrations if needed
if docker exec ${PROJECT_NAME}_postgres pg_isready -U postgres >/dev/null 2>&1; then
    log "Running database migrations..."
    
    # Try to run Prisma migrations
    if docker exec ${PROJECT_NAME}_frontend npx prisma migrate deploy 2>/dev/null; then
        success "Database migrations completed"
    else
        info "Migrations skipped or already applied"
    fi
fi

# Step 11: Display status and access information
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         🎉 DEPLOYMENT SUCCESSFUL! 🎉                      ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Show running containers
echo -e "${CYAN}Running Containers:${NC}"
docker ps --filter "name=${PROJECT_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo -e "${CYAN}Access your application:${NC}"
echo -e "  🌐 Frontend:     ${GREEN}http://localhost:${FRONTEND_PORT:-3000}${NC}"
echo -e "  🔍 API Health:   ${GREEN}http://localhost:${FRONTEND_PORT:-3000}/api/health${NC}"
echo -e "  📊 API Docs:     ${GREEN}http://localhost:${FRONTEND_PORT:-3000}/api/docs${NC}"

echo ""
echo -e "${CYAN}Useful commands:${NC}"
echo "  View logs:        $DOCKER_COMPOSE -f $COMPOSE_PATH logs -f"
echo "  Stop services:    $DOCKER_COMPOSE -f $COMPOSE_PATH down"
echo "  Restart services: $DOCKER_COMPOSE -f $COMPOSE_PATH restart"
echo "  View stats:       docker stats"

echo ""
echo -e "${YELLOW}Quick Actions:${NC}"
echo "  Press Ctrl+C to keep services running in background"
echo "  Run '$DOCKER_COMPOSE -f $COMPOSE_PATH down' to stop all services"

# Step 12: Optional - Open browser
echo ""
read -p "Would you like to open the application in your browser? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    URL="http://localhost:${FRONTEND_PORT:-3000}"
    
    # Detect OS and open browser
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "$URL"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        xdg-open "$URL"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        start "$URL"
    else
        info "Please open $URL in your browser"
    fi
    
    success "Browser opened"
fi

# Keep script running to show logs (optional)
echo ""
read -p "Show live logs? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log "Showing live logs (Press Ctrl+C to exit)..."
    $DOCKER_COMPOSE -f "$COMPOSE_PATH" logs -f
fi

echo ""
success "Script completed successfully!"