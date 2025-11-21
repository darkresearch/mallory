---
"@darkresearch/mallory-server": patch
---

Add comprehensive multi-tier fallback system for wallet token price fetching. Implements Jupiter Price API V3 as primary source with CoinGecko and Birdeye fallbacks. Includes robust error handling, timeout protection, resource leak fixes, and comprehensive test coverage. Fixes issue where wallet prices showed $0.00 when APIs failed.
