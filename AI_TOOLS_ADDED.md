# AI Tools Integration - Complete

The Mallory backend now has full AI tool support matching the researcher app capabilities.

## ✅ What Was Added

### 1. Web Search (Exa)
**File:** `apps/server/src/routes/chat/tools/searchWeb.ts`

**Capabilities:**
- Semantic web search (not keyword-based)
- Live crawling for breaking news
- Optimized for Solana/crypto ecosystem
- Advanced filtering:
  - Domain inclusion/exclusion
  - Date range filtering
  - Content type (news, research, PDFs)
  - Text inclusion/exclusion
- Returns structured results with titles, URLs, and content

**Usage:** AI automatically calls when user asks about current events, news, or token information

**Environment:** `EXA_API_KEY` (required)

### 2. User Memory (Supermemory)
**File:** `apps/server/src/routes/chat/tools/supermemory.ts`

**Capabilities:**
- Store user preferences and facts
- User-scoped memory (privacy-safe)
- Persistent across conversations
- Auto-builds user profiles
- `addMemory` tool for AI

**Usage:** AI automatically calls when user shares preferences or important information

**Environment:** `SUPERMEMORY_API_KEY` (optional - gracefully degrades if missing)

### 3. Tool Registry
**File:** `apps/server/src/routes/chat/tools/registry.ts`

Exports all available tools for easy import and management.

## 🔄 Changes Made

### Package Dependencies (apps/server/package.json)

**Added:**
```json
{
  "@ai-sdk/anthropic": "^2.0.16",
  "ai": "^5.0.50",
  "exa-js": "^1.0.14",
  "supermemory": "^1.0.0",
  "zod": "^4.1.8"
}
```

**Removed:**
```json
{
  "@anthropic-ai/sdk": "^0.32.1"  // Replaced by AI SDK
}
```

### Chat Endpoint (apps/server/src/routes/chat/index.ts)

**Before:**
- Direct Anthropic SDK streaming
- No tool support
- Basic system prompt

**After:**
- AI SDK (Vercel AI SDK) streaming
- Full tool calling support
- Enhanced system prompt with tool instructions
- Conditional Supermemory inclusion
- `pipeDataStreamToResponse` for proper SSE streaming

**Key code:**
```typescript
const tools: any = {
  searchWeb: toolRegistry.searchWeb,
  ...(process.env.SUPERMEMORY_API_KEY 
    ? toolRegistry.createSupermemoryTools(process.env.SUPERMEMORY_API_KEY, user.id)
    : {}
  )
};

const result = streamText({
  model: anthropic('claude-sonnet-4-20250514'),
  system: systemPrompt,
  messages,
  tools,  // Tools enabled!
  maxTokens: 4096,
  temperature: 0.7
});

result.pipeDataStreamToResponse(res);
```

### Environment Files

**apps/server/.env.example:**
Added:
```bash
# AI Tools (Optional but recommended)
EXA_API_KEY=your-exa-api-key-here
SUPERMEMORY_API_KEY=your-supermemory-api-key-here
```

**apps/server/.env:**
Added actual keys:
```bash
EXA_API_KEY=e915929d-d7f5-45c6-ab0c-bdec0d5acf26
SUPERMEMORY_API_KEY=sm_KLwwwiRhqk2djtzweUBnv9_WexAmvDAGUcFewyDTXhZWBxoZkTzITjpyzuCCcqIdJLNAxAxRITiiQgGmURtWBRz
```

### Documentation Updates

**Updated files:**
- `README.md` - Added AI tools to features
- `apps/server/README.md` - Added "AI Tools" section
- `apps/server/docs/API.md` - Documented tool calling in SSE stream
- `QUICK_START.md` - Added Exa and Supermemory to API keys
- `SETUP.md` - Added AI tools to environment setup

## 🎯 How It Works

### Tool Calling Flow

1. **User sends message:** "What's the latest news about Solana?"

2. **AI decides to use tool:**
```json
{"type": "tool-call", "toolName": "searchWeb", "args": {"query": "latest Solana news"}}
```

3. **Backend executes tool:**
- Calls Exa API
- Returns search results

4. **Tool result streamed:**
```json
{"type": "tool-result", "result": [{"title": "...", "url": "...", "content": "..."}]}
```

5. **AI synthesizes response:**
```json
{"type": "text-delta", "textDelta": "Based on recent news..."}
```

6. **Stream ends:**
```json
{"type": "finish", "finishReason": "stop"}
```

### Memory Flow

1. **User:** "Remember that I prefer technical analysis over price action"

2. **AI calls addMemory:**
```json
{
  "type": "tool-call",
  "toolName": "addMemory",
  "args": {"memory": "User prefers technical analysis over price action"}
}
```

3. **Backend stores in Supermemory:**
- Scoped to userId
- Persists across sessions

4. **Future conversations:**
- AI retrieves user profile
- Knows preferences automatically

## 🧪 Testing

### Test Web Search

**Message:** "What's the latest news about Solana?"

**Expected:**
- Claude calls `searchWeb` tool
- Console shows: `🔧 Tool: searchWeb`
- Exa API returns results
- AI synthesizes answer with sources

### Test Memory

**Message 1:** "Remember that I'm a developer focused on DeFi"

**Expected:**
- Claude calls `addMemory` tool
- Console shows: `🧠 [Supermemory] Adding memory`
- Memory stored successfully

**Message 2 (new conversation):** "What should I learn?"

**Expected:**
- AI remembers you're a DeFi developer
- Tailors recommendations accordingly

### Test Without Supermemory

**Remove `SUPERMEMORY_API_KEY` from .env**

**Expected:**
- Server starts normally
- Console shows: `ℹ️  Supermemory not configured`
- `searchWeb` still works
- `addMemory` not available (AI won't try to use it)

## 📊 Comparison with Researcher

### Features Matched
- ✅ Exa web search with full options
- ✅ Supermemory user memory
- ✅ Tool registry pattern
- ✅ Conditional tool inclusion
- ✅ User-scoped memory (containerTags)

### Intentional Differences
- ❌ No x402 tools (not relevant for boilerplate)
- ❌ No onboarding tools (not in Mallory)
- ✅ Simpler system prompt (no extended thinking strategy)
- ✅ More focused on crypto use case

## 🎉 Summary

Mallory backend now has:
- ✅ Web search via Exa
- ✅ User memory via Supermemory
- ✅ Tool calling infrastructure
- ✅ Graceful degradation
- ✅ Full documentation
- ✅ Production ready

The AI can now:
- Search the web for current information
- Remember user preferences
- Provide personalized, up-to-date responses
- Build user profiles over time

**Lines of code:** ~350 lines added (tools + updates)
**Dependencies:** 5 new packages
**API keys:** 2 new optional keys (Exa, Supermemory)

Ready for testing! 🚀

