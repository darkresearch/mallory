#!/bin/bash
# Pre-flight check for Maestro test
# Verifies everything is ready before running automated tests

set -e

echo "🎯 Maestro Pre-flight Check"
echo "================================"
echo ""

# Check 1: Maestro installed
echo "1️⃣  Checking Maestro installation..."
if command -v maestro &> /dev/null; then
    echo "   ✅ Maestro installed: $(maestro --version)"
else
    echo "   ❌ Maestro not found!"
    echo "   Install: curl -Ls \"https://get.maestro.mobile.dev\" | bash"
    exit 1
fi
echo ""

# Check 2: Backend running
echo "2️⃣  Checking backend server..."
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "   ✅ Backend running on http://localhost:3001"
else
    echo "   ❌ Backend not running!"
    echo "   Start with: cd apps/server && npm run dev"
    exit 1
fi
echo ""

# Check 3: .env.test exists
echo "3️⃣  Checking Mailosaur credentials..."
if [ -f "apps/client/.env.test" ]; then
    echo "   ✅ apps/client/.env.test exists"
    
    # Check for required keys
    if grep -q "MAILOSAUR_API_KEY" apps/client/.env.test; then
        echo "   ✅ MAILOSAUR_API_KEY found"
    else
        echo "   ❌ MAILOSAUR_API_KEY missing from .env.test"
        exit 1
    fi
    
    if grep -q "TEST_SUPABASE_EMAIL" apps/client/.env.test; then
        TEST_EMAIL=$(grep "TEST_SUPABASE_EMAIL" apps/client/.env.test | cut -d '=' -f2)
        echo "   ✅ TEST_EMAIL: $TEST_EMAIL"
    else
        echo "   ❌ TEST_SUPABASE_EMAIL missing from .env.test"
        exit 1
    fi
else
    echo "   ❌ apps/client/.env.test not found!"
    exit 1
fi
echo ""

# Check 4: Maestro config
echo "4️⃣  Creating .maestro/.env.local if needed..."
if [ ! -f ".maestro/.env.local" ]; then
    echo "   Creating .maestro/.env.local..."
    cat > .maestro/.env.local << EOF
APP_ID=com.mallory.app
BACKEND_URL=http://localhost:3001
TEST_EMAIL=$TEST_EMAIL
TIMEOUT_SHORT=5000
TIMEOUT_MEDIUM=15000
TIMEOUT_LONG=30000
EOF
    echo "   ✅ Created .maestro/.env.local"
else
    echo "   ✅ .maestro/.env.local already exists"
fi
echo ""

# Check 5: iOS Simulator
echo "5️⃣  Checking iOS Simulator..."
if xcrun simctl list devices | grep -q "Booted"; then
    DEVICE=$(xcrun simctl list devices | grep "Booted" | head -1 | sed 's/.*(\([^)]*\)).*/\1/')
    echo "   ✅ iOS Simulator running: $DEVICE"
else
    echo "   ⚠️  No iOS Simulator running"
    echo "   Start app with: cd apps/client && npx expo run:ios"
    echo "   (You can still continue, Maestro will launch the app)"
fi
echo ""

echo "================================"
echo "✅ Pre-flight check complete!"
echo ""
echo "🚀 Ready to run test!"
echo ""
echo "Run this command:"
echo "  maestro test .maestro/flows/auth/new-user-signup-auto.yaml"
echo ""

