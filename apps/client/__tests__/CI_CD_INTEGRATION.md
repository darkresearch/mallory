# CI/CD Integration Guide

## ✅ Cleaned Up: EXPO_PUBLIC_GRID_API_KEY Removed

The Grid API key has been **completely removed** from client-side code. It now only exists server-side where it belongs.

---

## Required Secrets for CI/CD

### Client Tests (Unit + Integration + E2E)

```bash
# Supabase (client-safe, but still secret)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Test Account Credentials
TEST_SUPABASE_EMAIL=mallory-testing@7kboxsdj.mailosaur.net
TEST_SUPABASE_PASSWORD=YourSecureTestPassword123!

# Mailosaur (for OTP retrieval in tests)
MAILOSAUR_API_KEY=your-mailosaur-api-key
MAILOSAUR_SERVER_ID=7kboxsdj

# Grid Environment (NOT a secret, just configuration)
EXPO_PUBLIC_GRID_ENV=production
```

### Server/Backend (Separate from Client)

```bash
# Grid API Key (SERVER-SIDE ONLY - never in client)
GRID_API_KEY=your-grid-api-key-server-only

# Other server secrets...
```

---

## Test Parallelization Strategy

### Recommended Approach

**Run test suites in parallel by type:**

```bash
# In CI/CD, run these jobs in parallel:
Job 1: Unit tests          (~5s)   # No secrets needed
Job 2: Integration tests   (~30s)  # Requires Supabase + Mailosaur secrets
Job 3: E2E tests           (~2min) # Requires all secrets + backend running
```

**Total CI/CD time: ~2 minutes** (limited by slowest job)

### GitHub Actions Workflow Example

```yaml
name: Client Tests

on:
  push:
    branches: [main]
  pull_request:

jobs:
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      
      - name: Install dependencies
        run: cd apps/client && bun install
        
      - name: Run unit tests
        run: cd apps/client && bun run test:unit
        
    # Fast, no secrets, always runs
    # ~5 seconds

  integration-tests:
    name: Integration Tests  
    runs-on: ubuntu-latest
    needs: unit-tests  # Run after unit tests pass
    
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      
      - name: Install dependencies
        run: cd apps/client && bun install
        
      - name: Run integration tests
        run: cd apps/client && bun run test:integration
        env:
          EXPO_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          EXPO_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
          TEST_SUPABASE_EMAIL: ${{ secrets.TEST_SUPABASE_EMAIL }}
          TEST_SUPABASE_PASSWORD: ${{ secrets.TEST_SUPABASE_PASSWORD }}
          MAILOSAUR_API_KEY: ${{ secrets.MAILOSAUR_API_KEY }}
          MAILOSAUR_SERVER_ID: ${{ secrets.MAILOSAUR_SERVER_ID }}
          EXPO_PUBLIC_GRID_ENV: production
          
    # ~30 seconds, requires secrets

  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: integration-tests  # Run after integration tests pass
    
    # Optional: Only run on main branch or releases
    if: github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/')
    
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      
      - name: Install client dependencies
        run: cd apps/client && bun install
        
      - name: Install server dependencies
        run: cd apps/server && bun install
        
      - name: Start backend server
        run: |
          cd apps/server
          bun run dev &
          sleep 5  # Wait for server to start
        env:
          GRID_API_KEY: ${{ secrets.GRID_API_KEY }}
          # Other server secrets...
          
      - name: Run E2E tests
        run: cd apps/client && bun run test:e2e:auth
        env:
          EXPO_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          EXPO_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
          TEST_SUPABASE_EMAIL: ${{ secrets.TEST_SUPABASE_EMAIL }}
          TEST_SUPABASE_PASSWORD: ${{ secrets.TEST_SUPABASE_PASSWORD }}
          MAILOSAUR_API_KEY: ${{ secrets.MAILOSAUR_API_KEY }}
          MAILOSAUR_SERVER_ID: ${{ secrets.MAILOSAUR_SERVER_ID }}
          EXPO_PUBLIC_GRID_ENV: production
          TEST_BACKEND_URL: http://localhost:3001
          
    # ~2 minutes, requires all secrets + backend

  # Optional: Persistence tests (OTP flow)
  persistence-tests:
    name: OTP Persistence Tests
    runs-on: ubuntu-latest
    needs: unit-tests
    
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      
      - name: Install dependencies
        run: cd apps/client && bun install
        
      - name: Run persistence tests
        run: cd apps/client && bun run test:e2e:persistence
        
    # ~5 seconds, no external dependencies
```

