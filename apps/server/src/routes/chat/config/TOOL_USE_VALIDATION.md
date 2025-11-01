# Tool Use/Result Validation Fix

## Problem

Users were experiencing errors like:
```
Error: messages.38: tool_use ids were found without tool_result blocks immediately after: toolu_013nnSt6ifVGAT6B7ENC5u3j. Each tool_use block must have a corresponding tool_result block in the next message.
```

This error occurs when:
1. An assistant message contains `tool_use` blocks
2. The next message (which should be user role) doesn't have corresponding `tool_result` blocks
3. The Anthropic API rejects the request because tool_use blocks must be immediately followed by tool_result blocks

## Solution

### 1. Validation Function (`validateMessages.ts`)
Created a comprehensive validation system that:
- Extracts `tool_use` IDs from assistant messages
- Extracts `tool_result` IDs from user messages
- Validates that every `tool_use` has a corresponding `tool_result` in the next message
- Provides detailed error messages for debugging

### 2. Automatic Fixing
When validation errors are detected:
- Orphaned `tool_use` blocks are automatically removed from messages
- This prevents API errors while preserving the rest of the conversation
- Fixes are logged for debugging

### 3. Integration
- Validation runs **before** messages are converted to API format
- Integrated into `buildStreamConfig()` in `streamConfig.ts`
- Errors are caught and logged with detailed information

### 4. Error Handling
- Enhanced error handling in chat route handler
- Specific detection of tool_use/tool_result errors
- Better error messages for debugging

## Files Changed

1. **`apps/server/src/routes/chat/config/validateMessages.ts`** (NEW)
   - Core validation logic
   - Tool use/result extraction functions
   - Validation and fixing functions

2. **`apps/server/src/routes/chat/config/streamConfig.ts`**
   - Integrated validation before API conversion
   - Error logging and handling

3. **`apps/server/src/routes/chat/index.ts`**
   - Enhanced error handling for tool_use/tool_result errors
   - Better error messages

4. **Test Files** (NEW)
   - `apps/server/src/routes/chat/config/__tests__/validateMessages.test.ts`
   - `apps/server/src/routes/chat/config/__tests__/validateMessages.integration.test.ts`

## Testing

Comprehensive tests cover:
- ✅ Correct tool_use/tool_result pairs
- ✅ Missing tool_result blocks
- ✅ Orphaned tool_use blocks
- ✅ Multiple tool calls
- ✅ Edge cases (empty arrays, missing parts, etc.)
- ✅ Real-world scenarios

## How It Works

1. Messages are loaded from database or received from client
2. **Before** converting to API format, validation runs:
   - Checks each assistant message for tool_use blocks
   - Verifies next message has corresponding tool_result blocks
   - If errors found, fixes by removing orphaned tool_use blocks
3. Fixed messages are converted to API format
4. API call proceeds with validated messages

## Benefits

- ✅ Prevents API errors from Anthropic
- ✅ Automatically fixes common issues
- ✅ Detailed logging for debugging
- ✅ Handles edge cases gracefully
- ✅ Preserves conversation history as much as possible

## Future Improvements

- Consider storing tool results in database when tool calls complete
- Add monitoring/metrics for validation errors
- Consider more sophisticated fixing strategies (e.g., querying for missing results)
