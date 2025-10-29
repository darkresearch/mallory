# Chat State Tests

Comprehensive test suite for the chat state machine and messaging functionality.

## Test Structure

### 1. Unit Tests (`__tests__/unit/useChatState.test.ts`)
Tests the state machine logic in isolation without any external dependencies.

**What it tests:**
- State type system (idle, waiting, reasoning, responding)
- State transitions (user intent-based)
- State transition sequences
- State invariants and properties
- Edge cases

**Run:**
```bash
cd apps/client
bun test __tests__/unit/useChatState.test.ts
```

### 2. Integration Tests (`__tests__/integration/chat-state.test.ts`)
Tests chat state with real services (Supabase, database).

**What it tests:**
- Conversation management
- Message persistence
- Stream state transitions
- Concurrent operations
- Error handling
- Real-world scenarios

**Requirements:**
- Test user account (from .env.test)
- Supabase connection

**Run:**
```bash
cd apps/client
bun test __tests__/integration/chat-state.test.ts
```

### 3. E2E Tests (`__tests__/e2e/chat-message-flow.test.ts`)
Tests complete chat flow with streaming backend API.

**What it tests:**
- Full chat flow: send → stream → persist
- State transitions during streaming
- Rapid message sends
- **🔴 CRITICAL: Stream completion verification** (catches incomplete response bug)
- **🔴 CRITICAL: Multi-turn conversations** (4+ message exchanges)
- **🔴 CRITICAL: Stream interruption detection** (timeout scenarios)
- Backend integration

### 4. Long Context Tests (`__tests__/e2e/long-context.test.ts`)
Tests context window management for extremely long conversations.

**What it tests:**
- **🔥 CRITICAL: Conversations exceeding 200k tokens** (input context limit)
- **🔥 CRITICAL: Single responses hitting output token limits**
- Context windowing fallback (when Supermemory unavailable)
- Supermemory Infinite Chat Router integration
- Error handling for context overflow

**Production Issue Coverage:**
These tests address user reports of errors in long conversations:
- Verifies backend handles 200k+ token conversations
- Tests both Supermemory Router and windowing fallback
- Validates `finishReason: "length"` for truncated responses
- Ensures no context window errors surface to user

**Requirements:**
- Backend server running
- Test user account
- Supabase connection
- SUPERMEMORY_API_KEY (tests both with and without)
- **⚠️ WARNING:** These tests consume significant API quota and time (5+ minutes each)

**Run:**
```bash
# Terminal 1: Start backend
cd apps/server
bun run dev

# Terminal 2: Run tests
cd apps/client
bun test __tests__/e2e/long-context.test.ts
```

**Production Issue Coverage (E2E):**
These tests specifically address the user-reported bug where AI responses appear incomplete:
- Verifies `finish_reason` signals are present AND correct value (`'stop'`)
- **Uses Claude API to review response completeness** (much better than heuristics)
- Monitors for stream stalls (>30s without data)
- Tests realistic multi-turn scenarios
- Same model and parameters as production

**AI-Powered Completeness Review:**
Instead of guessing with punctuation or length heuristics, we use **Claude itself** to evaluate if responses are complete:
```typescript
const review = await reviewResponseCompleteness(
  userQuestion,
  aiResponse,
  'claude-sonnet-4-20250514' // Same as production (Sonnet 4.5)
);

if (!review.isComplete && review.confidence === 'high') {
  // Response is incomplete - fail test
}
```

This catches incomplete responses even when they look complete (e.g., end with punctuation).

