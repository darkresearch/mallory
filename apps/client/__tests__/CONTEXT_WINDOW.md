# Context Window Management in Mallory

## Overview

This document explains how Mallory handles extremely long conversations and context window limits, and how our tests verify this behavior.

## The Problem

Large Language Models have two token limits:
1. **Input context window**: Maximum tokens that can be sent to the model (Claude Sonnet 4.5: ~200k tokens)
2. **Output token limit**: Maximum tokens the model can generate in a single response (~8k tokens typically)

When users have very long conversations or request very detailed responses, we must handle these limits gracefully.

## Backend Strategy

Mallory uses a **smart three-tier strategy** to handle context:

### 1. Short Conversations (< 80k tokens)
**Strategy**: Direct to Anthropic

- No modifications needed
- Sends all messages as-is
- Lowest latency
- Extended thinking enabled

**Code**: `apps/server/src/lib/contextWindow.ts` → `decideContextStrategy()`

### 2. Long Conversations (> 80k tokens) WITH Supermemory
**Strategy**: Supermemory Infinite Chat Router

- Routes through Supermemory proxy
- Uses RAG (Retrieval Augmented Generation)
- Automatically compresses old context
- Keeps relevant information accessible
- Extended thinking still works

**Code**: `apps/server/src/routes/chat/config/modelProvider.ts` → `setupModelProvider()`

```typescript
if (supermemoryApiKey && strategy.useSupermemoryProxy) {
  const infiniteChatProvider = createAnthropic({
    baseURL: 'https://api.supermemory.ai/v3/https://api.anthropic.com/v1',
    headers: {
      'x-supermemory-api-key': supermemoryApiKey,
      'x-sm-conversation-id': conversationId,
      'x-sm-user-id': userId,
    },
  });
  model = infiniteChatProvider(claudeModel);
}
```

### 3. Long Conversations (> 80k tokens) WITHOUT Supermemory
**Strategy**: Manual Windowing (Fallback)

- Keeps most recent messages that fit in 80k tokens
- Drops oldest messages first
- Logs what was dropped
- Ensures conversation can continue

**Code**: `apps/server/src/lib/contextWindow.ts` → `windowMessages()`

## Token Estimation

We estimate tokens using a simple heuristic:
- **~4 characters per token**
- Plus 10% overhead for JSON structure

```typescript
export function estimateMessageTokens(message: UIMessage): number {
  let charCount = 0;
  
  // Sum all text content
  for (const part of message.parts) {
    if (part.type === 'text' && part.text) {
      charCount += part.text.length;
    }
  }
  
  // ~4 chars per token + 10% overhead
  return Math.ceil((charCount / 4) * 1.1);
}
```

This is **approximate** but sufficient for decision-making. The actual tokenizer may vary slightly.

## Output Token Limits

When responses are very long, the model may hit its **output token limit**.

### Expected Behavior

