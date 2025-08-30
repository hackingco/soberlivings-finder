#!/bin/bash
# Environment-Scoped Secrets Setup
# Comprehensive script to manage GitHub environment secrets

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Repository info (auto-detect or override)
REPO="${GITHUB_REPOSITORY:-hackingco/soberlivings-finder}"

# Log functions
log() { echo -e "${BLUE}[ENV-SECRETS]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    if ! command -v gh &> /dev/null; then
        error "GitHub CLI (gh) is not installed"
    fi
    
    if ! gh auth status &> /dev/null; then
        error "GitHub CLI is not authenticated. Run 'gh auth login'"
    fi
    
    # Auto-detect repo if not set
    if [ "$REPO" = "hackingco/soberlivings-finder" ] && command -v gh &> /dev/null; then
        REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "hackingco/soberlivings-finder")
    fi
    
    log "Repository: $REPO"
    success "Prerequisites checked"
}

# Create GitHub environments
create_environments() {
    log "Creating GitHub environments..."
    
    # Create staging environment (idempotent)
    if gh api -X PUT -H "Accept: application/vnd.github+json" \
        "/repos/$REPO/environments/staging" 2>/dev/null; then
        success "✓ Staging environment created/verified"
    else
        warning "Could not create staging environment (may already exist)"
    fi
    
    # Create production environment with protection
    local prod_config='{
        "wait_timer": 10,
        "reviewers": [],
        "deployment_branch_policy": {
            "protected_branches": true,
            "custom_branch_policies": false
        }
    }'
    
    if echo "$prod_config" | gh api -X PUT -H "Accept: application/vnd.github+json" \
        "/repos/$REPO/environments/production" --input - 2>/dev/null; then
        success "✓ Production environment created/verified with protection"
    else
        warning "Could not create production environment (may already exist)"
    fi
}

# Set environment-scoped secrets
set_env_secret() {
    local secret_name=$1
    local secret_value=$2
    local environment=$3
    
    if [ -z "$secret_name" ] || [ -z "$secret_value" ] || [ -z "$environment" ]; then
        error "Usage: set_env_secret <name> <value> <environment>"
    fi
    
    log "Setting $secret_name for $environment environment..."
    
    if gh secret set "$secret_name" --env "$environment" --body "$secret_value" 2>/dev/null; then
        success "✓ $secret_name set for $environment"
    else
        error "Failed to set $secret_name for $environment"
    fi
}

# Set secrets for both environments
set_secrets_for_both() {
    local secret_name=$1
    local staging_value=$2
    local production_value=${3:-$2}  # Use staging value if production not provided
    
    set_env_secret "$secret_name" "$staging_value" "staging"
    set_env_secret "$secret_name" "$production_value" "production"
}

# Generate and set secure secrets
generate_secure_secrets() {
    log "Generating and setting secure secrets..."
    
    # Generate secure values
    local jwt_secret=$(openssl rand -hex 32)
    local session_secret=$(openssl rand -hex 32)
    local encryption_key=$(openssl rand -hex 32)
    
    # Set for both environments
    set_secrets_for_both "JWT_SECRET" "$jwt_secret"
    set_secrets_for_both "SESSION_SECRET" "$session_secret"  
    set_secrets_for_both "ENCRYPTION_KEY" "$encryption_key"
    
    # Set different values for different environments if needed
    local staging_api_key="staging_$(openssl rand -hex 16)"
    local prod_api_key="prod_$(openssl rand -hex 16)"
    
    set_env_secret "API_KEY" "$staging_api_key" "staging"
    set_env_secret "API_KEY" "$prod_api_key" "production"
    
    success "Secure secrets generated and set for both environments"
}

# Set database URLs
set_database_urls() {
    log "Setting database URLs..."
    
    read -p "Enter staging database URL: " staging_db_url
    read -p "Enter production database URL: " prod_db_url
    
    if [ ! -z "$staging_db_url" ]; then
        set_env_secret "DATABASE_URL" "$staging_db_url" "staging"
    fi
    
    if [ ! -z "$prod_db_url" ]; then
        set_env_secret "DATABASE_URL" "$prod_db_url" "production"
    fi
}

# Set Supabase secrets
set_supabase_secrets() {
    log "Setting Supabase secrets..."
    
    read -p "Enter Supabase project ref: " project_ref
    read -sp "Enter Supabase access token: " access_token
    echo
    read -p "Enter Supabase anon key: " anon_key
    read -sp "Enter Supabase service key: " service_key
    echo
    
    # Set for both environments (same project typically)
    if [ ! -z "$project_ref" ]; then
        set_secrets_for_both "SUPABASE_PROJECT_REF" "$project_ref"
    fi
    
    if [ ! -z "$access_token" ]; then
        set_secrets_for_both "SUPABASE_ACCESS_TOKEN" "$access_token"
    fi
    
    if [ ! -z "$anon_key" ]; then
        set_secrets_for_both "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$anon_key"
    fi
    
    if [ ! -z "$service_key" ]; then
        set_secrets_for_both "SUPABASE_SERVICE_ROLE_KEY" "$service_key"
    fi
}

