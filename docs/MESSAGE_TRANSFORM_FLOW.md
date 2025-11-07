# Message Transformation Flow

## Overview

This document explains how messages flow through the system and where transformations are applied to ensure Claude API compliance WITHOUT affecting what users see.

## The Challenge

When using Claude's extended thinking API, there are two conflicting requirements:

1. **Claude API Requirement**: Assistant messages with tool calls MUST start with a thinking block
2. **User Experience Requirement**: Messages should display in the natural order they were generated

## The Solution: Transform Only for API Input

We apply transformations ONLY to messages being sent TO Claude's API, while preserving the original order for:
- Messages saved to the database
- Messages streamed to the client
- Messages displayed in the UI

## Message Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. INCOMING MESSAGES                                        │
│    (from database or client)                                │
│    Parts in original order: [text, reasoning, tool-call]   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. SAVE USER MESSAGE IMMEDIATELY                            │
│    ✅ Saved BEFORE transformations                          │
│    ✅ Original part order preserved                         │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. APPLY TRANSFORMATIONS                                    │
│    (for Claude API compliance only)                         │
│                                                              │
│    a) ensureToolMessageStructure()                          │
│       - Splits interleaved tool calls/results               │
│       - Creates separate assistant/user messages            │
│                                                              │
│    b) convertReasoningToThinking()                          │
│       - Converts 'reasoning' → 'thinking' parts             │
│                                                              │
│    c) ensureThinkingBlockCompliance()                       │
│       - Reorders: [thinking, text, tool-call]               │
│       - Ensures thinking blocks come first                  │
│                                                              │
│    Parts now: [thinking, text, tool-call]                   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. SEND TO CLAUDE API                                       │
│    ✅ Transformed messages with proper structure            │
│    ✅ Thinking blocks positioned correctly                  │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. CLAUDE GENERATES RESPONSE                                │
│    Parts in Claude's natural generation order               │
│    Example: [thinking, text, tool-call] or [text]          │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. STREAM TO CLIENT                                         │
│    ✅ Uses originalMessages (untransformed)                 │
│    ✅ New response in Claude's natural order                │
│    ✅ No reordering applied to response                     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. SAVE ASSISTANT MESSAGE                                   │
│    ✅ Saved with parts in original order from Claude        │
│    ✅ No transformations applied                            │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. DISPLAY IN UI                                            │
│    ✅ Parts rendered in the order they appear               │
│    ✅ User sees natural conversation flow                   │
└─────────────────────────────────────────────────────────────┘
```

## Key Implementation Details

### 1. Separate Variables for Different Purposes

```typescript
// apps/server/src/routes/chat/index.ts

// ORIGINAL MESSAGES - for client response and display
const originalMessages = messages.filter((msg: UIMessage) => msg.role !== 'system');

// CONVERSATION MESSAGES - gets transformed for API
let conversationMessages = messages.filter((msg: UIMessage) => msg.role !== 'system');

// Save user message BEFORE transformations
await saveUserMessage(conversationId, lastUserMessage);

// Apply transformations AFTER saving
conversationMessages = ensureToolMessageStructure(conversationMessages);
conversationMessages = convertReasoningToThinking(conversationMessages);

// Send transformed messages TO Claude
const { model, processedMessages } = setupModelProvider(conversationMessages, ...);

// Build response using ORIGINAL messages (untransformed)
const { streamResponse } = buildStreamResponse(result, originalMessages, ...);
```

### 2. Transformation Functions Are Pure

All transformation functions create NEW message objects and don't mutate the originals:

```typescript
// These return NEW arrays/objects
export function convertReasoningToThinking(messages: UIMessage[]): UIMessage[] {
  return messages.map(message => {
    // Creates new message object if transformation needed
    if (needsTransformation) {
      return { ...message, parts: transformedParts };
    }
    return message; // Returns original if no transformation
  });
}
```

### 3. Response Streaming Uses Original Messages

```typescript
// apps/server/src/routes/chat/config/streamResponse.ts

