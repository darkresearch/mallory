---
"@darkresearch/mallory-server": patch
---

fix: resolve esbuild version conflict in OpenMemory setup to use bun consistently

This fixes the esbuild version mismatch that prevented using bun with OpenMemory backend by pinning esbuild to 0.25.12 and updating the setup script to use bun instead of npm.
