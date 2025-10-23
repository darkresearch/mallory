#!/bin/bash

# STRICT test - simulates Vercel even more closely by:
# 1. Testing from a clean checkout (no node_modules)
# 2. Using only what's in the repository

set -e

echo "🔬 STRICT Vercel Build Test (Simulating Clean Environment)"
echo "=========================================================="
echo ""
echo "⚠️  WARNING: This will remove node_modules and reinstall."
echo "   Press Ctrl+C to cancel, or Enter to continue..."
read

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Step 1: Complete cleanup (like fresh Vercel build)
echo "🧹 Step 1: Complete cleanup..."
rm -rf dist/
rm -rf .expo/
rm -rf node_modules/
rm -rf .metro/
echo "✅ Cleaned all artifacts and node_modules"
echo ""

# Step 2: Fresh install from lockfile (exactly like Vercel)
echo "📦 Step 2: Fresh install from lockfile..."
bun install
echo "✅ Fresh install complete"
echo ""

# Step 3: Verify workspace package is available
echo "🔍 Step 3: Verifying workspace packages..."
if [ -d "node_modules/streamdown-rn" ]; then
  echo "✅ streamdown-rn workspace package is available"
  ls -la node_modules/streamdown-rn | head -5
else
  echo "❌ streamdown-rn workspace package NOT found!"
  echo "   This will cause build failures in Vercel."
  exit 1
fi
echo ""

# Step 4: Run production build
echo "🔨 Step 4: Running production build..."
NODE_ENV=production npx expo export --platform web
echo ""

# Step 5: Verify output
echo "✅ Build completed!"
echo ""
echo "📊 Build Statistics:"
du -sh dist/
find dist -type f | wc -l | xargs echo "Files:"
echo ""

# Step 6: Check for common issues
echo "🔍 Step 6: Checking for common issues..."

if grep -r "undefined" dist/_expo/static/js/web/*.js > /dev/null 2>&1; then
  echo "⚠️  Warning: Found 'undefined' in bundle (might be normal)"
fi

if [ -f "dist/index.html" ] && grep -q "_expo/static/js/web/" dist/index.html; then
  echo "✅ index.html correctly references bundle"
else
  echo "❌ index.html doesn't reference bundle correctly"
  exit 1
fi

echo ""
echo "🎉 STRICT TEST PASSED!"
echo "   Your app will build successfully on Vercel."
echo ""
