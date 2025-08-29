# Makefile for Sober Living Facilities Finder
# Production-grade development workflow commands

.PHONY: help dev prod build test clean logs monitor

# Default target
help:
	@echo "Sober Living Facilities - Docker Development Workflow"
	@echo ""
	@echo "Available commands:"
	@echo "  make dev        - Start development environment"
	@echo "  make prod       - Start production-like environment"
	@echo "  make build      - Build all Docker images"
	@echo "  make test       - Run all tests in containers"
	@echo "  make clean      - Stop containers and clean volumes"
	@echo "  make logs       - Show container logs"
	@echo "  make monitor    - Open monitoring dashboards"
	@echo "  make db-migrate - Run database migrations"
	@echo "  make db-seed    - Seed database with sample data"
	@echo "  make shell      - Open shell in frontend container"
	@echo "  make health     - Check health of all services"
	@echo ""

# Development environment
dev:
	@echo "Starting development environment..."
	docker-compose -f docker-compose.development.yml up -d
	@echo "Waiting for services to be healthy..."
	@sleep 10
	@make health
	@echo ""
	@echo "Development environment ready!"
	@echo "  Frontend:      http://localhost:3000"
	@echo "  Grafana:       http://localhost:3001 (admin/admin)"
	@echo "  Adminer:       http://localhost:8080"
	@echo "  Mailhog:       http://localhost:8025"
	@echo "  Prometheus:    http://localhost:9090"
	@echo "  Elasticsearch: http://localhost:9200"
	@echo ""

# Production-like environment
prod:
	@echo "Starting production environment..."
	docker-compose -f docker-compose.yml up -d
	@make health
	@echo "Production environment ready!"

# Build all images
build:
	@echo "Building Docker images..."
	docker-compose -f docker-compose.development.yml build --no-cache

# Run tests
test:
	@echo "Running tests in containers..."
	docker-compose -f docker-compose.development.yml exec frontend npm test
	docker-compose -f docker-compose.development.yml exec frontend npm run test:e2e

# Clean up
clean:
	@echo "Stopping containers and cleaning up..."
	docker-compose -f docker-compose.development.yml down -v
	docker system prune -f
	@echo "Cleanup complete!"

# View logs
logs:
	docker-compose -f docker-compose.development.yml logs -f

# Open monitoring dashboards
monitor:
	@echo "Opening monitoring dashboards..."
	@open http://localhost:3001 || xdg-open http://localhost:3001 || echo "Grafana: http://localhost:3001"
	@open http://localhost:9090 || xdg-open http://localhost:9090 || echo "Prometheus: http://localhost:9090"

# Database migrations
db-migrate:
	@echo "Running database migrations..."
	docker-compose -f docker-compose.development.yml exec frontend npx prisma migrate deploy

# Database seeding
db-seed:
	@echo "Seeding database..."
	docker-compose -f docker-compose.development.yml exec frontend npm run db:seed

# Shell access
shell:
	docker-compose -f docker-compose.development.yml exec frontend sh

# Health check
health:
	@echo "Checking service health..."
	@docker-compose -f docker-compose.development.yml ps
	@echo ""
	@echo "Testing endpoints..."
	@curl -sf http://localhost:3000/api/health > /dev/null && echo "✓ Frontend is healthy" || echo "✗ Frontend is not responding"
	@curl -sf http://localhost:9200/_cluster/health > /dev/null && echo "✓ Elasticsearch is healthy" || echo "✗ Elasticsearch is not responding"
	@docker exec soberlivings_postgres_dev pg_isready > /dev/null 2>&1 && echo "✓ PostgreSQL is healthy" || echo "✗ PostgreSQL is not responding"
	@docker exec soberlivings_redis_dev redis-cli ping > /dev/null 2>&1 && echo "✓ Redis is healthy" || echo "✗ Redis is not responding"

# Quick restart
restart:
	@echo "Restarting services..."
	docker-compose -f docker-compose.development.yml restart

# View frontend logs only
logs-frontend:
	docker-compose -f docker-compose.development.yml logs -f frontend

# View database logs only
logs-db:
	docker-compose -f docker-compose.development.yml logs -f postgres

# Backup database
backup:
	@echo "Backing up database..."
	@mkdir -p backups
	docker-compose -f docker-compose.development.yml exec postgres pg_dump -U postgres soberlivings > backups/backup-$$(date +%Y%m%d-%H%M%S).sql
	@echo "Backup complete!"

# Restore database
restore:
	@echo "Restoring database from latest backup..."
	@docker-compose -f docker-compose.development.yml exec -T postgres psql -U postgres soberlivings < $$(ls -t backups/*.sql | head -1)
	@echo "Restore complete!"