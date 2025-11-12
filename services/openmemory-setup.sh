#!/bin/bash
# OpenMemory setup script for Mallory

echo "🚀 Setting up OpenMemory for Mallory..."

# Check if Docker is available
if ! command -v docker &> /dev/null; then
  echo "❌ Error: Docker is required but not installed"
  echo "   Please install Docker first: https://docs.docker.com/get-docker/"
  exit 1
fi

# Ensure compose directory exists with qdrant.yml
if [ ! -f services/compose/qdrant.yml ]; then
  echo "📝 Creating Qdrant compose file..."
  mkdir -p services/compose
  cat > services/compose/qdrant.yml << 'EOF'
services:
  mem0_store:
    image: qdrant/qdrant:latest
    restart: unless-stopped
    ports:
      - "6333:6333"
    volumes:
      - mem0_storage:/qdrant/storage
EOF
  echo "✅ Qdrant compose file created"
fi

# Use the official Mem0 setup script
echo "📥 Running Mem0 OpenMemory setup script..."
cd services
curl -sL https://raw.githubusercontent.com/mem0ai/mem0/main/openmemory/run.sh | bash

echo ""
echo "✅ OpenMemory setup complete!"
echo ""
echo "Note: OpenMemory is now running in Docker"
echo "Add to your server .env:"
echo "  OPENMEMORY_URL=http://localhost:8765"
echo "  OPENMEMORY_API_KEY=openmemory_dev_key"
