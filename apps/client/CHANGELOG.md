# @darkresearch/mallory-client

## 0.1.1

### Patch Changes

- bf541bb: Fix chat history navigation creating new conversations (#110, contributed by @Hebx)

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

- a4fa5ee: Add conversation management guidelines to prevent duplicate responses (#102, contributed by @kennethkabogo)

  - Added explicit prompt instructions to prevent re-answering already-addressed questions
  - Created decision tree for handling follow-up questions vs. new questions
  - Improved conversation context awareness in AI responses

- f45e9e4: Remove stale maestro artifacts (#104)

  - Cleaned up obsolete mobile testing configuration files

- 8bbc31b: Add changesets for version management and changelogs (#105)

  - Implemented automated changelog generation
  - Added changeset workflow for tracking changes

- Updated dependencies
  - @darkresearch/mallory-shared@0.1.1
