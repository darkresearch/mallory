# @darkresearch/mallory-server

## 0.1.1

### Patch Changes

- c480c17: Fix token prices and logos not showing in wallet screen (#106)

  - Refactored Birdeye API integration to use Token Overview endpoint (Starter plan compatible)
  - Optimized from 2 API calls per token to 1 call per token
  - Added comprehensive test coverage (18 unit tests + 11 integration tests)
  - Added detailed error logging for Birdeye API diagnostics
  - Token prices and logos now display correctly in wallet screen

- a4fa5ee: Add conversation management guidelines to prevent duplicate responses (#102, contributed by @kennethkabogo)

  - Added explicit prompt instructions to prevent re-answering already-addressed questions
  - Improved AI conversation context awareness

- Updated dependencies
  - @darkresearch/mallory-shared@0.1.1
