#!/bin/bash
# One-command Maestro test runner
# Run this from your terminal: ./run-maestro-test.sh

set -e

echo "🎭 Maestro Automated Test Runner"
echo "================================"
echo ""

# Add Maestro to PATH
export PATH="$PATH:$HOME/.maestro/bin"

# Check Java
echo "☕ Checking Java..."
if ! java -version &> /dev/null; then
    echo "❌ Java not found!"
    echo "Install: brew install openjdk@17"
    exit 1
fi
echo "✅ Java installed"
echo ""

# Check Maestro
echo "🎭 Checking Maestro..."
if ! command -v maestro &> /dev/null; then
    echo "❌ Maestro not found!"
    echo "Install: curl -Ls \"https://get.maestro.mobile.dev\" | bash"
    exit 1
fi
echo "✅ Maestro installed: $(maestro --version 2>&1 | head -1)"
echo ""

# Check backend
echo "🔧 Checking backend..."
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ Backend running"
else
    echo "❌ Backend not running!"
    echo ""
    echo "Start backend in another terminal:"
    echo "  cd apps/server && npm run dev"
    exit 1
fi
echo ""

# Check .env files
echo "📧 Checking Mailosaur config..."
if [ ! -f "apps/client/.env.test" ]; then
    echo "❌ apps/client/.env.test not found!"
    exit 1
fi
echo "✅ Mailosaur config found"
echo ""

# Create .maestro/.env.local if needed
if [ ! -f ".maestro/.env.local" ]; then
    echo "📝 Creating .maestro/.env.local..."
    TEST_EMAIL=$(grep "TEST_SUPABASE_EMAIL" apps/client/.env.test | cut -d '=' -f2)
    cat > .maestro/.env.local << EOF
APP_ID=com.mallory.app
BACKEND_URL=http://localhost:3001
TEST_EMAIL=$TEST_EMAIL
TIMEOUT_SHORT=5000
TIMEOUT_MEDIUM=15000
TIMEOUT_LONG=30000
EOF
    echo "✅ Created .maestro/.env.local"
else
    echo "✅ .maestro/.env.local exists"
fi
echo ""

# Check if app is running
echo "📱 Checking iOS Simulator..."
if xcrun simctl list devices | grep -q "Booted"; then
    echo "✅ iOS Simulator running"
else
    echo "⚠️  iOS Simulator not running"
    echo ""
    echo "Start app in another terminal:"
    echo "  cd apps/client && npx expo run:ios"
    echo ""
    echo "Waiting 10 seconds for you to start it..."
    sleep 10
fi
echo ""

# Run the test
echo "================================"
echo "🚀 Running Maestro Test..."
echo "================================"
echo ""

maestro test .maestro/flows/auth/new-user-signup-auto.yaml

echo ""
echo "================================"
echo "✅ Test completed!"
echo "================================"

