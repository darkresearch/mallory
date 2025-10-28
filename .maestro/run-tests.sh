#!/bin/bash
# Maestro Test Runner Script
# Simplifies running Maestro tests with proper environment setup

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Default values
TEST_SUITE="all"
PLATFORM="ios"
WATCH=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --suite)
      TEST_SUITE="$2"
      shift 2
      ;;
    --platform)
      PLATFORM="$2"
      shift 2
      ;;
    --watch)
      WATCH=true
      shift
      ;;
    --help)
      echo "Usage: ./run-tests.sh [options]"
      echo ""
      echo "Options:"
      echo "  --suite <name>     Test suite to run (auth, smoke, all)"
      echo "  --platform <name>  Platform to test (ios, android)"
      echo "  --watch            Watch mode - re-run on file changes"
      echo "  --help             Show this help message"
      echo ""
      echo "Examples:"
      echo "  ./run-tests.sh --suite auth"
      echo "  ./run-tests.sh --suite auth --platform android"
      echo "  ./run-tests.sh --watch"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

# Check if Maestro is installed
if ! command -v maestro &> /dev/null; then
    echo -e "${RED}❌ Maestro is not installed!${NC}"
    echo "Install with: curl -Ls \"https://get.maestro.mobile.dev\" | bash"
    exit 1
fi

echo -e "${GREEN}🎭 Maestro E2E Test Runner${NC}"
echo ""

# Load environment variables
if [ -f ".maestro/.env.local" ]; then
    echo -e "${GREEN}✓${NC} Loading environment from .env.local"
    export $(cat .maestro/.env.local | grep -v '^#' | xargs)
else
    echo -e "${YELLOW}⚠${NC}  No .env.local found, using defaults"
    echo "   Create .maestro/.env.local from .env.example for custom config"
fi

# Set APP_ID based on platform
if [ "$PLATFORM" = "ios" ]; then
    export APP_ID="com.mallory.app"
elif [ "$PLATFORM" = "android" ]; then
    export APP_ID="com.mallory.app"
fi

echo -e "${GREEN}✓${NC} Platform: $PLATFORM"
echo -e "${GREEN}✓${NC} Test Suite: $TEST_SUITE"
echo -e "${GREEN}✓${NC} App ID: $APP_ID"
echo ""

# Determine test path
if [ "$TEST_SUITE" = "all" ]; then
    TEST_PATH=".maestro/flows"
else
    TEST_PATH=".maestro/flows/$TEST_SUITE"
fi

# Check if test path exists
if [ ! -d "$TEST_PATH" ]; then
    echo -e "${RED}❌ Test suite not found: $TEST_PATH${NC}"
    exit 1
fi

# Run tests
echo -e "${GREEN}🚀 Running Maestro tests...${NC}"
echo ""

if [ "$WATCH" = true ]; then
    echo -e "${YELLOW}👀 Watch mode enabled - tests will re-run on file changes${NC}"
    maestro test --continuous "$TEST_PATH"
else
    maestro test --format junit --output test-results.xml "$TEST_PATH"
    
    # Check if tests passed
    if [ $? -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✅ All tests passed!${NC}"
    else
        echo ""
        echo -e "${RED}❌ Some tests failed!${NC}"
        exit 1
    fi
fi

