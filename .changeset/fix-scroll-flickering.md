---
"@darkresearch/mallory-client": patch
---

Fix chat scroll behavior to properly handle auto-scrolling during streaming without interrupting user's ability to browse chat history. The chat now stays scrolled to bottom when new content arrives, but immediately stops auto-scrolling when user scrolls up. Auto-scroll resumes when user scrolls back near the bottom. Fixes scroll button flickering during fast streaming by adding scroll direction detection with threshold.

