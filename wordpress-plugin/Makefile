# WordPress Plugin Development Makefile
# Quick commands for development workflow

.PHONY: help up down restart logs shell wp test cs stan clean install setup

help: ## Show this help message
	@echo "WordPress Plugin Development Commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

up: ## Start WordPress stack
	docker compose up -d --build
	@echo "WordPress starting at http://localhost:8080"
	@echo "phpMyAdmin at http://localhost:8081"
	@echo "MailHog at http://localhost:8025"

down: ## Stop WordPress stack
	docker compose down

restart: ## Restart WordPress stack
	docker compose restart

logs: ## Follow WordPress logs
	docker compose logs -f wordpress

shell: ## Open bash shell in WordPress container
	docker compose exec wordpress bash

wp: ## Run WP-CLI command (usage: make wp CMD="plugin list")
	docker compose exec wordpress wp $(CMD)

test: ## Run PHPUnit tests
	docker compose exec wordpress bash -c "cd /var/www/html/wp-content/plugins/sober-living-portal && vendor/bin/phpunit"

cs: ## Run PHP CodeSniffer
	docker compose exec wordpress bash -c "cd /var/www/html/wp-content/plugins/sober-living-portal && vendor/bin/phpcs --standard=WordPress --extensions=php ."

cs-fix: ## Auto-fix PHP CodeSniffer issues
	docker compose exec wordpress bash -c "cd /var/www/html/wp-content/plugins/sober-living-portal && vendor/bin/phpcbf --standard=WordPress --extensions=php ."

stan: ## Run PHPStan analysis
	docker compose exec wordpress bash -c "cd /var/www/html/wp-content/plugins/sober-living-portal && vendor/bin/phpstan analyse -l 7 ."

clean: ## Clean up volumes and containers
	docker compose down -v
	@echo "Cleaned up WordPress stack and volumes"

install: ## Install Composer dependencies in plugin
	docker compose exec wordpress bash -c "cd /var/www/html/wp-content/plugins/sober-living-portal && composer install"

setup: ## Initial setup after first run
	@echo "Setting up WordPress..."
	docker compose exec wordpress bash -c "wp core install --url=http://localhost:8080 --title='Sober Living Dev' --admin_user=admin --admin_password=admin --admin_email=admin@example.com --skip-email"
	docker compose exec wordpress wp plugin activate sober-living-portal
	docker compose exec wordpress wp theme install twentytwentyfour --activate
	@echo "Setup complete! Login at http://localhost:8080/wp-admin"
	@echo "Username: admin"
	@echo "Password: admin"

db-export: ## Export database
	docker compose exec db mysqldump -u root -proot_secure_2024 wordpress > backup-$$(date +%Y%m%d-%H%M%S).sql

db-import: ## Import database (usage: make db-import FILE=backup.sql)
	docker compose exec -T db mysql -u root -proot_secure_2024 wordpress < $(FILE)

plugin-zip: ## Create plugin ZIP for distribution
	cd plugins && zip -r sober-living-portal.zip sober-living-portal -x "*/vendor/*" "*/node_modules/*" "*/.git/*" "*/tests/*"
	@echo "Plugin ZIP created: plugins/sober-living-portal.zip"

install: ## Composer install inside plugin
	@docker compose exec wordpress bash -lc 'cd wp-content/plugins/sober-living-portal && composer install'

activate: ## Activate plugin via WP-CLI
	@docker compose exec wordpress wp plugin activate sober-living-portal --allow-root

page: ## Create demo page with shortcode
	@docker compose exec wordpress wp post create --post_type=page --post_title="Sober Facilities" --post_status=publish --post_content='[sober_facility_search state="CA"]' --allow-root

permalinks: ## Set pretty permalinks
	@docker compose exec wordpress bash -lc "wp rewrite structure '/%postname%/' --hard --allow-root && wp rewrite flush --hard --allow-root"

xdebug-on: ## Enable Xdebug (optional)
	@docker compose exec wordpress bash -lc 'docker-php-ext-enable xdebug && apachectl -k restart || true'

seed-staging: ## Seed staging database with test facilities
	@echo "Seeding staging database with California facilities..."
	@cd ../frontend && export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/soberlivings_staging?schema=public&sslmode=disable" && npx prisma db seed
	@echo "Database seeded successfully!"

test-api: ## Test API connectivity from WordPress
	@echo "Testing API from WordPress container..."
	@docker compose exec wordpress curl -s "http://host.docker.internal:3001/api/v1/facilities?state=CA&limit=3" | jq '.'

verify-integration: ## Verify WordPress-API integration
	@echo "Checking WordPress plugin status..."
	@docker compose exec wordpress wp plugin list --allow-root | grep sober
	@echo "\nTesting API from WordPress..."
	@docker compose exec wordpress curl -s "http://host.docker.internal:3001/api/v1/facilities?state=CA&limit=2" | jq '.facilities[].name'
	@echo "\nIntegration verified!"