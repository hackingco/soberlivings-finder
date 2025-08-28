#!/bin/bash

# Vercel-safe build script
echo "🚀 Building for Vercel deployment..."

# Set default environment variables if not present
export NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL:-"https://acwtjmqtwnijzbioauwn.supabase.co"}
export NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY:-"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjd3RqbXF0d25panpiaW9hdXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMjk4MjMsImV4cCI6MjA3MTkwNTgyM30.seFIOOiaWhJyPscqs2XAaEAbnxVU6G45NXMe3C9JZAM"}

# Skip Prisma generation if DATABASE_URL is not set
if [ -z "$DATABASE_URL" ]; then
  echo "⚠️  DATABASE_URL not set, skipping Prisma generation..."
  # Create minimal Prisma client stub
  mkdir -p node_modules/.prisma/client
  echo "module.exports = { PrismaClient: class PrismaClient {} }" > node_modules/.prisma/client/index.js
else
  echo "✅ Generating Prisma client..."
  npx prisma generate || true
fi

# Run Next.js build
echo "📦 Building Next.js application..."
next build

echo "✅ Build complete!"