# GitHub Secrets Configuration Guide

## Required Secrets for CI/CD Pipeline

This document lists all GitHub Secrets that need to be configured for the CI/CD pipeline to work properly.

### 🔐 Database Secrets

#### Staging Database
- **`STAGING_DATABASE_URL`**
  ```
  postgresql://user:password@host:5432/database?schema=public
  ```
  Example: `postgresql://postgres:password@staging.example.com:5432/soberlivings_staging?schema=public`

#### Production Database
- **`PRODUCTION_DATABASE_URL`**
  ```
  postgresql://user:password@host:5432/database?schema=public&sslmode=require
  ```
  Example: `postgresql://postgres:password@db.supabase.co:5432/postgres?schema=public&sslmode=require`

### 🔑 Supabase Secrets

- **`SUPABASE_ACCESS_TOKEN`**
  - Get from: https://app.supabase.com/account/tokens
  - Format: `sbp_` followed by 40 hex characters
  - Example: `sbp_e97b6c24f06ec7be829096abceb80a387de16ede`

- **`SUPABASE_PROJECT_REF`**
  - Your Supabase project reference ID
  - Example: `acwtjmqtwnijzbioauwn`

- **`SUPABASE_DB_PASSWORD`**
  - Database password for Supabase project
  - Get from: Dashboard → Settings → Database

- **`NEXT_PUBLIC_SUPABASE_URL`**
  - Your Supabase project URL
  - Example: `https://acwtjmqtwnijzbioauwn.supabase.co`

- **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**
  - Public anonymous key for Supabase
  - Safe to expose in frontend
  - Get from: Dashboard → Settings → API

- **`SUPABASE_SERVICE_ROLE_KEY`**
  - Service role key for backend operations
  - ⚠️ **NEVER expose this in frontend code**
  - Get from: Dashboard → Settings → API

### 🌐 Application URLs

- **`STAGING_URL`**
  - Your staging environment URL
  - Example: `https://staging.soberlivings.com`

- **`PRODUCTION_URL`**
  - Your production environment URL
  - Example: `https://soberlivings.com`

### 🔒 Authentication Secrets

- **`NEXTAUTH_SECRET`**
  - Random string for NextAuth.js
  - Generate: `openssl rand -base64 32`

### 📊 Monitoring (Optional)

- **`PROMETHEUS_PUSHGATEWAY_URL`**
  - URL for Prometheus Pushgateway
  - Example: `https://pushgateway.example.com`

- **`GRAFANA_API_KEY`**
  - API key for Grafana dashboards
  - Create from: Grafana → Configuration → API Keys

### 🔄 Secret Rotation Tracking

- **`LAST_SECRET_ROTATION`**
  - Unix timestamp of last rotation
  - Update when rotating secrets
  - Example: `1698768000`

## How to Add Secrets to GitHub

### Via GitHub Web Interface

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Enter the secret name and value
5. Click **Add secret**

### Via GitHub CLI

```bash
# Install GitHub CLI
brew install gh  # or: apt install gh

# Authenticate
gh auth login

# Add a secret
gh secret set STAGING_DATABASE_URL --body "postgresql://..."

# Add from file
echo "your-secret-value" | gh secret set SUPABASE_ACCESS_TOKEN

# List secrets
gh secret list
```

### Via GitHub API

```bash
# Encrypt and add secret via API
curl -X PUT \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/OWNER/REPO/actions/secrets/SECRET_NAME \
  -d '{"encrypted_value":"...","key_id":"..."}'
```

## Environment-Specific Secrets

### Development Environment
These are typically stored in `.env.local` and not in GitHub:
- Local database credentials
- Development API keys
- Test tokens

### Staging Environment
Prefix with `STAGING_`:
- `STAGING_DATABASE_URL`
- `STAGING_API_KEY`
- `STAGING_REDIS_URL`

### Production Environment
Use production names or prefix with `PRODUCTION_`:
- `PRODUCTION_DATABASE_URL`
- `DATABASE_URL` (if only one production DB)
- Production API keys

