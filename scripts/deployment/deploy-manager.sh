#!/bin/bash
# Deployment Manager - Interactive deployment control interface
# Handles staging and production deployments with validation

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$PROJECT_ROOT/logs/deploy-$(date +%Y%m%d-%H%M%S).log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Ensure log directory exists
mkdir -p "$PROJECT_ROOT/logs"

# Logging function
log() {
    local level=$1
    shift
    local message="$@"
    echo -e "${!level}[$level]${NC} $message" | tee -a "$LOG_FILE"
}

# Deploy to environment
deploy() {
    local environment=$1
    log BLUE "Deploying to $environment environment..."
    
    case $environment in
        staging)
            deploy_staging
            ;;
        production)
            deploy_production
            ;;
        *)
            log RED "Unknown environment: $environment"
            return 1
            ;;
    esac
}

# Deploy to staging
deploy_staging() {
    log CYAN "Starting staging deployment..."
    
    # Check if staging deployment script exists
    if [ -f "$PROJECT_ROOT/scripts/deploy-staging.sh" ]; then
        bash "$PROJECT_ROOT/scripts/deploy-staging.sh" deploy
    else
        log YELLOW "Using Docker Compose for staging deployment..."
        
        cd "$PROJECT_ROOT"
        
        # Build and start containers
        docker compose -f docker-compose.staging.yml build
        docker compose -f docker-compose.staging.yml up -d
        
        # Wait for services to be ready
        sleep 10
        
        # Run migrations
        docker compose -f docker-compose.staging.yml exec -T app npx prisma migrate deploy
        
        # Health check
        if curl -f http://localhost:3002/api/health &> /dev/null; then
            log GREEN "Staging deployment successful!"
        else
            log RED "Staging health check failed"
            return 1
        fi
    fi
}

# Deploy to production
deploy_production() {
    log CYAN "Starting production deployment..."
    
    # Safety check
    read -p "Are you sure you want to deploy to PRODUCTION? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        log YELLOW "Production deployment cancelled"
        return 0
    fi
    
    cd "$PROJECT_ROOT"
    
    # Create backup first
    log BLUE "Creating backup..."
    mkdir -p backups
    if docker compose exec postgres pg_dump -U postgres soberlivings > "backups/backup-$(date +%Y%m%d-%H%M%S).sql"; then
        log GREEN "Backup created successfully"
    else
        log YELLOW "Could not create backup, continuing anyway..."
    fi
    
    # Build and deploy
    docker compose build --no-cache
    docker compose up -d --force-recreate
    
    # Run migrations
    docker compose exec -T app npx prisma migrate deploy
    
    # Health check
    if curl -f http://localhost:3000/api/health &> /dev/null; then
        log GREEN "Production deployment successful!"
    else
        log RED "Production health check failed"
        return 1
    fi
}

# Validate deployment
validate() {
    local environment=$1
    log BLUE "Validating $environment deployment..."
    
    case $environment in
        staging)
            validate_staging
            ;;
        production)
            validate_production
            ;;
        *)
            log RED "Unknown environment: $environment"
            return 1
            ;;
    esac
}

# Validate staging
validate_staging() {
    log CYAN "Running staging validation tests..."
    
    local failed=0
    
    # Check application health
    if curl -f http://localhost:3002/api/health &> /dev/null; then
        log GREEN "✓ Application health check passed"
    else
        log RED "✗ Application health check failed"
        ((failed++))
    fi
    
    # Check database connection
    if docker compose -f docker-compose.staging.yml exec -T postgres pg_isready &> /dev/null; then
        log GREEN "✓ Database connection successful"
    else
        log RED "✗ Database connection failed"
        ((failed++))
    fi
    
    # Check Redis
    if docker compose -f docker-compose.staging.yml exec -T redis redis-cli ping &> /dev/null; then
        log GREEN "✓ Redis connection successful"
    else
        log RED "✗ Redis connection failed"
        ((failed++))
    fi
    
    # Check monitoring
    if curl -f http://localhost:9091/metrics &> /dev/null; then
        log GREEN "✓ Prometheus metrics available"
    else
        log YELLOW "⚠ Prometheus metrics not available"
    fi
    
    if [ $failed -eq 0 ]; then
        log GREEN "All staging validation tests passed!"
        return 0
    else
        log RED "$failed validation tests failed"
        return 1
    fi
}

# Validate production
validate_production() {
    log CYAN "Running production validation tests..."
    
    local failed=0
    
    # Check application health
    if curl -f http://localhost:3000/api/health &> /dev/null; then
        log GREEN "✓ Application health check passed"
    else
        log RED "✗ Application health check failed"
        ((failed++))
    fi
    
    # Check database
    if docker compose exec -T postgres pg_isready &> /dev/null; then
        log GREEN "✓ Database connection successful"
    else
        log RED "✗ Database connection failed"
        ((failed++))
    fi
    
    # Check Redis
    if docker compose exec -T redis redis-cli ping &> /dev/null; then
        log GREEN "✓ Redis connection successful"
    else
        log RED "✗ Redis connection failed"
        ((failed++))
    fi
    
    # Check API endpoints
    if curl -f http://localhost:3000/api/facilities &> /dev/null; then
        log GREEN "✓ API endpoints responding"
    else
        log RED "✗ API endpoints not responding"
        ((failed++))
    fi
    
    if [ $failed -eq 0 ]; then
        log GREEN "All production validation tests passed!"
        return 0
    else
        log RED "$failed validation tests failed"
        return 1
    fi
}

