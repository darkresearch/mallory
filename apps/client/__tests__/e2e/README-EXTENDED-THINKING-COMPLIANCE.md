# Extended Thinking Compliance Test

## Overview

This test replicates a critical bug in the Claude API extended thinking feature where assistant messages fail to comply with Anthropic's requirements:

> **Error**: `messages.3.content.0.type: Expected 'thinking' or 'redacted_thinking', but found 'text'.`
>
> When `thinking` is enabled, a final `assistant` message must start with a thinking block (preceeding the lastmost set of `tool_use` and `tool_result` blocks).

## The Problem

When extended thinking is enabled, Anthropic's API requires that:

1. **Assistant messages with tool calls** must start with a `thinking` or `redacted_thinking` block
2. The thinking block must come **before** any `tool_use` blocks
3. This applies to all assistant messages in the conversation history

### User-Reported Issue

The user asked: **"okay - what's going on in the markets today?"**

This question triggered the error, indicating that:
- The response likely triggered tool usage (market data lookup)
- The assistant message did not start with a thinking block
- The message had a `text` block first instead

## Test File

**Location**: `apps/client/__tests__/e2e/extended-thinking-compliance.test.ts`

### Test Cases

#### 1. `CRITICAL: should not fail with thinking block error when asking market questions`

Replicates the exact user scenario:
- Creates a conversation
- Asks the market question: "okay - what's going on in the markets today?"
- Verifies no thinking block compliance errors
- Sends a follow-up to test conversation history handling

**Expected behavior**: No errors, proper message structure

#### 2. `CRITICAL: should handle assistant messages without tool calls correctly`

Tests simple questions that don't trigger tools:
- Asks: "What is 2 + 2?"
- Verifies no thinking errors for simple responses

**Expected behavior**: Works correctly with or without thinking blocks

#### 3. `CRITICAL: should handle multi-turn conversation with tools correctly`

Tests a realistic conversation flow:
- Turn 1: "What's the Bitcoin price?" (triggers searchWeb tool)
- Turn 2: "How about Ethereum?" (triggers searchWeb tool)
- Turn 3: "okay - what's going on in the markets today?" (exact user case)

**Expected behavior**: All turns succeed, proper thinking block ordering

## Root Cause Analysis

The error occurs when:

1. **Loading conversation history** from the database
2. Messages contain `reasoning` parts (AI SDK internal format)
3. These need to be converted to `thinking` parts (Anthropic API format)
4. If conversion fails or thinking blocks aren't properly ordered, API rejects the request

## Backend Fix Applied

The backend implements several layers of message transformation:

### 1. Reasoning → Thinking Conversion

```typescript
// apps/server/src/lib/messageTransform.ts
export function convertReasoningToThinking(messages: UIMessage[]): UIMessage[]
```

Converts AI SDK's internal `reasoning` type to Anthropic's `thinking` type.

### 2. Thinking Block Compliance

```typescript
// apps/server/src/lib/messageTransform.ts
export function ensureThinkingBlockCompliance(messages: UIMessage[]): UIMessage[]
```

Ensures assistant messages with tool calls start with thinking blocks:
- Reorders parts if thinking block exists but isn't first
- Warns if no thinking block found (problematic case)

### 3. Tool Message Structure

```typescript
// apps/server/src/lib/messageTransform.ts
export function ensureToolMessageStructure(messages: UIMessage[]): UIMessage[]
```

Ensures tool_use and tool_result blocks are in separate, consecutive messages.

## How to Run

### Local Testing

```bash
cd apps/client
bun test __tests__/e2e/extended-thinking-compliance.test.ts
```

**Requirements**:
- Backend server running on port 3001
- Test Grid account configured
- Extended thinking enabled in backend

### CI Testing

Add to your CI workflow (e.g., `.github/workflows/ai-tests.yml`):

```yaml
- name: Run Extended Thinking Compliance Tests
  run: cd apps/client && bun test __tests__/e2e/extended-thinking-compliance.test.ts
  env:
    EXPO_PUBLIC_SUPABASE_URL: ${{ secrets.EXPO_PUBLIC_SUPABASE_URL }}
    EXPO_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.EXPO_PUBLIC_SUPABASE_ANON_KEY }}
    TEST_SUPABASE_EMAIL: ${{ secrets.TEST_SUPABASE_EMAIL }}
    TEST_SUPABASE_PASSWORD: ${{ secrets.TEST_SUPABASE_PASSWORD }}
    EXPO_PUBLIC_GRID_ENV: production
    TEST_BACKEND_URL: http://localhost:3001
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

## Test Output

### Success Case

```
🧠 Testing extended thinking compliance for market questions

   Replicating error: "Expected `thinking` or `redacted_thinking`, but found `text`"

