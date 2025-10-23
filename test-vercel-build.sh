#!/bin/bash

# Test script to simulate Vercel's build process locally
# This helps verify the build will work in production

set -e  # Exit on any error

echo "🧪 Testing Vercel Build Locally"
echo "================================"
echo ""

# Store current directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Step 1: Clean previous build artifacts
echo "📦 Step 1: Cleaning previous build artifacts..."
rm -rf dist/
rm -rf .expo/
rm -rf node_modules/.cache/
echo "✅ Cleaned"
echo ""

# Step 2: Simulate fresh dependency install (like Vercel does)
echo "📦 Step 2: Installing dependencies (simulating Vercel)..."
# Note: We won't actually remove node_modules since that's already installed
# but in Vercel, this runs fresh
bun install
echo "✅ Dependencies installed"
echo ""

# Step 3: Run the exact build command Vercel uses
echo "🔨 Step 3: Running Vercel build command..."
echo "Command: npx expo export --platform web"
echo ""

# Run the build with similar environment to Vercel
NODE_ENV=production npx expo export --platform web

echo ""
echo "✅ Build completed successfully!"
echo ""

# Step 4: Verify output
echo "📊 Step 4: Verifying build output..."
if [ -d "dist" ]; then
  echo "✅ dist/ directory created"
  
  if [ -f "dist/index.html" ]; then
    echo "✅ index.html exists"
  else
    echo "❌ index.html missing!"
    exit 1
  fi
  
  if [ -d "dist/_expo" ]; then
    echo "✅ _expo/ directory exists"
  else
    echo "❌ _expo/ directory missing!"
    exit 1
  fi
  
  # Check bundle size
  BUNDLE_SIZE=$(du -sh dist/ | cut -f1)
  echo "📦 Total bundle size: $BUNDLE_SIZE"
  
  # Count files
  FILE_COUNT=$(find dist -type f | wc -l | tr -d ' ')
  echo "📄 Total files: $FILE_COUNT"
  
else
  echo "❌ dist/ directory not created!"
  exit 1
fi

echo ""
echo "🎉 Success! Your build matches Vercel's production build."
echo ""
echo "💡 To preview the build locally:"
echo "   cd dist && python3 -m http.server 8080"
echo "   Then open http://localhost:8080"
echo ""
