#!/bin/bash
set -euo pipefail

# Health Check Script for SoberLivings Platform

ENVIRONMENT="${1:-production}"
BASE_URL="${PROD_URL:-https://soberlivings.com}"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "Running health checks for $ENVIRONMENT environment..."
echo "Base URL: $BASE_URL"
echo ""

# Track overall health
HEALTH_STATUS=0

# Function to check endpoint
check_endpoint() {
  local endpoint=$1
  local expected_status=${2:-200}
  local description=$3
  
  echo -n "Checking $description... "
  
  response=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${endpoint}")
  
  if [[ "$response" == "$expected_status" ]]; then
    echo -e "${GREEN}✓ OK (${response})${NC}"
  else
    echo -e "${RED}✗ FAILED (${response})${NC}"
    HEALTH_STATUS=1
  fi
}

# Core health checks
echo "Core Health Checks:"
echo "==================="
check_endpoint "/api/health/live" 200 "Liveness probe"
check_endpoint "/api/health/ready" 200 "Readiness probe"
check_endpoint "/api/version" 200 "Version endpoint"
echo ""

# API endpoints
echo "API Endpoints:"
echo "=============="
check_endpoint "/api/v1/facilities?limit=1" 200 "Facilities list"
check_endpoint "/api/v1/facilities/search?q=test&limit=1" 200 "Facility search"
check_endpoint "/api/v1/openapi" 200 "OpenAPI spec"
echo ""

# Database connectivity
echo "Database Health:"
echo "================"
echo -n "Checking database connectivity... "
db_check=$(curl -s "${BASE_URL}/api/health/ready" | grep -o '"database":"[^"]*"' | cut -d'"' -f4)
if [[ "$db_check" == "healthy" ]]; then
  echo -e "${GREEN}✓ Connected${NC}"
else
  echo -e "${RED}✗ Connection failed${NC}"
  HEALTH_STATUS=1
fi

# Redis connectivity
echo -n "Checking Redis connectivity... "
redis_check=$(curl -s "${BASE_URL}/api/health/ready" | grep -o '"redis":"[^"]*"' | cut -d'"' -f4)
if [[ "$redis_check" == "healthy" ]]; then
  echo -e "${GREEN}✓ Connected${NC}"
else
  echo -e "${RED}✗ Connection failed${NC}"
  HEALTH_STATUS=1
fi
echo ""

# Performance metrics
echo "Performance Metrics:"
echo "===================="
echo -n "Checking response time... "
response_time=$(curl -s -o /dev/null -w "%{time_total}" "${BASE_URL}/api/health/live")
response_time_ms=$(echo "$response_time * 1000" | bc | cut -d'.' -f1)

if [[ $response_time_ms -lt 250 ]]; then
  echo -e "${GREEN}✓ ${response_time_ms}ms (< 250ms)${NC}"
else
  echo -e "${YELLOW}⚠ ${response_time_ms}ms (> 250ms)${NC}"
fi

# Check SSL certificate
echo ""
echo "Security Checks:"
echo "================"
echo -n "Checking SSL certificate... "
cert_expiry=$(echo | openssl s_client -servername soberlivings.com -connect soberlivings.com:443 2>/dev/null | openssl x509 -noout -dates 2>/dev/null | grep notAfter | cut -d= -f2)

if [[ -n "$cert_expiry" ]]; then
  echo -e "${GREEN}✓ Valid until $cert_expiry${NC}"
else
  echo -e "${RED}✗ Unable to verify certificate${NC}"
fi

# Check security headers
echo -n "Checking security headers... "
headers=$(curl -sI "${BASE_URL}")
hsts=$(echo "$headers" | grep -i "strict-transport-security")
csp=$(echo "$headers" | grep -i "content-security-policy")

if [[ -n "$hsts" ]]; then
  echo -e "${GREEN}✓ HSTS enabled${NC}"
else
  echo -e "${YELLOW}⚠ HSTS not found${NC}"
fi

# Summary
echo ""
echo "================================"
if [[ $HEALTH_STATUS -eq 0 ]]; then
  echo -e "${GREEN}✓ All health checks passed${NC}"
  
  # Send success metric
  if command -v aws &> /dev/null; then
    aws cloudwatch put-metric-data \
      --namespace "SoberLivings/Health" \
      --metric-name "HealthCheckStatus" \
      --value 1 \
      --dimensions Environment="$ENVIRONMENT"
  fi
else
  echo -e "${RED}✗ Some health checks failed${NC}"
  
  # Send failure metric
  if command -v aws &> /dev/null; then
    aws cloudwatch put-metric-data \
      --namespace "SoberLivings/Health" \
      --metric-name "HealthCheckStatus" \
      --value 0 \
      --dimensions Environment="$ENVIRONMENT"
  fi
fi

exit $HEALTH_STATUS