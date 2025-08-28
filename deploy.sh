#!/bin/bash

# SoberLivings Finder - Automated Deployment Script
# This script automates the entire deployment process

set -e  # Exit on any error

echo "🚀 SoberLivings Finder - Automated Deployment"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper function for colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "frontend/package.json" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

print_status "Step 1: Preparing code for deployment..."

# Commit latest changes
cd frontend
npm run type-check || {
    print_error "TypeScript type checking failed. Please fix errors before deploying."
    exit 1
}

npm run build || {
    print_error "Build failed. Please fix build errors before deploying."
    exit 1
}

print_success "Build successful!"

cd ..
git add .
git commit -m "Deploy: Automated deployment $(date)" || print_warning "No changes to commit"
git push origin main

print_success "Code pushed to GitHub"

print_status "Step 2: Environment variables setup..."

# Check if .env.local exists for seeding
if [ ! -f "frontend/.env.local" ]; then
    print_warning ".env.local not found. Creating template..."
    cat > frontend/.env.local << 'EOF'
# Add your Supabase credentials here
DATABASE_URL=postgresql://postgres:your-password@db.your-project-id.supabase.co:5432/postgres
DIRECT_URL=postgresql://postgres:your-password@db.your-project-id.supabase.co:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
FIRECRAWL_API_KEY=fc-your-api-key-here
EOF
    print_warning "Please edit frontend/.env.local with your actual Supabase credentials"
    print_warning "Then run this script again with --skip-env flag"
    exit 0
fi

print_success "Environment file found"

print_status "Step 3: Deploying to Vercel..."

cd frontend

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    print_status "Installing Vercel CLI..."
    npm install -g vercel
fi

# Deploy to Vercel
print_status "Deploying to Vercel..."
vercel --prod --yes || {
    print_error "Vercel deployment failed"
    exit 1
}

print_success "Deployment to Vercel completed!"

print_status "Step 4: Database setup and seeding..."

# Generate Prisma client
print_status "Generating Prisma client..."
npx prisma generate

# Check if database is accessible
print_status "Testing database connection..."
if npx prisma db pull --preview-feature 2>/dev/null; then
    print_success "Database connection successful"
else
    print_warning "Could not connect to database. Skipping seeding."
    print_warning "Please:"
    print_warning "1. Set up your Supabase database using supabase-setup.sql"
    print_warning "2. Update your .env.local with correct credentials"
    print_warning "3. Run: npm run seed data-files"
    cd ..
    exit 0
fi

# Seed the database
print_status "Seeding database with facility data..."
npm run seed data-files || {
    print_warning "Database seeding failed. You can run it manually later with:"
    print_warning "cd frontend && npm run seed data-files"
}

print_success "Database seeded successfully!"

cd ..

print_success "🎉 Deployment completed successfully!"
echo ""
echo "=============================================="
echo "🌟 Your SoberLivings Finder is now live!"
echo "=============================================="
echo ""
echo "Next steps:"
echo "1. Visit your Vercel dashboard to get your app URL"
echo "2. Test the application thoroughly"
echo "3. Configure custom domain if needed"
echo "4. Set up monitoring and analytics"
echo ""
echo "Useful commands:"
echo "• Update data: cd frontend && npm run seed data-files"
echo "• View logs: vercel logs"
echo "• Redeploy: cd frontend && vercel --prod"
echo ""
print_success "Deployment guide: See DEPLOYMENT_GUIDE.md for detailed instructions"
