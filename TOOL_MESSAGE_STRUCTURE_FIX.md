# Tool Message Structure Fix

## Problem

Users were experiencing this error when using the chat functionality:

```
Error: messages.38: tool_use ids were found without tool_result blocks immediately after: toolu_013nnSt6ifVGAT6B7ENC5u3j. 
Each tool_use block must have a corresponding tool_result block in the next message.
```

## Root Cause

The Anthropic Claude API has strict requirements for how tool calls and their results are structured in the message history:

1. **Tool calls** (`tool_use` blocks) must be in **assistant messages**
2. **Tool results** (`tool_result` blocks) must be in **user messages** immediately following the assistant message with the tool call
3. Tool calls and results **cannot** be in the same message

However, the AI SDK's `UIMessage` format stores all message parts (text, reasoning, tool calls, and tool results) in a single `parts` array within one message. When these messages were saved to the database and later loaded for subsequent requests, they would be sent back to the Anthropic API with an incorrect structure.

### Example of Incorrect Structure

```typescript
// INCORRECT: Everything in one assistant message
{
  id: 'msg-1',
  role: 'assistant',
  parts: [
    { type: 'text', text: 'Let me search for that' },
    { type: 'tool-call', toolCallId: 'call-1', toolName: 'searchWeb', args: {...} },
    { type: 'tool-result', toolCallId: 'call-1', toolName: 'searchWeb', result: {...} },
    { type: 'text', text: 'Here are the results' }
  ]
}
```

### Example of Correct Structure

```typescript
// CORRECT: Tool calls and results in separate messages
[
  {
    id: 'msg-1',
    role: 'assistant',
    parts: [
      { type: 'text', text: 'Let me search for that' },
      { type: 'tool-call', toolCallId: 'call-1', toolName: 'searchWeb', args: {...} }
    ]
  },
  {
    id: 'msg-2',
    role: 'user',
    parts: [
      { type: 'tool-result', toolCallId: 'call-1', toolName: 'searchWeb', result: {...} }
    ]
  },
  {
    id: 'msg-3',
    role: 'assistant',
    parts: [
      { type: 'text', text: 'Here are the results' }
    ]
  }
]
```

## Solution

We implemented a message transformation system that:

1. **Validates** message structure before sending to the API
2. **Transforms** incorrectly structured messages to match Anthropic's requirements
3. **Preserves** all message content (text, reasoning, tool data)

### New Files

#### `/workspace/apps/server/src/lib/messageTransform.ts`

Core transformation utilities:
- `validateToolMessageStructure()` - Checks if messages follow Anthropic's requirements
- `ensureToolMessageStructure()` - Splits and reorganizes messages to fix structure issues
- `logMessageStructure()` - Debugging utility to visualize message structure

#### `/workspace/apps/server/src/lib/__tests__/messageTransform.test.ts`

Comprehensive test suite covering:
- Validation of correct and incorrect structures
- Message splitting and reorganization
- Preservation of message content and order
- Edge cases (multiple tool calls, reasoning parts, etc.)

#### `/workspace/apps/server/src/lib/__tests__/validate-message-transform.js`

Simple validation script that can be run standalone:
```bash
node src/lib/__tests__/validate-message-transform.js
```

### Integration

The fix is integrated into the chat handler at `/workspace/apps/server/src/routes/chat/index.ts`:

```typescript
// Import transformation utilities
import { ensureToolMessageStructure, validateToolMessageStructure, logMessageStructure } from '../../lib/messageTransform.js';

// In the chat handler, after loading messages:
console.log('🔧 Checking tool message structure...');
logMessageStructure(conversationMessages, 'BEFORE transformation');

const validation = validateToolMessageStructure(conversationMessages);
if (!validation.isValid) {
  console.warn('⚠️ Tool message structure validation failed:', validation.errors);
  console.log('🔧 Attempting to fix tool message structure...');
  conversationMessages = ensureToolMessageStructure(conversationMessages);
  logMessageStructure(conversationMessages, 'AFTER transformation');
  
  const revalidation = validateToolMessageStructure(conversationMessages);
  if (!revalidation.isValid) {
    console.error('❌ Tool message structure still invalid after transformation:', revalidation.errors);
  } else {
    console.log('✅ Tool message structure fixed successfully!');
  }
} else {
  console.log('✅ Tool message structure is valid');
}
```

## Testing

### Unit Tests

Run the test suite:
```bash
bun test src/lib/__tests__/messageTransform.test.ts
```

Or run the standalone validation:
```bash
node src/lib/__tests__/validate-message-transform.js
```

### Integration Tests

A new end-to-end test was created at `/workspace/apps/client/__tests__/e2e/tool-message-structure.test.ts` that:
1. Creates a conversation with tool calls
2. Loads the conversation history from the database
3. Sends a follow-up message (which loads the history)
4. Verifies no Anthropic API errors occur

## Impact

This fix ensures:
- ✅ Users can continue conversations that involved tool calls
- ✅ No more "tool_use ids were found without tool_result blocks" errors
- ✅ Message history is correctly structured when sent to Anthropic API
- ✅ All message content is preserved (no data loss)
- ✅ Tool functionality continues to work as expected

## Monitoring

The transformation includes detailed logging:
- `🔧 Checking tool message structure...` - Validation start
- `⚠️ Tool message structure validation failed` - Issues detected
- `🔧 Attempting to fix tool message structure...` - Transformation in progress
- `✅ Tool message structure fixed successfully!` - Fix applied successfully
- `❌ Tool message structure still invalid` - Fix failed (should be investigated)

Check server logs for these messages to monitor the fix in production.

## Future Considerations

1. **AI SDK Update**: Monitor `ai` package updates - future versions may handle this automatically
2. **Database Schema**: Consider storing messages in a format that matches Anthropic's requirements natively
3. **Performance**: For very long conversations with many tool calls, consider optimizing the transformation logic

## References

- [Anthropic API Documentation - Messages](https://docs.anthropic.com/claude/reference/messages_post)
- [AI SDK Documentation](https://sdk.vercel.ai/docs)
- Related issue: User reports of "tool_use ids were found without tool_result blocks" error
