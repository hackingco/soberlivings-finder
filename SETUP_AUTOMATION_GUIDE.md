# 🚀 SoberLivings CI/CD Setup Automation Guide

## Overview

This guide provides step-by-step instructions for activating the complete CI/CD pipeline using the automated deployment scripts. The entire setup can be completed in under 10 minutes using the master orchestrator.

## 📋 Prerequisites

Before starting, ensure you have:

- [ ] Git repository cloned locally
- [ ] Node.js 18+ and npm installed
- [ ] Docker and Docker Compose installed
- [ ] GitHub CLI (`gh`) installed
- [ ] Admin access to the GitHub repository
- [ ] Required credentials ready:
  - Database URLs (staging and production)
  - Supabase credentials
  - Application URLs

## 🎯 Quick Start (Recommended)

### One-Command Setup

```bash
# Make scripts executable
chmod +x scripts/deployment/*.sh

# Run complete automated setup
./scripts/deployment/master-setup.sh --auto
```

This will automatically:
1. Check all prerequisites
2. Configure GitHub secrets
3. Set up environments with protection rules
4. Configure branch protection
5. Install monitoring stack
6. Apply security hardening
7. Validate deployment
8. Test the pipeline
9. Generate a comprehensive report

## 📚 Detailed Setup Options

### Interactive Mode

For more control over the setup process:

```bash
./scripts/deployment/master-setup.sh
```

This presents a menu where you can:
- Run complete setup
- Execute individual components
- Skip certain steps
- Generate reports

### Quick Setup (Essentials Only)

For minimal setup without monitoring and security:

```bash
./scripts/deployment/master-setup.sh --quick
```

## 🔧 Individual Script Usage

### 1. CI/CD Pipeline Setup

```bash
./scripts/deployment/setup-cicd.sh
```

**Options:**
1. Complete setup (all steps)
2. Configure GitHub secrets
3. Set up environments
4. Configure branch protection
5. Enable GitHub Actions
6. Test pipeline
7. Generate status report

**Required Information:**
- Database URLs (staging and production)
- Supabase project details
- Application URLs

### 2. Monitoring Setup

```bash
./scripts/deployment/setup-monitoring.sh
```

**Creates:**
- Prometheus configuration
- Grafana dashboards
- AlertManager rules
- Docker Compose for monitoring stack

**Access Points:**
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (admin/admin)
- AlertManager: http://localhost:9093

### 3. Security Hardening

```bash
./scripts/deployment/security-hardening.sh
```

**Implements:**
- Secret scanning with TruffleHog and Gitleaks
- Git hooks for pre-commit and pre-push checks
- Docker security configurations
- CORS and rate limiting
- Security headers
- Dependency auditing

### 4. Deployment Manager

```bash
./scripts/deployment/deploy-manager.sh
```

**Commands:**
```bash
# Deploy to staging
./scripts/deployment/deploy-manager.sh deploy staging

# Deploy to production
./scripts/deployment/deploy-manager.sh deploy production

# Rollback deployment
./scripts/deployment/deploy-manager.sh rollback

# Check deployment status
./scripts/deployment/deploy-manager.sh status

# Run health checks
./scripts/deployment/deploy-manager.sh health
```

## 📊 Verification Steps

After setup, verify everything is working:

### 1. Check GitHub Configuration

```bash
# List configured secrets
gh secret list

# Check environments
gh api /repos/OWNER/REPO/environments

# Verify workflows
ls -la .github/workflows/
```

### 2. Test Local Development

```bash
# Start development environment
make dev

# Check application
curl http://localhost:3000/api/health

# Check database
make db-status
```

### 3. Test CI/CD Pipeline

```bash
# Create test branch
git checkout -b test-cicd

# Make small change
echo "test" > test.txt
git add test.txt
git commit -m "test: CI/CD pipeline"

# Push and create PR
git push origin test-cicd
gh pr create --title "Test CI/CD" --body "Testing pipeline"
```

