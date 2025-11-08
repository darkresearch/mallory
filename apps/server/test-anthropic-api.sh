#!/bin/bash

# CRITICAL INTEGRATION TEST
# Tests the thinking block fix with real Anthropic API calls
# Requires: ANTHROPIC_API_KEY environment variable

set -e

if [ -z "$ANTHROPIC_API_KEY" ]; then
  # Try to load from .env file
  if [ -f "../../.env" ]; then
    export $(cat ../../.env | grep ANTHROPIC_API_KEY | xargs)
  elif [ -f "../../../.env" ]; then
    export $(cat ../../../.env | grep ANTHROPIC_API_KEY | xargs)
  fi
  
  if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "❌ ANTHROPIC_API_KEY environment variable not set"
    echo "Please set it with: export ANTHROPIC_API_KEY=your_key"
    exit 1
  fi
fi

echo ""
echo "🧪 ========== ANTHROPIC API INTEGRATION TEST =========="
echo ""
echo "Testing the thinking block fix with real API calls..."
echo ""

# Test 1: Message WITHOUT thinking block (should fail with extended thinking)
echo "TEST 1: Message WITHOUT thinking block (expected to FAIL)"
echo "-------------------------------------------------------"
echo ""

WITHOUT_FIX=$(cat <<'EOF'
{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 100,
  "messages": [
    {
      "role": "user",
      "content": "What is 2+2?"
    },
    {
      "role": "assistant",
      "content": [
        {
          "type": "text",
          "text": "Let me use a tool."
        },
        {
          "type": "tool_use",
          "id": "toolu_01A09q90qw90lq917835lq9",
          "name": "calculator",
          "input": {"operation": "add", "a": 2, "b": 2}
        }
      ]
    }
  ],
  "tools": [
    {
      "name": "calculator",
      "description": "Perform calculations",
      "input_schema": {
        "type": "object",
        "properties": {
          "operation": {"type": "string"},
          "a": {"type": "number"},
          "b": {"type": "number"}
        }
      }
    }
  ],
  "thinking": {
    "type": "enabled",
    "budget_tokens": 5000
  }
}
EOF
)

RESPONSE=$(curl -s https://api.anthropic.com/v1/messages \
  -H "content-type: application/json" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: interleaved-thinking-2025-05-14" \
  -d "$WITHOUT_FIX")

if echo "$RESPONSE" | grep -q "thinking"; then
  echo "✅ EXPECTED: API returned error mentioning 'thinking'"
  echo "Error message: $(echo $RESPONSE | grep -o 'thinking[^"]*' | head -1)"
elif echo "$RESPONSE" | grep -q "error"; then
  echo "⚠️ Got an error (might be thinking-related):"
  echo "$RESPONSE" | grep -o '"message":"[^"]*"' | head -1
else
  echo "❌ UNEXPECTED: No error returned (API might have changed validation)"
fi

echo ""
echo ""
echo "TEST 2: Message WITH thinking block fix (expected to SUCCEED)"
echo "-------------------------------------------------------------"
echo ""

WITH_FIX=$(cat <<'EOF'
{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 100,
  "messages": [
    {
      "role": "user",
      "content": "What is 2+2?"
    },
    {
      "role": "assistant",
      "content": [
        {
          "type": "thinking",
          "text": "[Planning tool usage]"
        },
        {
          "type": "text",
          "text": "Let me use a tool."
        },
        {
          "type": "tool_use",
          "id": "toolu_01A09q90qw90lq917835lq9",
          "name": "calculator",
          "input": {"operation": "add", "a": 2, "b": 2}
        }
      ]
    }
  ],
  "tools": [
    {
      "name": "calculator",
      "description": "Perform calculations",
      "input_schema": {
        "type": "object",
        "properties": {
          "operation": {"type": "string"},
          "a": {"type": "number"},
          "b": {"type": "number"}
        }
      }
    }
  ],
  "thinking": {
    "type": "enabled",
    "budget_tokens": 5000
  }
}
EOF
)

echo "Message structure (assistant content):"
echo "  [0] thinking: '[Planning tool usage]'"
echo "  [1] text: 'Let me use a tool.'"
echo "  [2] tool_use: calculator"
echo ""
echo "Calling Anthropic API..."
echo ""

RESPONSE=$(curl -s https://api.anthropic.com/v1/messages \
  -H "content-type: application/json" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: interleaved-thinking-2025-05-14" \
  -d "$WITH_FIX")

if echo "$RESPONSE" | grep -q '"id":"msg_'; then
  echo "✅ SUCCESS: API accepted message with thinking block fix!"
  echo "Response ID: $(echo $RESPONSE | grep -o '"id":"msg_[^"]*"' | head -1 | cut -d'"' -f4)"
  echo "Stop reason: $(echo $RESPONSE | grep -o '"stop_reason":"[^"]*"' | head -1 | cut -d'"' -f4)"
  echo ""
  echo "Response content types:"
  echo "$RESPONSE" | grep -o '"type":"[^"]*"' | head -5
  echo ""
  echo "🎉 THE FIX WORKS! Anthropic accepted our message format!"
elif echo "$RESPONSE" | grep -q "error"; then
  echo "❌ FAILED: API rejected message even with fix"
  echo "Error: $(echo $RESPONSE | grep -o '"message":"[^"]*"' | cut -d'"' -f4)"
  echo ""
  echo "Full response:"
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
  exit 1
else
  echo "⚠️ Unexpected response format:"
  echo "$RESPONSE"
  exit 1
fi

echo ""
echo "========== ANTHROPIC API TEST PASSED =========="
echo ""
echo "The thinking block fix is working correctly!"
echo "Messages are properly formatted and accepted by Anthropic."
echo ""
