#!/bin/bash
set -euo pipefail

# Blue-Green Deployment Script
# Provides zero-downtime deployments with automatic rollback capability

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DEPLOY_TIMEOUT=300  # 5 minutes
HEALTH_CHECK_RETRIES=10
HEALTH_CHECK_INTERVAL=10
ROLLBACK_WINDOW=300  # 5 minutes

# Parse arguments
VERSION=""
STRATEGY="blue-green"
ENVIRONMENT="production"
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --version)
      VERSION="$2"
      shift 2
      ;;
    --strategy)
      STRATEGY="$2"
      shift 2
      ;;
    --environment)
      ENVIRONMENT="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Validate inputs
if [[ -z "$VERSION" ]]; then
  echo -e "${RED}Error: Version is required${NC}"
  exit 1
fi

echo -e "${BLUE}Starting ${STRATEGY} deployment${NC}"
echo "Version: $VERSION"
echo "Environment: $ENVIRONMENT"
echo "Strategy: $STRATEGY"
echo "Dry Run: $DRY_RUN"
echo ""

# Function to check service health
check_health() {
  local target=$1
  local url="https://${target}.soberlivings.com/api/health/ready"
  
  echo -e "${YELLOW}Checking health of ${target}...${NC}"
  
  for i in $(seq 1 $HEALTH_CHECK_RETRIES); do
    if curl -sf "$url" > /dev/null; then
      echo -e "${GREEN}✓ ${target} is healthy${NC}"
      return 0
    fi
    echo "  Attempt $i/$HEALTH_CHECK_RETRIES failed, waiting ${HEALTH_CHECK_INTERVAL}s..."
    sleep $HEALTH_CHECK_INTERVAL
  done
  
  echo -e "${RED}✗ ${target} health check failed${NC}"
  return 1
}

# Function to get current active environment
get_active_environment() {
  local active=$(aws elbv2 describe-target-groups \
    --names "soberlivings-${ENVIRONMENT}-active" \
    --query 'TargetGroups[0].Tags[?Key==`Environment`].Value' \
    --output text 2>/dev/null || echo "blue")
  echo "$active"
}

# Function to deploy to target environment
deploy_to_environment() {
  local target=$1
  
  echo -e "${BLUE}Deploying version $VERSION to ${target} environment${NC}"
  
  if [[ "$DRY_RUN" == "true" ]]; then
    echo -e "${YELLOW}[DRY RUN] Would deploy to ${target}${NC}"
    return 0
  fi
  
  # Update ECS service with new image
  aws ecs update-service \
    --cluster "soberlivings-${ENVIRONMENT}" \
    --service "soberlivings-${target}" \
    --task-definition "soberlivings-app:${VERSION}" \
    --force-new-deployment
  
  # Wait for deployment to stabilize
  echo "Waiting for deployment to stabilize..."
  aws ecs wait services-stable \
    --cluster "soberlivings-${ENVIRONMENT}" \
    --services "soberlivings-${target}"
  
  echo -e "${GREEN}✓ Deployment to ${target} complete${NC}"
}

# Function to switch traffic
switch_traffic() {
  local from=$1
  local to=$2
  local percentage=${3:-100}
  
  echo -e "${BLUE}Switching traffic: ${from} → ${to} (${percentage}%)${NC}"
  
  if [[ "$DRY_RUN" == "true" ]]; then
    echo -e "${YELLOW}[DRY RUN] Would switch traffic to ${to}${NC}"
    return 0
  fi
  
  # Get target group ARNs
  local from_tg=$(aws elbv2 describe-target-groups \
    --names "soberlivings-${ENVIRONMENT}-${from}" \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text)
  
  local to_tg=$(aws elbv2 describe-target-groups \
    --names "soberlivings-${ENVIRONMENT}-${to}" \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text)
  
  # Get listener ARN
  local listener=$(aws elbv2 describe-listeners \
    --load-balancer-arn "arn:aws:elasticloadbalancing:*:*:loadbalancer/app/soberlivings-${ENVIRONMENT}/*" \
    --query 'Listeners[?Port==`443`].ListenerArn' \
    --output text)
  
  # Update listener rules for traffic switching
  if [[ "$percentage" -eq 100 ]]; then
    # Full switch
    aws elbv2 modify-listener \
      --listener-arn "$listener" \
      --default-actions Type=forward,TargetGroupArn="$to_tg"
  else
    # Canary deployment with weighted routing
    aws elbv2 modify-listener \
      --listener-arn "$listener" \
      --default-actions Type=forward,ForwardConfig="{
        \"TargetGroups\": [
          {\"TargetGroupArn\": \"$from_tg\", \"Weight\": $((100 - percentage))},
          {\"TargetGroupArn\": \"$to_tg\", \"Weight\": $percentage}
        ]
      }"
  fi
  
  echo -e "${GREEN}✓ Traffic switched to ${to}${NC}"
}

# Function to perform smoke tests
run_smoke_tests() {
  local target=$1
  
  echo -e "${BLUE}Running smoke tests on ${target}...${NC}"
  
  # Basic API endpoint tests
  local base_url="https://${target}.soberlivings.com"
  local endpoints=(
    "/api/health/live"
    "/api/health/ready"
    "/api/v1/facilities?limit=1"
    "/api/v1/facilities/search?q=test&limit=1"
  )
  
  for endpoint in "${endpoints[@]}"; do
    echo "  Testing ${endpoint}..."
    if ! curl -sf "${base_url}${endpoint}" > /dev/null; then
      echo -e "${RED}✗ Smoke test failed: ${endpoint}${NC}"
      return 1
    fi
  done
  
  echo -e "${GREEN}✓ All smoke tests passed${NC}"
  return 0
}

