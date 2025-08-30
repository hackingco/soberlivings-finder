#!/bin/bash
# Quick setup script for staging environment

set -e

echo "🚀 Setting up Staging Environment..."

# Create necessary directories
mkdir -p logs backups/staging nginx/ssl-staging monitoring

# Check if .env.staging exists
if [ ! -f .env.staging ]; then
    echo "📝 Creating .env.staging from template..."
    cat > .env.staging << 'EOF'
# Staging Environment Variables
NODE_ENV=staging
NEXT_PUBLIC_ENVIRONMENT=staging

# Database
STAGING_DB_HOST=postgres-staging
STAGING_DB_PORT=5432
STAGING_DB_NAME=soberlivings_staging
STAGING_DB_USER=postgres
STAGING_DB_PASSWORD=staging_password_123
DATABASE_URL=postgresql://postgres:staging_password_123@postgres-staging:5432/soberlivings_staging

# Redis
REDIS_URL=redis://redis-staging:6379

# API Configuration
STAGING_API_URL=http://localhost:3002/api
NEXT_PUBLIC_API_URL=http://localhost:3002/api

# Monitoring
STAGING_GRAFANA_PASSWORD=staging_admin

# Logging
LOG_LEVEL=debug
ENABLE_METRICS=true
ENABLE_TRACING=true

# Security
JWT_SECRET=staging-jwt-secret-key-change-in-production
ENCRYPTION_KEY=staging-encryption-key-change-in-production
EOF
    echo "✅ .env.staging created"
fi

# Generate SSL certificates if not exist
if [ ! -f nginx/ssl-staging/staging.crt ]; then
    echo "🔒 Generating SSL certificates..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/ssl-staging/staging.key \
        -out nginx/ssl-staging/staging.crt \
        -subj "/C=US/ST=State/L=City/O=SoberLivings/CN=staging.soberlivings.com" \
        2>/dev/null
    echo "✅ SSL certificates generated"
fi

echo ""
echo "✨ Staging environment is ready!"
echo ""
echo "To deploy staging, run:"
echo "  ./scripts/deploy-staging.sh"
echo ""
echo "To check status:"
echo "  ./scripts/deploy-staging.sh status"