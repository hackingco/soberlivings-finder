#!/bin/bash
# Docker deployment script with health checks and rollback

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
STACK_NAME="${STACK_NAME:-soberlivings}"
HEALTH_CHECK_RETRIES=30
HEALTH_CHECK_DELAY=10

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check Docker and Docker Compose
check_requirements() {
    log "Checking requirements..."
    
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed"
    fi
    
    if ! docker info &> /dev/null; then
        error "Docker daemon is not running"
    fi
    
    log "Requirements check passed"
}

# Build images
build_images() {
    log "Building Docker images..."
    
    docker-compose -f $COMPOSE_FILE build --no-cache || error "Failed to build images"
    
    log "Images built successfully"
}

# Deploy stack
deploy_stack() {
    log "Deploying stack..."
    
    # Stop existing containers
    docker-compose -f $COMPOSE_FILE down
    
    # Start new containers
    docker-compose -f $COMPOSE_FILE up -d || error "Failed to start containers"
    
    log "Stack deployed"
}

# Health check
health_check() {
    log "Running health checks..."
    
    local retries=0
    local healthy=false
    
    while [ $retries -lt $HEALTH_CHECK_RETRIES ]; do
        if docker-compose -f $COMPOSE_FILE ps | grep -q "unhealthy\|starting"; then
            warning "Some services are not healthy yet. Retry $((retries+1))/$HEALTH_CHECK_RETRIES"
            sleep $HEALTH_CHECK_DELAY
            retries=$((retries+1))
        else
            healthy=true
            break
        fi
    done
    
    if [ "$healthy" = false ]; then
        error "Health check failed after $HEALTH_CHECK_RETRIES retries"
    fi
    
    log "All services are healthy"
}

# Rollback on failure
rollback() {
    error "Deployment failed. Rolling back..."
    
    docker-compose -f $COMPOSE_FILE down
    
    # Restore previous version if backup exists
    if [ -f ".docker-backup/docker-compose.yml" ]; then
        cp .docker-backup/docker-compose.yml $COMPOSE_FILE
        docker-compose -f $COMPOSE_FILE up -d
        log "Rollback completed"
    fi
}

# Backup current configuration
backup_config() {
    log "Backing up current configuration..."
    
    mkdir -p .docker-backup
    cp $COMPOSE_FILE .docker-backup/docker-compose.yml
    
    log "Configuration backed up"
}

# Main deployment flow
main() {
    log "Starting Docker deployment for $STACK_NAME"
    
    # Set trap for rollback on error
    trap rollback ERR
    
    check_requirements
    backup_config
    build_images
    deploy_stack
    health_check
    
    log "Deployment completed successfully!"
    
    # Show running services
    echo ""
    log "Running services:"
    docker-compose -f $COMPOSE_FILE ps
    
    # Show URLs
    echo ""
    log "Access URLs:"
    echo "  Application: http://localhost:3000"
    echo "  Grafana: http://localhost:3001 (admin/admin)"
    echo "  Adminer: http://localhost:8080"
    echo "  Prometheus: http://localhost:9090"
}

# Run main function
main "$@"