# Context Limit Error - Root Cause Analysis

## 🔴 The Problem

A user is experiencing this error despite using Supermemory's Infinite Chat:

```
Error: input length and max_tokens exceed context limit: 154996 + 64000 > 200000, 
decrease input length or max_tokens and try again
```

## 🎯 Root Cause Identified

**The `withSupermemory()` wrapper is breaking the Infinite Chat proxy.**

### The Critical Difference

**✅ CI Test (WORKS):**
```typescript
const infiniteChatProvider = createAnthropic({
  baseURL: 'https://api.supermemory.ai/v3/https://api.anthropic.com/v1',
  // ...
});
const model = infiniteChatProvider('claude-3-5-sonnet-20241022');
// NO withSupermemory wrapper

const result = await generateText({
  model,
  messages: messages, // 400k+ tokens - WORKS!
  maxTokens: 100,
});
```

**❌ Production Code (FAILS):**
```typescript
const infiniteChatProvider = createAnthropic({
  baseURL: 'https://api.supermemory.ai/v3/https://api.anthropic.com/v1',
  // ...
});
let model = infiniteChatProvider(claudeModel);
model = withSupermemory(model, userId, { mode: 'full' });  // ← BREAKS THE PROXY

const result = streamText({
  model,
  messages: processedMessages, // 154k tokens - FAILS!
  // NO maxTokens parameter - defaults to 64000
});
```

## 🔍 Why This Happens

1. **withSupermemory() likely creates a new model instance** that bypasses the proxy baseURL
2. **Requests go directly to Anthropic API** instead of through Supermemory's compression layer
3. **No maxTokens is set**, so AI SDK defaults to `64000` for Claude
4. **Extended thinking uses tokens**, further constraining input space:
   - Output budget: 64000 (default)
   - Thinking budget: 15000
   - Available input: 200000 - 64000 = 136000
   - User input: 154996 tokens
   - **Result: 154996 > 136000 = ERROR** ❌

## ✅ The Fix

### Solution 1: Remove `withSupermemory()` Wrapper

**File:** `apps/server/src/routes/chat/config/modelProvider.ts`

```typescript
export function setupModelProvider(
  messages: UIMessage[],
  conversationId: string,
  userId: string,
  claudeModel: string
): ModelProviderResult {
  const supermemoryApiKey = process.env.SUPERMEMORY_API_KEY;
  
  if (!supermemoryApiKey) {
    throw new Error('SUPERMEMORY_API_KEY is required but not configured');
  }
  
  const estimatedTokens = estimateTotalTokens(messages);
  
  console.log('🧠 Using Supermemory Infinite Chat Router');
  
  const infiniteChatProvider = createAnthropic({
    baseURL: 'https://api.supermemory.ai/v3/https://api.anthropic.com/v1',
    apiKey: process.env.ANTHROPIC_API_KEY,
    headers: {
      'x-supermemory-api-key': supermemoryApiKey,
      'x-sm-conversation-id': conversationId,
      'x-sm-user-id': userId,
    },
  });
  
  const model = infiniteChatProvider(claudeModel);
  
  // REMOVE THIS LINE:
  // model = withSupermemory(model, userId, { mode: 'full' });
  
  return {
    model,
    processedMessages: messages,
    strategy: {
      useExtendedThinking: true,
      useSupermemoryProxy: true,
      estimatedTokens,
      reason: 'Supermemory Infinite Chat Router handles all context management'
    }
  };
}
```

### Solution 2: Add Explicit `maxTokens`

**File:** `apps/server/src/routes/chat/config/streamConfig.ts`

```typescript
export function buildStreamConfig(options: StreamConfigOptions) {
  const { model, processedMessages, systemPrompt, tools, strategy } = options;
  
  return {
    model,
    messages: convertToModelMessages(processedMessages),
    system: systemPrompt,
    temperature: 0.7,
    maxTokens: 4096,  // ← ADD THIS: Explicit output token limit
    tools,
    stopWhen: stepCountIs(10),
    
    ...(strategy.useExtendedThinking ? {
      headers: {
        'anthropic-beta': 'interleaved-thinking-2025-05-14',
      },
      providerOptions: {
        anthropic: {
          thinking: { type: 'enabled', budgetTokens: 15000 },
          sendReasoning: true,
        },
      },
    } : {}),
    
    onError: (error: any) => {
      console.error('❌ AI streaming error:', error);
    }
  };
}
```

## 🧪 Testing the Fix

1. **Verify CI test still passes**
2. **Test with long conversations** (150k+ tokens)
3. **Confirm memory tools still work** (`addMemory` tool should still be available)

## 📊 What Gets Lost?

The `withSupermemory()` wrapper was supposed to add:
- User profile injection
- Query-based memory search

However:
- **User profile can be passed via headers** (`x-sm-user-id`)
- **Memory tools are already available** (`addMemory` via `createSupermemoryTools()`)

So removing the wrapper loses no critical functionality while fixing the bug.

## 🎓 Lessons Learned

1. **CI tests must match production code paths exactly**
   - The test didn't use `withSupermemory()`, so it didn't catch this bug
   
2. **Always set explicit `maxTokens`**
   - Relying on defaults can cause unexpected behavior
   
3. **Middleware/wrappers can break proxy configurations**
   - Be careful when wrapping models that use custom baseURLs
   
4. **Extended thinking affects token budgets**
   - `budgetTokens: 15000` for thinking reduces available input space

## 🚀 Implementation

Both solutions should be implemented together:
1. Remove `withSupermemory()` wrapper ← **Primary fix**
2. Add explicit `maxTokens: 4096` ← **Safety guard**

This ensures:
- Infinite Chat proxy works correctly
- No unexpected default token limits
- Long conversations are handled gracefully
- User gets reasonable output lengths
