#!/bin/bash
set -euo pipefail

# Automatic Rollback Script for SoberLivings Platform
# Provides rapid rollback capability within 5 minutes

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
ROLLBACK_TIMEOUT=300  # 5 minutes
AUTO_MODE=false
FROM_ENV=""
TO_ENV=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --auto)
      AUTO_MODE=true
      shift
      ;;
    --from)
      FROM_ENV="$2"
      shift 2
      ;;
    --to)
      TO_ENV="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Function to detect environments
detect_environments() {
  if [[ -z "$FROM_ENV" ]] || [[ -z "$TO_ENV" ]]; then
    # Auto-detect based on current active environment
    local active=$(aws elbv2 describe-target-groups \
      --names "soberlivings-production-active" \
      --query 'TargetGroups[0].Tags[?Key==`Environment`].Value' \
      --output text 2>/dev/null || echo "green")
    
    if [[ "$active" == "green" ]]; then
      FROM_ENV="green"
      TO_ENV="blue"
    else
      FROM_ENV="blue"
      TO_ENV="green"
    fi
  fi
}

# Function to perform rollback
perform_rollback() {
  echo -e "${YELLOW}⚠️  INITIATING ROLLBACK${NC}"
  echo "From: $FROM_ENV → To: $TO_ENV"
  echo ""
  
  # Step 1: Switch traffic immediately
  echo -e "${YELLOW}Switching traffic...${NC}"
  local listener=$(aws elbv2 describe-listeners \
    --load-balancer-arn "arn:aws:elasticloadbalancing:*:*:loadbalancer/app/soberlivings-production/*" \
    --query 'Listeners[?Port==`443`].ListenerArn' \
    --output text)
  
  local target_group=$(aws elbv2 describe-target-groups \
    --names "soberlivings-production-${TO_ENV}" \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text)
  
  aws elbv2 modify-listener \
    --listener-arn "$listener" \
    --default-actions Type=forward,TargetGroupArn="$target_group"
  
  echo -e "${GREEN}✓ Traffic switched to ${TO_ENV}${NC}"
  
  # Step 2: Health check
  echo -e "${YELLOW}Verifying rollback environment health...${NC}"
  local health_url="https://${TO_ENV}.soberlivings.com/api/health/ready"
  
  for i in {1..10}; do
    if curl -sf "$health_url" > /dev/null; then
      echo -e "${GREEN}✓ ${TO_ENV} environment is healthy${NC}"
      break
    fi
    echo "  Health check attempt $i/10..."
    sleep 5
  done
  
  # Step 3: Update tags
  aws elbv2 add-tags \
    --resource-arns "arn:aws:elasticloadbalancing:*:*:targetgroup/soberlivings-production-${TO_ENV}/*" \
    --tags Key=Environment,Value=active Key=RollbackAt,Value="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  
  aws elbv2 add-tags \
    --resource-arns "arn:aws:elasticloadbalancing:*:*:targetgroup/soberlivings-production-${FROM_ENV}/*" \
    --tags Key=Environment,Value=failed
  
  # Step 4: Send notifications
  if [[ -n "${SLACK_WEBHOOK:-}" ]]; then
    curl -X POST "$SLACK_WEBHOOK" \
      -H 'Content-Type: application/json' \
      -d "{
        \"text\": \"🔴 **Rollback Executed**\",
        \"attachments\": [{
          \"color\": \"danger\",
          \"fields\": [
            {\"title\": \"Environment\", \"value\": \"Production\", \"short\": true},
            {\"title\": \"Rolled back from\", \"value\": \"$FROM_ENV\", \"short\": true},
            {\"title\": \"Rolled back to\", \"value\": \"$TO_ENV\", \"short\": true},
            {\"title\": \"Time\", \"value\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\", \"short\": true}
          ]
        }]
      }"
  fi
  
  # Step 5: Log metrics
  aws cloudwatch put-metric-data \
    --namespace "SoberLivings/Deployments" \
    --metric-name "RollbackExecuted" \
    --value 1 \
    --dimensions Environment=production,From="$FROM_ENV",To="$TO_ENV"
}

# Function to verify rollback
verify_rollback() {
  echo -e "${YELLOW}Verifying rollback...${NC}"
  
  # Check application health
  local health_status=$(curl -s -o /dev/null -w "%{http_code}" https://soberlivings.com/api/health/ready)
  
  if [[ "$health_status" == "200" ]]; then
    echo -e "${GREEN}✓ Application is healthy${NC}"
  else
    echo -e "${RED}✗ Application health check failed (HTTP $health_status)${NC}"
    exit 1
  fi
  
  # Check key endpoints
  local endpoints=(
    "/api/v1/facilities?limit=1"
    "/api/v1/facilities/search?q=test&limit=1"
    "/api/health/live"
  )
  
  for endpoint in "${endpoints[@]}"; do
    if curl -sf "https://soberlivings.com${endpoint}" > /dev/null; then
      echo -e "${GREEN}✓ ${endpoint} is responding${NC}"
    else
      echo -e "${RED}✗ ${endpoint} is not responding${NC}"
    fi
  done
}

# Main execution
main() {
  echo -e "${RED}════════════════════════════════════${NC}"
  echo -e "${RED}   EMERGENCY ROLLBACK PROCEDURE     ${NC}"
  echo -e "${RED}════════════════════════════════════${NC}"
  echo ""
  
  # Detect environments if not specified
  detect_environments
  
  if [[ "$AUTO_MODE" == "true" ]]; then
    echo -e "${YELLOW}AUTO MODE: Executing rollback immediately${NC}"
    perform_rollback
  else
    echo -e "${YELLOW}Manual rollback requested${NC}"
    echo "This will rollback from $FROM_ENV to $TO_ENV"
    echo ""
    read -p "Are you sure you want to proceed? (yes/no): " confirm
    
    if [[ "$confirm" == "yes" ]]; then
      perform_rollback
    else
      echo "Rollback cancelled"
      exit 0
    fi
  fi
  
  # Verify rollback success
  verify_rollback
  
  echo ""
  echo -e "${GREEN}════════════════════════════════════${NC}"
  echo -e "${GREEN}   ROLLBACK COMPLETED SUCCESSFULLY  ${NC}"
  echo -e "${GREEN}════════════════════════════════════${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Investigate the issue that caused the rollback"
  echo "2. Review logs: aws logs tail /aws/ecs/soberlivings-production"
  echo "3. Check metrics dashboard"
  echo "4. Schedule post-mortem meeting"
}

# Execute main function
main