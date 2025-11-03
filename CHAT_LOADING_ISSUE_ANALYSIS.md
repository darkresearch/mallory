# Chat Screen Loading Issue Analysis - Mobile Safari

## Problem Description

**Reproduction Steps:**
1. User refreshes `/wallet` page on mobile Safari
2. User navigates to chat screen (via arrow/back button)
3. Chat screen gets stuck showing "Loading conversation history..." indefinitely

**Affected Screens:**
- `/chat` screen
- `/chat-history` screen (similar issue)

**Environment:**
- ✅ Works on desktop browsers (Brave, Chrome, etc.)
- ❌ Fails on mobile Safari

## Code Flow Analysis

### Chat Screen Loading Flow

```
chat.tsx
  ↓
useActiveConversation()
  ↓ (provides: currentConversationId, isLoadingConversation)
  ↓
useChatState()
  ↓ (combines: isLoadingConversation || useAIChat.isLoadingHistory)
  ↓
useAIChat()
  ↓ (loads messages via loadMessagesFromSupabase)
  ↓
MessageList component (shows "Loading conversation history..." when isLoadingHistory=true)
```

### Key Hooks Involved

#### 1. `useActiveConversation` (`hooks/useActiveConversation.ts`)

**Purpose:** Loads the active conversation ID for the chat screen

**Key Logic:**
- Starts with `isLoading=true`
- Uses `hasLoadedRef` and `loadInProgressRef` to prevent duplicate loads
- Resets `hasLoadedRef` when pathname changes (line 44)
- Checks `pathname.includes('/chat')` to determine if on chat screen

**Potential Issues:**

1. **Ref Persistence After Page Refresh:**
   - `hasLoadedRef` is a React ref that persists across re-renders but NOT across page refreshes
   - However, if the component doesn't fully unmount on navigation, the ref might retain state
   - On mobile Safari, navigation might preserve component state differently than desktop

2. **Pathname Check Timing:**
   ```typescript
   const isOnChatScreen = pathname.includes('/chat');
   ```
   - On mobile Safari, pathname might not update immediately after navigation
   - The check happens synchronously, but navigation might be asynchronous

3. **Race Condition Between Storage and Load:**
   ```typescript
   if (hasLoadedRef.current || loadInProgressRef.current) {
     return; // Prevents loading
   }
   ```
   - If `loadInProgressRef` gets stuck as `true` due to an error, subsequent loads are blocked
   - Error handling resets it, but if error happens before set, it might persist

#### 2. `useAIChat` (`hooks/useAIChat.ts`)

**Purpose:** Loads historical messages and manages AI chat state

**Key Logic:**
- Starts with `isLoadingHistory=true`
- Loads messages when `conversationId` changes (line 34-77)
- Sets `isLoadingHistory=false` after loading completes OR on error

**Potential Issues:**

1. **Silent Failure in `loadMessagesFromSupabase`:**
   ```typescript
   try {
     const historicalMessages = await loadMessagesFromSupabase(conversationId);
     if (!isCancelled) {
       setInitialMessages(historicalMessages);
       setIsLoadingHistory(false);
     }
   } catch (error) {
     console.error('📖 Error loading historical messages:', error);
     if (!isCancelled) {
       setInitialMessages([]);
       setIsLoadingHistory(false);
     }
   }
   ```
   - If `loadMessagesFromSupabase` throws an error, it should set `isLoadingHistory=false`
   - BUT: If the Supabase query hangs/times out silently on mobile Safari, the error might never be caught
   - Mobile Safari might have different network timeout behavior

2. **Effect Dependency Issue:**
   ```typescript
   useEffect(() => {
     // Load history when conversationId changes
   }, [conversationId]);
   ```
   - If `conversationId` is `null` or `'temp-loading'`, it sets `isLoadingHistory=false` immediately
   - BUT: If `conversationId` is set but invalid/corrupted, the effect might not handle it properly

3. **Race Condition with `useChat`:**
   - `useChat` hook is initialized with `conversationId` immediately
   - If `conversationId` changes while messages are loading, `isCancelled` prevents update
   - BUT: If `conversationId` is the same but component remounts, the cancellation might not work correctly

#### 3. `loadMessagesFromSupabase` (`features/chat/services/messages.ts`)

**Purpose:** Query Supabase for messages

**Key Logic:**
```typescript
const { data: messages, error } = await supabase
  .from('messages')
  .select('id, role, content, metadata, created_at, is_liked, is_disliked')
  .eq('conversation_id', conversationId)
  .order('created_at', { ascending: true });
```

**Potential Issues:**

1. **Mobile Safari Network Timeout:**
   - Mobile Safari might have stricter network timeout policies
   - Supabase queries might timeout silently without throwing an error
   - The query might hang indefinitely, keeping `isLoadingHistory=true`

2. **Session Storage on Mobile Safari:**
   - `secureStorage` uses `sessionStorage` on web (line 20 in `lib/storage/index.ts`)
   - Mobile Safari has known issues with `sessionStorage` persistence:
     - `sessionStorage` is cleared when page is refreshed in private browsing mode
     - Some mobile Safari versions have bugs with `sessionStorage` after page refresh
     - If auth tokens are lost after refresh, Supabase queries will fail silently