# Function to rollback deployment
rollback() {
  local from=$1
  local to=$2
  
  echo -e "${RED}Initiating rollback: ${from} → ${to}${NC}"
  
  if [[ "$DRY_RUN" == "true" ]]; then
    echo -e "${YELLOW}[DRY RUN] Would rollback to ${to}${NC}"
    return 0
  fi
  
  # Switch traffic back
  switch_traffic "$from" "$to" 100
  
  # Mark deployment as failed
  aws cloudwatch put-metric-data \
    --namespace "SoberLivings/Deployments" \
    --metric-name "DeploymentStatus" \
    --value 0 \
    --dimensions Environment="${ENVIRONMENT}",Version="${VERSION}"
  
  echo -e "${YELLOW}Rollback complete. Deployment failed.${NC}"
}

# Main deployment logic
main() {
  echo -e "${BLUE}═══════════════════════════════════════${NC}"
  echo -e "${BLUE}   SoberLivings Deployment Pipeline    ${NC}"
  echo -e "${BLUE}═══════════════════════════════════════${NC}"
  echo ""
  
  # Get current active environment
  ACTIVE_ENV=$(get_active_environment)
  INACTIVE_ENV=$([[ "$ACTIVE_ENV" == "blue" ]] && echo "green" || echo "blue")
  
  echo "Current active: ${ACTIVE_ENV}"
  echo "Deploy target: ${INACTIVE_ENV}"
  echo ""
  
  # Pre-deployment checks
  echo -e "${YELLOW}Pre-deployment checks...${NC}"
  check_health "$ACTIVE_ENV" || exit 1
  
  # Deploy to inactive environment
  deploy_to_environment "$INACTIVE_ENV"
  
  # Health check new deployment
  if ! check_health "$INACTIVE_ENV"; then
    echo -e "${RED}New deployment health check failed${NC}"
    exit 1
  fi
  
  # Run smoke tests on inactive environment
  if ! run_smoke_tests "$INACTIVE_ENV"; then
    echo -e "${RED}Smoke tests failed${NC}"
    exit 1
  fi
  
  # Traffic switching based on strategy
  case "$STRATEGY" in
    blue-green)
      echo -e "${BLUE}Executing blue-green switch...${NC}"
      switch_traffic "$ACTIVE_ENV" "$INACTIVE_ENV" 100
      ;;
    
    canary)
      echo -e "${BLUE}Executing canary deployment...${NC}"
      # Start with 10% traffic
      switch_traffic "$ACTIVE_ENV" "$INACTIVE_ENV" 10
      sleep 60
      
      # Check metrics
      echo "Monitoring canary metrics..."
      if check_health "$INACTIVE_ENV"; then
        # Increase to 50%
        switch_traffic "$ACTIVE_ENV" "$INACTIVE_ENV" 50
        sleep 120
        
        # Full switch
        switch_traffic "$ACTIVE_ENV" "$INACTIVE_ENV" 100
      else
        rollback "$INACTIVE_ENV" "$ACTIVE_ENV"
        exit 1
      fi
      ;;
    
    *)
      echo -e "${RED}Unknown strategy: $STRATEGY${NC}"
      exit 1
      ;;
  esac
  
  # Post-deployment validation
  echo -e "${YELLOW}Post-deployment validation...${NC}"
  sleep 30
  
  if ! check_health "$INACTIVE_ENV"; then
    echo -e "${RED}Post-deployment health check failed, rolling back...${NC}"
    rollback "$INACTIVE_ENV" "$ACTIVE_ENV"
    exit 1
  fi
  
  # Update tags
  if [[ "$DRY_RUN" == "false" ]]; then
    aws elbv2 add-tags \
      --resource-arns "arn:aws:elasticloadbalancing:*:*:targetgroup/soberlivings-${ENVIRONMENT}-${INACTIVE_ENV}/*" \
      --tags Key=Environment,Value=active Key=Version,Value="${VERSION}" Key=DeployedAt,Value="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    
    aws elbv2 add-tags \
      --resource-arns "arn:aws:elasticloadbalancing:*:*:targetgroup/soberlivings-${ENVIRONMENT}-${ACTIVE_ENV}/*" \
      --tags Key=Environment,Value=inactive
  fi
  
  # Send metrics
  if [[ "$DRY_RUN" == "false" ]]; then
    aws cloudwatch put-metric-data \
      --namespace "SoberLivings/Deployments" \
      --metric-name "DeploymentStatus" \
      --value 1 \
      --dimensions Environment="${ENVIRONMENT}",Version="${VERSION}"
    
    aws cloudwatch put-metric-data \
      --namespace "SoberLivings/Deployments" \
      --metric-name "DeploymentDuration" \
      --value "$SECONDS" \
      --unit Seconds \
      --dimensions Environment="${ENVIRONMENT}",Version="${VERSION}"
  fi
  
  echo ""
  echo -e "${GREEN}═══════════════════════════════════════${NC}"
  echo -e "${GREEN}   Deployment Successful! 🎉           ${NC}"
  echo -e "${GREEN}═══════════════════════════════════════${NC}"
  echo "Version ${VERSION} is now live in ${ENVIRONMENT}"
  echo "Previous version available in ${ACTIVE_ENV} for rollback"
  echo ""
  echo "Rollback command if needed:"
  echo "  ./scripts/rollback.sh --from ${INACTIVE_ENV} --to ${ACTIVE_ENV}"
}

# Execute main function
main