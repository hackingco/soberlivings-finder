#!/bin/bash
# GitHub Secrets Setup Script for SoberLivings CI/CD
# This script helps configure all required GitHub secrets

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}    GitHub Secrets Setup for SoberLivings CI/CD Pipeline      ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI not found.${NC}"
    echo -e "${YELLOW}Please install GitHub CLI first:${NC}"
    echo "  macOS:  brew install gh"
    echo "  Ubuntu: sudo apt install gh"
    echo "  Other:  https://cli.github.com/manual/installation"
    exit 1
fi

# Check authentication
echo -e "${BLUE}Checking GitHub authentication...${NC}"
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}Not authenticated. Starting login process...${NC}"
    gh auth login
fi

echo -e "${GREEN}✅ GitHub CLI authenticated${NC}"
echo ""

# Function to set secret
set_secret() {
    local name=$1
    local value=$2
    local masked_value=$(echo "$value" | sed 's/./*/g')
    
    if gh secret set "$name" --body "$value" 2>/dev/null; then
        echo -e "${GREEN}✅ Set $name${NC}"
    else
        echo -e "${RED}❌ Failed to set $name${NC}"
        return 1
    fi
}

# Function to prompt for secret
prompt_secret() {
    local name=$1
    local description=$2
    local example=$3
    local is_password=$4
    
    echo -e "${YELLOW}$description${NC}"
    if [ ! -z "$example" ]; then
        echo -e "  Example: ${BLUE}$example${NC}"
    fi
    
    if [ "$is_password" = "true" ]; then
        read -sp "  Enter $name: " value
        echo ""
    else
        read -p "  Enter $name: " value
    fi
    
    if [ -z "$value" ]; then
        echo -e "${RED}  ⚠️  Skipping $name (no value provided)${NC}"
        return 1
    fi
    
    set_secret "$name" "$value"
}

# Main setup
echo -e "${BLUE}Starting secret configuration...${NC}"
echo -e "${YELLOW}Note: Leave blank to skip any optional secret${NC}"
echo ""

echo -e "${BLUE}━━━ 1. Server Access Secrets ━━━${NC}"
prompt_secret "STAGING_SERVER_HOST" "Staging server hostname or IP" "staging.example.com" false
prompt_secret "STAGING_SERVER_USER" "Staging server SSH username" "deploy" false
prompt_secret "PRODUCTION_SERVER_HOST" "Production server hostname or IP" "example.com" false
prompt_secret "PRODUCTION_SERVER_USER" "Production server SSH username" "deploy" false

echo ""
echo -e "${BLUE}━━━ 2. Database Secrets ━━━${NC}"
prompt_secret "STAGING_DATABASE_URL" "Staging database connection URL" "postgresql://user:pass@host:5432/db" true
prompt_secret "PRODUCTION_DATABASE_URL" "Production database connection URL" "postgresql://user:pass@host:5432/db?sslmode=require" true

echo ""
echo -e "${BLUE}━━━ 3. Supabase Configuration ━━━${NC}"
prompt_secret "SUPABASE_PROJECT_REF" "Supabase project reference ID" "acwtjmqtwnijzbioauwn" false
prompt_secret "SUPABASE_ACCESS_TOKEN" "Supabase access token (sbp_...)" "sbp_e97b6c24f06ec7be829096abceb80a387de16ede" false
prompt_secret "SUPABASE_DB_PASSWORD" "Supabase database password" "" true
prompt_secret "NEXT_PUBLIC_SUPABASE_URL" "Supabase project URL" "https://acwtjmqtwnijzbioauwn.supabase.co" false
prompt_secret "NEXT_PUBLIC_SUPABASE_ANON_KEY" "Supabase anonymous key" "" false
prompt_secret "SUPABASE_SERVICE_ROLE_KEY" "Supabase service role key (NEVER expose publicly)" "" true

echo ""
echo -e "${BLUE}━━━ 4. Application Secrets ━━━${NC}"
prompt_secret "JWT_SECRET" "JWT secret for authentication (generate with: openssl rand -base64 32)" "" true
prompt_secret "ENCRYPTION_KEY" "Encryption key for sensitive data" "" true
prompt_secret "SESSION_SECRET" "Session secret for cookies" "" true
prompt_secret "NEXTAUTH_SECRET" "NextAuth.js secret" "" true

echo ""
echo -e "${BLUE}━━━ 5. Environment URLs ━━━${NC}"
prompt_secret "STAGING_URL" "Staging environment URL" "https://staging.soberlivings.com" false
prompt_secret "PRODUCTION_URL" "Production environment URL" "https://soberlivings.com" false

echo ""
echo -e "${BLUE}━━━ 6. Optional Services ━━━${NC}"
echo -e "${YELLOW}Press Enter to skip if not using these services${NC}"
prompt_secret "SLACK_WEBHOOK_URL" "Slack webhook for notifications (optional)" "https://hooks.slack.com/services/T00/B00/XXX" false
prompt_secret "DISCORD_WEBHOOK_URL" "Discord webhook for notifications (optional)" "" false
prompt_secret "GOOGLE_MAPS_API_KEY" "Google Maps API key (optional)" "" false
prompt_secret "TWILIO_ACCOUNT_SID" "Twilio account SID (optional)" "" false
prompt_secret "TWILIO_AUTH_TOKEN" "Twilio auth token (optional)" "" true

# Set rotation timestamp
echo ""
echo -e "${BLUE}Setting secret rotation timestamp...${NC}"
set_secret "LAST_SECRET_ROTATION" "$(date +%s)"

# List all configured secrets
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Secret configuration complete!${NC}"
echo ""
echo -e "${BLUE}Configured secrets:${NC}"
gh secret list

echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Add SSH keys for server access if using SSH deployment"
echo "2. Configure environment protection rules in GitHub"
echo "3. Test the CI/CD pipeline with a test commit"
echo "4. Enable branch protection for main branch"

echo ""
echo -e "${YELLOW}Security reminders:${NC}"
echo "• Rotate secrets every 90 days"
echo "• Use different secrets for each environment"
echo "• Never commit secrets to the repository"
echo "• Enable required reviewers for production deployments"

echo ""
echo -e "${GREEN}Setup complete! Your CI/CD pipeline is ready to use.${NC}"