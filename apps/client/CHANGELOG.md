# @darkresearch/mallory-client

## 0.1.1

### Patch Changes

- bf541bb: Fix chat history navigation creating new conversations (PR #92 by @Hebx)

  - **Fix navigation back from chat-history**: Now includes conversationId in URL to preserve active conversation
  - **Fix "Create chat" button stuck state**: Added proper cleanup on mount/unmount and removed animation delay
  - **Fix OnboardingHandler race condition**: Now checks both URL params and props before creating onboarding conversations
  - **Fix storage persistence**: Storage no longer clears during navigation, only on explicit actions like logout
  - **Improve URL sync**: Added web-specific URL update logic to keep browser URL in sync with storage

  This resolves issues where:

  - Users navigating back from chat-history would get a new conversation instead of their active one
  - The "Create chat" button would get stuck in loading state after first use
  - New users would get duplicate onboarding conversations due to race conditions
  - Active conversation was lost during navigation due to premature storage clearing

  Comprehensive test coverage added:

  - Integration tests for navigation preservation and storage persistence
  - Unit tests for button state management and race condition prevention
  - All tests added to CI pipeline

  Contributed by: @Hebx (Ihab Heb)

  - @darkresearch/mallory-shared@0.1.1