# Set application URLs
set_app_urls() {
    log "Setting application URLs..."
    
    set_env_secret "APP_URL" "https://staging.soberlivings.com" "staging"
    set_env_secret "NEXT_PUBLIC_APP_URL" "https://staging.soberlivings.com" "staging"
    
    set_env_secret "APP_URL" "https://soberlivings.com" "production"
    set_env_secret "NEXT_PUBLIC_APP_URL" "https://soberlivings.com" "production"
    
    success "Application URLs set for both environments"
}

# Verify secrets
verify_secrets() {
    log "Verifying environment secrets..."
    
    echo -e "\n${CYAN}Staging Environment Secrets:${NC}"
    gh secret list --env staging 2>/dev/null || warning "No staging secrets found"
    
    echo -e "\n${CYAN}Production Environment Secrets:${NC}"
    gh secret list --env production 2>/dev/null || warning "No production secrets found"
    
    echo -e "\n${CYAN}Repository-Level Secrets:${NC}"
    gh secret list 2>/dev/null || warning "No repository secrets found"
}

# Migrate repo secrets to environment secrets
migrate_repo_to_env_secrets() {
    log "Migrating repository secrets to environment secrets..."
    
    # List of secrets to migrate
    local secrets_to_migrate=(
        "JWT_SECRET"
        "DATABASE_URL"
        "SUPABASE_ACCESS_TOKEN"
        "SUPABASE_PROJECT_REF"
        "NEXT_PUBLIC_SUPABASE_ANON_KEY"
        "SUPABASE_SERVICE_ROLE_KEY"
    )
    
    for secret in "${secrets_to_migrate[@]}"; do
        log "Checking if $secret exists at repository level..."
        
        if gh secret list | grep -q "^$secret"; then
            warning "$secret exists at repository level"
            read -p "Move $secret to environment-scoped? (y/n): " migrate_secret
            
            if [ "$migrate_secret" = "y" ]; then
                # Note: We can't actually retrieve the secret value via CLI
                # So we ask user to provide new values
                read -sp "Enter new value for $secret (staging): " staging_value
                echo
                read -sp "Enter new value for $secret (production, or Enter for same): " prod_value
                echo
                
                if [ -z "$prod_value" ]; then
                    prod_value="$staging_value"
                fi
                
                set_secrets_for_both "$secret" "$staging_value" "$prod_value"
                
                read -p "Delete repository-level $secret? (y/n): " delete_repo_secret
                if [ "$delete_repo_secret" = "y" ]; then
                    gh secret delete "$secret" 2>/dev/null && success "Repository-level $secret deleted"
                fi
            fi
        fi
    done
}

# Quick setup with common secrets
quick_setup() {
    log "Running quick setup with common secrets..."
    
    create_environments
    generate_secure_secrets
    set_app_urls
    
    # Ask for optional secrets
    read -p "Set database URLs? (y/n): " set_db
    [ "$set_db" = "y" ] && set_database_urls
    
    read -p "Set Supabase secrets? (y/n): " set_supabase  
    [ "$set_supabase" = "y" ] && set_supabase_secrets
    
    verify_secrets
    success "Quick setup complete!"
}

# Bulk secret setter
bulk_set_secrets() {
    log "Bulk secret setter..."
    
    echo "Format: SECRET_NAME=value (one per line, empty line to finish)"
    echo "Secrets will be set for BOTH staging and production environments"
    echo ""
    
    local secrets=()
    
    while true; do
        read -p "Enter secret (name=value): " secret_input
        
        if [ -z "$secret_input" ]; then
            break
        fi
        
        if [[ "$secret_input" == *"="* ]]; then
            secrets+=("$secret_input")
            echo "Added: $(echo "$secret_input" | cut -d'=' -f1)"
        else
            warning "Invalid format. Use: SECRET_NAME=value"
        fi
    done
    
    if [ ${#secrets[@]} -eq 0 ]; then
        warning "No secrets to set"
        return
    fi
    
    log "Setting ${#secrets[@]} secrets for both environments..."
    
    for secret in "${secrets[@]}"; do
        local name=$(echo "$secret" | cut -d'=' -f1)
        local value=$(echo "$secret" | cut -d'=' -f2-)
        
        set_secrets_for_both "$name" "$value"
    done
    
    verify_secrets
}

# Test environment secret access
test_secret_access() {
    log "Testing environment secret access..."
    
    # Create a test workflow that uses environment secrets
    cat > "$PROJECT_ROOT/.github/workflows/test-env-secrets.yml" << 'EOF'
name: Test Environment Secrets

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to test'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production

jobs:
  test-secrets:
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment }}
    steps:
      - name: Test JWT_SECRET
        run: |
          if [ -n "$JWT_SECRET" ]; then
            echo "✅ JWT_SECRET is accessible (length: ${#JWT_SECRET})"
          else
            echo "❌ JWT_SECRET is not accessible"
          fi
        env:
          JWT_SECRET: ${{ secrets.JWT_SECRET }}
          
      - name: Test DATABASE_URL
        run: |
          if [ -n "$DATABASE_URL" ]; then
            echo "✅ DATABASE_URL is accessible"
            echo "URL: $(echo "$DATABASE_URL" | sed 's/:[^@]*@/:***@/')"
          else
            echo "❌ DATABASE_URL is not accessible"
          fi
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          
      - name: Test environment context
        run: |
          echo "Environment: ${{ github.event.inputs.environment }}"
          echo "Job environment: $ENVIRONMENT"
        env:
          ENVIRONMENT: ${{ github.event.inputs.environment }}
EOF
    
    success "Test workflow created: .github/workflows/test-env-secrets.yml"
    log "Run it with: gh workflow run test-env-secrets.yml -f environment=staging"
}

