# Test Account Strategy

## Account Types

### 1. **Stable Account** (for existing user tests)
- **Email:** `github-actions@7kboxsdj.mailosaur.net`
- **Password:** `34aa15f6-c29f-43fd-949a-41c3c60ee649`
- **User ID:** `ddc40b37-3682-4d96-bddd-363fbce3a96e`
- **Grid Address:** `4nnT9EyTm7JSmNM6ciCER3SU5QAmUKsqngtmA1rn4Hga`

**Used for:**
- ✅ Existing user login tests
- ✅ Integration tests (auth + Grid)
- ✅ Session persistence tests
- ✅ CI/CD unit tests

**Setup status:** ✅ Account created in both Supabase and Grid

### 2. **Random Fresh Emails** (for new signup tests)
- **Pattern:** `mallory-test-{random}{timestamp}@7kboxsdj.mailosaur.net`
- **Generator:** `generateTestEmail()` in `mailosaur-helpers.ts`
- **Password:** Random 16-char string via `generateTestPassword()`

**Used for:**
- ✅ New user signup E2E tests
- ✅ Testing first-time user experience
- ✅ Ensuring signup flow creates both Supabase + Grid accounts

**Why random?** Each test run creates a truly new user to test the complete signup flow.

---

## Configuration Files

### `.env.test` (Local Development)
```env
TEST_SUPABASE_EMAIL=github-actions@7kboxsdj.mailosaur.net
TEST_SUPABASE_PASSWORD=34aa15f6-c29f-43fd-949a-41c3c60ee649
```

### GitHub Actions Secrets
```
TEST_SUPABASE_EMAIL=github-actions@7kboxsdj.mailosaur.net
TEST_SUPABASE_PASSWORD=34aa15f6-c29f-43fd-949a-41c3c60ee649
```

---

## Test Flow Examples

### Existing User Test (uses stable account):
```typescript
// __tests__/integration/auth-grid-integration.test.ts
beforeAll(async () => {
  // Uses TEST_SUPABASE_EMAIL from env
  testSession = await setupTestUserSession();
});

test('should restore Supabase session', async () => {
  // Tests with github-actions@ account
  expect(session.user.email).toBe('github-actions@7kboxsdj.mailosaur.net');
});
```

### New Signup Test (uses random email):
```typescript
// __tests__/e2e/auth-flows.test.ts
test('should complete full signup flow', async () => {
  // Generates random email like:
  // mallory-test-abc123xyz789@7kboxsdj.mailosaur.net
  const testEmail = generateTestEmail();
  const testPassword = generateTestPassword();
  
  // Creates brand new Supabase + Grid accounts
  const result = await signupNewUser(testEmail, testPassword);
  const gridSession = await completeGridSignupProduction(testEmail, token);
  
  // Verifies new user flow works end-to-end
});
```

---

## Why This Strategy Works

### ✅ **Stable Account Benefits:**
1. Fast tests (no signup delay)
2. Consistent test data
3. Tests existing user flows
4. Reusable across test runs

### ✅ **Random Email Benefits:**
1. Tests actual signup flow
2. No conflicts between test runs
3. Validates new user experience
4. Each test is isolated

### ✅ **Combined Benefits:**
- Comprehensive coverage
- Fast unit/integration tests
- Thorough E2E signup validation
- Predictable CI/CD behavior

---

## Maintenance

### If Stable Account Breaks:
```bash
# Re-run setup script
cd apps/client
bun __tests__/scripts/setup-github-actions-account.ts
```

### If Mailosaur Quota Issues:
- Random emails accumulate in Mailosaur
- They expire automatically after 7 days
- Or manually clean up via Mailosaur dashboard

---

## Summary

✅ **Stable account:** `github-actions@7kboxsdj.mailosaur.net` (already set up!)
✅ **Random emails:** Auto-generated for new signup tests
✅ **Both strategies:** Work together for comprehensive testing
✅ **CI/CD ready:** Secrets configured, account exists

