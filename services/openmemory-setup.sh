#!/bin/bash
# OpenMemory setup script for Mallory

echo "🚀 Setting up OpenMemory for Mallory..."

# Check if OpenMemory backend directory exists
if [ ! -d "services/openmemory/backend" ]; then
  echo "❌ OpenMemory backend not found!"
  echo ""
  echo "The OpenMemory backend is not included in this repository."
  echo "Cloning OpenMemory backend from CaviraOSS/OpenMemory..."
  echo ""
  
  # Create directory if it doesn't exist
  mkdir -p services/openmemory
  
  # Clone the repository
  git clone https://github.com/CaviraOSS/OpenMemory.git services/openmemory/backend
  
  if [ $? -ne 0 ]; then
    echo "❌ Failed to clone OpenMemory backend!"
    echo "Please check your internet connection and try again."
    exit 1
  fi
  
  # Remove .git directory to avoid nested git repository
  echo "🧹 Removing .git directory from cloned repository..."
  rm -rf services/openmemory/backend/.git
  
  echo "✅ OpenMemory backend cloned successfully!"
  echo ""
fi

# Check if package.json exists
if [ ! -f "services/openmemory/backend/package.json" ]; then
  echo "❌ OpenMemory backend package.json not found!"
  echo ""
  echo "The backend directory exists but doesn't contain the source code."
  echo "Please ensure you've cloned the complete OpenMemory backend repository."
  echo ""
  exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f services/openmemory/backend/.env ]; then
  echo "📝 Creating OpenMemory .env file..."
  mkdir -p services/openmemory/backend
  cat > services/openmemory/backend/.env << 'EOF'
# OpenMemory Configuration for Mallory
# See README.md for instructions on filling in these variables

# Embedding Provider - Using Gemini (free tier!)
OM_EMBED_PROVIDER=gemini
OM_GEMINI_API_KEY=your-gemini-api-key-here

# Server Configuration
OM_PORT=8080

# Database - Using SQLite for local development (no Redis needed!)
OM_DB_TYPE=sqlite
OM_DB_PATH=./data/openmemory.sqlite

# Memory Tier
OM_TIER=smart

# Vector Dimensions (Gemini)
OM_VEC_DIM=768

# API Key (used by Mallory server to authenticate with OpenMemory)
# Generate a secure random string for production use
OM_API_KEY=your-secure-api-key-here
EOF
  echo "✅ .env file created"
else
  echo "✅ .env file already exists"
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "services/openmemory/backend/node_modules" ]; then
  echo "📦 Installing OpenMemory dependencies..."
  cd services/openmemory/backend
  bun install
  cd ../../..
fi

# Build OpenMemory
echo "🔨 Building OpenMemory..."
cd services/openmemory/backend

# Check if build script exists in package.json
if ! grep -q '"build"' package.json; then
  echo "❌ 'build' script not found in package.json!"
  echo ""
  echo "The OpenMemory backend package.json is missing the 'build' script."
  echo "Please ensure you've cloned the correct version of the OpenMemory backend."
  echo ""
  exit 1
fi

bun run build

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ Build failed!"
  echo "Please check the error messages above and ensure:"
  echo "  1. All dependencies are installed (bun install)"
  echo "  2. The OpenMemory backend is up to date"
  echo "  3. Required environment variables are set"
  exit 1
fi

echo ""
echo "✅ OpenMemory is ready!"
echo ""
echo "To start OpenMemory:"
echo "  cd services/openmemory/backend && bun start"
echo ""
echo "📝 Next steps:"
echo "  1. Edit services/openmemory/backend/.env to configure your API keys"
echo "  2. See README.md for required environment variables"
echo "  3. Add OPENMEMORY_URL and OPENMEMORY_API_KEY to your server .env file"