# Show menu
show_menu() {
    clear
    echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}      Environment-Scoped Secrets Manager           ${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
    echo
    echo -e "${YELLOW}Repository:${NC} $REPO"
    echo
    echo -e "${YELLOW}Select an option:${NC}"
    echo
    echo "  1) 🚀 Quick Setup (Common secrets for both environments)"
    echo "  2) 🏗️ Create Environments Only"  
    echo "  3) 🔐 Set Individual Secret"
    echo "  4) 📦 Bulk Set Secrets"
    echo "  5) 🔄 Migrate Repo Secrets to Environment Secrets"
    echo "  6) 🔍 Verify Current Secrets"
    echo "  7) 🧪 Create Test Workflow"
    echo "  8) 📋 Show Secret Usage Examples"
    echo "  9) 🗑️ Clean Up (Delete Repo-level Secrets)"
    echo "  0) Exit"
    echo
    read -p "Enter your choice [0-9]: " choice
}

# Show usage examples
show_examples() {
    cat << 'EOF'
# GitHub Actions Workflow Examples

## Using Environment-Scoped Secrets

```yaml
jobs:
  deploy-staging:
    environment: staging
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploying to staging"
        env:
          JWT_SECRET: ${{ secrets.JWT_SECRET }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

  deploy-production:
    environment: production
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploying to production"
        env:
          JWT_SECRET: ${{ secrets.JWT_SECRET }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

## CLI Commands

```bash
# Set secret for specific environment
gh secret set JWT_SECRET --env staging --body "your-staging-jwt-secret"
gh secret set JWT_SECRET --env production --body "your-production-jwt-secret"

# List environment secrets
gh secret list --env staging
gh secret list --env production

# Delete environment secret
gh secret delete JWT_SECRET --env staging
```

## Environment Protection Rules

Production environment includes:
- 10-second wait timer
- Requires main branch for deployment
- Can add required reviewers

Staging environment:
- No restrictions
- Allows any branch
- Immediate deployment
EOF
}

# Clean up repo-level secrets
cleanup_repo_secrets() {
    log "Cleaning up repository-level secrets..."
    
    warning "This will DELETE repository-level secrets!"
    read -p "Are you sure? (type 'yes' to confirm): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log "Cleanup cancelled"
        return
    fi
    
    local secrets_to_delete=(
        "JWT_SECRET"
        "DATABASE_URL"
        "SUPABASE_ACCESS_TOKEN"
        "SUPABASE_PROJECT_REF"
        "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    )
    
    for secret in "${secrets_to_delete[@]}"; do
        if gh secret list | grep -q "^$secret"; then
            if gh secret delete "$secret" 2>/dev/null; then
                success "Deleted repository-level $secret"
            else
                warning "Could not delete $secret"
            fi
        fi
    done
}

# Main execution
main() {
    check_prerequisites
    
    if [ "${1:-}" = "--quick" ]; then
        quick_setup
        exit 0
    elif [ "${1:-}" = "--create-envs" ]; then
        create_environments
        exit 0
    elif [ "${1:-}" = "--verify" ]; then
        verify_secrets
        exit 0
    fi
    
    # Interactive mode
    while true; do
        show_menu
        case $choice in
            1)
                quick_setup
                read -p "Press Enter to continue..."
                ;;
            2)
                create_environments
                read -p "Press Enter to continue..."
                ;;
            3)
                read -p "Secret name: " secret_name
                read -sp "Secret value: " secret_value
                echo
                read -p "Environment (staging/production/both): " env_choice
                
                case $env_choice in
                    staging|production)
                        set_env_secret "$secret_name" "$secret_value" "$env_choice"
                        ;;
                    both)
                        set_secrets_for_both "$secret_name" "$secret_value"
                        ;;
                    *)
                        error "Invalid environment choice"
                        ;;
                esac
                read -p "Press Enter to continue..."
                ;;
            4)
                bulk_set_secrets
                read -p "Press Enter to continue..."
                ;;
            5)
                migrate_repo_to_env_secrets
                read -p "Press Enter to continue..."
                ;;
            6)
                verify_secrets
                read -p "Press Enter to continue..."
                ;;
            7)
                test_secret_access
                read -p "Press Enter to continue..."
                ;;
            8)
                show_examples | less
                ;;
            9)
                cleanup_repo_secrets
                read -p "Press Enter to continue..."
                ;;
            0)
                exit 0
                ;;
            *)
                error "Invalid option"
                ;;
        esac
    done
}

# Run main function
main "$@"