# Rollback deployment
rollback() {
    local environment=$1
    log YELLOW "Rolling back $environment deployment..."
    
    case $environment in
        staging)
            rollback_staging
            ;;
        production)
            rollback_production
            ;;
        *)
            log RED "Unknown environment: $environment"
            return 1
            ;;
    esac
}

# Rollback staging
rollback_staging() {
    log CYAN "Rolling back staging deployment..."
    
    cd "$PROJECT_ROOT"
    
    # Stop current containers
    docker compose -f docker-compose.staging.yml down
    
    # Restore from previous image
    docker compose -f docker-compose.staging.yml up -d --force-recreate
    
    log GREEN "Staging rollback complete"
}

# Rollback production
rollback_production() {
    log CYAN "Rolling back production deployment..."
    
    # Find latest backup
    local latest_backup=$(ls -t "$PROJECT_ROOT/backups"/*.sql 2>/dev/null | head -n1)
    
    if [ -z "$latest_backup" ]; then
        log RED "No backup found for rollback"
        return 1
    fi
    
    log BLUE "Restoring from backup: $latest_backup"
    
    cd "$PROJECT_ROOT"
    
    # Restore database
    docker compose exec -T postgres psql -U postgres soberlivings < "$latest_backup"
    
    # Restart containers with previous image
    docker compose down
    docker compose up -d
    
    log GREEN "Production rollback complete"
}

# Show deployment status
status() {
    log CYAN "Deployment Status"
    echo "═══════════════════════════════════════"
    
    # Check staging
    echo -e "\n${YELLOW}Staging Environment:${NC}"
    if docker compose -f docker-compose.staging.yml ps 2>/dev/null | grep -q "Up"; then
        echo -e "  Status: ${GREEN}Running${NC}"
        docker compose -f docker-compose.staging.yml ps
    else
        echo -e "  Status: ${RED}Not running${NC}"
    fi
    
    # Check production
    echo -e "\n${YELLOW}Production Environment:${NC}"
    if docker compose ps 2>/dev/null | grep -q "Up"; then
        echo -e "  Status: ${GREEN}Running${NC}"
        docker compose ps
    else
        echo -e "  Status: ${RED}Not running${NC}"
    fi
    
    # Show recent deployments
    echo -e "\n${YELLOW}Recent Deployments:${NC}"
    ls -lt "$PROJECT_ROOT/logs"/deploy-*.log 2>/dev/null | head -5 || echo "  No deployment logs found"
}

# Show menu
show_menu() {
    clear
    echo -e "${CYAN}════════════════════════════════════════${NC}"
    echo -e "${CYAN}     Deployment Manager - SoberLivings   ${NC}"
    echo -e "${CYAN}════════════════════════════════════════${NC}"
    echo
    echo -e "${YELLOW}Select an action:${NC}"
    echo
    echo "  1) 🚀 Deploy to Staging"
    echo "  2) 🔥 Deploy to Production"
    echo "  3) ✅ Validate Staging"
    echo "  4) ✅ Validate Production"
    echo "  5) ↩️  Rollback Staging"
    echo "  6) ↩️  Rollback Production"
    echo "  7) 📊 Show Status"
    echo "  8) 📋 View Logs"
    echo "  9) 🔄 Restart Services"
    echo "  0) Exit"
    echo
    read -p "Enter your choice [0-9]: " choice
}

# Main execution
main() {
    # Check for command line arguments
    if [ $# -gt 0 ]; then
        case "$1" in
            deploy)
                deploy "${2:-staging}"
                ;;
            validate)
                validate "${2:-staging}"
                ;;
            rollback)
                rollback "${2:-staging}"
                ;;
            status)
                status
                ;;
            --help|-h)
                echo "Usage: $0 [COMMAND] [ENVIRONMENT]"
                echo ""
                echo "Commands:"
                echo "  deploy [staging|production]    Deploy to environment"
                echo "  validate [staging|production]  Validate deployment"
                echo "  rollback [staging|production]  Rollback deployment"
                echo "  status                         Show deployment status"
                echo ""
                echo "Without arguments, shows interactive menu"
                exit 0
                ;;
            *)
                log RED "Unknown command: $1"
                exit 1
                ;;
        esac
    else
        # Interactive mode
        while true; do
            show_menu
            case $choice in
                1)
                    deploy staging
                    read -p "Press Enter to continue..."
                    ;;
                2)
                    deploy production
                    read -p "Press Enter to continue..."
                    ;;
                3)
                    validate staging
                    read -p "Press Enter to continue..."
                    ;;
                4)
                    validate production
                    read -p "Press Enter to continue..."
                    ;;
                5)
                    rollback staging
                    read -p "Press Enter to continue..."
                    ;;
                6)
                    rollback production
                    read -p "Press Enter to continue..."
                    ;;
                7)
                    status
                    read -p "Press Enter to continue..."
                    ;;
                8)
                    less "$LOG_FILE"
                    ;;
                9)
                    log BLUE "Restarting services..."
                    docker compose restart
                    log GREEN "Services restarted"
                    read -p "Press Enter to continue..."
                    ;;
                0)
                    exit 0
                    ;;
                *)
                    log RED "Invalid option"
                    read -p "Press Enter to continue..."
                    ;;
            esac
        done
    fi
}

# Run main function
main "$@"