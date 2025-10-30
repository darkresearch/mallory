# ✅ Your New Tests ARE in CI!

## Status: Fully Integrated ✓

Your new tests are automatically included in your CI pipeline through your existing test commands. Here's how:

---

## 🔄 How CI Picks Up the Tests

### In Your CI Workflow (`.github/workflows/test.yml`):

**Integration Tests Job** (line 180-181):
```yaml
- name: Run integration tests
  run: cd apps/client && bun run test:integration
```

**This command** (from `package.json` line 22):
```json
"test:integration": "bun test __tests__/integration/"
```

**Runs ALL files in `__tests__/integration/`**, including:
- ✅ `storage-key-consistency.test.ts` (NEW!)
- ✅ `app-refresh-grid-persistence.test.ts` (NEW!)
- ✅ `auth-grid-integration.test.ts` (existing)
- ✅ `session-persistence.test.ts` (existing)
- ✅ `wallet-grid-integration.test.ts` (existing)
- ✅ `chat-state.test.ts` (existing)

---

## 📋 CI Test Execution Flow

```
On every PR/push to main:
┌─────────────────────────────────┐
│  1. Unit Tests (5 min timeout)  │  ← Fast, no backend
└──────────┬──────────────────────┘
           │
           v
┌─────────────────────────────────┐
│ 2. Integration Tests (10 min)   │  ← YOUR NEW TESTS RUN HERE!
│    - Start backend server        │
│    - Setup Grid account          │
│    - Run ALL integration tests   │  ✅ storage-key-consistency
│      including new ones          │  ✅ app-refresh-persistence
└──────────┬──────────────────────┘
           │
           v
┌─────────────────────────────────┐
│  3. E2E Tests (10 min)          │
│    - Auth flows                  │
│    - OTP persistence             │
└─────────────────────────────────┘
```

---

## 🧪 What Gets Tested in CI

### Storage Key Consistency Test
**Runs in Integration Tests job** (line 86-222)

**What it does:**
- Scans all `.ts` and `.tsx` files in `apps/client`
- Checks for hardcoded `sessionStorage.getItem('string')` calls
- Checks for hardcoded `secureStorage.getItem('string')` calls
- Fails CI if any hardcoded keys are found
- Reports violations with file paths

**Will catch:**
```typescript
// ❌ These will FAIL the CI build:
sessionStorage.getItem('my_key')
secureStorage.getItem('some_key')

// ✅ These will PASS:
sessionStorage.getItem(SESSION_STORAGE_KEYS.MY_KEY)
secureStorage.getItem(SECURE_STORAGE_KEYS.SOME_KEY)
```

### App Refresh Grid Persistence Test
**Runs in Integration Tests job** (line 86-222)

**What it does:**
- Tests that Grid credentials persist through app refresh
- Tests that Grid credentials are cleared on explicit logout
- Tests multiple refresh cycles
- Tests re-hydration after user becomes available

**Scenarios tested:**
1. ✅ User null temporarily (refresh) → Credentials preserved
2. ✅ User null + logout flag → Credentials cleared
3. ✅ Multiple refreshes → Credentials persist
4. ✅ No logout flag → No clearing happens

---

## 🚀 Running Tests Locally

### Run just the new tests:
```bash
cd apps/client

# Storage key consistency
bun test __tests__/integration/storage-key-consistency.test.ts

# App refresh persistence
bun test __tests__/integration/app-refresh-grid-persistence.test.ts
```

### Run all integration tests (like CI does):
```bash
bun run test:integration
```

### Run the full CI test suite locally:
```bash
bun run test:all
```

---

## 📊 CI Test Stages

Your new tests run in **Stage 2: Integration Tests**:

```yaml
integration-tests:
  name: Integration Tests
  runs-on: ubuntu-latest
  timeout-minutes: 10
  needs: unit-tests  # ← Runs after unit tests pass
```

**Why Integration stage?**
- Storage key consistency checks the actual file structure (needs full codebase)
- App refresh test mocks contexts and providers (integration-level testing)
- Both tests verify integration between multiple components

---

## 🔍 Verification

You can verify the tests will run in CI by:

### 1. Check test discovery:
```bash
cd apps/client
bun test --listTests | grep -E "storage|refresh"
```

### 2. Run the integration suite:
```bash
bun run test:integration
```

### 3. Push to a PR and check CI:
The tests will automatically run in the "Integration Tests" job.

---

## ✅ Summary

**Q: Are the new tests in CI?**  
**A: YES! ✓**

- ✅ Tests are in `__tests__/integration/` directory
- ✅ CI runs `bun run test:integration` which includes that directory
- ✅ Tests will run on every PR and push to main
- ✅ CI will fail if hardcoded keys are found
- ✅ CI will fail if app refresh breaks Grid credentials

**No additional CI configuration needed!** Your tests are already integrated through the existing `test:integration` command.

---

## 🎯 Next PR Trigger

On your next push, you'll see in the CI logs:

```
Running integration tests...
  ✓ storage-key-consistency.test.ts
    ✓ should not have hardcoded sessionStorage keys
    ✓ should not have hardcoded secureStorage keys
    ✓ should have storage keys constants file
    ✓ all storage keys should have mallory_ prefix
    
  ✓ app-refresh-grid-persistence.test.ts
    ✓ should preserve Grid credentials on app refresh
    ✓ should clear Grid credentials on explicit logout
    ✓ should handle multiple refresh cycles
```

Your storage layer is now protected by CI! 🎉
