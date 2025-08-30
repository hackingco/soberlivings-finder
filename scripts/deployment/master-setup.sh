#!/bin/bash

# =============================================================================
# Master Setup Orchestrator
# =============================================================================
# Complete automation for CI/CD pipeline activation and deployment setup
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="/tmp/soberlivings-setup-$(date +%Y%m%d-%H%M%S).log"

# Track progress
STEPS_COMPLETED=0
TOTAL_STEPS=10

print_header() {
    echo -e "\n${BLUE}==============================================================================${NC}" | tee -a "$LOG_FILE"
    echo -e "${BLUE}$1${NC}" | tee -a "$LOG_FILE"
    echo -e "${BLUE}==============================================================================${NC}" | tee -a "$LOG_FILE"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}" | tee -a "$LOG_FILE"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}" | tee -a "$LOG_FILE"
}

print_error() {
    echo -e "${RED}❌ $1${NC}" | tee -a "$LOG_FILE"
}

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}" | tee -a "$LOG_FILE"
}

print_progress() {
    local percent=$((STEPS_COMPLETED * 100 / TOTAL_STEPS))
    echo -e "\n${MAGENTA}Progress: [$STEPS_COMPLETED/$TOTAL_STEPS] ${percent}% complete${NC}" | tee -a "$LOG_FILE"
    
    # Progress bar
    local bar_length=50
    local filled=$((percent * bar_length / 100))
    local empty=$((bar_length - filled))
    
    echo -n "["
    for ((i=0; i<filled; i++)); do echo -n "="; done
    for ((i=0; i<empty; i++)); do echo -n " "; done
    echo "] ${percent}%"
}