When this happens:
1. Model stops generating mid-response
2. Stream ends with `finishReason: "length"` (not `"stop"`)
3. Response is still saved (it's just incomplete)
4. No error shown to user

**This is acceptable** - the model generated as much as it could.

### Code Signal

```typescript
// In stream processing
if (finishReason === 'length') {
  console.log('Response truncated due to output token limit');
  // Still valid - save the response
}
```

## How Tests Verify This

### Test 1: Long Context (200k+ tokens)

**File**: `apps/client/__tests__/e2e/long-context.test.ts`

```typescript
test('CRITICAL: should handle conversation exceeding 200k tokens', async () => {
  // Generate 200k tokens of conversation history
  const conversationHistory = createLongConversationHistory(200000);
  
  // Send new message with full context
  const response = await fetch(`${BACKEND_URL}/api/chat`, {
    body: JSON.stringify({
      messages: [...conversationHistory, newMessage],
      conversationId,
    }),
  });
  
  // CRITICAL: Should not fail
  expect(response.ok).toBe(true);
  
  // Check for context window errors
  if (errorText.includes('context') || errorText.includes('token')) {
    throw new Error('CONTEXT WINDOW ERROR DETECTED!');
  }
});
```

**What it catches**:
- Backend crashes on large context
- Context window overflow errors
- Windowing logic failures
- Supermemory Router issues

### Test 2: Output Token Limit

**File**: `apps/client/__tests__/e2e/long-context.test.ts`

```typescript
test('CRITICAL: should handle very long single response', async () => {
  // Ask for book-length response
  const testMessage = `Write an extremely detailed, comprehensive guide...
  This should be a book-length response.`;
  
  // Track finish reason
  let finishReason: string | null = null;
  
  // Process stream
  // ...
  
  // Verify finish reason
  if (finishReason === 'length') {
    console.log('✅ Response hit output token limit (expected)');
  } else if (finishReason === 'stop') {
    console.log('✅ Response completed naturally');
  } else {
    throw new Error(`Unexpected finish reason: ${finishReason}`);
  }
});
```

**What it catches**:
- Errors when hitting output limit (should handle gracefully)
- Missing `finishReason` signals
- Response not being saved despite truncation

### Test 3: Windowing Fallback

**File**: `apps/client/__tests__/e2e/long-context.test.ts`

```typescript
test('should verify context windowing fallback', async () => {
  // Generate 100k tokens (exceeds 80k threshold)
  const conversationHistory = createLongConversationHistory(100000);
  
  // Send without Supermemory
  const response = await fetch(`${BACKEND_URL}/api/chat`, {
    body: JSON.stringify({
      messages: [...conversationHistory, newMessage],
      conversationId,
    }),
  });
  
  // Should complete without error
  expect(streamCompleted).toBe(true);
});
```

**What it catches**:
- Windowing logic bugs
- Math errors in token calculation
- Edge cases (empty messages, huge single message)

## Backend Logging

When running the backend, you'll see logs like:

```
📊 Conversation Metrics:
   totalMessages: 1245
   estimatedTokens: 185234
   conversationId: abc123
   userId: user456

🎯 Context Strategy Decision:
   useExtendedThinking: true
   useSupermemoryProxy: true
   estimatedTokens: 185234
   reason: Context exceeds threshold (185234 > 80000 tokens), using Infinite Chat Router

🧠 Using Supermemory Infinite Chat Router (extended thinking enabled)
```

Or for windowing fallback:

```
⚠️  SUPERMEMORY_API_KEY not set, using windowing fallback

✂️  Windowed conversation:
   originalCount: 1245
   windowedCount: 856
   estimatedTokens: 78453
   droppedCount: 389
```

## Production Monitoring

### Green Flags ✅
- "Direct to Anthropic" for short conversations
- "Using Infinite Chat Router" for long conversations
- "Windowed conversation" when Supermemory unavailable
- `finishReason: "length"` for very long responses (acceptable)

### Red Flags 🚨
- "Context window exceeded" errors
- 500 errors with "token" in error message
- Conversations failing after certain length
- No finish reason in stream
- Backend crashes on long conversations

## Environment Variables

```bash
# Required for Supermemory Router (handles unlimited context)
SUPERMEMORY_API_KEY=sm_xyz...

# Model selection (Sonnet 4.5 has 200k context window)
CLAUDE_MODEL=claude-sonnet-4-20250514
```

**If SUPERMEMORY_API_KEY is not set**:
- Long conversations will use manual windowing (80k token window)
- Still functional, but old context is completely lost
- Supermemory Router preserves important information via RAG

## Further Reading

- **Token Estimation**: `apps/server/src/lib/contextWindow.ts`
- **Strategy Decision**: `apps/server/src/lib/contextWindow.ts` → `decideContextStrategy()`
- **Model Setup**: `apps/server/src/routes/chat/config/modelProvider.ts` → `setupModelProvider()`
- **Tests**: `apps/client/__tests__/e2e/long-context.test.ts`

## Related Issues

- [Supermemory AI](https://supermemory.ai) - Context compression service
- [Claude 3.5 Sonnet docs](https://docs.anthropic.com/claude/docs/models-overview) - Context window specs
- [AI SDK docs](https://sdk.vercel.ai/docs) - Stream handling

---

**Summary**: Mallory handles long conversations intelligently using a three-tier strategy. Our tests verify all three paths work correctly, catching context window issues before they reach production.

