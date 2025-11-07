# Bug Fix: Extended Thinking Response Structure Error

## Issue Summary

**GitHub Issue:** #64 - "Response structure sometimes falls out of claude's rules"

**Date Fixed:** November 7, 2025

**Severity:** High - Caused API errors that blocked conversation flow

### Problem Description

When using Claude's extended thinking API (with `anthropic-beta: interleaved-thinking-2025-05-14`), the system would occasionally fail with this error:

```
Error: messages.1.content.0.type: Expected `thinking` or `redacted_thinking`, but found `text`. 
When `thinking` is enabled, a final `assistant` message must start with a thinking block 
(preceeding the lastmost set of `tool_use` and `tool_result` blocks).
```

This error occurred particularly when:
1. User asked a question
2. Claude used extended thinking and made a tool call (e.g., nansenFlowIntelligence)
3. Tool result was received
4. Claude tried to respond, but the message structure was invalid

## Root Cause Analysis

The bug had two root causes:

### 1. Part Type Mismatch
- **Internal representation:** The AI SDK (v5.0.50) uses `reasoning` as the part type internally during streaming
- **API expectation:** Claude's extended thinking API expects `thinking` or `redacted_thinking` as part types
- **Problem:** When messages with `reasoning` parts were sent back to Claude (from database or client), they weren't being converted to `thinking` parts that Claude's API requires

### 2. Part Ordering Issue
- **API requirement:** When extended thinking is enabled, assistant messages with tool calls MUST start with a thinking block before any tool_use blocks
- **Problem:** Messages reconstructed from the database or sent from the client might have:
  - No thinking blocks at all
  - Thinking blocks in the wrong position (e.g., after text or after tool calls)
  - Interleaved tool calls and tool results (separate issue but compounded the problem)

## Solution Implemented

### Changes Made

#### 1. New Function: `convertReasoningToThinking()` 
**File:** `apps/server/src/lib/messageTransform.ts`

Converts `reasoning` and `reasoning-delta` part types to `thinking` part types for Anthropic API compatibility.

```typescript
export function convertReasoningToThinking(messages: UIMessage[]): UIMessage[] {
  return messages.map(message => {
    // Convert reasoning parts to thinking parts
    const convertedParts = message.parts.map(part => {
      if (part.type === 'reasoning' || part.type === 'reasoning-delta') {
        return { ...part, type: 'thinking' };
      }
      return part;
    });
    // ...
  });
}
```

#### 2. Enhanced Function: `ensureThinkingBlockCompliance()`
**File:** `apps/server/src/lib/messageTransform.ts`

Ensures that assistant messages with tool calls have thinking blocks properly positioned at the start.

- Iterates through all assistant messages
- For messages with tool calls, ensures thinking block is first
- Reorders parts if thinking blocks exist but are in wrong position
- Warns if no thinking blocks found (future enhancement: could add synthetic thinking blocks)

#### 3. Integration in Chat Route
**File:** `apps/server/src/routes/chat/index.ts`

Added message transformation pipeline before sending to Claude:

```typescript
// 1. Fix tool message structure (existing)
conversationMessages = ensureToolMessageStructure(conversationMessages);

// 2. Convert reasoning to thinking (NEW)
conversationMessages = convertReasoningToThinking(conversationMessages);

// 3. Ensure thinking blocks are properly ordered (called within ensureToolMessageStructure)
```

### Testing

#### Unit Tests Added
**File:** `apps/server/src/lib/__tests__/messageTransform.test.ts`

New test suites added:

1. **`convertReasoningToThinking`** - Tests reasoning-to-thinking conversion
   - Converts `reasoning` parts
   - Converts `reasoning-delta` parts
   - Preserves messages without reasoning
   - Handles mixed message types

2. **`extended thinking API compliance`** - Integration tests
   - Ensures thinking blocks come first in messages with tool calls
   - Handles edge cases (tool calls without reasoning)
   - Tests complete flow: conversion + structure fixing
   - Simulates the exact bug scenario from issue #64

All tests validate that:
- Reasoning parts are converted to thinking parts
- Thinking blocks are positioned before tool calls
- Message structure complies with Anthropic's extended thinking API

## Prevention Strategy

### CI/CD Integration

The comprehensive unit tests now cover:
1. ✅ Reasoning-to-thinking conversion
2. ✅ Thinking block ordering for extended thinking compliance
3. ✅ Integration with existing tool message structure validation
4. ✅ Real-world scenario from issue #64

These tests run automatically on every PR and will catch:
- Missing thinking blocks before tool calls
- Incorrect part type conversions
- Improper message ordering
- Any regression of this bug

### Code Review Checklist

When modifying message transformation logic:
- [ ] Ensure reasoning parts are converted to thinking parts
- [ ] Verify thinking blocks come first in assistant messages with tool calls
- [ ] Test with extended thinking enabled
- [ ] Run full test suite: `bun test src/lib/__tests__/messageTransform.test.ts`

## Related Files Changed

1. `apps/server/src/lib/messageTransform.ts` - Core transformation logic
2. `apps/server/src/routes/chat/index.ts` - Integration in chat pipeline
3. `apps/server/src/lib/__tests__/messageTransform.test.ts` - Comprehensive tests

## API References

- [Anthropic Extended Thinking Documentation](https://docs.claude.com/en/docs/build-with-claude/extended-thinking)
- [AI SDK Documentation](https://sdk.vercel.ai/docs)

## Future Enhancements

1. **Synthetic Thinking Blocks:** When an assistant message has tool calls but no thinking blocks, automatically add a placeholder thinking block instead of just warning
2. **Client-Side Validation:** Add validation in the client to ensure messages sent to the server already have proper structure
3. **Monitoring:** Add metrics to track how often message transformations are needed (indicates potential issues upstream)

## Verification

To verify the fix works:

1. Run the test suite:
   ```bash
   cd apps/server
   bun test src/lib/__tests__/messageTransform.test.ts
   ```

2. Test in production-like scenario:
   - Enable extended thinking
   - Make a request that uses tools (e.g., Nansen API call)
   - Verify no API errors occur
   - Check logs for transformation messages

## Contributors

- Fixed by: Background Agent (Cursor)
- Reported by: User (GitHub Issue #64)
- Date: November 7, 2025