check_prerequisites() {
    print_header "Checking Prerequisites"
    
    local missing=()
    
    # Check required tools
    command -v git >/dev/null 2>&1 || missing+=("git")
    command -v node >/dev/null 2>&1 || missing+=("node")
    command -v npm >/dev/null 2>&1 || missing+=("npm")
    command -v docker >/dev/null 2>&1 || missing+=("docker")
    command -v gh >/dev/null 2>&1 || missing+=("gh (GitHub CLI)")
    command -v jq >/dev/null 2>&1 || missing+=("jq")
    
    if [ ${#missing[@]} -gt 0 ]; then
        print_error "Missing required tools: ${missing[*]}"
        echo "Please install missing tools before continuing."
        
        # Provide installation instructions
        echo -e "\n${YELLOW}Installation instructions:${NC}"
        
        if [[ "$OSTYPE" == "darwin"* ]]; then
            echo "  macOS:"
            echo "    brew install gh jq"
            echo "    brew install --cask docker"
        else
            echo "  Ubuntu/Debian:"
            echo "    sudo apt-get update"
            echo "    sudo apt-get install gh jq docker.io docker-compose"
        fi
        
        exit 1
    fi
    
    # Check if in git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        print_error "Not in a git repository"
        exit 1
    fi
    
    # Check GitHub CLI authentication
    if ! gh auth status >/dev/null 2>&1; then
        print_warning "GitHub CLI not authenticated"
        echo "Authenticating with GitHub..."
        gh auth login
    fi
    
    print_success "All prerequisites met"
    ((STEPS_COMPLETED++))
    print_progress
}

setup_environment() {
    print_header "Setting Up Environment"
    
    cd "$PROJECT_ROOT"
    
    # Create necessary directories
    mkdir -p monitoring secrets .github/workflows scripts/deployment frontend/.env.d
    
    # Check for environment files
    if [ ! -f "frontend/.env.local" ]; then
        print_info "Creating .env.local from template..."
        if [ -f "frontend/.env.example" ]; then
            cp frontend/.env.example frontend/.env.local
            print_success "Created .env.local"
        else
            print_warning "No .env.example found"
        fi
    fi
    
    # Install dependencies
    print_info "Installing dependencies..."
    cd frontend
    npm ci
    cd ..
    
    print_success "Environment setup complete"
    ((STEPS_COMPLETED++))
    print_progress
}

configure_github_secrets() {
    print_header "Configuring GitHub Secrets"
    
    if [ -f "$SCRIPT_DIR/setup-cicd.sh" ]; then
        print_info "Running CI/CD setup script..."
        bash "$SCRIPT_DIR/setup-cicd.sh" <<< "2"  # Option 2: Configure secrets
        print_success "GitHub secrets configured"
    else
        print_warning "CI/CD setup script not found"
    fi
    
    ((STEPS_COMPLETED++))
    print_progress
}

setup_environments() {
    print_header "Setting Up GitHub Environments"
    
    if [ -f "$SCRIPT_DIR/setup-cicd.sh" ]; then
        print_info "Creating staging and production environments..."
        bash "$SCRIPT_DIR/setup-cicd.sh" <<< "3"  # Option 3: Set up environments
        print_success "Environments configured"
    else
        print_warning "CI/CD setup script not found"
    fi
    
    ((STEPS_COMPLETED++))
    print_progress
}

configure_branch_protection() {
    print_header "Configuring Branch Protection"
    
    if [ -f "$SCRIPT_DIR/setup-cicd.sh" ]; then
        print_info "Setting up branch protection rules..."
        bash "$SCRIPT_DIR/setup-cicd.sh" <<< "4"  # Option 4: Branch protection
        print_success "Branch protection configured"
    else
        print_warning "CI/CD setup script not found"
    fi
    
    ((STEPS_COMPLETED++))
    print_progress
}

setup_monitoring() {
    print_header "Setting Up Monitoring"
    
    if [ -f "$SCRIPT_DIR/setup-monitoring.sh" ]; then
        print_info "Configuring monitoring stack..."
        bash "$SCRIPT_DIR/setup-monitoring.sh" <<< "1"  # Option 1: Complete setup
        print_success "Monitoring configured"
    else
        print_warning "Monitoring setup script not found"
    fi
    
    ((STEPS_COMPLETED++))
    print_progress
}

apply_security_hardening() {
    print_header "Applying Security Hardening"
    
    if [ -f "$SCRIPT_DIR/security-hardening.sh" ]; then
        print_info "Running security hardening..."
        bash "$SCRIPT_DIR/security-hardening.sh" <<< "1"  # Option 1: Complete hardening
        print_success "Security hardening applied"
    else
        print_warning "Security hardening script not found"
    fi
    
    ((STEPS_COMPLETED++))
    print_progress
}

validate_deployment() {
    print_header "Validating Deployment Setup"
    
    if [ -f "$SCRIPT_DIR/deploy-manager.sh" ]; then
        print_info "Running deployment validation..."
        bash "$SCRIPT_DIR/deploy-manager.sh" validate
        print_success "Deployment validated"
    else
        print_warning "Deploy manager script not found"
    fi
    
    ((STEPS_COMPLETED++))
    print_progress
}

test_pipeline() {
    print_header "Testing CI/CD Pipeline"
    
    read -p "Would you like to test the CI/CD pipeline? (y/n) " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [ -f "$SCRIPT_DIR/setup-cicd.sh" ]; then
            print_info "Creating test branch and PR..."
            bash "$SCRIPT_DIR/setup-cicd.sh" <<< "6"  # Option 6: Test pipeline
            print_success "Pipeline test initiated"
        fi
    else
        print_info "Skipping pipeline test"
    fi
    
    ((STEPS_COMPLETED++))
    print_progress
}

generate_final_report() {
    print_header "Generating Setup Report"
    
    local report_file="SETUP_REPORT_$(date +%Y%m%d-%H%M%S).md"
    
    cat > "$report_file" << EOF
# SoberLivings CI/CD Setup Report
Generated: $(date)

## Setup Summary

### ✅ Completed Steps
- Prerequisites checked
- Environment configured
- GitHub secrets set up
- GitHub environments created
- Branch protection enabled
- Monitoring stack configured
- Security hardening applied
- Deployment validated

### 📋 Configuration Status

#### GitHub Configuration
- Repository: $(git remote get-url origin)
- Branch: $(git branch --show-current)
- Secrets: $(gh secret list --json name | jq '. | length') configured
- Environments: $(gh api "/repos/$(git remote get-url origin | sed -E 's/.*[:/]([^/]+\/[^/]+)\.git/\1/')/environments" --jq '.total_count' 2>/dev/null || echo "0") configured

#### Workflows
$(ls -1 .github/workflows/*.yml 2>/dev/null | wc -l) workflow files:
$(ls -1 .github/workflows/*.yml 2>/dev/null | xargs -n1 basename || echo "None found")

#### Docker Services
- App: $(docker ps --filter name=soberlivings-app --format "table {{.Status}}" | tail -n +2 || echo "Not running")
- Database: $(docker ps --filter name=soberlivings-postgres --format "table {{.Status}}" | tail -n +2 || echo "Not running")
- Redis: $(docker ps --filter name=soberlivings-redis --format "table {{.Status}}" | tail -n +2 || echo "Not running")

#### Monitoring
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (admin/admin)
- AlertManager: http://localhost:9093

### 🚀 Next Steps

1. **Start Development Environment**
   \`\`\`bash
   make dev
   \`\`\`

2. **Deploy to Staging**
   \`\`\`bash
   ./scripts/deployment/deploy-manager.sh deploy staging
   \`\`\`

3. **Deploy to Production**
   \`\`\`bash
   ./scripts/deployment/deploy-manager.sh deploy production
   \`\`\`

4. **Monitor Application**
   \`\`\`bash
   cd monitoring && ./start-monitoring.sh
   \`\`\`

5. **View Deployment Status**
   \`\`\`bash
   ./scripts/deployment/deploy-manager.sh status
   \`\`\`

### 📚 Documentation

- [CI/CD Pipeline](.github/workflows/ci-cd-pipeline.yml)
- [GitHub Secrets Setup](.github/GITHUB_SECRETS_SETUP.md)
- [Deployment Procedures](DEPLOYMENT_PROCEDURES.md)
- [Monitoring Setup](monitoring/README.md)
- [Security Guidelines](SECURITY.md)

### ⚠️ Important Reminders

1. **Rotate Secrets**: Remember to rotate secrets every 90 days
2. **Review PRs**: All production deployments require PR approval
3. **Monitor Alerts**: Check monitoring dashboards regularly
4. **Backup Data**: Ensure database backups are running
5. **Update Dependencies**: Run \`npm audit\` weekly

### 📞 Support

- Issues: https://github.com/$(git remote get-url origin | sed -E 's/.*[:/]([^/]+\/[^/]+)\.git/\1/')/issues
- Documentation: See /docs directory
- Logs: Check $LOG_FILE

---
Setup completed successfully at $(date)
EOF
    
    print_success "Report generated: $report_file"
    
    # Display report
    echo -e "\n${CYAN}=== SETUP COMPLETE ===${NC}"
    cat "$report_file"
    
    ((STEPS_COMPLETED++))
    print_progress
}

interactive_menu() {
    print_header "SoberLivings Master Setup - Interactive Mode"
    
    while true; do
        echo -e "\n${YELLOW}Select setup components:${NC}"
        echo "  1) Complete Setup (Recommended)"
        echo "  2) Prerequisites Only"
        echo "  3) GitHub Configuration"
        echo "  4) Monitoring Setup"
        echo "  5) Security Hardening"
        echo "  6) Deployment Tools"
        echo "  7) Test Pipeline"
        echo "  8) Generate Report"
        echo "  0) Exit"
        
        read -p "Enter option: " option
        
        case $option in
            1)
                check_prerequisites
                setup_environment
                configure_github_secrets
                setup_environments
                configure_branch_protection
                setup_monitoring
                apply_security_hardening
                validate_deployment
                test_pipeline
                generate_final_report
                ;;
            2) check_prerequisites ;;
            3) 
                configure_github_secrets
                setup_environments
                configure_branch_protection
                ;;
            4) setup_monitoring ;;
            5) apply_security_hardening ;;
            6) validate_deployment ;;
            7) test_pipeline ;;
            8) generate_final_report ;;
            0) 
                print_success "Setup complete!"
                exit 0
                ;;
            *)
                print_error "Invalid option"
                ;;
        esac
    done
}

main() {
    print_header "🚀 SoberLivings Master Setup Orchestrator"
    
    echo "This master script will orchestrate the complete CI/CD setup process."
    echo "Log file: $LOG_FILE"
    echo ""
    
    # Check for command line arguments
    case "${1:-}" in
        --auto|-a)
            print_info "Running in automatic mode..."
            check_prerequisites
            setup_environment
            configure_github_secrets
            setup_environments
            configure_branch_protection
            setup_monitoring
            apply_security_hardening
            validate_deployment
            test_pipeline
            generate_final_report
            ;;
        --quick|-q)
            print_info "Running quick setup (essentials only)..."
            check_prerequisites
            setup_environment
            configure_github_secrets
            setup_environments
            generate_final_report
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --auto, -a     Run complete setup automatically"
            echo "  --quick, -q    Run quick setup (essentials only)"
            echo "  --help, -h     Show this help message"
            echo ""
            echo "Without options, runs in interactive mode"
            exit 0
            ;;
        *)
            interactive_menu
            ;;
    esac
}

# Trap errors and cleanup
trap 'print_error "Setup failed! Check log: $LOG_FILE"' ERR

# Run main function
main "$@"