#!/bin/bash
# OpenMemory setup script for Mallory

set -e
set -o pipefail

echo "🚀 Setting up OpenMemory for Mallory..."

# Check if npm is available (OpenMemory backend uses npm, not bun)
if ! command -v npm &> /dev/null; then
  echo "❌ Error: npm is required but not installed"
  echo "   Please install Node.js and npm first: https://nodejs.org"
  exit 1
fi

# Navigate to services directory
cd "$(dirname "$0")"

# Clone OpenMemory repository if it doesn't exist
if [ ! -d "openmemory" ]; then
  echo "📥 Cloning OpenMemory repository..."
  git clone https://github.com/CaviraOSS/OpenMemory.git openmemory
  echo "✅ OpenMemory repository cloned"
else
  echo "✅ OpenMemory repository already exists"
fi

# Create .env file if it doesn't exist
if [ ! -f openmemory/backend/.env ]; then
  echo "📝 Creating OpenMemory .env file..."
  mkdir -p openmemory/backend/data
  cat > openmemory/backend/.env << EOF
# OpenMemory Configuration for Mallory

# Embedding Provider - Using Gemini (free tier!) or OpenAI
OM_EMBED_PROVIDER=${OM_EMBED_PROVIDER:-gemini}
OM_GEMINI_API_KEY=${GEMINI_API_KEY:-}
OPENAI_API_KEY=${OPENAI_API_KEY:-}

# Server Configuration
OM_PORT=8080

# Database - Using SQLite for local development (no Redis needed!)
OM_DB_TYPE=sqlite
OM_DB_PATH=./data/openmemory.sqlite

# Memory Tier
OM_TIER=smart

# Vector Dimensions (Gemini: 768, OpenAI: 1536)
OM_VEC_DIM=${OM_VEC_DIM:-768}

# API Key for authentication
OM_API_KEY=${OPENMEMORY_API_KEY:-openmemory_dev_key}
EOF
  echo "✅ .env file created"
else
  echo "✅ .env file already exists"
fi

# Install dependencies
echo "📦 Installing OpenMemory dependencies..."
cd openmemory/backend
if [ ! -d "node_modules" ]; then
  npm install
  echo "✅ Dependencies installed"
else
  echo "✅ Dependencies already installed"
fi

# Build OpenMemory
echo "🔨 Building OpenMemory..."
npm run build

echo ""
echo "✅ OpenMemory setup complete!"
echo ""
echo "To start OpenMemory:"
echo "  cd services/openmemory/backend && npm start"
echo ""
echo "Or add to your server .env:"
echo "  OPENMEMORY_URL=http://localhost:8080"
echo "  OPENMEMORY_API_KEY=openmemory_dev_key"
echo "  GEMINI_API_KEY=your_gemini_key (optional, for free embeddings)"
echo "  OPENAI_API_KEY=your_openai_key (if not using Gemini)"