📋 Step 1/5: Authenticating test user...

✅ Test user authenticated:
   User ID: xxx
   Email: test@example.com

📋 Step 2/5: Creating test conversation...

✅ Conversation created: xxx

📋 Step 3/5: Sending market question that triggers the error...

   Question: okay - what's going on in the markets today?

✅ Response received:
   Status: 200
   Has Error: false

📋 Step 4/5: Verifying message structure in database...

✅ Found 2 messages in database
   Assistant messages: 1
   Message xxx:
     - Parts: 3
     - Has tool calls: YES
     - First part type: thinking
     ✅ Correctly starts with thinking/reasoning block

📋 Step 5/5: Testing with conversation history...

   Follow-up: And what about crypto specifically?

✅ Follow-up response received:
   Status: 200
   Has Error: false

✅ Test completed successfully
   No extended thinking compliance errors detected
```

### Failure Case (Bug Present)

```
❌ FAILED: Got the thinking block compliance error!
   This means assistant messages are not starting with thinking blocks
   when extended thinking is enabled.

   Error details: messages.3.content.0.type: Expected `thinking` or `redacted_thinking`, 
   but found `text`. When `thinking` is enabled, a final `assistant` message must start 
   with a thinking block (preceeding the lastmost set of `tool_use` and `tool_result` blocks).
```

## Related Files

- **Backend transformation logic**: `apps/server/src/lib/messageTransform.ts`
- **Unit tests**: `apps/server/src/lib/__tests__/messageTransform.test.ts`
- **Chat route**: `apps/server/src/routes/chat/index.ts`
- **Stream config**: `apps/server/src/routes/chat/config/streamConfig.ts`

## Debugging Tips

### Check Backend Logs

Look for these log messages in the backend:

```
🧠 Converting reasoning parts to thinking parts for Anthropic API compatibility...
🧠 Ensuring thinking block compliance for extended thinking API...
🔧 [Message N] Reordering thinking blocks to start of message for extended thinking compliance
⚠️ [Message N] Assistant message has tool calls but no thinking block
```

### Inspect Database Messages

```sql
SELECT 
  id, 
  role, 
  parts::json 
FROM messages 
WHERE conversation_id = 'xxx' 
ORDER BY created_at;
```

Look for:
- Assistant messages with `tool-call` parts
- Whether they have `thinking` or `reasoning` parts
- The order of parts (thinking should be first)

### Test Individual Functions

```typescript
import { 
  convertReasoningToThinking, 
  ensureThinkingBlockCompliance,
  ensureToolMessageStructure 
} from '../messageTransform';

// Load messages from DB
const messages = await loadConversationHistory(conversationId);

// Test transformations
const step1 = convertReasoningToThinking(messages);
const step2 = ensureToolMessageStructure(step1);
const step3 = ensureThinkingBlockCompliance(step2);

console.log('Final messages:', JSON.stringify(step3, null, 2));
```

## Success Criteria

✅ All three test cases pass  
✅ No thinking block compliance errors  
✅ Messages properly structured in database  
✅ Conversation history loads correctly  
✅ Follow-up questions work after tool usage  

## Known Limitations

1. **Placeholder thinking blocks**: If a message has tool calls but no thinking block, the current implementation warns but doesn't add a synthetic thinking block. This should be enhanced in a future update.

2. **Redacted thinking**: The test doesn't specifically test for `redacted_thinking` type, only `thinking`. Both are valid per Anthropic's API.

3. **Multiple tool calls**: The test focuses on single tool calls. Multi-tool scenarios need additional coverage.

## Future Enhancements

- [ ] Add synthetic thinking blocks when none exist
- [ ] Test with `redacted_thinking` blocks
- [ ] Test with multiple simultaneous tool calls
- [ ] Test with very long conversation histories
- [ ] Add performance benchmarks for transformation logic

## References

- [Anthropic Extended Thinking Documentation](https://docs.claude.com/en/docs/build-with-claude/extended-thinking)
- [AI SDK UIMessage Format](https://sdk.vercel.ai/docs/reference/ai-sdk-ui/use-chat)
- [Anthropic Messages API](https://docs.anthropic.com/claude/reference/messages)
