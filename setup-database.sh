#!/bin/bash

echo "🚀 Setting up Supabase Database"
echo "================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
    echo -e "${GREEN}✓${NC} Environment variables loaded"
else
    echo -e "${RED}✗${NC} .env.local file not found!"
    exit 1
fi

# Check if required variables are set
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${RED}✗${NC} Missing required Supabase environment variables"
    exit 1
fi

echo ""
echo "📊 Database Setup Options:"
echo "1. Run setup via API endpoint (recommended)"
echo "2. Execute SQL directly in Supabase dashboard"
echo ""

# Try API endpoint first
echo -e "${YELLOW}→${NC} Attempting to set up database via API..."
echo ""

# Start the dev server in background
npm run dev > /dev/null 2>&1 &
SERVER_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 5

# Call the setup endpoint
RESPONSE=$(curl -s -X GET http://localhost:3000/api/setup-database)

# Kill the dev server
kill $SERVER_PID 2>/dev/null

# Check response
if echo "$RESPONSE" | grep -q "success.*true"; then
    echo -e "${GREEN}✓${NC} Database setup completed successfully!"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
else
    echo -e "${YELLOW}⚠${NC} API setup incomplete. Manual setup required."
    echo ""
    echo "📝 Manual Setup Instructions:"
    echo "================================"
    echo ""
    echo "1. Go to your Supabase SQL Editor:"
    echo "   https://app.supabase.com/project/acwtjmqtwnijzbioauwn/sql/new"
    echo ""
    echo "2. Copy the SQL from: setup-supabase.sql"
    echo ""
    echo "3. Paste and run the SQL in the editor"
    echo ""
    echo "4. Verify the table was created:"
    echo "   - Go to Table Editor"
    echo "   - Check for 'facilities' table"
    echo "   - Verify sample data exists"
    echo ""
    
    # Show the SQL file location
    if [ -f "setup-supabase.sql" ]; then
        echo "📄 SQL file ready at: $(pwd)/setup-supabase.sql"
        echo ""
        echo "Preview of SQL to run:"
        echo "----------------------"
        head -n 20 setup-supabase.sql
        echo "... (see full file for complete SQL)"
    fi
fi

echo ""
echo "✨ Next Steps:"
echo "1. Verify the database setup at: https://app.supabase.com/project/acwtjmqtwnijzbioauwn/editor"
echo "2. Test the application locally: npm run dev"
echo "3. Deploy to Vercel: npm run deploy"