# Stream Completeness Detection

## The Question: How Do We Know a Response is Complete?

Users reported: "AI responses sometimes appear incomplete or cut off mid-sentence"

## The Definitive Signals

### 1. **`finishReason` Value** (MOST IMPORTANT)

```typescript
finishReason: 'stop'    // ✅ AI completed normally - GOOD
finishReason: 'length'  // ❌ Hit token limit - INCOMPLETE
finishReason: 'error'   // ❌ Error occurred - INCOMPLETE
finishReason: null      // ❌ Stream didn't finish - INCOMPLETE
```

**This is the SOURCE OF TRUTH.**

If `finishReason !== 'stop'`, the response IS incomplete, regardless of how it looks.

### 2. **Stream Events** (Technical Signals)

The AI SDK emits these events in order:
```typescript
'text-start'      // AI starts generating text
'text-delta'      // Incremental text chunks
'text-end'        // ✅ AI finished generating text
'finish-step'     // ✅ Step complete (multi-step agents)
'finish'          // ✅ Stream complete (includes finishReason)
```

**A complete response MUST have:**
- ✅ `text-end` event
- ✅ `finish` event  
- ✅ `finishReason: 'stop'`

### 3. **Stream Reader `done` Signal**

```typescript
const { done, value } = await reader.read();
if (done) {
  // Stream closed by server
}
```

This confirms the server properly closed the connection, but doesn't guarantee completeness.

## What About Content Heuristics?

### ⚠️ Unreliable Indicators (Don't Use These Alone):

**Ends with punctuation:**
```typescript
"The capital is Paris."     // ✅ Looks complete AND is complete
"The capital is Paris"      // ⚠️ Looks incomplete but might be complete
"Please wait..."           // ❌ Looks complete but is incomplete
"Here are 5 steps: 1."     // ❌ Looks complete but clearly incomplete
```

**Response length:**
```typescript
Short response: "Yes."     // ✅ Complete and valid
Long response: 5000 chars  // ❌ Might be cut off at token limit
```

**Conclusion:** Content analysis can supplement but should NEVER override `finishReason`.

### ✅ AI-Powered Completeness Review (Our Solution)

Instead of trying to write heuristics, we use **Claude itself** to review completeness:

```typescript
import { reviewResponseCompleteness } from '../utils/ai-completeness-reviewer';

const review = await reviewResponseCompleteness(
  userQuestion,
  aiResponse,
  'claude-sonnet-4-20250514' // Same model as production (Sonnet 4.5)
);

if (!review.isComplete && review.confidence === 'high') {
  // Response is definitely incomplete - fail test
  throw new Error(`Response incomplete: ${review.reasoning}`);
}
```

**Why This Works Better:**
- ✅ Claude can understand semantic completeness
- ✅ Works for any type of question/response
- ✅ Catches incomplete responses even if they end with punctuation
- ✅ Provides reasoning and confidence levels
- ✅ Uses same API/model as production

**Example Output:**
```
🤖 AI Completeness Review:
   Complete: ✅
   Confidence: high
   Reasoning: Response fully explains all 5 Fibonacci steps with complete sentences

🤖 AI Completeness Review:
   Complete: ❌
   Confidence: high
   Reasoning: Response promises 5 steps but only includes 3, appears cut off
   Missing: Steps 4 and 5
```

## The Production Bug Causes

### Cause 1: Token Limit Hit
```
finishReason: 'length'
```
AI hit max token limit mid-response. Response IS incomplete.

**Solution:** Increase token limit or summarize earlier in response

### Cause 2: Stream Interrupted
```
done=true but no 'finish' event
finishReason=null
```
Network issue, server crash, or timeout.

**Solution:** Better error handling, connection monitoring

### Cause 3: AI Error
```
finishReason: 'error'
```
AI model encountered error during generation.

**Solution:** Check backend logs for AI SDK errors

### Cause 4: Persistence Failure
```
Stream complete (finishReason: 'stop')
But database has partial message
```
Message saved before stream finished, or save failed.

**Solution:** Save messages AFTER stream completes

## Test Strategy

### ✅ What Our Tests Check:

1. **Stream Completion Test:**
   ```typescript
   expect(finishReason).toBe('stop'); // ← KEY CHECK
   expect(hasTextEnd).toBe(true);
   expect(hasFinishEvent).toBe(true);
   expect(streamEndedCleanly).toBe(true);
   ```

2. **Multi-turn Conversation:**
   ```typescript
   // Every turn must complete fully
   turnResults.forEach(result => {
     expect(result.hasFinishReason).toBe(true);
     expect(result.streamCompleted).toBe(true);
   });
   ```

3. **Stream Interruption Detection:**
   ```typescript
   // No gaps >30s between chunks
   expect(maxGapBetweenChunks).toBeLessThan(30000);
   expect(streamStalled).toBe(false);
   ```

4. **Persistence Verification:**
   ```typescript
   // Compare stream content vs. saved content
   const persistedLength = assistantMessage.content.length;
   expect(persistedLength).toBeGreaterThan(50);
   ```

## Implementation in Production App

### What the App Should Do:

```typescript
// In useAIChat.ts or message rendering
const checkResponseComplete = (message: any, finishReason: string | null) => {
  // Check 1: Has finish reason
  if (!finishReason) {
    return { complete: false, reason: 'Stream did not finish' };
  }
  
  // Check 2: Finished normally
  if (finishReason !== 'stop') {
    return { 
      complete: false, 
      reason: finishReason === 'length' 
        ? 'Response too long (hit token limit)' 
        : `Error: ${finishReason}`
    };
  }
  
  // Check 3: Has text-end event
  const hasTextEnd = message.parts?.some((p: any) => 
    p.type === 'text-end' || p.type === 'text'
  );
  
  if (!hasTextEnd) {
    return { complete: false, reason: 'No text content generated' };
  }
  
  return { complete: true, reason: null };
};
```

### UI Indicators:

```typescript
{!responseComplete && (
  <Warning>
    ⚠️ This response may be incomplete: {incompleteness}
  </Warning>
)}
```

## Debugging Production Issues

### When user reports incomplete response:

1. **Check backend logs:**
   ```
   Look for: "✅ Stream completed successfully"
   Look for: "finishReason: stop"
   Look for: "text-end" event
   ```

2. **Check database:**
   ```sql
   SELECT content, parts 
   FROM messages 
   WHERE id = 'message-id';
   
   -- Does parts include 'text-end'?
   -- Does content look complete?
   ```

3. **Check network:**
   ```
   - Did request timeout?
   - Was connection stable?
   - Check Chrome DevTools Network tab
   ```

4. **Reproduce with test:**
   ```bash
   bun test __tests__/e2e/chat-message-flow.test.ts --test "CRITICAL"
   ```

## Summary

**Complete Response =**
- ✅ `finishReason: 'stop'`
- ✅ `text-end` event present
- ✅ `finish` event present
- ✅ Stream `done=true`
- ✅ Content persisted correctly

**Incomplete Response =**
- ❌ `finishReason: 'length'` or `'error'`
- ❌ Missing `text-end` or `finish` events
- ❌ Stream interrupted (no `done`)
- ❌ Content not persisted or partial

**The golden rule:** Trust `finishReason`, validate everything else.

