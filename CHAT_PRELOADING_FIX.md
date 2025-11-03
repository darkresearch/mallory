# Chat Screen Preloading Fix

## Problem Statement

Users were experiencing a loading issue on mobile when:
1. User logs in & goes through OTP
2. User is navigated to wallet screen
3. User clicks back arrow on wallet screen to go back to the chat screen
4. Chat screen gets stuck loading the first conversation

The issue only occurred on initial navigation after OTP, not after app refresh.

## Root Cause

The chat screen loads data in two sequential steps:
1. **Load active conversation ID** - via `useActiveConversation` hook which calls `getCurrentOrCreateConversation()`
2. **Load conversation messages** - via `useAIChat` hook which calls `loadMessagesFromSupabase()`

When navigating from wallet back to chat, these operations would start fresh and take time, causing the perceived "stuck on loading" issue.

## Solution

Implemented background preloading of chat data when the user lands on the wallet screen (or chat-history screen) after OTP. This ensures that when the user navigates back to the chat screen, all data is already loaded and ready.

### Implementation Details

#### 1. New Hook: `useChatPreloader`

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

**Key Features:**
- Only runs once per session (prevents duplicate loads)
- Runs in the background without blocking UI
- Can be conditionally enabled
- Logs preload progress for debugging
- Gracefully handles errors

#### 2. Updated Wallet Screen

Modified `/workspace/apps/client/app/(main)/wallet.tsx`:

```typescript
// Preload chat data in the background so it's ready when user navigates back to chat
const { isPreloading, isPreloaded } = useChatPreloader({ 
  userId: user?.id,
  enabled: !!user?.id // Only preload when user is authenticated
});
```

#### 3. Updated Chat History Screen

Modified `/workspace/apps/client/app/(main)/chat-history.tsx`:

```typescript
// Preload chat data in the background so it's ready when user navigates to chat
const { isPreloading, isPreloaded } = useChatPreloader({ 
  userId: user?.id,
  enabled: !!user?.id // Only preload when user is authenticated
});
```

## Benefits

1. **Instant Chat Navigation** - When user clicks back to chat from wallet, the conversation and messages are already loaded
2. **No UI Changes** - Works transparently in the background without affecting existing UI
3. **Safe & Efficient** - Only runs once per session, prevents duplicate loads
4. **Debuggable** - Logs preload status for monitoring
5. **Flexible** - Can be disabled or added to other screens easily

## Files Modified

1. **Created:**
   - `/workspace/apps/client/hooks/useChatPreloader.ts` - New hook for background preloading

2. **Modified:**
   - `/workspace/apps/client/app/(main)/wallet.tsx` - Added chat preloading
   - `/workspace/apps/client/app/(main)/chat-history.tsx` - Added chat preloading

## Testing Recommendations

1. **Test on Mobile Device:**
   - Log in with OTP
   - Navigate to wallet screen
   - Verify console logs show: `🔄 [ChatPreloader] Starting background preload of chat data`
   - Navigate back to chat screen
   - Verify chat loads instantly without showing loading state

2. **Test Multiple Navigations:**
   - Navigate between wallet and chat multiple times
   - Verify preloading only happens once (check console logs)
   - Verify subsequent navigations remain fast

3. **Test on Web:**
   - Verify the same behavior works on web platform
   - Verify no regressions in existing functionality

## Future Considerations

If needed, the same preloading approach can be applied to:
- Wallet data when on chat screen
- Other expensive data loads
- Predictive preloading based on user navigation patterns