3. **Supabase Client Configuration:**
   - Uses `AsyncStorage` for auth storage (line 28 in `lib/supabase/client.ts`)
   - On web, this might not work correctly (AsyncStorage is React Native specific)
   - Mobile Safari might not handle AsyncStorage correctly, causing auth issues

## Root Cause Hypotheses

### Hypothesis 1: Session Storage Cleared on Refresh (HIGH PROBABILITY)

**Scenario:**
- User refreshes `/wallet` page
- Mobile Safari clears `sessionStorage` (or it's not persisted correctly)
- Auth tokens are lost
- When navigating to chat, Supabase queries fail silently
- `isLoadingHistory` stays `true` because error handling doesn't catch the auth failure

**Evidence:**
- Issue only happens after refresh (not on initial navigation)
- Mobile Safari specific (desktop browsers handle sessionStorage differently)
- Both chat and chat-history affected (both use Supabase queries)

**Fix Direction:**
- Add explicit error handling for auth failures
- Check if auth token exists before making queries
- Add timeout handling for Supabase queries

### Hypothesis 2: Ref State Persistence Issue (MEDIUM PROBABILITY)

**Scenario:**
- `hasLoadedRef` in `useActiveConversation` gets stuck as `true`
- After refresh, the ref might retain state if component doesn't fully unmount
- The check `if (hasLoadedRef.current || loadInProgressRef.current) { return; }` prevents reloading
- Conversation ID never loads, so `isLoadingHistory` stays `true`

**Evidence:**
- The ref reset logic depends on pathname change detection
- Mobile Safari might handle navigation differently, causing pathname to not update correctly

**Fix Direction:**
- Add explicit reset logic on component mount
- Don't rely on pathname change detection
- Add cleanup on unmount

### Hypothesis 3: Supabase Query Timeout on Mobile Safari (MEDIUM PROBABILITY)

**Scenario:**
- Supabase query hangs/times out silently on mobile Safari
- Network conditions or Safari-specific behavior causes query to never resolve
- No error is thrown, so `isLoadingHistory` stays `true`

**Evidence:**
- Issue is Safari-specific
- Happens after refresh (network state might be different)

**Fix Direction:**
- Add explicit timeout to Supabase queries
- Add timeout handling in `loadMessagesFromSupabase`
- Add retry logic with exponential backoff

### Hypothesis 4: Component Mount Order Issue (LOW PROBABILITY)

**Scenario:**
- On mobile Safari, components mount in different order after refresh
- `useAIChat` initializes before `useActiveConversation` finishes
- `conversationId` is `null` initially, so `isLoadingHistory` is set to `false`
- When `conversationId` loads, the effect doesn't re-run because dependencies haven't changed correctly

**Evidence:**
- Less likely, but mobile Safari might handle React hydration differently

**Fix Direction:**
- Ensure proper dependency arrays
- Add loading state checks before initializing `useAIChat`

## Similarities Between Chat and Chat-History Screens

Both screens:
1. Use Supabase queries to load data
2. Use `secureStorage` (sessionStorage on web)
3. Have loading states that depend on async operations
4. Are affected by the same issue on mobile Safari

**Key Difference:**
- `chat-history.tsx` loads conversations directly via Supabase (line 83-171)
- `chat.tsx` uses hooks (`useActiveConversation`, `useAIChat`) which abstract the loading

**Common Pattern:**
Both rely on:
- Secure storage for auth tokens
- Supabase queries for data
- Loading state management

## Debugging Recommendations

### 1. Add Comprehensive Logging

Add logging at key points:
- When `useActiveConversation` starts loading
- When `useAIChat` starts loading messages
- When `loadMessagesFromSupabase` is called
- When Supabase queries complete or fail
- When loading states change

### 2. Check Auth Token State

Log auth token availability:
- Before making Supabase queries
- After page refresh
- When navigating to chat screen

### 3. Add Error Boundaries

Wrap Supabase queries in try-catch with explicit error handling:
- Log errors with full details
- Set loading states to false on error
- Show user-friendly error messages

### 4. Add Timeout Handling

Add explicit timeouts to Supabase queries:
- Use `AbortController` for fetch requests
- Set reasonable timeout (e.g., 10 seconds)
- Handle timeout errors explicitly

### 5. Test Session Storage Behavior

Verify sessionStorage behavior on mobile Safari:
- Log sessionStorage state after refresh
- Check if auth tokens persist correctly
- Verify sessionStorage is available and working

## Next Steps

1. **Add logging** to identify exactly where the loading gets stuck
2. **Check auth token** state before/after refresh on mobile Safari
3. **Add timeout handling** to Supabase queries
4. **Add explicit error handling** for auth failures
5. **Test sessionStorage** behavior on mobile Safari specifically

## Files to Investigate

1. `/workspace/apps/client/hooks/useActiveConversation.ts` - Conversation ID loading
2. `/workspace/apps/client/hooks/useAIChat.ts` - Message history loading
3. `/workspace/apps/client/features/chat/services/messages.ts` - Supabase query
4. `/workspace/apps/client/lib/storage/index.ts` - SessionStorage implementation
5. `/workspace/apps/client/lib/supabase/client.ts` - Supabase client config
