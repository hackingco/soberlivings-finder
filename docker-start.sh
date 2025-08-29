#!/bin/bash
# Quick start script for Docker development environment

set -e

echo "🐳 Starting Sober Living Facilities Docker Development Environment"
echo "================================================================"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker Desktop first."
    echo "   Visit: https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

# Create necessary directories
echo "📁 Creating required directories..."
mkdir -p monitoring/grafana-dashboards
mkdir -p nginx/ssl
mkdir -p scripts
mkdir -p frontend/database/migrations

# Check for environment file
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    if [ -f .env.development ]; then
        cp .env.development .env
        echo "✅ Environment file created"
    else
        echo "⚠️  No .env file found. Please create one from .env.development"
    fi
fi

# Build and start containers
echo "🔨 Building Docker images..."
docker compose -f docker-compose.development.yml build

echo "🚀 Starting containers..."
docker compose -f docker-compose.development.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check health status
echo "🏥 Checking service health..."
docker compose -f docker-compose.development.yml ps

echo ""
echo "✅ Docker development environment is ready!"
echo ""
echo "📋 Available services:"
echo "  Frontend:      http://localhost:3000"
echo "  Grafana:       http://localhost:3001 (admin/admin)"
echo "  Adminer:       http://localhost:8080"
echo "  Mailhog:       http://localhost:8025"
echo "  Prometheus:    http://localhost:9090"
echo "  Elasticsearch: http://localhost:9200"
echo ""
echo "📚 Useful commands:"
echo "  View logs:        docker compose -f docker-compose.development.yml logs -f"
echo "  Stop services:    docker compose -f docker-compose.development.yml down"
echo "  Clean everything: docker compose -f docker-compose.development.yml down -v"
echo ""
echo "Or use the Makefile shortcuts:"
echo "  make dev     - Start development"
echo "  make logs    - View logs"
echo "  make clean   - Stop and clean"
echo "  make health  - Check health"