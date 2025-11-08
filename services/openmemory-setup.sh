#!/bin/bash
# OpenMemory setup script for Mallory

echo "🚀 Setting up OpenMemory for Mallory..."

# Create .env file if it doesn't exist
if [ ! -f services/openmemory/backend/.env ]; then
  echo "📝 Creating OpenMemory .env file..."
  cat > services/openmemory/backend/.env << 'EOF'
# OpenMemory Configuration for Mallory

# Embedding Provider - Using Gemini (free tier!)
OM_EMBED_PROVIDER=gemini
OM_GEMINI_API_KEY=${GEMINI_API_KEY}

# Server Configuration
OM_PORT=8080

# Database - Using SQLite for local development (no Redis needed!)
OM_DB_TYPE=sqlite
OM_DB_PATH=./data/openmemory.sqlite

# Memory Tier
OM_TIER=smart

# Vector Dimensions (Gemini)
OM_VEC_DIM=768

# API Key
OM_API_KEY=${OPENMEMORY_API_KEY:-openmemory_dev_key}
EOF
  echo "✅ .env file created"
else
  echo "✅ .env file already exists"
fi

# Build OpenMemory
echo "🔨 Building OpenMemory..."
cd services/openmemory/backend
bun run build

echo ""
echo "✅ OpenMemory is ready!"
echo ""
echo "To start OpenMemory:"
echo "  cd services/openmemory/backend && bun start"
echo ""
echo "Or add to your .env:"
echo "  OPENMEMORY_URL=http://localhost:8080"
echo "  OPENMEMORY_API_KEY=openmemory_dev_key"
echo "  OPENAI_API_KEY=your_openai_key"