## Security Best Practices

### ✅ DO:
1. **Rotate secrets regularly** (every 90 days)
2. **Use different secrets** for each environment
3. **Limit secret access** to required workflows only
4. **Audit secret usage** regularly
5. **Use GitHub Environments** for production secrets
6. **Enable required reviewers** for production deployments

### ❌ DON'T:
1. **Never commit secrets** to the repository
2. **Don't log secret values** in workflows
3. **Don't use personal tokens** for CI/CD
4. **Avoid hardcoding** secret names in scripts
5. **Don't share** repository secrets across projects

## Verifying Secrets

### Test Secret Configuration

```yaml
# .github/workflows/test-secrets.yml
name: Test Secrets Configuration

on:
  workflow_dispatch:

jobs:
  test-secrets:
    runs-on: ubuntu-latest
    steps:
      - name: Check required secrets
        run: |
          # Check if secrets are set (not their values)
          secrets=(
            "STAGING_DATABASE_URL"
            "PRODUCTION_DATABASE_URL"
            "SUPABASE_ACCESS_TOKEN"
            "SUPABASE_PROJECT_REF"
          )
          
          for secret in "${secrets[@]}"; do
            if [ -z "${!secret}" ]; then
              echo "❌ $secret is not set"
              exit 1
            else
              echo "✅ $secret is configured"
            fi
          done
        env:
          STAGING_DATABASE_URL: ${{ secrets.STAGING_DATABASE_URL }}
          PRODUCTION_DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_PROJECT_REF: ${{ secrets.SUPABASE_PROJECT_REF }}
```

## Troubleshooting

### Secret Not Found
- Ensure secret name matches exactly (case-sensitive)
- Check if secret is in the correct environment
- Verify workflow has access to the secret

### Authentication Failures
- Rotate the secret and update in GitHub
- Check secret format and encoding
- Verify secret hasn't expired

### Permission Errors
- Ensure GitHub Actions has necessary permissions
- Check repository settings for Actions permissions
- Verify environment protection rules

## Quick Setup Script

```bash
#!/bin/bash
# setup-github-secrets.sh

echo "Setting up GitHub Secrets for SoberLivings CI/CD"

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "GitHub CLI not found. Please install: brew install gh"
    exit 1
fi

# Authenticate if needed
gh auth status || gh auth login

# Prompt for secrets
read -p "Enter STAGING_DATABASE_URL: " staging_db
read -p "Enter PRODUCTION_DATABASE_URL: " prod_db
read -p "Enter SUPABASE_ACCESS_TOKEN: " supabase_token
read -p "Enter SUPABASE_PROJECT_REF: " supabase_ref
read -sp "Enter SUPABASE_DB_PASSWORD: " supabase_pass
echo
read -p "Enter STAGING_URL: " staging_url
read -p "Enter PRODUCTION_URL: " prod_url

# Set secrets
gh secret set STAGING_DATABASE_URL --body "$staging_db"
gh secret set PRODUCTION_DATABASE_URL --body "$prod_db"
gh secret set SUPABASE_ACCESS_TOKEN --body "$supabase_token"
gh secret set SUPABASE_PROJECT_REF --body "$supabase_ref"
gh secret set SUPABASE_DB_PASSWORD --body "$supabase_pass"
gh secret set STAGING_URL --body "$staging_url"
gh secret set PRODUCTION_URL --body "$prod_url"

# Set rotation timestamp
gh secret set LAST_SECRET_ROTATION --body "$(date +%s)"

echo "✅ Secrets configured successfully!"
gh secret list
```

## Next Steps

1. **Configure all required secrets** listed above
2. **Test the CI/CD pipeline** with a test commit
3. **Set up environment protection** for production
4. **Enable branch protection** for main branch
5. **Configure webhook notifications** for deployment status

---

**Security Note**: This guide references example values. Never use these examples in production. Always generate new, secure values for your secrets.

**Last Updated**: August 2025
**Maintained By**: DevOps Team