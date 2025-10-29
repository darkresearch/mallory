# GitHub Secrets Setup Guide

This document lists all secrets needed for CI/CD testing with backend integration.

## Required Secrets

Add these secrets to your GitHub repository:
**Settings → Secrets and variables → Actions → New repository secret**

### 1. Supabase Secrets

```
SUPABASE_URL
Value: https://your-project-id.supabase.co
Note: Your Supabase project URL

SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Note: Supabase anonymous/public key (safe for client use)

SUPABASE_SERVICE_ROLE_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Note: Backend-only key with full database access (NEVER expose to client)
```

### 2. Test Account Credentials

```
TEST_SUPABASE_EMAIL
Value: mallory-testing@7kboxsdj.mailosaur.net
Note: Test account email (uses Mailosaur for OTP retrieval)

TEST_SUPABASE_PASSWORD
Value: YourSecureTestPassword123!
Note: Test account password (store securely)
```

### 3. Mailosaur (OTP Retrieval)

```
MAILOSAUR_API_KEY
Value: your-mailosaur-api-key
Note: API key from mailosaur.com dashboard

MAILOSAUR_SERVER_ID
Value: 7kboxsdj
Note: Your Mailosaur server ID (from inbox settings)
```

### 4. Grid API

```
GRID_API_KEY
Value: your-grid-production-api-key
Note: SERVER-SIDE ONLY - Used by backend, NEVER exposed to client
```

## Optional Secrets (for production deployment)

These are not needed for testing but may be needed for deployment:

```
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

## Environment Variables (Not Secret)

These can be in the workflow file directly:

```yaml
EXPO_PUBLIC_GRID_ENV: production
NODE_ENV: test
PORT: 3001
TEST_BACKEND_URL: http://localhost:3001
```

## Verification Checklist

Before running CI/CD, verify:

- [ ] All 7 required secrets are added to GitHub
- [ ] Test account exists in Supabase with valid password
- [ ] Test account has Grid wallet set up (run `bun run test:setup` locally first)
- [ ] Mailosaur server is active and receiving emails
- [ ] Grid API key is valid and has production access
- [ ] Supabase RLS policies allow test account to operate

## Local Testing

Test the CI/CD setup locally before pushing:

```bash
# 1. Create .env.test file
cp .env.example .env.test

# 2. Add all secrets to .env.test
# (Same values as GitHub secrets)

# 3. Run tests locally
cd apps/client

# Unit tests (no backend)
bun run test:unit

# Integration tests (no backend)
bun run test:integration

# E2E tests (requires backend)
cd ../server && bun run dev &  # Start backend
cd ../client && bun run test:e2e:auth

# Stop backend when done
pkill -f "bun run dev"
```

## Security Notes

### ✅ Safe to Store

- `SUPABASE_URL` - Can be public, but we keep it secret to prevent abuse
- `SUPABASE_ANON_KEY` - Designed to be client-safe (RLS enforces security)
- `TEST_SUPABASE_EMAIL` - Disposable Mailosaur email
- `MAILOSAUR_SERVER_ID` - Not sensitive, but we keep it private

### 🔒 Must Stay Secret

- `SUPABASE_SERVICE_ROLE_KEY` - **CRITICAL** - Full database access
- `TEST_SUPABASE_PASSWORD` - Protects test account
- `MAILOSAUR_API_KEY` - Access to email inbox
- `GRID_API_KEY` - **CRITICAL** - Backend-only, controls wallet operations

### ⚠️ Never Expose to Client

- `GRID_API_KEY` - Must ONLY be in server environment
- `SUPABASE_SERVICE_ROLE_KEY` - Must ONLY be in server environment

## Troubleshooting

### "Secret not found" error

1. Check secret name matches exactly (case-sensitive)
2. Verify secret was added to the correct repository
3. Check if secret is available in the environment (organization vs repo)

### Backend fails to start in CI

1. Check `GRID_API_KEY` is set correctly
2. Verify all backend secrets are present
3. Look at server logs artifact for error details
4. Increase server startup timeout if needed

### Integration tests fail

1. Verify test account exists in Supabase
2. Check Mailosaur is accessible from GitHub Actions
3. Test account may need Grid wallet re-setup
4. Check Supabase RLS policies allow test operations

### E2E tests timeout

1. Backend may not be starting properly
2. Increase timeout in workflow file
3. Check backend logs for errors
4. Verify all backend environment variables are set

## Cost Considerations

### GitHub Actions Minutes

- Private repos: $0.008 per minute
- Public repos: Free

### Per Test Run Estimates

- Unit tests: ~5 seconds (~$0.001)
- Integration tests: ~30 seconds (~$0.004)
- E2E tests: ~2 minutes (~$0.016)
- **Total per run: ~$0.02**

### Monthly Estimates (100 PRs + commits)

- Frequent commits (unit only): ~$0.10/month
- PR validation (unit + integration): ~$0.50/month
- Full suite (all tests): ~$2/month
- **Very affordable!**

## Monitoring

After setup, monitor:

1. **Success rate** - Are tests passing consistently?
2. **Timing** - Watch for increases in test duration
3. **Resource usage** - Check GitHub Actions minutes consumed
4. **Test account** - Ensure it's not locked or rate-limited

## Next Steps

1. ✅ Add all secrets to GitHub
2. ✅ Test workflow locally first
3. ✅ Push workflow file to trigger CI
4. ✅ Monitor first few runs
5. ✅ Adjust timeouts if needed
6. ✅ Add status badges to README

