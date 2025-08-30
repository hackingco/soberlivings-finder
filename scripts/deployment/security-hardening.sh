#!/bin/bash
# Security Hardening Script - Apply security best practices
# Implements comprehensive security measures for the deployment

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
log() { echo -e "${BLUE}[SECURITY]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

# Generate secure passwords
generate_passwords() {
    log "Generating secure passwords..."
    
    # Generate random passwords
    DB_PASSWORD=$(openssl rand -base64 32)
    JWT_SECRET=$(openssl rand -base64 32)
    ENCRYPTION_KEY=$(openssl rand -base64 32)
    SESSION_SECRET=$(openssl rand -base64 32)
    REDIS_PASSWORD=$(openssl rand -base64 24)
    
    # Save to secure location
    cat > "$PROJECT_ROOT/.env.secure" << EOF
# Generated secure credentials - $(date)
# IMPORTANT: Keep this file secure and never commit to git

DB_PASSWORD=$DB_PASSWORD
JWT_SECRET=$JWT_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY
SESSION_SECRET=$SESSION_SECRET
REDIS_PASSWORD=$REDIS_PASSWORD
EOF
    
    chmod 600 "$PROJECT_ROOT/.env.secure"
    success "Secure passwords generated and saved to .env.secure"
}

# Configure SSL certificates
configure_ssl() {
    log "Configuring SSL certificates..."
    
    # Check if Let's Encrypt should be used
    read -p "Use Let's Encrypt for SSL? (y/n): " use_letsencrypt
    
    if [ "$use_letsencrypt" = "y" ]; then
        log "Setting up Let's Encrypt..."
        
        # Create certbot configuration
        cat > "$PROJECT_ROOT/nginx/certbot.conf" << 'EOF'
server {
    listen 80;
    server_name _;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$host$request_uri;
    }
}
EOF
        
        # Add certbot to docker-compose
        cat >> "$PROJECT_ROOT/docker-compose.staging.yml" << 'EOF'

  certbot:
    image: certbot/certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
EOF
        
        success "Let's Encrypt configuration added"
    else
        warning "Using self-signed certificates"
    fi
}

# Harden Docker containers
harden_containers() {
    log "Hardening Docker containers..."
    
    # Create security options for docker-compose
    cat > "$PROJECT_ROOT/docker-compose.security.yml" << 'EOF'
version: '3.8'

# Security hardening overrides
services:
  app:
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETUID
      - SETGID
    read_only: true
    tmpfs:
      - /tmp
      - /app/.next/cache

  postgres-staging:
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETUID
      - SETGID
      - DAC_OVERRIDE

  redis-staging:
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETUID
      - SETGID

  nginx:
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETUID
      - SETGID
      - NET_BIND_SERVICE
EOF
    
    success "Container hardening configuration created"
}

# Configure firewall rules
configure_firewall() {
    log "Configuring firewall rules..."
    
    # Check if ufw is available
    if command -v ufw &> /dev/null; then
        log "Setting up UFW firewall rules..."
        
        # Basic rules
        sudo ufw default deny incoming
        sudo ufw default allow outgoing
        
        # Allow SSH
        sudo ufw allow 22/tcp
        
        # Allow HTTP and HTTPS
        sudo ufw allow 80/tcp
        sudo ufw allow 443/tcp
        
        # Allow staging ports (restrict to specific IPs in production)
        sudo ufw allow 3002/tcp  # Staging app
        sudo ufw allow 9091/tcp  # Prometheus
        sudo ufw allow 3003/tcp  # Grafana
        
        success "Firewall rules configured"
    else
        warning "UFW not found, skipping firewall configuration"
    fi
}

# Setup security scanning
setup_security_scanning() {
    log "Setting up security scanning..."
    
    # Create security scanning workflow
    cat > "$PROJECT_ROOT/.github/workflows/security.yml" << 'EOF'
name: Security Scanning

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday

jobs:
  secret-scanning:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: TruffleHog OSS
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          head: HEAD
          
      - name: Gitleaks
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  dependency-scanning:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run npm audit
        working-directory: ./frontend
        run: |
          npm audit --audit-level=moderate || true
          
      - name: Run Snyk
        if: ${{ secrets.SNYK_TOKEN }}
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=medium

  container-scanning:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Trivy
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'
          
      - name: Upload Trivy results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'
EOF
    
    success "Security scanning configured"
}

