#!/bin/bash

# Preview the built app locally
# This lets you test the production build in a browser

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

if [ ! -d "dist" ]; then
  echo "❌ No dist/ directory found!"
  echo "   Run './test-vercel-build.sh' first to build the app."
  exit 1
fi

echo "🌐 Starting local preview server..."
echo ""
echo "📱 Open your browser to:"
echo "   http://localhost:8080"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

cd dist
python3 -m http.server 8080
