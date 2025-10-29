# Environment Variable Strategy

## Local Development

**Uses:** `.env.test` file
```env
TEST_SUPABASE_EMAIL=github-actions@7kboxsdj.mailosaur.net
TEST_SUPABASE_PASSWORD=********  # Use actual password from GitHub Secrets
EXPO_PUBLIC_SUPABASE_URL=https://...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
...
```

**How it works:**
- `test-env.ts` reads `.env.test` file
- Sets `process.env` variables for tests
- File is gitignored (not committed)

---

## CI/CD (GitHub Actions)

**Uses:** Environment variables from GitHub Secrets
```yaml
env:
  TEST_SUPABASE_EMAIL: ${{ secrets.TEST_SUPABASE_EMAIL }}
  TEST_SUPABASE_PASSWORD: ${{ secrets.TEST_SUPABASE_PASSWORD }}
  EXPO_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
  ...
```

**How it works:**
- GitHub Actions sets environment variables directly
- `test-env.ts` detects no `.env.test` file exists
- Uses existing `process.env` variables (from GitHub)
- **No .env file needed in CI**

---

## Priority Order

`test-env.ts` now follows this priority:

1. **Environment variables** (from GitHub Actions) - **HIGHEST PRIORITY**
2. `.env.test` file (local development) - Only if env var not already set
3. `.env` file (fallback) - Only if neither above exists

**Key change:** CI environment variables take precedence over file-based config.

---

## Code Behavior

```typescript
// Before (would override CI env vars):
process.env[key] = value;  // ❌ Always overrides

// After (respects CI env vars):
if (!process.env[key]) {   // ✅ Only set if not already set
  process.env[key] = value;
}
```

---

## Result

**Local:**
```
✅ Loaded .env.test
→ Uses file-based configuration
```

**CI:**
```
ℹ️  No .env file found (using environment variables from CI)
→ Uses GitHub Secrets
```

Both work correctly! 🎉