# Configure secrets rotation
configure_secrets_rotation() {
    log "Configuring secrets rotation..."
    
    # Create rotation script
    cat > "$PROJECT_ROOT/scripts/rotate-secrets.sh" << 'EOF'
#!/bin/bash
# Rotate secrets and update configurations

set -e

echo "Starting secrets rotation..."

# Generate new secrets
NEW_JWT_SECRET=$(openssl rand -base64 32)
NEW_SESSION_SECRET=$(openssl rand -base64 32)
NEW_ENCRYPTION_KEY=$(openssl rand -base64 32)

# Update GitHub secrets
gh secret set JWT_SECRET --body "$NEW_JWT_SECRET"
gh secret set SESSION_SECRET --body "$NEW_SESSION_SECRET"
gh secret set ENCRYPTION_KEY --body "$NEW_ENCRYPTION_KEY"

# Update rotation timestamp
gh secret set LAST_SECRET_ROTATION --body "$(date +%s)"

echo "Secrets rotated successfully"
echo "Remember to redeploy the application for changes to take effect"
EOF
    
    chmod +x "$PROJECT_ROOT/scripts/rotate-secrets.sh"
    success "Secrets rotation script created"
}

# Apply security headers
apply_security_headers() {
    log "Applying security headers to nginx..."
    
    # Update nginx configuration with security headers
    cat > "$PROJECT_ROOT/nginx/security-headers.conf" << 'EOF'
# Security Headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:;" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

# Hide nginx version
server_tokens off;

# Prevent clickjacking
add_header X-Frame-Options DENY;

# Enable HSTS
add_header Strict-Transport-Security "max-age=63072000; includeSubdomains; preload";
EOF
    
    success "Security headers configuration created"
}

# Create security checklist
create_security_checklist() {
    log "Creating security checklist..."
    
    cat > "$PROJECT_ROOT/SECURITY_CHECKLIST.md" << 'EOF'
# Security Checklist

## Pre-Deployment
- [ ] All secrets rotated from defaults
- [ ] SSL certificates configured
- [ ] Firewall rules applied
- [ ] Security scanning enabled
- [ ] Dependencies updated
- [ ] Container images scanned

## Authentication & Authorization
- [ ] Strong password policy enforced
- [ ] JWT tokens expire appropriately
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Session management secure

## Data Protection
- [ ] Database encrypted at rest
- [ ] Sensitive data encrypted in transit
- [ ] Backups encrypted
- [ ] PII data anonymized in logs

## Infrastructure
- [ ] Containers run as non-root
- [ ] Network segmentation implemented
- [ ] Least privilege principle applied
- [ ] Security updates automated
- [ ] Monitoring and alerting configured

## Incident Response
- [ ] Incident response plan documented
- [ ] Contact information updated
- [ ] Backup restoration tested
- [ ] Rollback procedures verified

## Compliance
- [ ] GDPR compliance verified
- [ ] Security headers implemented
- [ ] Audit logging enabled
- [ ] Data retention policies configured
EOF
    
    success "Security checklist created"
}

# Validate security
validate_security() {
    log "Validating security configuration..."
    
    local issues=0
    
    # Check for default passwords
    if grep -q "password\|secret\|12345\|admin" "$PROJECT_ROOT/.env.staging" 2>/dev/null; then
        warning "✗ Default passwords detected in .env.staging"
        ((issues++))
    else
        success "✓ No default passwords in .env.staging"
    fi
    
    # Check SSL configuration
    if [ -f "$PROJECT_ROOT/nginx/ssl-staging/staging.crt" ]; then
        success "✓ SSL certificates configured"
    else
        warning "✗ SSL certificates not found"
        ((issues++))
    fi
    
    # Check security headers
    if [ -f "$PROJECT_ROOT/nginx/security-headers.conf" ]; then
        success "✓ Security headers configured"
    else
        warning "✗ Security headers not configured"
        ((issues++))
    fi
    
    # Check GitHub secrets
    if gh secret list | grep -q "JWT_SECRET"; then
        success "✓ GitHub secrets configured"
    else
        warning "✗ GitHub secrets not configured"
        ((issues++))
    fi
    
    if [ "$issues" -eq 0 ]; then
        success "All security checks passed!"
    else
        warning "$issues security issues found. Please review."
    fi
}

# Main execution
main() {
    if [ "${1:-}" = "--auto" ]; then
        log "Running automated security hardening..."
        generate_passwords
        harden_containers
        setup_security_scanning
        configure_secrets_rotation
        apply_security_headers
        create_security_checklist
        validate_security
        success "Security hardening complete!"
    else
        log "Interactive security hardening"
        
        read -p "Generate secure passwords? (y/n): " gen_pass
        [ "$gen_pass" = "y" ] && generate_passwords
        
        read -p "Configure SSL certificates? (y/n): " config_ssl
        [ "$config_ssl" = "y" ] && configure_ssl
        
        read -p "Harden Docker containers? (y/n): " harden
        [ "$harden" = "y" ] && harden_containers
        
        read -p "Configure firewall? (y/n): " firewall
        [ "$firewall" = "y" ] && configure_firewall
        
        read -p "Setup security scanning? (y/n): " scanning
        [ "$scanning" = "y" ] && setup_security_scanning
        
        read -p "Configure secrets rotation? (y/n): " rotation
        [ "$rotation" = "y" ] && configure_secrets_rotation
        
        apply_security_headers
        create_security_checklist
        validate_security
        
        success "Security hardening complete!"
    fi
}

main "$@"