export function buildStreamResponse(
  result: any,
  originalMessages: UIMessage[],  // ← Uses original, untransformed messages
  conversationId: string,
) {
  const streamResponse = result.toUIMessageStreamResponse({
    originalMessages: originalMessages.map((msg: any) => {
      // Preserve original message structure
      return msg;
    }),
    // ...
  });
}
```

### 4. Database Persistence Preserves Original Order

```typescript
// User messages: Saved BEFORE transformations
await saveUserMessage(conversationId, lastUserMessage);  // Original order preserved

// Assistant messages: Saved with parts from Claude's response
// (not from transformed input)
await saveAssistantMessage(conversationId, assistantMessage);  // Claude's order preserved
```

## What Users See

### Example: Conversation with Tool Usage

**What's stored in the database (and displayed to users):**

```
User: "Analyze MOTHER token"

Assistant (message parts in natural order):
  1. [text] "Let me fetch flow intelligence data for you"
  2. [reasoning] "I need to use the nansenFlowIntelligence tool..."
  3. [tool-call] nansenFlowIntelligence(token_address: "...")

User (system-generated):
  1. [tool-result] { data: "..." }

Assistant (message parts in natural order):
  1. [reasoning] "Based on the flow data..."
  2. [text] "Here's the analysis: ..."
```

**What's sent TO Claude API (transformed):**

```
User: "Analyze MOTHER token"

Assistant (transformed for API):
  1. [thinking] "I need to use the nansenFlowIntelligence tool..."  ← Converted from 'reasoning'
  2. [text] "Let me fetch flow intelligence data for you"  ← Reordered to come after thinking
  3. [tool-call] nansenFlowIntelligence(...)

User (system-generated):
  1. [tool-result] { data: "..." }

Assistant (NEW response from Claude):
  1. [thinking] "Based on the flow data..."  ← Generated by Claude
  2. [text] "Here's the analysis: ..."  ← Generated by Claude
```

**Key Points:**

- ✅ User always sees messages in their natural order
- ✅ Transformations only affect API calls (hidden from user)
- ✅ New responses from Claude maintain their generated order
- ✅ Database stores original order for display consistency

## Why This Matters

### Without This Separation

If we applied transformations to ALL messages:

1. ❌ User messages would be saved with reordered parts
2. ❌ Conversation history would look unnatural
3. ❌ Thinking blocks would always appear first, even when Claude generated them later
4. ❌ Tool calls would be separated from their context

### With This Separation

1. ✅ User sees natural conversation flow
2. ✅ Claude API gets properly structured messages
3. ✅ No confusion about why parts appear in different orders
4. ✅ History is consistent and readable

## Testing

To verify this behavior works correctly:

### Manual Testing

1. Start a conversation with tool usage
2. Check the database - parts should be in natural order
3. Continue the conversation - transformations happen transparently
4. Check the UI - messages display naturally

### Automated Testing

See `apps/server/src/lib/__tests__/messageTransform.test.ts`:

```typescript
test('complete flow: reasoning conversion + structure fixing for extended thinking', () => {
  // Simulates real conversation with database messages
  // Verifies transformations don't affect display order
});
```

## Summary

**The Fix:**
- ✅ Transformations applied ONLY to messages sent TO Claude
- ✅ Original messages preserved for user display
- ✅ User messages saved BEFORE transformations
- ✅ Assistant messages saved in their generated order
- ✅ No reordering visible to end users

**The Result:**
- ✅ Claude API requirements satisfied
- ✅ User experience remains natural
- ✅ Conversation history is readable
- ✅ No side effects from API compliance fixes

## Related Documentation

- [BUG_FIX_EXTENDED_THINKING.md](./BUG_FIX_EXTENDED_THINKING.md) - Details on the bug and fix
- [Anthropic Extended Thinking Docs](https://docs.claude.com/en/docs/build-with-claude/extended-thinking)
