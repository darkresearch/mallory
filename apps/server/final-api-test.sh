#!/bin/bash

ANTHROPIC_API_KEY=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

echo ""
echo "🧪 ========== FINAL ANTHROPIC API TEST =========="
echo ""
echo "Testing the REAL fix: Disable extended thinking when needed"
echo ""

# Test 1: Fresh conversation WITH extended thinking (should work)
echo "TEST 1: Fresh conversation with extended thinking ENABLED"
echo "--------------------------------------------------------"
echo "This simulates a NEW conversation where Claude will generate thinking blocks"
echo ""

curl -s https://api.anthropic.com/v1/messages \
  -H "content-type: application/json" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: interleaved-thinking-2025-05-14" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 200,
    "messages": [
      {"role": "user", "content": "Calculate 5+3"}
    ],
    "tools": [{
      "name": "calculator",
      "description": "Do math",
      "input_schema": {
        "type": "object",
        "properties": {"expr": {"type": "string"}}
      }
    }],
    "thinking": {"type": "enabled", "budget_tokens": 5000}
  }' | python3 -c "import sys, json; d=json.load(sys.stdin); print('✅ SUCCESS' if 'id' in d else '❌ FAIL'); print(f'Response: {d.get(\"id\", d.get(\"error\", {}).get(\"message\", \"unknown\")[:100])}'); print(f'Has thinking: {any(b.get(\"type\") == \"thinking\" for b in d.get(\"content\", []))}' if 'content' in d else '')"

echo ""
echo ""

# Test 2: Historical conversation WITHOUT extended thinking (should work)
echo "TEST 2: Historical conversation with extended thinking DISABLED"
echo "---------------------------------------------------------------"
echo "This simulates loading a conversation with tool_use but no thinking signature"
echo ""

curl -s https://api.anthropic.com/v1/messages \
  -H "content-type: application/json" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 200,
    "messages": [
      {"role": "user", "content": "What is 2+2?"},
      {
        "role": "assistant",
        "content": [
          {"type": "text", "text": "Let me calculate."},
          {
            "type": "tool_use",
            "id": "toolu_01test",
            "name": "calculator",
            "input": {"expr": "2+2"}
          }
        ]
      },
      {
        "role": "user",
        "content": [{
          "type": "tool_result",
          "tool_use_id": "toolu_01test",
          "content": "4"
        }]
      }
    ],
    "tools": [{
      "name": "calculator",
      "description": "Calculate",
      "input_schema": {
        "type": "object",
        "properties": {"expr": {"type": "string"}}
      }
    }]
  }' | python3 -c "import sys, json; d=json.load(sys.stdin); print('✅ SUCCESS' if 'id' in d else '❌ FAIL'); print(f'Response: {d.get(\"id\", d.get(\"error\", {}).get(\"message\", \"unknown\")[:100])}')"

echo ""
echo ""
echo "========================================="
echo "RESULTS:"
echo "  Test 1: Fresh conversation with thinking should succeed"  
echo "  Test 2: Historical without thinking should succeed"
echo ""
echo "The fix: Dynamically disable extended thinking when"
echo "         historical messages lack valid thinking signatures"
echo "========================================="
echo ""
