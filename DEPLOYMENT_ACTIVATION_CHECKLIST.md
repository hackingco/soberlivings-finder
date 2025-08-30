# 🚀 Deployment Activation Checklist - Flip the Switch!

## ✅ One-Time Preparation (Local)

### 1️⃣ Authenticate CLIs
```bash
# GitHub CLI
gh auth login           

# Supabase (rotate token first!)
supabase login --token <NEW_SBP_TOKEN>
```

### 2️⃣ Verify Repository State
```bash
git fetch --all --prune
git rev-parse --abbrev-ref HEAD  # Should be 'main'
```

## 🎯 Full Automated Setup

### Quick Start - One Command
```bash
./scripts/deployment/master-setup.sh --auto
```

**What this does automatically:**
- ✅ Creates staging & production environments in GitHub
- ✅ Uploads all required secrets
- ✅ Enables GitHub Actions
- ✅ Configures branch protection
- ✅ Deploys monitoring stack (Prometheus/Grafana)
- ✅ Applies security hardening
- ✅ Runs smoke tests
- ✅ Validates entire pipeline

## 🔧 Alternative: Guided Interactive Mode

### Choose Your Path
```bash
# Full interactive setup with prompts
./scripts/deployment/master-setup.sh

# Individual components
./scripts/deployment/setup-cicd.sh         # Just CI/CD
./scripts/deployment/setup-monitoring.sh   # Just monitoring
./scripts/deployment/security-hardening.sh # Just security
./scripts/deployment/deploy-manager.sh     # Deployment control
```

## 🔐 Required Secrets (Minimum Set)

### Quick Secret Configuration via GitHub CLI
```bash
# Database URLs
gh secret set STAGING_DATABASE_URL --body "postgresql://user:pass@host:5432/staging_db"
gh secret set PRODUCTION_DATABASE_URL --body "postgresql://user:pass@host:5432/prod_db"

# Supabase (rotate the token first!)
gh secret set SUPABASE_ACCESS_TOKEN --body "sbp_YOUR_NEW_TOKEN_HERE"
gh secret set SUPABASE_PROJECT_REF --body "YOUR_PROJECT_REF"

# API URLs
gh secret set STAGING_URL --body "https://staging.soberlivings.com"
gh secret set PRODUCTION_URL --body "https://soberlivings.com"

# Security (generate new values)
gh secret set JWT_SECRET --body "$(openssl rand -base64 32)"
gh secret set ENCRYPTION_KEY --body "$(openssl rand -base64 32)"

# Optional: Monitoring webhooks
gh secret set SLACK_WEBHOOK_URL --body "https://hooks.slack.com/services/YOUR/WEBHOOK"
```

### Or Use the Setup Script
```bash
./.github/setup-secrets.sh
```

## 🧪 Test the Pipeline

### 1. Create Test Branch
```bash
git checkout -b test-cicd
echo "# Test" >> README.md
git add . && git commit -m "test: CI/CD validation"
git push -u origin test-cicd
```

### 2. Open Pull Request
```bash
gh pr create --title "Test: CI/CD Pipeline" --body "Testing deployment pipeline"
```

### 3. Watch GitHub Actions
- Go to GitHub → Actions tab
- Verify all checks pass
- Merge PR when ready

## 🚢 Deploy to Staging

### Method 1: Deploy Manager (Interactive)
```bash
./scripts/deployment/deploy-manager.sh
# Select: 1) Deploy to Staging
```

### Method 2: Direct Command
```bash
./scripts/deployment/deploy-manager.sh deploy staging
./scripts/deployment/deploy-manager.sh validate staging
```

### Method 3: Docker Compose
```bash
docker compose -f docker-compose.staging.yml up -d
./scripts/staging-health-check.sh
```

## ✅ Validate Deployment

### Health Checks
```bash
# Staging validation
curl https://localhost:8443/api/health  # Basic auth: staging/staging123

# Check all services
./scripts/deployment/deploy-manager.sh status

# View logs
docker compose -f docker-compose.staging.yml logs -f
```

### Access Monitoring
- **Prometheus**: http://localhost:9091
- **Grafana**: http://localhost:3003 (admin/staging_admin)
- **Application**: https://localhost:8443 (staging/staging123)

## 🔄 Rollback Testing

### Test Rollback Capability
```bash
# Staging rollback
./scripts/deployment/deploy-manager.sh rollback staging

# Verify rollback
./scripts/deployment/deploy-manager.sh validate staging
```

## 📈 Monitoring Setup

### Configure Alerts (Optional)
```bash
# Add to GitHub secrets
gh secret set PROMETHEUS_PUSHGATEWAY_URL --body "https://pushgateway.example.com"
gh secret set GRAFANA_API_KEY --body "YOUR_API_KEY"
```

### Import Dashboards
1. Access Grafana: http://localhost:3003
2. Login: admin/staging_admin
3. Import dashboards from `monitoring/grafana/dashboards/`

## 🧰 Troubleshooting Quick Fixes

### Actions Disabled
```bash
# Enable via Settings → Actions → "Allow all actions"
gh api repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)/actions/permissions \
  --method PUT --field enabled=true
```

### Missing Secrets
```bash
# List current secrets
gh secret list

# Re-run setup to add missing ones
./scripts/deployment/master-setup.sh --fix
```

### Permission Errors
```bash
# Check auth status
gh auth status

# Re-authenticate with proper scope
gh auth refresh -s repo,workflow
```

### Branch Protection Blocking
```bash
# Temporarily disable for testing
gh api repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)/branches/main/protection \
  --method DELETE
```

## 🎯 Suggested Follow-ups (Fast Wins)

### 1. Add Database Seeding to Pipeline
```yaml
# In .github/workflows/ci-cd-pipeline.yml
- name: Seed staging database
  run: |
    docker compose -f docker-compose.staging.yml exec -T app npm run db:seed
```

### 2. Add Prisma Migration Guard
```yaml
# In .github/workflows/ci-cd-pipeline.yml
- name: Check migrations
  run: |
    npx prisma migrate diff --exit-code || \
      (echo "Database schema out of sync!" && exit 1)
```

### 3. Auto-publish WordPress Plugin
```yaml
# Already configured in wordpress-plugin-release.yml
# Just create a release to trigger
gh release create v1.0.0 --generate-notes
```

## 📊 Success Criteria

Your deployment is ready when:
- ✅ All GitHub secrets configured (minimum 6)
- ✅ GitHub environments created (staging + production)
- ✅ Branch protection enabled on main
- ✅ CI/CD pipeline passes on test PR
- ✅ Staging deployment successful
- ✅ Health checks passing
- ✅ Monitoring dashboards accessible
- ✅ Rollback tested successfully

## 🚀 Production Deployment

Once staging is validated:
```bash
# Deploy to production (requires confirmation)
./scripts/deployment/deploy-manager.sh deploy production

# Or via GitHub Actions (push to main)
git checkout main
git merge develop
git push origin main
```

## 📞 Support

- **Logs**: `logs/` directory for all operations
- **Status**: `./scripts/deployment/deploy-manager.sh status`
- **Help**: Each script has `--help` flag
- **Interactive**: Run scripts without flags for menus

---

**Ready to flip the switch? Start with:**
```bash
./scripts/deployment/master-setup.sh --auto
```

This will activate your entire deployment infrastructure in one go! 🚀