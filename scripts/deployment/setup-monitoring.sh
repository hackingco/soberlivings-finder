#!/bin/bash
# Monitoring Setup Script - Configure Prometheus, Grafana, and alerting
# Sets up complete observability stack for the deployment

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Log functions
log() { echo -e "${BLUE}[MONITOR]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

# Create monitoring configuration
create_prometheus_config() {
    log "Creating Prometheus configuration..."
    
    mkdir -p "$PROJECT_ROOT/monitoring"
    
    cat > "$PROJECT_ROOT/monitoring/prometheus.staging.yml" << 'EOF'
# Prometheus Configuration for Staging
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    environment: 'staging'

# Alertmanager configuration
alerting:
  alertmanagers:
    - static_configs:
        - targets: []

# Load rules once and periodically evaluate them
rule_files:
  - "alerts.yaml"

# Scrape configurations
scrape_configs:
  # Prometheus itself
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9091']

  # Node application
  - job_name: 'app'
    static_configs:
      - targets: ['app:3002']
    metrics_path: '/api/metrics'
    scrape_interval: 30s

  # PostgreSQL exporter
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  # Redis exporter
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  # Node exporter (system metrics)
  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']

  # Nginx metrics
  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx:9113']
    metrics_path: '/metrics'
EOF
    
    success "Prometheus configuration created"
}

# Create alert rules
create_alert_rules() {
    log "Creating alert rules..."
    
    cat > "$PROJECT_ROOT/monitoring/alerts.yaml" << 'EOF'
groups:
  - name: app_alerts
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is above 5% for 5 minutes"

      - alert: HighResponseTime
        expr: http_request_duration_seconds{quantile="0.95"} > 2
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High response time"
          description: "95th percentile response time is above 2 seconds"

      - alert: DatabaseDown
        expr: up{job="postgres"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "PostgreSQL is down"
          description: "PostgreSQL database is not responding"

      - alert: RedisDown
        expr: up{job="redis"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Redis is down"
          description: "Redis cache is not responding"

      - alert: HighMemoryUsage
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is above 90%"

      - alert: HighCPUUsage
        expr: (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m]))) > 0.8
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage"
          description: "CPU usage is above 80%"
EOF
    
    success "Alert rules created"
}

# Create Grafana dashboards
create_grafana_dashboards() {
    log "Creating Grafana dashboard configurations..."
    
    mkdir -p "$PROJECT_ROOT/monitoring/grafana/dashboards"
    
    cat > "$PROJECT_ROOT/monitoring/grafana/dashboards/app-dashboard.json" << 'EOF'
{
  "dashboard": {
    "title": "SoberLivings Application Dashboard",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])"
          }
        ]
      },
      {
        "title": "Response Time",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))"
          }
        ]
      },
      {
        "title": "Active Users",
        "targets": [
          {
            "expr": "app_active_users"
          }
        ]
      }
    ]
  }
}
EOF
    
    success "Grafana dashboards created"
}

# Deploy monitoring stack
deploy_monitoring() {
    log "Deploying monitoring stack..."
    
    cd "$PROJECT_ROOT"
    
    # Create docker-compose.monitoring.yml if it doesn't exist
    if [ ! -f "docker-compose.monitoring.yml" ]; then
        cat > "docker-compose.monitoring.yml" << 'EOF'
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    volumes:
      - ./monitoring/prometheus.staging.yml:/etc/prometheus/prometheus.yml
      - ./monitoring/alerts.yaml:/etc/prometheus/alerts.yaml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--web.enable-lifecycle'
    ports:
      - "9091:9090"
    networks:
      - monitoring

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=staging_admin
      - GF_INSTALL_PLUGINS=grafana-piechart-panel
    ports:
      - "3003:3000"
    networks:
      - monitoring

  node-exporter:
    image: prom/node-exporter:latest
    container_name: node-exporter
    restart: unless-stopped
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.rootfs=/rootfs'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    expose:
      - 9100
    networks:
      - monitoring

  postgres-exporter:
    image: prometheuscommunity/postgres-exporter
    container_name: postgres-exporter
    environment:
      DATA_SOURCE_NAME: "postgresql://postgres:password@postgres-staging:5432/soberlivings_staging?sslmode=disable"
    expose:
      - 9187
    networks:
      - monitoring

  redis-exporter:
    image: oliver006/redis_exporter
    container_name: redis-exporter
    environment:
      REDIS_ADDR: "redis-staging:6379"
    expose:
      - 9121
    networks:
      - monitoring

networks:
  monitoring:
    driver: bridge

volumes:
  prometheus_data:
  grafana_data:
EOF
    fi
    
    # Start monitoring stack
    docker compose -f docker-compose.monitoring.yml up -d
    
    success "Monitoring stack deployed"
}

