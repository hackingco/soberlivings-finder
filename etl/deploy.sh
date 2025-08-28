#!/bin/bash

echo "🚀 Deploying ETL Pipeline"
echo "========================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Change to ETL directory
cd "$(dirname "$0")"

# Step 1: Install dependencies
echo -e "${YELLOW}→${NC} Installing dependencies..."
npm install

# Step 2: Build TypeScript
echo -e "${YELLOW}→${NC} Building TypeScript..."
npm run build

# Step 3: Test the pipeline locally
echo -e "${YELLOW}→${NC} Testing pipeline with limited records..."
npm run etl:test

if [ $? -ne 0 ]; then
    echo -e "${RED}✗${NC} Pipeline test failed!"
    exit 1
fi

echo -e "${GREEN}✓${NC} Pipeline test successful"

# Step 4: Deploy to Vercel (as serverless function)
echo -e "${YELLOW}→${NC} Deploying to Vercel..."

# Create vercel.json for ETL
cat > vercel.json << EOF
{
  "functions": {
    "api/etl/route.ts": {
      "maxDuration": 60
    }
  },
  "crons": [
    {
      "path": "/api/etl",
      "schedule": "0 */6 * * *"
    }
  ]
}
EOF

# Deploy
vercel --prod

echo -e "${GREEN}✓${NC} ETL Pipeline deployed successfully!"
echo ""
echo "📊 Next Steps:"
echo "1. Configure API keys in Vercel environment variables"
echo "2. Test the API endpoint: POST /api/etl"
echo "3. Monitor logs in Vercel dashboard"
echo "4. Set up monitoring alerts"