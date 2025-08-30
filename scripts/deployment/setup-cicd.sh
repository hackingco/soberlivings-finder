#!/bin/bash
# CI/CD Setup Script - Configure GitHub Actions and deployment pipeline
# This script sets up the complete CI/CD pipeline for the project

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

# Log function
log() {
    echo -e "${BLUE}[CI/CD]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    if ! command -v gh &> /dev/null; then
        error "GitHub CLI (gh) is not installed. Please install it first."
    fi
    
    if ! gh auth status &> /dev/null; then
        error "GitHub CLI is not authenticated. Run 'gh auth login' first."
    fi
    
    success "Prerequisites checked"
}

# Get repository info
get_repo_info() {
    REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
    OWNER=$(echo $REPO | cut -d'/' -f1)
    REPO_NAME=$(echo $REPO | cut -d'/' -f2)
    
    log "Repository: $REPO"
}

# Create GitHub environments
create_environments() {
    log "Creating GitHub environments..."
    
    # Create staging environment
    gh api repos/$REPO/environments/staging \
        --method PUT \
        --field wait_timer=0 \
        --field reviewers='[]' \
        --field deployment_branch_policy='{"protected_branches":false,"custom_branch_policies":true}' \
        2>/dev/null && success "Staging environment created" || warning "Staging environment exists"
    
    # Create production environment with protection
    gh api repos/$REPO/environments/production \
        --method PUT \
        --field wait_timer=10 \
        --field reviewers='[]' \
        --field deployment_branch_policy='{"protected_branches":true,"custom_branch_policies":false}' \
        2>/dev/null && success "Production environment created" || warning "Production environment exists"
}

# Configure secrets
configure_secrets() {
    log "Configuring GitHub secrets..."
    
    # Critical secrets (prompt if not set)
    local secrets_to_check=(
        "STAGING_DATABASE_URL"
        "PRODUCTION_DATABASE_URL"
        "SUPABASE_ACCESS_TOKEN"
        "SUPABASE_PROJECT_REF"
        "JWT_SECRET"
        "ENCRYPTION_KEY"
    )
    
    for secret in "${secrets_to_check[@]}"; do
        if ! gh secret list | grep -q "^$secret"; then
            warning "Secret $secret is not configured"
            read -sp "Enter value for $secret (or press Enter to skip): " value
            echo
            if [ ! -z "$value" ]; then
                gh secret set "$secret" --body "$value"
                success "Secret $secret configured"
            fi
        else
            success "Secret $secret already configured"
        fi
    done
}

# Enable GitHub Actions
enable_actions() {
    log "Enabling GitHub Actions..."
    
    gh api repos/$REPO/actions/permissions \
        --method PUT \
        --field enabled=true \
        --field allowed_actions=all \
        2>/dev/null && success "GitHub Actions enabled" || warning "Could not modify Actions settings"
}

# Configure branch protection
configure_branch_protection() {
    log "Configuring branch protection for main branch..."
    
    # Configure main branch protection
    gh api repos/$REPO/branches/main/protection \
        --method PUT \
        --field required_status_checks='{"strict":true,"contexts":["test","build-app"]}' \
        --field enforce_admins=false \
        --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true,"require_code_owner_reviews":false}' \
        --field restrictions=null \
        --field allow_force_pushes=false \
        --field allow_deletions=false \
        --field required_linear_history=false \
        --field allow_squash_merge=true \
        --field allow_merge_commit=true \
        --field allow_rebase_merge=true \
        2>/dev/null && success "Branch protection configured" || warning "Branch protection may already exist"
}

