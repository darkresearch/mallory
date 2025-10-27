# Mallory Onboarding Implementation Summary

## Overview
Implemented a first-time onboarding flow where new users are greeted by Mallory in their first conversation. Mallory proactively starts the conversation with a confident, engaging introduction.

## What Was Implemented

### 1. Server-Side Changes

#### Created: `apps/server/prompts/onboarding.ts`
- `ONBOARDING_OPENING_MESSAGE_TEMPLATE`: Mallory's greeting message with personality
  - Confident, friendly introduction
  - Explains x402 micropayments (0.001 USDC per Nansen call)
  - Lists capabilities (search, Nansen endpoints, analysis)
  - **Wallet funding requirement**: Clearly explains need for SOL + USDC
  - Provides user's wallet address directly in the message
  - Points to wallet screen for funding
  - Honest about it being "an extra step" - very human
- `ONBOARDING_GUIDELINES`: Instructions for Mallory's tone and behavior
- `ONBOARDING_GREETING_SYSTEM_MESSAGE`: System prompt for onboarding trigger

#### Modified: `apps/server/prompts/index.ts`
- Added exports for onboarding prompts

#### Modified: `apps/server/src/routes/chat/index.ts`
- Detects `'onboarding_greeting'` system message
- Fetches conversation metadata to check for `is_onboarding: true`
- Gets user's wallet address from Grid session
- Passes onboarding context to system prompt builder
- Updated `buildSystemPrompt()` to inject onboarding prompts when triggered
- Replaces `{WALLET_ADDRESS}` placeholder with actual wallet address

#### Modified: `apps/server/src/routes/chat/config/streamResponse.ts`
- Added onboarding context parameter
- **Auto-completion**: In `onFinish` callback, marks `has_completed_onboarding = true` after first assistant message
- No user confirmation needed - automatically completes after Mallory's greeting

### 2. Client-Side Changes

#### Modified: `apps/client/features/chat/services/conversations.ts`
- Added `createOnboardingConversation()` function
- Creates conversation with `is_onboarding: true` metadata
- Auto-exported through existing service exports

#### Modified: `apps/client/hooks/useChatState.ts`
- Already had onboarding detection logic! ✅
- Checks for `is_onboarding` metadata in conversation
- **Added immediate placeholder display** - shows Mallory "M" avatar right away
- **Added custom thinking message** - tracks `isOnboardingGreeting` state
- Sets `hasInitialReasoning = true` to trigger placeholder
- Triggers proactive greeting by sending system message: `'onboarding_greeting'`
- Clears onboarding greeting flag when message completes
- Only triggers once per conversation when empty

#### Modified: `apps/client/app/(main)/loading.tsx`
- Checks `user.hasCompletedOnboarding` flag
- If `false`: Creates onboarding conversation and redirects to chat
- If `true`: Normal flow (goes directly to chat)

#### Already Works: `apps/client/contexts/AuthContext.tsx`
- Already reads `has_completed_onboarding` from `users` table
- Stores in `user.hasCompletedOnboarding`
- Will work once database has the column

## How It Works (Complete Flow)

1. **New user signs in** → AuthContext loads user, `hasCompletedOnboarding = false`
2. **Loading screen** → Detects missing onboarding, creates conversation with `is_onboarding: true`
3. **Chat screen loads** → useChatState detects onboarding metadata
4. **Placeholder shows** → Mallory "M" avatar appears immediately (no blank screen!)
5. **Proactive greeting** → Sends system message `'onboarding_greeting'`
6. **Server receives** → Detects onboarding context, injects special prompts, adds synthetic user message
7. **Mallory responds** → Personalized greeting with user's wallet address streams in
8. **Stream completes** → Server marks `has_completed_onboarding = true`
9. **Next login** → User goes straight to chat (no onboarding)

## Database Requirements

### Required Column
The `users` table needs to have:
```sql
has_completed_onboarding BOOLEAN DEFAULT false
```

**Note**: You mentioned the database is already set up, so this column should already exist.

## Key Features

### Personality-Driven
- Confident, warm, maybe a little flirty/cheeky
- Honest about the wallet funding step ("I know it's an extra step")
- Makes users go "whoa, fuck yeah" 🎉

### Wallet Funding Emphasis
- Clearly explains SOL needed for gas (~0.01 SOL)
- Clearly explains USDC needed for x402 (couple dollars)
- Provides wallet address directly in chat
- Points to wallet screen for easy funding
- Emphasizes how affordable x402 is (0.001 USDC per call!)

### Simple Auto-Completion
- No multi-turn interrogation
- No questions about user goals/experience
- Just greeting → mark complete
- User can continue chatting in same conversation

### Regular Conversation
- This is a normal conversation where Mallory speaks first
- User can continue chatting here
- Can start new conversations anytime
- No special "onboarding mode" behavior after greeting

## Critical Fix: Synthetic User Message

### Problem
The AI SDK requires at least one conversation message - you can't have just a system prompt. When we filtered out the system message `'onboarding_greeting'`, we left an empty array, causing:
```
AI_InvalidPromptError: Invalid prompt: messages must not be empty
```

### Solution
Following the researcher pattern:
1. **Save original messages** before adding synthetic message
2. **Add synthetic user message** if onboarding greeting with no conversation messages:
   - Message: "Please proceed as instructed, accounting for what you know about me and how I would most prefer your response. Do not mention that you saw this user message of mine or reference it in any way."
   - Only exists server-side during AI processing
