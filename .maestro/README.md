# Maestro E2E Testing for Mallory

## Overview

This directory contains end-to-end tests for Mallory's authentication flows using [Maestro](https://maestro.mobile.dev/).

## Test Coverage

### Authentication Flows (`flows/auth/`)

1. **`new-user-signup.yaml`** - First-time user registration
   - Tests Google OAuth integration
   - Tests Grid OTP verification for new users
   - Verifies successful onboarding

2. **`returning-user.yaml`** - Existing user login
   - Tests advanced Grid auth flow
   - Verifies direct access to chat (no onboarding)

3. **`incomplete-auth-recovery.yaml`** - Edge case handling
   - Tests user abandoning OTP during sign-in
   - Verifies graceful logout and recovery
   - Prevents infinite loading screens

4. **`logout.yaml`** - Logout functionality
   - Tests clean logout process
   - Verifies no recursive logout calls
   - Confirms redirect to login screen

### Helper Flows (`helpers/`)

- **`login.yaml`** - Reusable login flow for test setup

## Prerequisites

### 1. Install Maestro

```bash
# macOS/Linux
curl -Ls "https://get.maestro.mobile.dev" | bash

# Windows
# Download from https://maestro.mobile.dev/getting-started/installing-maestro
```

### 2. Set Up Test Environment

Create a test Gmail account (e.g., `mallory.e2e.test@gmail.com`) for automated testing.

### 3. Configure Test Credentials

Copy the example environment file:

```bash
cp .maestro/.env.example .maestro/.env.local
```

Edit `.maestro/.env.local` and fill in:

```bash
TEST_EMAIL=your-test-email@gmail.com
TEST_GRID_OTP=123456  # Fixed OTP for testing (requires backend support)
```

### 4. Backend Test Mode (IMPORTANT!)

For real OTP testing without mocking, you need to configure your backend:

**Option A: Read OTP from Test Email** (recommended for full integration)
- Use a service like [Mailosaur](https://mailosaur.com/) or [MailSlurp](https://www.mailslurp.com/)
- These provide API access to test emails
- Maestro can fetch the OTP programmatically

**Option B: Fixed OTP in Test Mode**
- Add a test-mode flag to your backend
- When `TEST_MODE=true`, return a fixed OTP like `123456`
- Only enable in test environments!

Example backend code:

```typescript
// apps/server/src/routes/grid.ts
if (process.env.TEST_MODE === 'true' && email === process.env.TEST_EMAIL) {
  // Return fixed OTP for test user
  return { success: true, otp: '123456' };
}
```

## Running Tests

### Local Testing

```bash
# Run all auth tests
maestro test .maestro/flows/auth

# Run specific test
maestro test .maestro/flows/auth/new-user-signup.yaml

# Run with environment variables
export TEST_EMAIL=test@example.com
export TEST_GRID_OTP=123456
maestro test .maestro/flows/auth

# Watch mode (re-runs on file changes)
maestro test --continuous .maestro/flows
```

### iOS Testing

```bash
# Start iOS simulator
open -a Simulator

# Build and install app
cd apps/client
npx expo run:ios

# Run tests
maestro test .maestro/flows/auth
```

### Android Testing

```bash
# Start Android emulator
emulator -avd Pixel_5_API_33

# Build and install app
cd apps/client
npx expo run:android

# Run tests
maestro test .maestro/flows/auth
```

### Web Testing

```bash
# Start web app
cd apps/client
npm run web

# Maestro doesn't support web directly, but you can use Playwright/Cypress
# Consider adding web tests separately
```

## CI/CD Integration

Tests run automatically on every PR via GitHub Actions (`.github/workflows/maestro-e2e.yml`).

### Required GitHub Secrets

Add these secrets to your GitHub repository (Settings → Secrets → Actions):

```
TEST_EMAIL=your-test-email@gmail.com
TEST_GRID_OTP=123456
TEST_BACKEND_URL=https://your-staging-backend.com
MAESTRO_CLOUD_API_KEY=xxx  # Optional, for Maestro Cloud
```

### Manual Trigger

You can manually trigger tests from the Actions tab → "E2E Tests (Maestro)" → Run workflow.

## Debugging Failed Tests

### View Test Recordings

Maestro automatically records test runs:

```bash
# Tests save recordings to ~/.maestro/tests/
ls -la ~/.maestro/tests/

# View latest recording
maestro studio ~/.maestro/tests/<test-id>
```

### Interactive Mode

Run Maestro Studio to interact with the app:

```bash
maestro studio
```

This opens a web interface where you can:
- Interact with the app manually
- Record new test flows
- Debug element selectors

### Common Issues

**Issue**: "Element not found"
- **Fix**: Use `maestro studio` to inspect the actual element IDs/text
- Update selectors in test files

**Issue**: "Timeout waiting for animation"
- **Fix**: Increase timeout values in test
- Check if app is actually responding

**Issue**: "OAuth redirect not working"
- **Fix**: Ensure redirect URLs are configured correctly
- Use deep links to simulate OAuth callbacks in tests

## Best Practices

1. **Keep tests independent** - Each test should work standalone
2. **Use realistic data** - Test with real email/OTP for accurate results
3. **Clean state** - Always start from logged-out state
4. **Meaningful assertions** - Verify expected outcomes, not just absence of errors
5. **Fast feedback** - Group critical tests in smoke suite for quick runs

## Cost Breakdown

### Free Tier (What you get for $0)
- ✅ Maestro CLI (unlimited local tests)
- ✅ GitHub Actions integration
- ✅ Unlimited test runs on your own infra

### Paid Options (Optional)
- **Maestro Cloud** (~$40/month):
  - Parallel test execution
  - Cross-device testing (iOS + Android simultaneously)
  - Test recordings and screenshots
  - Faster CI/CD runs

**Recommendation**: Start with free tier, upgrade to Cloud if CI/CD runs are slow.

## Next Steps

1. ✅ Install Maestro: `curl -Ls "https://get.maestro.mobile.dev" | bash`
2. ⏳ Set up test Gmail account
3. ⏳ Configure backend test mode (fixed OTP)
4. ⏳ Run your first test: `maestro test .maestro/flows/auth/new-user-signup.yaml`
5. ⏳ Add GitHub secrets for CI/CD
6. ⏳ Enable GitHub Actions workflow

## Resources

- [Maestro Documentation](https://maestro.mobile.dev/)
- [Maestro GitHub](https://github.com/mobile-dev-inc/maestro)
- [Maestro Discord Community](https://discord.gg/mobile-dev)
- [Example Test Suites](https://github.com/mobile-dev-inc/maestro/tree/main/maestro-test)

