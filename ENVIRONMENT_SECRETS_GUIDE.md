# 🔐 Environment-Scoped Secrets Guide

## 🎯 Quick Setup - Two Options

### Option 1: Keep It Simple (Repo-Level Secrets)
No changes needed! Your current workflow references work for all branches/environments:

```yaml
env:
  JWT_SECRET: ${{ secrets.JWT_SECRET }}
```

### Option 2: Environment-Scoped Secrets (Recommended)

## 🚀 Automated Setup

### One-Line Helper (Set Secret for Both Environments)
```bash
./scripts/set-env-secret.sh JWT_SECRET "d723a22a16510efab340cefca5081c13b2e6651be6a5624834439c7c9621f7d3"
```

### Interactive Full Setup
```bash
./scripts/deployment/setup-environment-secrets.sh
```

### Manual Commands (GitHub CLI)
```bash
# Create environments (idempotent)
gh api -X PUT -H "Accept: application/vnd.github+json" \
  /repos/hackingco/soberlivings-finder/environments/staging

gh api -X PUT -H "Accept: application/vnd.github+json" \
  /repos/hackingco/soberlivings-finder/environments/production

# Set environment-scoped secrets
gh secret set JWT_SECRET --env staging --body "staging_jwt_secret"
gh secret set JWT_SECRET --env production --body "production_jwt_secret"

# Verify
gh secret list --env staging
gh secret list --env production
```

## 📋 Current Status
✅ GitHub environments created: `staging`, `production`  
✅ Comprehensive secret manager script available
✅ Quick helper script for single secrets
✅ Test workflow to verify secret access
✅ CI/CD workflows updated to use environment secrets

## 🎛️ Usage in GitHub Actions

### With Environment Protection
```yaml
jobs:
  deploy-staging:
    environment: staging  # This line enables environment-scoped secrets
    runs-on: ubuntu-latest
    steps:
      - run: echo "JWT length: ${#JWT_SECRET}"
        env:
          JWT_SECRET: ${{ secrets.JWT_SECRET }}  # Gets staging value

  deploy-production:
    environment: production  # This line enables environment-scoped secrets
    runs-on: ubuntu-latest  
    steps:
      - run: echo "JWT length: ${#JWT_SECRET}"
        env:
          JWT_SECRET: ${{ secrets.JWT_SECRET }}  # Gets production value
```

## 🧪 Testing Your Setup

### Test Secret Access
```bash
# Test staging secrets
gh workflow run test-env-secrets.yml -f environment=staging

# Test production secrets  
gh workflow run test-env-secrets.yml -f environment=production
```

### Verify Current Secrets
```bash
# Check what secrets exist
./scripts/deployment/setup-environment-secrets.sh --verify

# Or manually
gh secret list --env staging
gh secret list --env production
gh secret list  # repo-level
```

## 🔄 Migration from Repo-Level Secrets

### Semi-Automated Migration
```bash
./scripts/deployment/setup-environment-secrets.sh
# Choose option 5: Migrate Repo Secrets to Environment Secrets
```

### Manual Migration
```bash
# 1. Set new environment-scoped values
gh secret set JWT_SECRET --env staging --body "new_staging_value"
gh secret set JWT_SECRET --env production --body "new_production_value"

# 2. Delete repo-level secret (optional)
gh secret delete JWT_SECRET
```

## 🛡️ Environment Protection Features

### Production Environment Includes:
- ✅ 10-second wait timer before deployment
- ✅ Requires `main` branch for deployment
- ✅ Can add required reviewers
- ✅ Deployment approval workflow

### Staging Environment:
- ✅ No deployment restrictions
- ✅ Allows any branch
- ✅ Immediate deployment

## 📊 Secret Management Tools

### Quick Helper Script
```bash
# Usage: ./scripts/set-env-secret.sh SECRET_NAME "value"
./scripts/set-env-secret.sh JWT_SECRET "your-secret-here"
./scripts/set-env-secret.sh DATABASE_URL "postgresql://..."
```

### Comprehensive Manager
```bash
./scripts/deployment/setup-environment-secrets.sh

# Interactive menu with options:
# 1) Quick Setup (generates secure secrets)  
# 2) Create Environments Only
# 3) Set Individual Secret
# 4) Bulk Set Secrets
# 5) Migrate Repo Secrets
# 6) Verify Current Secrets
# 7) Create Test Workflow
```

## 🔍 Common Patterns

### Secure Secret Generation
```bash
# Generate secure random secrets
JWT_SECRET=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)

# Set for both environments
gh secret set JWT_SECRET --env staging --body "$JWT_SECRET"
gh secret set JWT_SECRET --env production --body "$JWT_SECRET"
```

### Different Values Per Environment  
```bash
# Different database URLs
gh secret set DATABASE_URL --env staging --body "postgresql://staging-db"
gh secret set DATABASE_URL --env production --body "postgresql://prod-db"

# Different API keys
gh secret set API_KEY --env staging --body "staging_key"
gh secret set API_KEY --env production --body "prod_key"
```

## ⚠️ Important Notes

### Environment Names are Case-Sensitive
- ✅ `staging` (lowercase)
- ❌ `Staging` (capitalized)

### Repository Admin Required
- Creating environments requires repository admin permissions
- Setting environment secrets requires admin access

### Workflow File Requirements
```yaml
jobs:
  deploy:
    environment: staging  # This line is REQUIRED for env-scoped secrets
    steps:
      - run: echo "$SECRET_VALUE"
        env:
          SECRET_VALUE: ${{ secrets.SECRET_VALUE }}
```

## 🚀 Recommended Setup

1. **Run the quick setup:**
   ```bash
   ./scripts/deployment/setup-environment-secrets.sh --quick
   ```

2. **Test the setup:**
   ```bash
   gh workflow run test-env-secrets.yml -f environment=staging
   ```

3. **Update your workflows to use `environment:` key**

4. **Clean up old repo-level secrets (optional):**
   ```bash  
   gh secret delete JWT_SECRET
   ```

## 🎯 Benefits of Environment-Scoped Secrets

- 🔒 **Better Security**: Different secrets for staging/production
- 🎛️ **Environment Control**: Deployment approval workflows
- 🔍 **Clear Separation**: Obvious which secrets apply where
- 🛡️ **Protection Rules**: Prevent accidental production deployments
- 📊 **Audit Trail**: Better visibility into secret usage

Your environment-scoped secret management system is ready to use! 🚀