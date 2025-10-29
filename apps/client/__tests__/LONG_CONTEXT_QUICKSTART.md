# Long Context Window Testing - Quick Start

## What These Tests Do

Test Mallory's ability to handle:
1. **Conversations with 200k+ tokens** (near context window limit)
2. **Responses that hit output token limits** (8k+ token responses)
3. **Context windowing fallback** (when Supermemory unavailable)

## Why We Need These Tests

**Production Issues:**
- Users report errors in very long conversations
- App sometimes crashes when conversation gets too long
- Unclear if context window management is working correctly

**These tests catch:**
- Context window overflow errors
- Windowing logic bugs
- Supermemory Router failures
- Missing error handling

## Running the Tests

### Prerequisites
```bash
# Backend must be running
cd apps/server
bun run dev

# Ensure env vars are set
# - SUPERMEMORY_API_KEY (optional but recommended)
# - ANTHROPIC_API_KEY
# - All other standard backend env vars
```

### Run Tests
```bash
cd apps/client

# Run all long context tests (takes 5-10 minutes)
bun test __tests__/e2e/long-context.test.ts

# Run specific test
bun test __tests__/e2e/long-context.test.ts --test "200k tokens"
```

### Expected Output

**Test 1: Long Conversation (200k+ tokens)**
```
🔥 Testing LONG conversation (200k+ tokens)...
📊 Generating conversation history...
   Generated: 500 messages
   Estimated tokens: 200,000

📤 Sending request with long context...
✅ Request completed in 15234 ms
   Status: 200

📊 Stream Results:
   Completed: true
   Total chunks: 234
   Has error: false

✅ Long context test passed!
   Backend successfully handled 200k+ token conversation
```

**Test 2: Long Response (output limit)**
```
📝 Testing LONG response (output token limit)...
📤 Requesting very long response...

📊 Response Analysis:
   Total bytes: 48,234
   Estimated tokens: 12,058
   Stream completed: true
   Finish reason: length

✅ Response hit output token limit (expected for very long request)
   This is CORRECT behavior - not a bug
   Backend handled it gracefully without errors
```

**Test 3: Windowing Fallback**
```
✂️  Testing context windowing fallback...
   Generated: 250 messages
   Estimated: 100,000 tokens
   Threshold: 80,000 tokens
   Backend should: Window to most recent messages

✅ Windowing fallback works correctly
```

## What Success Looks Like

All tests pass with:
- ✅ No context window errors
- ✅ Streams complete
- ✅ No backend crashes
- ✅ Graceful handling of token limits

## What Failure Looks Like

### Context Window Error
```
❌ Backend returned error: 400
   Error body: {"error": "context_length_exceeded"}
🚨 CONTEXT WINDOW ERROR DETECTED!
   This is the production bug users are experiencing
```

### Backend Crash
```
❌ Request failed: FetchError: request to http://localhost:3001/api/chat failed
   Backend likely crashed due to large context
```

### Stream Error
```
📊 Stream Results:
   Completed: false
   Total chunks: 45
   Has error: true
❌ Stream contained errors - likely context window issue
```

## Troubleshooting

### Backend logs show "SUPERMEMORY_API_KEY not set"
**Solution**: This is OK. Tests verify the windowing fallback works without Supermemory.

### Tests time out
**Causes**:
- Backend overloaded
- Network issues
- Context too large for available memory

**Solution**:
- Check backend logs for errors
- Increase test timeout (currently 5 minutes)
- Reduce TARGET_TOKENS in test

### Tests fail in CI but pass locally
**Causes**:
- Different SUPERMEMORY_API_KEY availability
- Memory limits in CI
- API rate limits

**Solution**:
- Check CI logs for specific error
- Verify env vars in GitHub secrets
- Consider running tests separately (not in parallel)

## Cost & Time

**Per full test run:**
- Time: 5-10 minutes
- API calls: ~3 large requests
- Tokens: ~400k input + ~20k output
- Estimated cost: ~$2-3 (at Claude Sonnet 4.5 pricing)

**Recommendation**: 
- Run locally when making context window changes
- Run in CI on PR for critical paths only
- Consider marking as `[slow]` tests

## Related Docs

- **[CONTEXT_WINDOW.md](./CONTEXT_WINDOW.md)** - Deep dive on context management
- **[CHAT_STATE_TESTS.md](./CHAT_STATE_TESTS.md)** - Full test suite documentation
- **Backend code**: `apps/server/src/lib/contextWindow.ts`

---

**TL;DR**: These tests simulate extreme conversation scenarios to catch context window bugs before users encounter them.

