# GitHub Actions Test Account Setup

## ✅ Account Already Created

The stable test account for CI/CD has been set up:

**Email:** `github-actions@7kboxsdj.mailosaur.net`  
**User ID:** `ddc40b37-3682-4d96-bddd-363fbce3a96e`  
**Grid Address:** `4nnT9EyTm7JSmNM6ciCER3SU5QAmUKsqngtmA1rn4Hga`

**Status:**
- ✅ Supabase account exists
- ✅ Grid wallet exists
- ✅ Ready for CI/CD

## GitHub Secrets to Add

Add these secrets to your GitHub repository:

```
Settings → Secrets and variables → Actions → New repository secret
```

### Required Secrets:

```
TEST_SUPABASE_EMAIL=github-actions@7kboxsdj.mailosaur.net
TEST_SUPABASE_PASSWORD=[use the secure password provided separately]
```

**Note:** Password should be stored as a GitHub Secret, never committed to the repository.

## Test Account Strategy

### Stable Account (github-actions@)
- Used for existing user tests
- Used in CI/CD
- Reusable across test runs

### Random Emails (mallory-test-*)
- Generated via `generateTestEmail()`
- Used for new signup tests
- Fresh account for each test

## If Account Needs Reset

Contact the team to regenerate the test account. The setup script has been removed for security.

