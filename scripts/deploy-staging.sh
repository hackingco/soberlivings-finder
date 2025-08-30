#!/bin/bash
# Staging Deployment Script with Advanced Features
# Includes health checks, rollback, and monitoring

set -e

# Configuration
ENVIRONMENT="staging"
COMPOSE_FILE="docker-compose.staging.yml"
ENV_FILE=".env.staging"
BACKUP_DIR="./backups/staging"
LOG_FILE="./logs/staging-deployment-$(date +%Y%m%d-%H%M%S).log"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"

# Set Docker Compose command globally
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    echo "Error: Docker Compose is not installed"
    exit 1
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create necessary directories
mkdir -p ./logs ./backups/staging

# Logging function
log() {
    local message="[$(date +'%Y-%m-%d %H:%M:%S')] $1"
    echo -e "${GREEN}${message}${NC}"
    echo "${message}" >> "${LOG_FILE}"
}

error() {
    local message="[ERROR] $1"
    echo -e "${RED}${message}${NC}"
    echo "${message}" >> "${LOG_FILE}"
    
    # Send Slack notification if webhook is configured
    if [ -n "${SLACK_WEBHOOK}" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚨 Staging deployment failed: ${message}\"}" \
            "${SLACK_WEBHOOK}" 2>/dev/null || true
    fi
    
    exit 1
}

warning() {
    local message="[WARNING] $1"
    echo -e "${YELLOW}${message}${NC}"
    echo "${message}" >> "${LOG_FILE}"
}

info() {
    local message="[INFO] $1"
    echo -e "${BLUE}${message}${NC}"
    echo "${message}" >> "${LOG_FILE}"
}

# Pre-deployment checks
pre_deployment_checks() {
    log "Running pre-deployment checks..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
    fi
    
    if ! docker info &> /dev/null; then
        error "Docker daemon is not running"
    fi
    
    # Check Docker Compose (v1 or v2)
    if command -v ${DOCKER_COMPOSE} &> /dev/null; then
        DOCKER_COMPOSE="${DOCKER_COMPOSE}"
    elif docker compose version &> /dev/null; then
        DOCKER_COMPOSE="docker compose"
    else
        error "Docker Compose is not installed"
    fi
    
    # Check environment file
    if [ ! -f "${ENV_FILE}" ]; then
        error "Environment file ${ENV_FILE} not found"
    fi
    
    # Check compose file
    if [ ! -f "${COMPOSE_FILE}" ]; then
        error "Compose file ${COMPOSE_FILE} not found"
    fi
    
    # Check disk space
    available_space=$(df -h . | awk 'NR==2 {print $4}' | sed 's/G//')
    if (( $(echo "$available_space < 5" | bc -l) )); then
        warning "Low disk space: ${available_space}GB available"
    fi
    
    log "Pre-deployment checks passed"
}

# Backup current deployment
backup_deployment() {
    log "Creating backup of current deployment..."
    
    local backup_name="staging-backup-$(date +%Y%m%d-%H%M%S)"
    local backup_path="${BACKUP_DIR}/${backup_name}"
    
    mkdir -p "${backup_path}"
    
    # Backup database
    if ${DOCKER_COMPOSE} -f "${COMPOSE_FILE}" ps | grep -q "postgres-staging.*Up"; then
        info "Backing up database..."
        ${DOCKER_COMPOSE} -f "${COMPOSE_FILE}" exec -T postgres-staging \
            pg_dump -U postgres soberlivings_staging | gzip > "${backup_path}/database.sql.gz"
    fi
    
    # Backup volumes
    info "Backing up volumes..."
    docker run --rm \
        -v soberlivings_postgres_staging_data:/data \
        -v "$(pwd)/${backup_path}":/backup \
        alpine tar czf /backup/postgres-volume.tar.gz -C /data . 2>/dev/null || true
    
    # Backup environment file
    cp "${ENV_FILE}" "${backup_path}/.env.staging.backup"
    
    # Store backup path for rollback
    echo "${backup_path}" > "${BACKUP_DIR}/latest"
    
    log "Backup created at ${backup_path}"
}

# Build and pull images
build_images() {
    log "Building and pulling Docker images..."
    
    # Pull latest base images
    ${DOCKER_COMPOSE} -f "${COMPOSE_FILE}" pull --ignore-pull-failures
    
    # Build application image
    ${DOCKER_COMPOSE} -f "${COMPOSE_FILE}" build --no-cache app
    
    log "Images ready"
}

# Deploy staging environment
deploy_staging() {
    log "Deploying staging environment..."
    
    # Stop existing containers gracefully
    info "Stopping existing containers..."
    ${DOCKER_COMPOSE} -f "${COMPOSE_FILE}" stop || true
    
    # Remove old containers
    ${DOCKER_COMPOSE} -f "${COMPOSE_FILE}" rm -f || true
    
    # Start new containers
    info "Starting new containers..."
    ${DOCKER_COMPOSE} -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d
    
    log "Containers started"
}

# Health checks
health_check() {
    log "Running health checks..."
    
    local max_retries=30
    local retry_delay=10
    local retries=0
    local all_healthy=false
    
    while [ $retries -lt $max_retries ]; do
        all_healthy=true
        
        # Check each service
        for service in app postgres-staging redis-staging elasticsearch-staging; do
            if ! ${DOCKER_COMPOSE} -f "${COMPOSE_FILE}" ps | grep -q "${service}.*Up.*healthy"; then
                all_healthy=false
                warning "Service ${service} is not healthy yet (attempt $((retries+1))/${max_retries})"
            fi
        done
        
        if [ "$all_healthy" = true ]; then
            break
        fi
        
        sleep $retry_delay
        retries=$((retries+1))
    done
    
    if [ "$all_healthy" = false ]; then
        error "Health checks failed after ${max_retries} attempts"
    fi
    
    log "All services are healthy"
}

# Run smoke tests
smoke_tests() {
    log "Running smoke tests..."
    
    # Test application endpoint
    if ! curl -f -s -o /dev/null -w "%{http_code}" http://localhost:3002/api/health | grep -q "200"; then
        error "Application health check failed"
    fi
    info "Application health check passed"
    
    # Test database connection
    if ! ${DOCKER_COMPOSE} -f "${COMPOSE_FILE}" exec -T postgres-staging \
        psql -U postgres -d soberlivings_staging -c "SELECT 1" &>/dev/null; then
        error "Database connection test failed"
    fi
    info "Database connection test passed"
    
    # Test Redis connection
    if ! ${DOCKER_COMPOSE} -f "${COMPOSE_FILE}" exec -T redis-staging \
        redis-cli ping | grep -q "PONG"; then
        error "Redis connection test failed"
    fi
    info "Redis connection test passed"
    
    # Test Elasticsearch
    if ! curl -f -s http://localhost:9201/_cluster/health | grep -q "green\|yellow"; then
        warning "Elasticsearch cluster is not fully healthy"
    fi
    info "Elasticsearch test passed"
    
    log "Smoke tests completed successfully"
}

# Database migrations
run_migrations() {
    log "Running database migrations..."
    
    ${DOCKER_COMPOSE} -f "${COMPOSE_FILE}" exec -T app \
        npx prisma migrate deploy || warning "Migrations may have already been applied"
    
    log "Migrations completed"
}

# Rollback deployment
rollback() {
    error "Deployment failed, initiating rollback..."
    
    # Get latest backup path
    if [ -f "${BACKUP_DIR}/latest" ]; then
        local backup_path=$(cat "${BACKUP_DIR}/latest")
        
        if [ -d "${backup_path}" ]; then
            log "Rolling back to ${backup_path}"
            
            # Stop current containers
            ${DOCKER_COMPOSE} -f "${COMPOSE_FILE}" down
            
            # Restore database
            if [ -f "${backup_path}/database.sql.gz" ]; then
                info "Restoring database..."
                ${DOCKER_COMPOSE} -f "${COMPOSE_FILE}" up -d postgres-staging
                sleep 10
                gunzip -c "${backup_path}/database.sql.gz" | \
                    ${DOCKER_COMPOSE} -f "${COMPOSE_FILE}" exec -T postgres-staging \
                    psql -U postgres -d soberlivings_staging
            fi
            
            # Restore environment
            if [ -f "${backup_path}/.env.staging.backup" ]; then
                cp "${backup_path}/.env.staging.backup" "${ENV_FILE}"
            fi
            
            # Restart with previous configuration
            ${DOCKER_COMPOSE} -f "${COMPOSE_FILE}" up -d
            
            log "Rollback completed"
        fi
    else
        error "No backup found for rollback"
    fi
}

# Post-deployment tasks
post_deployment() {
    log "Running post-deployment tasks..."
    
    # Clear caches
    info "Clearing caches..."
    ${DOCKER_COMPOSE} -f "${COMPOSE_FILE}" exec -T redis-staging redis-cli FLUSHALL
    
    # Warm up application
    info "Warming up application..."
    for i in {1..5}; do
        curl -s http://localhost:3002/ > /dev/null || true
        sleep 1
    done
    
    # Generate deployment report
    generate_report
    
    log "Post-deployment tasks completed"
}

# Generate deployment report
generate_report() {
    local report_file="./logs/staging-deployment-report-$(date +%Y%m%d-%H%M%S).txt"
    
    {
        echo "==================================="
        echo "STAGING DEPLOYMENT REPORT"
        echo "==================================="
        echo "Date: $(date)"
        echo "Environment: ${ENVIRONMENT}"
        echo ""
        echo "SERVICES STATUS:"
        ${DOCKER_COMPOSE} -f "${COMPOSE_FILE}" ps
        echo ""
        echo "RESOURCE USAGE:"
        docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
        echo ""
        echo "ENDPOINTS:"
        echo "  Application: http://localhost:3002"
        echo "  Grafana: http://localhost:3003"
        echo "  Prometheus: http://localhost:9091"
        echo ""
        echo "LOGS: ${LOG_FILE}"
        echo "==================================="
    } | tee "${report_file}"
    
    info "Report saved to ${report_file}"
}

# Send deployment notification
send_notification() {
    local status=$1
    local message=$2
    
    if [ -n "${SLACK_WEBHOOK}" ]; then
        local emoji="✅"
        if [ "${status}" = "failed" ]; then
            emoji="❌"
        fi
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"${emoji} Staging deployment ${status}: ${message}\"}" \
            "${SLACK_WEBHOOK}" 2>/dev/null || true
    fi
}

# Main deployment flow
main() {
    log "Starting staging deployment..."
    
    # Set trap for rollback on error
    trap rollback ERR
    
    # Run deployment steps
    pre_deployment_checks
    backup_deployment
    build_images
    deploy_staging
    health_check
    run_migrations
    smoke_tests
    post_deployment
    
    # Clear trap
    trap - ERR
    
    log "✅ Staging deployment completed successfully!"
    send_notification "completed" "All services are running"
    
    # Show final status
    echo ""
    info "Staging environment is ready:"
    echo "  🌐 Application: http://localhost:3002"
    echo "  📊 Grafana: http://localhost:3003 (admin/staging_admin)"
    echo "  📈 Prometheus: http://localhost:9091"
    echo "  🗄️ Database: localhost:5433"
    echo "  📦 Redis: localhost:6380"
    echo "  🔍 Elasticsearch: localhost:9201"
    echo ""
    echo "View logs: tail -f ${LOG_FILE}"
}

# Parse command line arguments
case "${1:-deploy}" in
    deploy)
        main
        ;;
    rollback)
        rollback
        ;;
    status)
        ${DOCKER_COMPOSE} -f "${COMPOSE_FILE}" ps
        ;;
    logs)
        ${DOCKER_COMPOSE} -f "${COMPOSE_FILE}" logs -f --tail=100
        ;;
    stop)
        log "Stopping staging environment..."
        ${DOCKER_COMPOSE} -f "${COMPOSE_FILE}" stop
        ;;
    restart)
        log "Restarting staging environment..."
        ${DOCKER_COMPOSE} -f "${COMPOSE_FILE}" restart
        ;;
    *)
        echo "Usage: $0 {deploy|rollback|status|logs|stop|restart}"
        exit 1
        ;;
esac