### 4. Monitor Services

```bash
# Start monitoring
cd monitoring && ./start-monitoring.sh

# Check status
./check-health.sh
```

## 🔐 Security Checklist

After setup, ensure:

- [ ] All secrets are configured in GitHub
- [ ] Branch protection is enabled for main
- [ ] Production environment requires approval
- [ ] Git hooks are installed locally
- [ ] Security scanning is enabled
- [ ] Rate limiting is configured
- [ ] CORS is properly set up

## 🚨 Troubleshooting

### GitHub CLI Authentication Issues

```bash
# Re-authenticate
gh auth logout
gh auth login
```

### Docker Permission Issues

```bash
# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

### Missing Dependencies

```bash
# macOS
brew install gh jq node docker

# Ubuntu/Debian
sudo apt-get update
sudo apt-get install gh jq nodejs npm docker.io
```

### Secret Configuration Issues

```bash
# Verify secrets are set
gh secret list

# Re-run secret configuration
./scripts/deployment/setup-cicd.sh
# Select option 2 (Configure GitHub secrets)
```

## 📈 Performance Optimization

### Enable Caching

```bash
# GitHub Actions cache is auto-configured
# Local Docker layer caching
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
```

### Parallel Execution

The CI/CD pipeline automatically runs tests in parallel. To optimize further:

```yaml
# In .github/workflows/ci-cd-pipeline.yml
strategy:
  matrix:
    node-version: [18.x, 20.x]
```

## 🔄 Maintenance

### Weekly Tasks

```bash
# Update dependencies
cd frontend && npm update

# Security audit
npm audit

# Check for outdated packages
npm outdated
```

### Monthly Tasks

```bash
# Rotate secrets
./scripts/deployment/setup-cicd.sh
# Select option 2 and update secrets

# Review monitoring metrics
# Access Grafana dashboards

# Update security rules
./scripts/deployment/security-hardening.sh
```

## 📝 Environment Variables

### Required for CI/CD

```env
# Database
STAGING_DATABASE_URL=postgresql://...
PRODUCTION_DATABASE_URL=postgresql://...

# Supabase
SUPABASE_ACCESS_TOKEN=sbp_...
SUPABASE_PROJECT_REF=...
SUPABASE_DB_PASSWORD=...
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Application
STAGING_URL=https://staging.example.com
PRODUCTION_URL=https://example.com
NEXTAUTH_SECRET=...
```

### Optional for Monitoring

```env
PROMETHEUS_PUSHGATEWAY_URL=...
GRAFANA_API_KEY=...
SLACK_WEBHOOK_URL=...
```

## 🎉 Success Indicators

Your CI/CD pipeline is successfully set up when:

1. ✅ GitHub Actions badge shows "passing"
2. ✅ Secrets are listed in repository settings
3. ✅ Environments appear in GitHub UI
4. ✅ Branch protection prevents direct pushes to main
5. ✅ Pull requests trigger automated tests
6. ✅ Deployments require approval for production
7. ✅ Monitoring dashboards show metrics
8. ✅ Security scans run on every commit

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)

## 🆘 Support

If you encounter issues:

1. Check the log file: `/tmp/soberlivings-setup-*.log`
2. Review error messages in the terminal
3. Consult the troubleshooting section above
4. Create an issue in the repository

---

## Quick Command Reference

```bash
# Complete setup
./scripts/deployment/master-setup.sh --auto

# Deploy to staging
./scripts/deployment/deploy-manager.sh deploy staging

# Deploy to production
./scripts/deployment/deploy-manager.sh deploy production

# Check status
./scripts/deployment/deploy-manager.sh status

# Rollback
./scripts/deployment/deploy-manager.sh rollback

# Start monitoring
cd monitoring && ./start-monitoring.sh

# Security scan
./scripts/deployment/security-hardening.sh
```

---

**Last Updated**: August 2025
**Version**: 1.0.0
**Maintained By**: DevOps Team