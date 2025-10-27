#!/bin/bash
#
# Run All Nansen X402 Tests
# Tests all 18 Nansen endpoints individually
#

echo "🧪 Running All Nansen X402 Tests"
echo "================================"
echo ""
echo "This will test 18 Nansen endpoints via X402 payments"
echo "Estimated cost: ~\$0.018 (18 endpoints × \$0.001 each)"
echo "Estimated time: ~4-5 minutes (5 tests in parallel)"
echo ""

cd "$(dirname "$0")/.."

# Run all x402-nansen-*.test.ts files (5 in parallel)
bun test --concurrent 5 e2e/x402-nansen-*.test.ts

echo ""
echo "✅ All Nansen tests complete!"

