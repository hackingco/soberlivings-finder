#!/bin/bash
# Tiny helper to create environments and set a secret in one shot
# Usage: ./set-env-secret.sh SECRET_NAME "secret_value"

set -e

SECRET_NAME=$1
SECRET_VALUE=$2
REPO="${GITHUB_REPOSITORY:-hackingco/soberlivings-finder}"

if [ -z "$SECRET_NAME" ] || [ -z "$SECRET_VALUE" ]; then
    echo "Usage: $0 SECRET_NAME 'secret_value'"
    echo "Example: $0 JWT_SECRET 'd723a22a16510efab340cefca5081c13b2e6651be6a5624834439c7c9621f7d3'"
    exit 1
fi

echo "🏗️ Creating environments (if needed)..."
gh api -X PUT -H "Accept: application/vnd.github+json" "/repos/$REPO/environments/staging" >/dev/null 2>&1 || true
gh api -X PUT -H "Accept: application/vnd.github+json" "/repos/$REPO/environments/production" >/dev/null 2>&1 || true

echo "🔐 Setting $SECRET_NAME for both environments..."
gh secret set "$SECRET_NAME" --env staging --body "$SECRET_VALUE"
gh secret set "$SECRET_NAME" --env production --body "$SECRET_VALUE"

echo "✅ Done! Secret $SECRET_NAME set for staging and production environments."
echo ""
echo "📋 Verify with:"
echo "  gh secret list --env staging"
echo "  gh secret list --env production"