# Create workflow dispatch
create_workflow_dispatch() {
    log "Creating manual workflow triggers..."
    
    # Check if workflows exist
    if [ ! -d "$PROJECT_ROOT/.github/workflows" ]; then
        error "No workflows directory found"
    fi
    
    # List available workflows
    log "Available workflows:"
    for workflow in "$PROJECT_ROOT/.github/workflows"/*.yml; do
        if [ -f "$workflow" ]; then
            local workflow_name=$(basename "$workflow")
            echo "  - $workflow_name"
        fi
    done
    
    success "Workflows are ready for manual dispatch"
}

# Test CI/CD pipeline
test_pipeline() {
    log "Testing CI/CD pipeline..."
    
    # Create test branch
    local test_branch="test-cicd-$(date +%Y%m%d-%H%M%S)"
    
    log "Creating test branch: $test_branch"
    git checkout -b "$test_branch"
    
    # Make a small change
    echo "# CI/CD Test $(date)" >> README.md
    git add README.md
    git commit -m "test: CI/CD pipeline test"
    
    # Push to trigger CI
    log "Pushing to trigger CI/CD..."
    git push -u origin "$test_branch"
    
    # Open PR
    log "Creating pull request..."
    gh pr create \
        --title "Test: CI/CD Pipeline Validation" \
        --body "This is an automated test of the CI/CD pipeline. It can be closed after validation." \
        --base main \
        --head "$test_branch"
    
    success "Test PR created. Check GitHub Actions for pipeline execution."
    
    # Return to main branch
    git checkout main
}

# Setup deployment keys
setup_deployment_keys() {
    log "Setting up deployment keys..."
    
    # Check if SSH key exists
    if [ ! -f "$HOME/.ssh/id_ed25519" ]; then
        log "Generating SSH key for deployments..."
        ssh-keygen -t ed25519 -C "deploy@soberlivings.com" -f "$HOME/.ssh/id_ed25519" -N ""
    fi
    
    # Add public key as deploy key
    if [ -f "$HOME/.ssh/id_ed25519.pub" ]; then
        local public_key=$(cat "$HOME/.ssh/id_ed25519.pub")
        
        gh api repos/$REPO/keys \
            --method POST \
            --field title="CI/CD Deploy Key" \
            --field key="$public_key" \
            --field read_only=false \
            2>/dev/null && success "Deploy key added" || warning "Deploy key may already exist"
    fi
}

# Configure webhooks
configure_webhooks() {
    log "Configuring webhooks..."
    
    read -p "Do you want to configure Slack/Discord webhooks? (y/n): " configure_webhooks
    
    if [ "$configure_webhooks" = "y" ]; then
        read -p "Enter Slack webhook URL (or press Enter to skip): " slack_webhook
        if [ ! -z "$slack_webhook" ]; then
            gh secret set SLACK_WEBHOOK_URL --body "$slack_webhook"
            success "Slack webhook configured"
        fi
        
        read -p "Enter Discord webhook URL (or press Enter to skip): " discord_webhook
        if [ ! -z "$discord_webhook" ]; then
            gh secret set DISCORD_WEBHOOK_URL --body "$discord_webhook"
            success "Discord webhook configured"
        fi
    fi
}

# Validate setup
validate_setup() {
    log "Validating CI/CD setup..."
    
    local issues=0
    
    # Check environments
    local env_count=$(gh api repos/$REPO/environments 2>/dev/null | jq '.total_count // 0')
    if [ "$env_count" -ge 2 ]; then
        success "✓ Environments configured"
    else
        warning "✗ Missing environments"
        ((issues++))
    fi
    
    # Check secrets
    local secret_count=$(gh secret list 2>/dev/null | wc -l)
    if [ "$secret_count" -ge 6 ]; then
        success "✓ Secrets configured ($secret_count found)"
    else
        warning "✗ Insufficient secrets ($secret_count found, need at least 6)"
        ((issues++))
    fi
    
    # Check workflows
    local workflow_count=$(ls -1 "$PROJECT_ROOT/.github/workflows"/*.yml 2>/dev/null | wc -l)
    if [ "$workflow_count" -ge 1 ]; then
        success "✓ Workflows configured ($workflow_count found)"
    else
        warning "✗ No workflows found"
        ((issues++))
    fi
    
    # Check branch protection
    if gh api repos/$REPO/branches/main/protection &> /dev/null; then
        success "✓ Branch protection enabled"
    else
        warning "✗ Branch protection not configured"
        ((issues++))
    fi
    
    if [ "$issues" -eq 0 ]; then
        success "All CI/CD components are properly configured!"
    else
        warning "$issues issues found. Please review the setup."
    fi
}

# Main menu
show_menu() {
    echo
    echo -e "${BLUE}CI/CD Setup Menu${NC}"
    echo "════════════════════════════════"
    echo "1) Run complete setup"
    echo "2) Configure environments only"
    echo "3) Configure secrets only"
    echo "4) Configure branch protection only"
    echo "5) Test pipeline with PR"
    echo "6) Validate current setup"
    echo "7) Exit"
    echo
    read -p "Select option: " choice
}

# Main execution
main() {
    if [ "${1:-}" = "--auto" ]; then
        # Automated mode
        check_prerequisites
        get_repo_info
        create_environments
        configure_secrets
        enable_actions
        configure_branch_protection
        setup_deployment_keys
        validate_setup
        success "CI/CD setup complete!"
    else
        # Interactive mode
        check_prerequisites
        get_repo_info
        
        while true; do
            show_menu
            case $choice in
                1)
                    create_environments
                    configure_secrets
                    enable_actions
                    configure_branch_protection
                    setup_deployment_keys
                    configure_webhooks
                    validate_setup
                    ;;
                2)
                    create_environments
                    ;;
                3)
                    configure_secrets
                    ;;
                4)
                    configure_branch_protection
                    ;;
                5)
                    test_pipeline
                    ;;
                6)
                    validate_setup
                    ;;
                7)
                    exit 0
                    ;;
                *)
                    error "Invalid option"
                    ;;
            esac
        done
    fi
}

# Run main function
main "$@"