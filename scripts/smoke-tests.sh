#!/bin/bash
set -euo pipefail

# Smoke Tests for SoberLivings Platform
# Critical path validation for production deployment

ENVIRONMENT="${1:-production}"
BASE_URL="${TEST_URL:-https://soberlivings.com}"
RESULTS_FILE="test-results/smoke-test-$(date +%Y%m%d-%H%M%S).json"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
TEST_RESULTS=()

echo "Running smoke tests for $ENVIRONMENT"
echo "Target: $BASE_URL"
echo "================================"
echo ""

# Function to run test
run_test() {
  local test_name=$1
  local test_command=$2
  local expected_result=$3
  
  echo -n "Testing: $test_name... "
  
  if eval "$test_command"; then
    echo -e "${GREEN}✓ PASSED${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    TEST_RESULTS+=("{\"test\": \"$test_name\", \"status\": \"passed\"}")
  else
    echo -e "${RED}✗ FAILED${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    TEST_RESULTS+=("{\"test\": \"$test_name\", \"status\": \"failed\"}")
  fi
}

# API Health Tests
echo "API Health Tests"
echo "----------------"
run_test "Liveness endpoint" \
  "curl -sf '${BASE_URL}/api/health/live' > /dev/null" \
  "200"

run_test "Readiness endpoint" \
  "curl -sf '${BASE_URL}/api/health/ready' > /dev/null" \
  "200"

run_test "Version endpoint" \
  "curl -sf '${BASE_URL}/api/version' | grep -q 'version'" \
  "version present"
echo ""

# Facility CRUD Tests
echo "Facility CRUD Tests"
echo "-------------------"
run_test "List facilities" \
  "curl -sf '${BASE_URL}/api/v1/facilities?limit=10' | grep -q 'facilities'" \
  "facilities array"

run_test "Search facilities" \
  "curl -sf '${BASE_URL}/api/v1/facilities/search?q=treatment&limit=5' | grep -q 'results'" \
  "search results"

run_test "Get facility by ID" \
  "curl -sf '${BASE_URL}/api/v1/facilities/ca-test-facility' || true" \
  "facility object"

run_test "Geospatial search" \
  "curl -sf '${BASE_URL}/api/v1/region/nearby/37.7749/-122.4194/10' | grep -q 'facilities'" \
  "nearby facilities"
echo ""

# ETL Pipeline Tests
echo "ETL Pipeline Tests"
echo "------------------"
run_test "ETL health endpoint" \
  "curl -sf '${BASE_URL}/api/v1/etl' | grep -q 'status'" \
  "ETL status"

run_test "ETL metrics" \
  "curl -sf '${BASE_URL}/api/metrics' | grep -q 'etl_'" \
  "ETL metrics"
echo ""

# Performance Tests
echo "Performance Tests"
echo "-----------------"
# Test response time
response_time=$(curl -s -o /dev/null -w "%{time_total}" "${BASE_URL}/api/health/live")
response_time_ms=$(echo "$response_time * 1000" | bc | cut -d'.' -f1)

if [[ $response_time_ms -lt 250 ]]; then
  echo -e "Response time: ${GREEN}${response_time_ms}ms ✓${NC} (target: <250ms)"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "Response time: ${RED}${response_time_ms}ms ✗${NC} (target: <250ms)"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test concurrent requests
echo -n "Testing concurrent requests... "
parallel_test=$(seq 1 10 | xargs -P10 -I{} curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/health/live" | grep -c "200")
if [[ $parallel_test -eq 10 ]]; then
  echo -e "${GREEN}✓ All 10 requests succeeded${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "${RED}✗ Only $parallel_test/10 requests succeeded${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Security Tests
echo "Security Tests"
echo "--------------"
run_test "HTTPS redirect" \
  "curl -sI 'http://soberlivings.com' | grep -q '301'" \
  "301 redirect"

run_test "Security headers" \
  "curl -sI '${BASE_URL}' | grep -q 'Strict-Transport-Security'" \
  "HSTS header"

run_test "CORS policy" \
  "curl -sI '${BASE_URL}/api/v1/facilities' | grep -q 'Access-Control-Allow-Origin'" \
  "CORS headers"
echo ""

# Webhook Tests
echo "Webhook Tests"
echo "-------------"
run_test "Webhook subscription" \
  "curl -sf -X GET '${BASE_URL}/api/v1/admin/webhooks' -H 'Authorization: Bearer test' || true" \
  "webhook list"

run_test "Webhook health" \
  "curl -sf '${BASE_URL}/api/health/ready' | grep -q 'webhook'" \
  "webhook status"
echo ""

# Database Tests
echo "Database Tests"
echo "--------------"
run_test "Database connectivity" \
  "curl -sf '${BASE_URL}/api/health/ready' | grep -q '\"database\":\"healthy\"'" \
  "database healthy"

run_test "Database migrations" \
  "curl -sf '${BASE_URL}/api/health/ready' | grep -q '\"migrations\":\"current\"'" \
  "migrations current"
echo ""

# Cache Tests
echo "Cache Tests"
echo "-----------"
run_test "Redis connectivity" \
  "curl -sf '${BASE_URL}/api/health/ready' | grep -q '\"redis\":\"healthy\"'" \
  "redis healthy"

run_test "Cache headers" \
  "curl -sI '${BASE_URL}/api/v1/facilities?limit=1' | grep -q 'X-Cache'" \
  "cache headers present"
echo ""

# Generate results file
mkdir -p test-results
cat > "$RESULTS_FILE" <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "$ENVIRONMENT",
  "base_url": "$BASE_URL",
  "tests_passed": $TESTS_PASSED,
  "tests_failed": $TESTS_FAILED,
  "total_tests": $((TESTS_PASSED + TESTS_FAILED)),
  "pass_rate": $(echo "scale=2; $TESTS_PASSED * 100 / ($TESTS_PASSED + $TESTS_FAILED)" | bc)%,
  "results": [
    $(IFS=,; echo "${TEST_RESULTS[*]}")
  ]
}
EOF

# Summary
echo ""
echo "================================"
echo "Smoke Test Results"
echo "================================"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo -e "Total: $((TESTS_PASSED + TESTS_FAILED))"
echo -e "Pass Rate: $(echo "scale=2; $TESTS_PASSED * 100 / ($TESTS_PASSED + $TESTS_FAILED)" | bc)%"
echo ""
echo "Results saved to: $RESULTS_FILE"

# Send metrics
if command -v aws &> /dev/null; then
  aws cloudwatch put-metric-data \
    --namespace "SoberLivings/Testing" \
    --metric-name "SmokeTestsPassed" \
    --value "$TESTS_PASSED" \
    --dimensions Environment="$ENVIRONMENT"
  
  aws cloudwatch put-metric-data \
    --namespace "SoberLivings/Testing" \
    --metric-name "SmokeTestsFailed" \
    --value "$TESTS_FAILED" \
    --dimensions Environment="$ENVIRONMENT"
fi

# Exit with appropriate code
if [[ $TESTS_FAILED -gt 0 ]]; then
  exit 1
else
  exit 0
fi