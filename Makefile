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
	docker compose -f docker compose.development.yml up -d
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
	docker compose -f docker compose.yml up -d
	@make health
	@echo "Production environment ready!"

# Build all images
build:
	@echo "Building Docker images..."
	docker compose -f docker compose.development.yml build --no-cache

# Run tests
test:
	@echo "Running tests in containers..."
	docker compose -f docker compose.development.yml exec frontend npm test
	docker compose -f docker compose.development.yml exec frontend npm run test:e2e

# Clean up
clean:
	@echo "Stopping containers and cleaning up..."
	docker compose -f docker compose.development.yml down -v
	docker system prune -f
	@echo "Cleanup complete!"

# View logs
logs:
	docker compose -f docker compose.development.yml logs -f

# Open monitoring dashboards
monitor:
	@echo "Opening monitoring dashboards..."
	@open http://localhost:3001 || xdg-open http://localhost:3001 || echo "Grafana: http://localhost:3001"
	@open http://localhost:9090 || xdg-open http://localhost:9090 || echo "Prometheus: http://localhost:9090"

# Database migrations
db-migrate:
	@echo "Running database migrations..."
	docker compose -f docker compose.development.yml exec frontend npx prisma migrate deploy

# Database seeding
db-seed:
	@echo "Seeding database..."
	docker compose -f docker compose.development.yml exec frontend npm run db:seed

# Shell access
shell:
	docker compose -f docker compose.development.yml exec frontend sh

# Health check
health:
	@echo "Checking service health..."
	@docker compose -f docker compose.development.yml ps
	@echo ""
	@echo "Testing endpoints..."
	@curl -sf http://localhost:3000/api/health > /dev/null && echo "✓ Frontend is healthy" || echo "✗ Frontend is not responding"
	@curl -sf http://localhost:9200/_cluster/health > /dev/null && echo "✓ Elasticsearch is healthy" || echo "✗ Elasticsearch is not responding"
	@docker exec soberlivings_postgres_dev pg_isready > /dev/null 2>&1 && echo "✓ PostgreSQL is healthy" || echo "✗ PostgreSQL is not responding"
	@docker exec soberlivings_redis_dev redis-cli ping > /dev/null 2>&1 && echo "✓ Redis is healthy" || echo "✗ Redis is not responding"

# Quick restart
restart:
	@echo "Restarting services..."
	docker compose -f docker compose.development.yml restart

# View frontend logs only
logs-frontend:
	docker compose -f docker compose.development.yml logs -f frontend

# View database logs only
logs-db:
	docker compose -f docker compose.development.yml logs -f postgres

# Backup database
backup:
	@echo "Backing up database..."
	@mkdir -p backups
	docker compose -f docker compose.development.yml exec postgres pg_dump -U postgres soberlivings > backups/backup-$$(date +%Y%m%d-%H%M%S).sql
	@echo "Backup complete!"