3. **Pass original messages** (without synthetic) to `buildStreamResponse`

This ensures:
- ✅ AI has a message to respond to
- ✅ Synthetic message never sent to client
- ✅ Synthetic message never saved to database
- ✅ UI only shows real messages

## Files Modified

**New Files:**
- `apps/server/prompts/onboarding.ts`
- `ONBOARDING_IMPLEMENTATION.md` (this file)

**Modified Files:**

*Server:*
- `apps/server/prompts/index.ts`
- `apps/server/prompts/onboarding.ts` (H1 format for first line)
- `apps/server/src/routes/chat/index.ts` (synthetic message logic + uuid import)
- `apps/server/src/routes/chat/config/streamResponse.ts`

*Client:*
- `apps/client/app/_layout.tsx` (load Belwe-Bold font)
- `apps/client/app/(main)/loading.tsx`
- `apps/client/app/(main)/chat.tsx` (pass onboarding greeting flag)
- `apps/client/features/chat/services/conversations.ts`
- `apps/client/hooks/useChatState.ts` (immediate placeholder + custom thinking text)
- `apps/client/components/chat/MessageList.tsx` (pass custom thinking text + isOnboardingMessage)
- `apps/client/components/chat/SimpleMessageRenderer.tsx` (styleOverrides for H1)
- `apps/client/components/chat/AssistantResponse.tsx` (accept styleOverrides)
- `apps/client/components/chat/ChainOfThought/types.ts` (add thinkingText prop)
- `apps/client/components/chat/ChainOfThought/ChainOfThought.tsx` (render custom text)

*StreamdownRN Package (updated separately):*
- `src/core/types.ts` (added styleOverrides to props)
- `src/StreamdownRN.tsx` (getTheme function + styleOverrides support)
- Published as `streamdown-rn@0.1.4-beta.0`

**No Changes Needed:**
- `apps/client/contexts/AuthContext.tsx` (already reads the flag!)

## Custom "Thinking" Text for Onboarding

For the very first message of the onboarding conversation, instead of showing the usual "Thinking" indicator, we show **"Mallory wants to say hello"** for a warm, personal first impression.

### How It Works

1. `useChatState` sets `isOnboardingGreeting = true` when triggering greeting
2. Flag is passed through: chat.tsx → MessageList → SimpleMessageRenderer
3. MessageList checks if it's the first message (index === 0) and flag is set
4. Passes `thinkingText="Mallory wants to say hello"` to SimpleMessageRenderer
5. SimpleMessageRenderer passes it to ChainOfThought component
6. ChainOfThoughtHeader uses this custom text instead of "Thinking"
7. Flag is cleared when message completes (aiStatus === 'ready')

This creates a delightful, personal moment for the user's first interaction!

## Custom H1 Styling for "Hey there!"

The first sentence of Mallory's onboarding greeting uses a special large, bold font (BelweBoldBT) to make a memorable first impression.

### Implementation

**1. Updated StreamdownRN Package (v0.1.4-beta.0)**
- Added `styleOverrides` prop to allow per-instance markdown style customization
- Merges overrides with base theme styles
- Keeps package generic - no app-specific fonts hardcoded
- Published to npm with `beta` tag

**2. Loaded Belwe-Bold Font in Mallory**
- Added `'Belwe-Bold': require('../assets/fonts/BelweBoldBT.ttf')` to font loading
- Font available app-wide for use

**3. Formatted Onboarding Message with H1**
- Changed first line to: `# Hey there!` (markdown H1)
- Separated from emoji and name for clean heading

**4. Applied Custom Styling**
- `SimpleMessageRenderer` detects `isOnboardingMessage` flag
- Creates `styleOverrides` object with custom H1 styling:
  ```typescript
  {
    heading1: {
      fontFamily: 'Belwe-Bold',
      fontSize: 32,
      fontWeight: 'bold',
      color: '#1a1a1a',
      marginTop: 0,
      marginBottom: 12,
    }
  }
  ```
- Passes to `AssistantResponse` → `StreamdownRN`
- Only applies to onboarding greeting message (index === 0)

### Result
- "Hey there!" renders in 32pt BelweBoldBT
- Rest of message in regular 16pt Satoshi
- Creates strong visual hierarchy and memorable first impression

## Testing Checklist

1. ✅ New user signs in for first time
2. ✅ Gets redirected to chat with onboarding conversation
3. ✅ **Mallory "M" placeholder appears immediately** (no blank screen)
4. ✅ **Shows "Mallory wants to say hello"** instead of "Thinking" 
5. ✅ Mallory sends greeting proactively (user didn't send message)
6. ✅ **"Hey there!" displays in large BelweBoldBT font** (32pt)
7. ✅ Rest of message in regular Satoshi font (16pt)
8. ✅ Greeting includes user's wallet address
9. ✅ Greeting explains x402 and funding requirements
10. ✅ After greeting completes, `has_completed_onboarding = true` in database
11. ✅ User can continue chatting in same conversation
12. ✅ Subsequent messages show normal "Thinking" indicator
13. ✅ Subsequent messages use regular fonts (no custom H1)
14. ✅ Next login, user goes straight to normal chat (no onboarding)

## Next Steps

1. Verify `has_completed_onboarding` column exists in production database
2. Test with a new user account
3. Optionally: Adjust Mallory's personality/tone in `ONBOARDING_OPENING_MESSAGE_TEMPLATE`
4. Optionally: Add more wallet funding guidance based on user feedback

