# Onboarding Intro Message Safeguards

## Overview
The introductory conversation feature has been **RE-ENABLED** with multiple layers of protection to prevent infinite loops and duplicate messages.

## The Problem
Previously, Mallory would sometimes send endless messages to users during onboarding, creating an infinite loop that could spam users.

## The Solution: 4 Layers of Protection

### 1. **Database Flag Check (PRIMARY SAFEGUARD)**
- **What**: Before triggering the intro message, check `user.hasCompletedOnboarding`
- **Where**: `apps/client/hooks/useChatState.ts` line ~197
- **Effect**: If user has already completed onboarding, NEVER trigger intro message again
- **Scope**: Persists across all sessions, devices, and app restarts

### 2. **Session-Level Ref Guard**
- **What**: `hasTriggeredProactiveMessage.current` prevents multiple triggers in same session
- **Where**: `apps/client/hooks/useChatState.ts` line ~234
- **Effect**: Even if component re-renders, won't trigger intro message twice
- **Scope**: Protects within a single app session

### 3. **Empty Conversation Check**
- **What**: Only trigger if `rawMessages.length === 0`
- **Where**: `apps/client/hooks/useChatState.ts` line ~210
- **Effect**: Won't send intro message if conversation already has messages
- **Scope**: Prevents duplicate intro messages in populated conversations

### 4. **Database Update BEFORE Sending Message (CRITICAL FAIL-SAFE)**
- **What**: Set `has_completed_onboarding = true` in database BEFORE sending intro message
- **Where**: `apps/client/hooks/useChatState.ts` line ~239
- **Effect**: Even if message fails to send, we won't retry. User can only receive intro message ONCE, EVER.
- **Abort on Failure**: If database update fails, we ABORT the intro message entirely
- **Scope**: Permanent, irreversible protection

## Code Flow

```
1. User signs in for first time
   └─> Loading screen checks: hasCompletedOnboarding === false
   
2. Create onboarding conversation with metadata: { is_onboarding: true }
   
3. Navigate to chat screen
   
4. useChatState detects onboarding conversation
   └─> CHECK #1: userHasCompletedOnboarding? → Must be false
   └─> CHECK #2: hasTriggeredProactiveMessage.current? → Must be false
   └─> CHECK #3: rawMessages.length === 0? → Must be empty
   └─> CHECK #4: Mark onboarding complete in DB → Must succeed
   
5. ONLY IF ALL CHECKS PASS: Send intro message
   
6. User will NEVER see intro message again
```

## Why This Works

**The Key Insight**: We update the database flag BEFORE sending the message, not after.

- If the message fails → Database already marked complete → Won't retry ✅
- If the message succeeds → Database already marked complete → Won't send again ✅
- If database update fails → We abort and don't send message → Safe ✅
- If user logs in again → Database flag is true → Won't trigger ✅
- If component re-mounts → Ref and DB flag protect → Won't trigger ✅

## Fail-Safe Behavior

If the database update fails:
```typescript
const success = await markUserOnboardingComplete(userId);
if (!success) {
  console.error('❌ Failed to mark onboarding complete - ABORTING intro message');
  return; // Don't send message at all
}
```

This ensures we NEVER risk sending a message if we can't track that we sent it.

## Testing Checklist

- [ ] New user signs in → Receives intro message ONCE
- [ ] New user refreshes page → Does NOT receive intro message again
- [ ] New user logs out and back in → Does NOT receive intro message again
- [ ] Existing user signs in → Does NOT receive intro message
- [ ] Component re-renders during intro → Does NOT send duplicate message
- [ ] Database update fails → Does NOT send intro message at all
- [ ] Network fails during message send → User still marked complete, won't retry

## Files Modified

1. `apps/client/hooks/useChatState.ts`
   - Added `markUserOnboardingComplete()` helper function
   - Added `userHasCompletedOnboarding` parameter
   - Re-enabled proactive message logic with 4-layer protection

2. `apps/client/app/(main)/loading.tsx`
   - Re-enabled onboarding conversation creation
   - Check `hasCompletedOnboarding` before creating onboarding conversation

3. `apps/client/app/(main)/chat.tsx`
   - Pass `userHasCompletedOnboarding` to `useChatState`

## Database Schema
The protection relies on the `users` table having a `has_completed_onboarding` boolean column:

```sql
-- Column should already exist in users table
has_completed_onboarding BOOLEAN DEFAULT FALSE
```

## Monitoring & Debugging

All safeguards include detailed console logging:
- 🤖 `[Proactive]` - Onboarding detection and checks
- 🎯 `[Onboarding]` - Database flag updates
- ✅ Success indicators
- ❌ Failure indicators with abort reasons

To verify safeguards are working, check browser console for these log patterns.