# Restore database
restore:
	@echo "Restoring database from latest backup..."
	@docker compose -f docker compose.development.yml exec -T postgres psql -U postgres soberlivings < $$(ls -t backups/*.sql | head -1)
	@echo "Restore complete!"

# ============================================================================
# Environment Switching (Local vs Supabase)
# ============================================================================

# Switch API to use Supabase database
api-env-supabase: ## Point API to Supabase DB
	@echo "Switching to Supabase database..."
	@cp frontend/.env.production.supabase frontend/.env.production
	@cp frontend/.env.production.supabase frontend/.env.local
	@echo "✓ API now targets Supabase. Rebuild/restart your app."
	@echo "  Run: docker compose restart app"

# Switch API to use local Postgres
api-env-local: ## Point API to local Postgres
	@echo "Switching to local PostgreSQL database..."
	@cp frontend/.env.production.localdb frontend/.env.production
	@cp frontend/.env.production.localdb frontend/.env.local
	@echo "✓ API now targets local Postgres. Rebuild/restart your app."
	@echo "  Run: docker compose restart app"

# ============================================================================
# Supabase CLI Operations
# ============================================================================

# Link to Supabase project (requires login)
supabase-link: ## Link to Supabase project
	@echo "Linking to Supabase project..."
	@echo "Note: Requires SUPABASE_ACCESS_TOKEN environment variable or 'supabase login' first"
	supabase link --project-ref acwtjmqtwnijzbioauwn

# Push migrations to Supabase
supabase-push: ## Apply supabase/migrations to remote
	@echo "Pushing migrations to Supabase..."
	supabase db push

# Pull schema from Supabase
supabase-pull: ## Pull remote schema snapshot
	@echo "Pulling schema from Supabase..."
	supabase db pull

# Set Supabase secrets
supabase-secrets: ## Set Supabase secrets (usage: make supabase-secrets KV='KEY=val KEY2=val2')
	@[ -n "${KV}" ] || (echo "Usage: make supabase-secrets KV='KEY=value KEY2=value2'"; exit 1)
	supabase secrets set ${KV}

# Get Supabase connection string
supabase-connection: ## Get Supabase connection string
	@echo "Supabase project info:"
	supabase projects list --linked

# ============================================================================
# Database Migration Sync
# ============================================================================

# Generate SQL from Prisma schema
prisma-to-sql: ## Generate SQL migration from Prisma schema
	@echo "Generating SQL from Prisma schema..."
	@mkdir -p supabase/migrations
	cd frontend && npx prisma migrate diff \
		--from-empty \
		--to-schema-datamodel prisma/schema.prisma \
		--script > ../supabase/migrations/$$(date +%Y%m%d_%H%M%S)_prisma_sync.sql
	@echo "✓ SQL migration generated in supabase/migrations/"

# Deploy Prisma migrations to current database
prisma-deploy: ## Deploy Prisma migrations to current DATABASE_URL
	@echo "Deploying Prisma migrations..."
	cd frontend && npx prisma migrate deploy

# ============================================================================
# Testing Database Connectivity
# ============================================================================

# Test Supabase connection from Docker
test-supabase: ## Test Supabase connectivity from Docker
	@echo "Testing Supabase connection from Docker container..."
	docker compose exec app sh -lc '\
		echo "Checking DNS resolution..." && \
		getent hosts db.acwtjmqtwnijzbioauwn.supabase.co || echo "DNS lookup failed" && \
		echo "\nChecking port connectivity..." && \
		nc -vz db.acwtjmqtwnijzbioauwn.supabase.co 5432 || echo "Port connection failed" && \
		echo "\nCurrent DATABASE_URL:" && \
		echo "$$DATABASE_URL" | sed "s/:[^:]*@/:****@/"'

# Test local Postgres connection
test-local-db: ## Test local PostgreSQL connectivity
	@echo "Testing local PostgreSQL connection..."
	@docker exec soberlivings-staging-postgres pg_isready && echo "✓ Local PostgreSQL is ready" || echo "✗ Local PostgreSQL is not responding"
	@echo "\nTesting from API..."
	@curl -s "http://localhost:3001/api/health" | jq '.' || echo "API not responding"

# ============================================================================
# Quick Setup Commands
# ============================================================================

# Complete local setup
setup-local: ## Complete local environment setup
	@echo "Setting up local environment..."
	@make api-env-local
	@docker compose -f docker compose.staging.yml up -d postgres-staging redis-staging
	@sleep 5
	@cd frontend && npm run db:push
	@cd frontend && npm run db:seed
	@echo "✓ Local environment ready!"

# Complete Supabase setup
setup-supabase: ## Complete Supabase environment setup (requires login)
	@echo "Setting up Supabase environment..."
	@make api-env-supabase
	@make supabase-link
	@make prisma-deploy
	@echo "✓ Supabase environment ready!"

# Seed staging database
seed-staging: ## Seed the current database with test data
	@echo "Seeding database with test facilities..."
	cd frontend && npm run db:seed
	@echo "✓ Database seeded successfully!"

# Show current environment
show-env: ## Show current database environment
	@echo "Current environment configuration:"
	@echo "=================================="
	@grep "^DATABASE_URL" frontend/.env.local | sed 's/PASSWORD=[^@]*/PASSWORD=***/' || echo "DATABASE_URL not set"
	@echo ""
	@if grep -q "^DATABASE_URL.*supabase.co" frontend/.env.local 2>/dev/null; then \
		echo "✓ Currently using: SUPABASE"; \
	else \
		echo "✓ Currently using: LOCAL POSTGRES"; \
	fi