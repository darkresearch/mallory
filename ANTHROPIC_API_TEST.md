# Running the Anthropic API Integration Test

## Purpose
This test makes **real API calls** to Anthropic to verify that our thinking block fix works in production. It's the ultimate validation.

## Prerequisites
You need an Anthropic API key. Set it with:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

## Running the Test

### Option 1: Shell Script (Simple)
```bash
cd /workspace/apps/server
export ANTHROPIC_API_KEY=your_key_here
bash test-anthropic-api.sh
```

### Option 2: TypeScript Test (Detailed)
```bash
cd /workspace/apps/server
export ANTHROPIC_API_KEY=your_key_here
npx tsx test-anthropic-api-integration.ts
```

Note: Option 2 requires `npm install` to work, but gives more detailed output.

## What the Test Does

### Test 1: WITHOUT Fix (Expected to Fail)
Sends a message where the assistant has `tool_use` but NO `thinking` block:
```json
{
  "role": "assistant",
  "content": [
    {"type": "text", "text": "..."},
    {"type": "tool_use", "id": "...", "name": "calculator", "input": {...}}
  ]
}
```

**Expected Result**: Anthropic API returns error about missing thinking block

### Test 2: WITH Fix (Expected to Succeed)  
Sends the same message but WITH our fix applied:
```json
{
  "role": "assistant",
  "content": [
    {"type": "thinking", "text": "[Planning tool usage]"},  ← Added by our fix
    {"type": "text", "text": "..."},
    {"type": "tool_use", "id": "...", "name": "calculator", "input": {...}}
  ]
}
```

**Expected Result**: Anthropic API accepts the message and returns a response

### Test 3: Multi-turn Conversation
Tests a realistic scenario with tool call + tool result to ensure the fix works in real conversations.

## Success Criteria

If you see this output, the fix is working:
```
✅ EXPECTED: API returned error mentioning 'thinking' (Test 1)
✅ SUCCESS: API accepted message with thinking block fix! (Test 2)
✅ SUCCESS: Multi-turn conversation accepted! (Test 3)
🎉 THE FIX WORKS!
```

## Alternative: Manual API Test

If you can't run the automated test, you can manually test with curl:

```bash
curl https://api.anthropic.com/v1/messages \
  -H "content-type: application/json" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
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
            "text": "Let me calculate."
          },
          {
            "type": "tool_use",
            "id": "toolu_test123",
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
  }'
```

If this returns a successful response (not an error), the fix is working!

## Troubleshooting

**"ANTHROPIC_API_KEY not set"**
- Export your API key: `export ANTHROPIC_API_KEY=sk-ant-...`
- Or add it to `.env` file in `/workspace` directory

**"Cannot find package"**
- The TypeScript test requires dependencies. Use the shell script version instead:
  ```bash
  bash test-anthropic-api.sh
  ```

**"429 rate limit"**
- Wait a minute and try again
- The test makes 3 API calls

## What This Proves

Running this test successfully proves:
1. ✅ Our `ensureThinkingBlocksInModelMessages` function produces correct Anthropic API format
2. ✅ Anthropic accepts messages with our thinking block fix
3. ✅ The fix works for multi-turn conversations
4. ✅ The production app will work correctly

Without this test, we're just testing our code logic. WITH this test, we're verifying Anthropic actually accepts our messages!
