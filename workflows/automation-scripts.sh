#!/bin/bash
# Automation Scripts for Next Steps Workflow
# SPARC Workflow Manager - Executable Scripts

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# =============================================================================
# WORKFLOW 1: Setup Development Environment
# =============================================================================
setup_development() {
    log "Starting development environment setup..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
        exit 1
    fi
    
    # Start services
    log "Starting Docker services..."
    docker compose -f docker-compose.simple.yml up -d
    
    # Wait for health
    log "Waiting for services to be healthy..."
    sleep 10
    
    # Run migrations
    log "Running database migrations..."
    docker exec soberlivings_frontend npx prisma db push
    
    log "✅ Development environment ready!"
    echo "Frontend: http://localhost:3000"
    echo "Database: postgresql://localhost:5432/soberlivings"
}

# =============================================================================
# WORKFLOW 2: Populate Sample Data
# =============================================================================
populate_data() {
    log "Populating database with sample data..."
    
    # Create sample data file
    cat > /tmp/sample-facilities.sql <<EOF
INSERT INTO facilities (id, name, city, state, zip, phone, website, latitude, longitude, services, created_at, updated_at)
VALUES 
    (gen_random_uuid(), 'Sunrise Recovery Center', 'San Francisco', 'CA', '94102', '415-555-0100', 'https://sunriserecovery.com', 37.7749, -122.4194, '{"detox": true, "residential": true, "outpatient": true}'::jsonb, NOW(), NOW()),
    (gen_random_uuid(), 'Bay Area Sober Living', 'Oakland', 'CA', '94612', '510-555-0200', 'https://bayareasober.com', 37.8044, -122.2712, '{"sober_living": true, "counseling": true}'::jsonb, NOW(), NOW()),
    (gen_random_uuid(), 'Golden Gate Treatment', 'San Jose', 'CA', '95113', '408-555-0300', 'https://goldengate-treatment.com', 37.3382, -121.8863, '{"residential": true, "medication_assisted": true}'::jsonb, NOW(), NOW()),
    (gen_random_uuid(), 'Pacific Heights Recovery', 'San Francisco', 'CA', '94115', '415-555-0400', 'https://pacificheights.com', 37.7893, -122.4384, '{"luxury": true, "residential": true, "holistic": true}'::jsonb, NOW(), NOW()),
    (gen_random_uuid(), 'Silicon Valley Recovery', 'Palo Alto', 'CA', '94301', '650-555-0500', 'https://svrecovery.com', 37.4419, -122.1430, '{"intensive_outpatient": true, "tech_professionals": true}'::jsonb, NOW(), NOW());
EOF
    
    # Import data
    docker exec -i soberlivings_postgres psql -U postgres -d soberlivings < /tmp/sample-facilities.sql
    
    # Verify import
    COUNT=$(docker exec soberlivings_postgres psql -U postgres -d soberlivings -t -c "SELECT COUNT(*) FROM facilities;")
    log "✅ Imported $COUNT facilities"
}

# =============================================================================
# WORKFLOW 3: Run Comprehensive Tests
# =============================================================================
run_tests() {
    log "Running comprehensive test suite..."
    
    # API Health Tests
    log "Testing API health endpoints..."
    curl -sf http://localhost:3000/api/health > /dev/null && \
        log "✅ Health endpoint OK" || \
        error "❌ Health endpoint failed"
    
    # Database Tests
    log "Testing database connection..."
    docker exec soberlivings_postgres pg_isready -U postgres && \
        log "✅ Database connection OK" || \
        error "❌ Database connection failed"
    
    # Redis Tests
    log "Testing Redis cache..."
    docker exec soberlivings_redis redis-cli ping > /dev/null && \
        log "✅ Redis cache OK" || \
        error "❌ Redis cache failed"
    
    # Frontend Tests
    log "Testing frontend compilation..."
    curl -sf http://localhost:3000 > /dev/null && \
        log "✅ Frontend serving OK" || \
        error "❌ Frontend serving failed"
    
    log "✅ All tests passed!"
}

# =============================================================================
# WORKFLOW 4: Build for Production
# =============================================================================
build_production() {
    log "Building production containers..."
    
    # Build frontend
    log "Building frontend production image..."
    docker build -f frontend/Dockerfile \
        --target production \
        -t soberlivings/frontend:prod \
        ./frontend
    
    # Optimize images
    log "Optimizing container images..."
    docker image prune -f
    
    # Tag for registry
    log "Tagging images for registry..."
    docker tag soberlivings/frontend:prod soberlivings/frontend:latest
    docker tag soberlivings/frontend:prod soberlivings/frontend:$(date +%Y%m%d)
    
    log "✅ Production build complete!"
}

# =============================================================================
# WORKFLOW 5: Deploy to Staging
# =============================================================================
deploy_staging() {
    log "Deploying to staging environment..."
    
    # Backup current state
    log "Creating backup..."
    docker exec soberlivings_postgres pg_dump -U postgres soberlivings > backup-staging-$(date +%Y%m%d-%H%M%S).sql
    
    # Deploy new version
    log "Deploying new version..."
    docker compose -f docker-compose.staging.yml up -d
    
    # Run migrations
    log "Running migrations..."
    docker exec soberlivings_frontend_staging npx prisma migrate deploy
    
    # Verify deployment
    log "Verifying deployment..."
    sleep 10
    curl -sf http://localhost:3001/api/health || error "Staging deployment failed"
    
    log "✅ Staging deployment complete!"
}

# =============================================================================
# WORKFLOW 6: Monitor Performance
# =============================================================================
monitor_performance() {
    log "Starting performance monitoring..."
    
    while true; do
        # Check CPU usage
        CPU=$(docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}" | tail -n +2)
        
        # Check memory usage
        MEM=$(docker stats --no-stream --format "table {{.Container}}\t{{.MemUsage}}" | tail -n +2)
        
        # Check response times
        RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}\n' http://localhost:3000/api/health)
        
        # Display metrics
        clear
        echo -e "${BLUE}=== Performance Metrics ===${NC}"
        echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
        echo ""
        echo "CPU Usage:"
        echo "$CPU"
        echo ""
        echo "Memory Usage:"
        echo "$MEM"
        echo ""
        echo "API Response Time: ${RESPONSE_TIME}s"
        
        sleep 5
    done
}

# =============================================================================
# MAIN WORKFLOW ORCHESTRATOR
# =============================================================================
main() {
    case "$1" in
        setup)
            setup_development
            ;;
        populate)
            populate_data
            ;;
        test)
            run_tests
            ;;
        build)
            build_production
            ;;
        staging)
            deploy_staging
            ;;
        monitor)
            monitor_performance
            ;;
        all)
            setup_development
            populate_data
            run_tests
            log "✅ Complete workflow executed successfully!"
            ;;
        *)
            echo "Usage: $0 {setup|populate|test|build|staging|monitor|all}"
            echo ""
            echo "Workflows:"
            echo "  setup     - Setup development environment"
            echo "  populate  - Populate sample data"
            echo "  test      - Run comprehensive tests"
            echo "  build     - Build production containers"
            echo "  staging   - Deploy to staging"
            echo "  monitor   - Monitor performance"
            echo "  all       - Run complete workflow"
            exit 1
            ;;
    esac
}

main "$@"