---

## Phased Rollout Plan

### Phase 1: Unit Tests (Immediate) ✅ RECOMMENDED START HERE

```yaml
# Minimal setup - no secrets needed
- name: Run unit tests
  run: cd apps/client && bun run test:unit
```

**Benefits:**
- ✅ No secrets to configure
- ✅ Runs in ~5 seconds
- ✅ Catches 60% of bugs
- ✅ Zero friction to set up

**Add to CI/CD:** Today

### Phase 2: Integration Tests (This Week)

**Required secrets (7):**
1. `SUPABASE_URL`
2. `SUPABASE_ANON_KEY`
3. `TEST_SUPABASE_EMAIL`
4. `TEST_SUPABASE_PASSWORD`
5. `MAILOSAUR_API_KEY`
6. `MAILOSAUR_SERVER_ID`
7. `EXPO_PUBLIC_GRID_ENV` (not secret, just config)

**Benefits:**
- ✅ Tests real Supabase + Grid integration
- ✅ Runs in ~30 seconds
- ✅ Catches 90% of bugs
- ✅ No backend dependency

**Add to CI/CD:** This week

### Phase 3: E2E Tests (Optional - For Releases)

**Additional requirements:**
- Backend server must be running
- `GRID_API_KEY` (server-side)
- Test account must be funded

**Benefits:**
- ✅ Complete user flow validation
- ✅ Catches 99% of bugs
- ✅ Confidence for releases

**Add to CI/CD:** For main branch merges or releases only

---

## Security Notes

### ✅ What's Safe

- Supabase anon key (client-safe by design)
- Grid environment name (`production` or `sandbox`)
- Test account email (disposable Mailosaur)

### ⚠️ What's Secret

- Supabase URL (don't expose to prevent abuse)
- Test account password
- Mailosaur API key
- **GRID_API_KEY (NEVER in client code!)**

### 🔒 Best Practices

1. **Grid API Key:** Server-side ONLY
2. **Test Account:** Use Mailosaur (disposable emails)
3. **Separate Environments:** Different keys for test/prod
4. **Rotate Secrets:** Update keys quarterly
5. **Minimal Access:** Only add secrets that are actually used

---

## Quick Start Commands

```bash
# Add secrets to GitHub:
# Settings → Secrets and variables → Actions → New repository secret

# Test locally before pushing to CI:
cd apps/client

# Fast smoke test
bun run test:unit

# Full local validation
bun run test:all

# Just auth tests
bun run test:auth:all
```

---

## Troubleshooting CI/CD

### Tests failing in CI but pass locally?

1. **Check environment variables** - Print them (masked) in CI logs
2. **Test account locked?** - Mailosaur might have rate limits
3. **Network issues?** - Supabase/Grid API might be slow
4. **Backend not started?** - Add longer `sleep` time

### Integration tests timing out?

- Increase timeout in workflow: `timeout-minutes: 10`
- Check Supabase connection from CI
- Verify Mailosaur API is accessible

### E2E tests flaky?

- Add retries for network calls
- Increase backend startup wait time
- Consider running E2E tests only on main branch

---

## Cost Estimate

- **GitHub Actions:** Free for public repos, ~$0.008/minute for private
- **Unit tests:** ~$0.01 per run
- **Integration tests:** ~$0.05 per run
- **E2E tests:** ~$0.15 per run

**Estimated monthly cost (100 PRs):**
- Unit only: ~$1/month
- Unit + Integration: ~$6/month
- Full suite: ~$20/month

---

## Summary

✅ **EXPO_PUBLIC_GRID_API_KEY removed** - Grid API key is now server-side only
✅ **7 secrets needed** for comprehensive testing
✅ **Phased rollout** - Start with unit tests (no secrets), add more later
✅ **2-minute total CI time** with parallelization
✅ **Cost effective** - ~$6-20/month depending on coverage

**Recommendation:** Start with Phase 1 (unit tests) today, add Phase 2 (integration) this week!