# Configure GitHub Actions monitoring
configure_github_monitoring() {
    log "Configuring GitHub Actions monitoring..."
    
    # Add monitoring workflow
    mkdir -p "$PROJECT_ROOT/.github/workflows"
    
    cat > "$PROJECT_ROOT/.github/workflows/monitoring.yml" << 'EOF'
name: Monitoring and Health Checks

on:
  schedule:
    - cron: '*/30 * * * *'  # Every 30 minutes
  workflow_dispatch:

jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - name: Check staging health
        run: |
          response=$(curl -s -o /dev/null -w "%{http_code}" ${{ secrets.STAGING_URL }}/api/health)
          if [ $response -eq 200 ]; then
            echo "✅ Staging is healthy"
          else
            echo "❌ Staging health check failed with status $response"
            exit 1
          fi

      - name: Check production health
        if: github.ref == 'refs/heads/main'
        run: |
          response=$(curl -s -o /dev/null -w "%{http_code}" ${{ secrets.PRODUCTION_URL }}/api/health)
          if [ $response -eq 200 ]; then
            echo "✅ Production is healthy"
          else
            echo "❌ Production health check failed with status $response"
            exit 1
          fi

      - name: Send notification on failure
        if: failure()
        run: |
          if [ -n "${{ secrets.SLACK_WEBHOOK_URL }}" ]; then
            curl -X POST -H 'Content-type: application/json' \
              --data '{"text":"⚠️ Health check failed for SoberLivings!"}' \
              ${{ secrets.SLACK_WEBHOOK_URL }}
          fi
EOF
    
    success "GitHub Actions monitoring configured"
}

# Setup alerting
setup_alerting() {
    log "Setting up alerting..."
    
    read -p "Do you want to configure alerting? (y/n): " setup_alerts
    
    if [ "$setup_alerts" = "y" ]; then
        read -p "Enter Slack webhook URL (or press Enter to skip): " slack_webhook
        if [ ! -z "$slack_webhook" ]; then
            gh secret set SLACK_WEBHOOK_URL --body "$slack_webhook" 2>/dev/null || warning "Could not set Slack webhook"
            success "Slack alerting configured"
        fi
        
        read -p "Enter email for alerts (or press Enter to skip): " alert_email
        if [ ! -z "$alert_email" ]; then
            gh secret set ALERT_EMAIL --body "$alert_email" 2>/dev/null || warning "Could not set alert email"
            success "Email alerting configured"
        fi
    fi
}

# Test monitoring
test_monitoring() {
    log "Testing monitoring setup..."
    
    # Check Prometheus
    if curl -s http://localhost:9091/metrics &> /dev/null; then
        success "✓ Prometheus is accessible"
    else
        warning "✗ Prometheus is not accessible"
    fi
    
    # Check Grafana
    if curl -s http://localhost:3003/api/health &> /dev/null; then
        success "✓ Grafana is accessible"
    else
        warning "✗ Grafana is not accessible"
    fi
    
    log "Access monitoring dashboards:"
    echo "  Prometheus: http://localhost:9091"
    echo "  Grafana: http://localhost:3003 (admin/staging_admin)"
}

# Main execution
main() {
    if [ "${1:-}" = "--auto" ]; then
        create_prometheus_config
        create_alert_rules
        create_grafana_dashboards
        deploy_monitoring
        configure_github_monitoring
        test_monitoring
        success "Monitoring setup complete!"
    else
        log "Interactive monitoring setup"
        create_prometheus_config
        create_alert_rules
        create_grafana_dashboards
        read -p "Deploy monitoring stack now? (y/n): " deploy_now
        if [ "$deploy_now" = "y" ]; then
            deploy_monitoring
        fi
        setup_alerting
        test_monitoring
    fi
}

main "$@"