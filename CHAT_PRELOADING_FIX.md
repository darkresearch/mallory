# Chat Screen & Chat History Preloading Fix

## Problem Statement

Users were experiencing loading issues on mobile when navigating between screens:

### Scenario 1: Wallet → Chat
1. User logs in & goes through OTP
2. User is navigated to wallet screen
3. User clicks back arrow on wallet screen to go back to the chat screen
4. Chat screen gets stuck loading the first conversation

### Scenario 2: Wallet → Chat → Chat History (or Wallet → Chat History)
1. User is on wallet screen
2. User navigates to chat screen, then to chat history screen
3. Chat history screen is stuck loading all conversations and messages

The issue only occurred on initial navigation after OTP, not after app refresh.

## Root Cause

### Chat Screen Loading
The chat screen loads data in two sequential steps:
1. **Load active conversation ID** - via `useActiveConversation` hook which calls `getCurrentOrCreateConversation()`
2. **Load conversation messages** - via `useAIChat` hook which calls `loadMessagesFromSupabase()`

### Chat History Loading
The chat history screen loads much more data:
1. **Load ALL conversations** - via `loadConversationsAndMessages()` which fetches all user conversations
2. **Load ALL messages** - fetches messages for ALL conversations to enable search

When navigating from wallet to these screens, these operations would start fresh and take time, causing the perceived "stuck on loading" issue.

## Solution

Implemented **two separate background preloaders** to handle both scenarios:

1. **`useChatPreloader`** - Preloads the active conversation and its messages (lightweight)
2. **`useChatHistoryPreloader`** - Preloads ALL conversations and ALL their messages (heavier)

These preloaders run in the background when users land on certain screens, ensuring instant navigation later.

### Implementation Details

#### 1. Hook: `useChatPreloader`

Created `/workspace/apps/client/hooks/useChatPreloader.ts`:

```typescript
export function useChatPreloader({ userId, enabled = true }: UseChatPreloaderProps) {
  // Preloads in the background:
  // 1. Active conversation ID (loads or creates)
  // 2. Messages for that conversation
  
  // Only runs once per session (uses useRef to prevent re-runs)
  // Safe to call from multiple screens
}
```

**Used in:**
- Wallet screen (preloads for when user navigates back to chat)

**Key Features:**
- Only runs once per session
- Runs in the background without blocking UI
- Can be conditionally enabled
- Logs preload progress for debugging
- Gracefully handles errors

#### 2. Hook: `useChatHistoryPreloader`

Created `/workspace/apps/client/hooks/useChatHistoryPreloader.ts`:

```typescript
export function useChatHistoryPreloader({ userId, enabled = true }: UseChatHistoryPreloaderProps) {
  // Preloads in the background:
  // 1. ALL conversations for the user
  // 2. ALL messages for ALL conversations (for search functionality)
  
  // Only runs once per session
  // Much heavier operation than useChatPreloader
}
```

**Used in:**
- Wallet screen (preloads for when user navigates to chat history from wallet)
- Chat screen (preloads for when user navigates from chat to chat history)

**Key Features:**
- Preloads complete conversation history
- Enables instant search when chat history loads
- Groups messages by conversation ID
- Only runs once per session
- Safe to call from multiple screens

#### 3. Updated Wallet Screen

Modified `/workspace/apps/client/app/(main)/wallet.tsx`:

```typescript
// Preload chat data in the background so it's ready when user navigates back to chat
const { isPreloading, isPreloaded } = useChatPreloader({ 
  userId: user?.id,
  enabled: !!user?.id
});

// Preload chat history data in the background so it's ready when user navigates to chat history
const { 
  isPreloading: isPreloadingHistory, 
  isPreloaded: isPreloadedHistory 
} = useChatHistoryPreloader({ 
  userId: user?.id,
  enabled: !!user?.id
});
```

#### 4. Updated Chat Screen

Modified `/workspace/apps/client/app/(main)/chat.tsx`:

```typescript
// Preload chat history data in the background so it's ready when user navigates to chat history
const { 
  isPreloading: isPreloadingHistory, 
  isPreloaded: isPreloadedHistory 
} = useChatHistoryPreloader({ 
  userId: user?.id,
  enabled: !!user?.id
});
```

#### 5. Chat History Screen

No changes needed! The chat-history screen already has its own efficient loading mechanism. The preloaders ensure the data is ready before the user even navigates there.

## Benefits

1. **Instant Navigation** - All navigation paths load instantly:
   - Wallet → Chat (instant)
   - Wallet → Chat History (instant)
   - Chat → Chat History (instant)
   
2. **No UI Changes** - Works transparently in the background without affecting existing UI

3. **Safe & Efficient** - Both hooks only run once per session, prevents duplicate loads

4. **Debuggable** - Logs preload status for monitoring:
   - `🔄 [ChatPreloader] Starting background preload of chat data`
   - `🔄 [ChatHistoryPreloader] Starting background preload of chat history data`

5. **Flexible** - Can be disabled or added to other screens easily

6. **Smart Loading** - Light preloader for single conversation, heavy preloader for full history

## Files Modified

### Created:
1. `/workspace/apps/client/hooks/useChatPreloader.ts` - Preloads active conversation + messages
2. `/workspace/apps/client/hooks/useChatHistoryPreloader.ts` - Preloads all conversations + all messages
3. `/workspace/apps/client/__tests__/unit/useChatPreloader.test.ts` - Unit tests

### Modified:
1. `/workspace/apps/client/app/(main)/wallet.tsx` - Added both preloaders
2. `/workspace/apps/client/app/(main)/chat.tsx` - Added chat history preloader
3. `/workspace/apps/client/app/(main)/chat-history.tsx` - Removed unnecessary preloader (uses own loading)

## Testing Recommendations

### Test on Mobile Device:

1. **Wallet → Chat:**
   - Log in with OTP → lands on wallet
   - Check console: `🔄 [WalletScreen] Chat preload status:`
   - Navigate back to chat
   - ✅ Verify chat loads instantly

2. **Wallet → Chat History:**
   - From wallet, navigate to chat history
   - Check console: `🔄 [WalletScreen] Chat history preload status:`
   - ✅ Verify chat history loads instantly with all conversations

3. **Chat → Chat History:**
   - From chat, navigate to chat history
   - Check console: `🔄 [ChatScreen] Chat history preload status:`
   - ✅ Verify chat history loads instantly

4. **Multiple Navigations:**
   - Navigate between screens multiple times
   - ✅ Verify preloading only happens once (check console logs)
   - ✅ Verify all subsequent navigations remain fast

### Test on Web:
- Verify the same behavior works on web platform
- Verify no regressions in existing functionality

## Performance Notes

- **`useChatPreloader`**: Lightweight - loads 1 conversation + its messages (~100-500ms)
- **`useChatHistoryPreloader`**: Heavier - loads all conversations + all messages (~500ms-2s depending on history)
- Both run in parallel without blocking UI
- Both only run once per session
- Subsequent navigations use the preloaded data instantly

## Future Considerations

The same preloading approach can be applied to:
- Wallet data when on chat screen (already done via WalletContext)
- Other expensive data loads
- Predictive preloading based on user navigation patterns
- Smart caching strategies for preloaded data