**Requirements:**
- Backend server running (default: http://localhost:3001)
- Test user account with Grid wallet
- Supabase connection

**Run:**
```bash
# Terminal 1: Start backend
cd apps/server
bun run dev

# Terminal 2: Run tests
cd apps/client
bun test __tests__/e2e/chat-message-flow.test.ts
```

## Running All Tests

### Locally

```bash
cd apps/client

# Unit tests only (no dependencies)
bun test __tests__/unit/

# Integration tests (requires Supabase)
bun test __tests__/integration/

# E2E tests - Chat flow (requires backend + Supabase)
bun test __tests__/e2e/chat-message-flow.test.ts

# E2E tests - Long context (requires backend + Supabase + time)
# ⚠️ WARNING: Takes 5+ minutes, uses significant API quota
bun test __tests__/e2e/long-context.test.ts

# Run all tests
bun test
```

### In CI

The tests run automatically in GitHub Actions. See `.github/workflows/test.yml`.

**CI setup:**
- Backend server starts automatically
- Test credentials loaded from secrets
- Supabase connection configured
- Tests run in parallel where possible

## Test User

All tests use a single test user defined in `.env.test`:

```bash
TEST_SUPABASE_EMAIL=test@example.com
TEST_SUPABASE_PASSWORD=your-secure-password
```

**Important:**
- The test user must already exist in Supabase
- The test user must have a Grid wallet configured
- Use the setup script if needed: `bun run test:setup`

## Environment Variables

Required in `.env.test`:

```bash
# Supabase
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Test user credentials
TEST_SUPABASE_EMAIL=test@example.com
TEST_SUPABASE_PASSWORD=your-secure-password

# Backend (for E2E tests)
TEST_BACKEND_URL=http://localhost:3001

# Grid
EXPO_PUBLIC_GRID_ENV=production

# Anthropic API (for AI completeness review in tests)
# Copy this from apps/server/.env (same key as production backend)
ANTHROPIC_API_KEY=sk-ant-...
```

**Important:**
- `ANTHROPIC_API_KEY` is used by tests to review response completeness
- **Use the same API key from `apps/server/.env`** (production backend key)
- Same model as production: `claude-sonnet-4-20250514` (Sonnet 4.5)
- Tests will fall back to basic heuristics if API key not provided
- AI review significantly improves test reliability

## Test Philosophy

### Intent-Based Testing
Tests verify **behavior** and **user intent**, not implementation details.

**Good:**
```typescript
test('INTENT: User sends a message', () => {
  // Test that state transitions from idle → waiting
});
```

**Bad:**
```typescript
test('setStreamState is called with waiting status', () => {
  // Testing implementation detail
});
```

### State Machine Properties
Tests verify properties that should always be true:

- AI never reasons and responds simultaneously
- All transitions eventually return to idle
- startTime persists through transitions
- Only idle state has no startTime

### Test Coverage

| Area | Unit | Integration | E2E (Chat) | E2E (Context) |
|------|------|-------------|------------|---------------|
| State machine logic | ✅ | | | |
| State transitions | ✅ | ✅ | ✅ | |
| Message persistence | | ✅ | ✅ | |
| Streaming | | | ✅ | |
| **Stream completion** | | | **✅** | |
| **Multi-turn conversations** | | | **✅** | |
| **Stream interruptions** | | | **✅** | |
| **Long context (200k+ tokens)** | | | | **✅** |
| **Output token limits** | | | | **✅** |
| **Context windowing** | | | | **✅** |
| Backend API | | | ✅ | ✅ |
| Error handling | ✅ | ✅ | | ✅ |
| Concurrent operations | | ✅ | | |

## 🔴 Production Issue Testing

### Incomplete Response Bug

**User Report:** "AI responses sometimes appear incomplete or cut off mid-sentence"

**Root Cause Suspects:**
- Stream not completing properly (no `finish_reason` signal)
- Connection timeout before stream finishes
- Client-side stream handling issues
- Backend stream interruption

**How Our Tests Catch This:**

1. **Stream Completion Verification** (`test: CRITICAL: should verify stream completes fully`)
   - ✅ Checks `done=true` signal from stream
   - ✅ Verifies `finish_reason` present in stream
   - ✅ Validates response ends with punctuation
   - ✅ Compares first 100 and last 100 chars
   - 🎯 **This will fail if responses are incomplete**

2. **Multi-turn Conversation** (`test: CRITICAL: should handle multi-turn conversation correctly`)
   - ✅ Tests 4 message exchanges
   - ✅ Each turn must complete fully
   - ✅ Verifies all turns have `finish_reason`
   - 🎯 **This catches if the bug happens intermittently**

3. **Stream Interruption Detection** (`test: CRITICAL: should detect stream interruptions`)
   - ✅ Monitors time gaps between chunks
   - ✅ Fails if >30s without data (stall detected)
   - ✅ Tracks average chunk timing
   - 🎯 **This catches timeout/connection issues**

**Running Production Issue Tests:**
```bash
# Run just the critical tests
cd apps/client
bun test __tests__/e2e/chat-message-flow.test.ts --test "CRITICAL"

# Watch output for:
# - "Stream ended cleanly: true"
# - "Has finish_reason: true"
# - "Response may be incomplete" warnings
```

**If Tests Fail:**
- Check backend logs for errors
- Look for network timeout issues
- Verify AI SDK configuration
- Check stream buffer sizes
- Review error handling in chat API

### Long Context Window Issues

**User Report:** "Getting errors in very long conversations" / "App crashes when conversation gets too long"

**Root Cause Suspects:**
- Context window overflow (>200k tokens)
- Output token limit reached (response truncated)
- Backend windowing logic failing
- Supermemory Router issues
- Out-of-memory errors

**How Our Tests Catch This:**

1. **Long Conversation Test** (`test: CRITICAL: should handle conversation exceeding 200k tokens`)
   - ✅ Generates 200k+ tokens of conversation history
   - ✅ Sends new message with full context
   - ✅ Verifies backend handles without errors
   - ✅ Checks for context window error messages
   - ✅ Tests both Supermemory Router and windowing fallback
   - 🎯 **This will fail if context management breaks**

2. **Output Token Limit Test** (`test: CRITICAL: should handle very long single response`)
   - ✅ Requests extremely detailed, book-length response
   - ✅ Verifies `finishReason: "length"` or `"stop"`
   - ✅ Ensures graceful handling of truncated responses
   - ✅ Checks response is saved despite truncation
   - 🎯 **This catches output limit issues**

3. **Windowing Fallback Test** (`test: should verify context windowing fallback`)
   - ✅ Tests 100k token conversation (exceeds 80k threshold)
   - ✅ Verifies manual windowing works when Supermemory unavailable
   - ✅ Ensures most recent messages kept
   - 🎯 **This catches windowing logic bugs**

**Running Long Context Tests:**
```bash
# These tests take 5+ minutes and use significant API quota
cd apps/client
bun test __tests__/e2e/long-context.test.ts

# Watch for:
# - "CONTEXT WINDOW ERROR DETECTED!" (bad - test fails)
# - "Backend successfully handled 200k+ token conversation" (good)
# - "Response hit output token limit (expected)" (acceptable behavior)
```

**If Tests Fail:**
- Check backend logs for "Context exceeds threshold" messages
- Verify SUPERMEMORY_API_KEY is set correctly
- Check token estimation logic in `contextWindow.ts`
- Review windowing threshold (currently 80k tokens)
- Verify Supermemory Router is accessible

## Debugging Tests

### View test output
```bash
bun test --verbose
```

### Run single test
```bash
bun test --test "INTENT: User sends a message"
```

### Check backend logs
```bash
# Terminal 1: Start backend with logging
cd apps/server
DEBUG=* bun run dev

# Terminal 2: Run E2E tests
cd apps/client
bun test __tests__/e2e/chat-message-flow.test.ts
```

### Inspect database
```sql
-- View test conversations
SELECT * FROM conversations WHERE title LIKE 'Test:%';

-- View test messages
SELECT * FROM messages WHERE conversation_id IN (
  SELECT id FROM conversations WHERE title LIKE 'Test:%'
);

-- Cleanup test data
DELETE FROM messages WHERE conversation_id IN (
  SELECT id FROM conversations WHERE title LIKE 'Test:%'
);
DELETE FROM conversations WHERE title LIKE 'Test:%';
```

## CI Configuration

Tests run in GitHub Actions. Backend server starts automatically.

See: `.github/workflows/test.yml`

Key configuration:
- Matrix strategy for parallel test runs
- Backend server starts before tests
- Test credentials from secrets
- Cleanup after tests

## Troubleshooting

### "Cannot connect to backend"
- Ensure backend is running on http://localhost:3001
- Check TEST_BACKEND_URL in .env.test
- Verify backend logs for errors

### "Test user not found"
- Run setup script: `bun run test:setup`
- Verify credentials in .env.test
- Check Supabase dashboard for user

### "Grid session not found"
- Test user needs Grid wallet configured
- Run Grid signup flow for test user
- Check secure storage for Grid credentials

### "Messages not persisting"
- Check backend logs for save errors
- Verify Supabase connection
- Check message table schema

## Adding New Tests

Follow existing patterns:

1. **Unit Test**: Test pure logic in isolation
2. **Integration Test**: Test with real services
3. **E2E Test**: Test complete user flows

Use intent-based naming:
```typescript
test('INTENT: User wants to [action]', () => {
  // Test goes here
});
```

## Related Documentation

- [State Management Review](../../docs/STATE_MANAGEMENT_REVIEW.md)
- [Chat State Machine Plan](../../chat-sta.plan.md)
- [Test Setup Guide](./setup/README.md)

