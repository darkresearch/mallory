#!/bin/bash
# Simple one-command test - replace YOUR_KEY with your actual Anthropic API key

echo "Testing thinking block fix with Anthropic API..."
echo ""
echo "Message structure being sent:"
echo "  assistant.content[0] = thinking: '[Planning tool usage]'"
echo "  assistant.content[1] = text: 'Let me use a tool.'"
echo "  assistant.content[2] = tool_use: calculator"
echo ""
echo "Making API call..."
echo ""

curl -s https://api.anthropic.com/v1/messages \
  -H "content-type: application/json" \
  -H "x-api-key: ${ANTHROPIC_API_KEY}" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: interleaved-thinking-2025-05-14" \
  -d '{
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
            "id": "toolu_01test",
            "name": "calculator",
            "input": {"a": 2, "b": 2}
          }
        ]
      }
    ],
    "tools": [{
      "name": "calculator",
      "description": "Calculate",
      "input_schema": {
        "type": "object",
        "properties": {
          "a": {"type": "number"},
          "b": {"type": "number"}
        }
      }
    }],
    "thinking": {"type": "enabled", "budget_tokens": 5000}
  }' | python3 -m json.tool

echo ""
echo ""
echo "If you see a response with an 'id' field (like 'msg_...'), the fix works! ✅"
echo "If you see an error about 'thinking', there's still an issue. ❌"
