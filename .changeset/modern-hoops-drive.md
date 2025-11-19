---
"@darkresearch/mallory-server": patch
---

Fix token prices and logos not showing in wallet screen

- Refactored Birdeye API integration to use Token Overview endpoint (Starter plan compatible)
- Optimized from 2 API calls per token to 1 call per token
- Added comprehensive test coverage (18 unit tests + 11 integration tests)
- Added detailed error logging for Birdeye API diagnostics
- Token prices and logos now display correctly in wallet screen
