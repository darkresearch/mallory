# Auth Testing Documentation

Comprehensive testing for the refactored authentication state management.

## Test Structure

### Unit Tests (`__tests__/unit/`)
Tests contexts in isolation with mocked dependencies:
- `AuthContext.test.tsx` - Login, logout, token refresh, re-auth, guards
- `GridContext.test.tsx` - Grid sign-in, OTP flow, account management, guards

**Run unit tests:**
```bash
bun run test:unit              # All unit tests
bun run test:unit:auth         # AuthContext only
bun run test:unit:grid         # GridContext only
```

### Integration Tests (`__tests__/integration/`)
Tests with REAL services (Supabase + Grid):
- `auth-grid-integration.test.ts` - Both contexts working together
- `session-persistence.test.ts` - Session restoration scenarios

**Run integration tests:**
```bash
bun run test:integration           # All integration tests
bun run test:integration:auth      # Auth integration only
bun run test:integration:session   # Session persistence only
```

### E2E Tests (`__tests__/e2e/`)
Complete user flows:
- `auth-flows.test.ts` - Full authentication journeys
- `signup-flow.test.ts` - New user signup
- `signup-error-scenarios.test.ts` - Error handling

**Run E2E tests:**
```bash
bun run test:e2e              # All E2E tests
bun run test:e2e:auth         # Auth flows only
bun run test:signup           # Signup flow
bun run test:signup:errors    # Signup errors
```

## Quick Commands

```bash
# Run all auth tests
bun run test:auth:all

# Run everything
bun run test:all

# Run with specific filter
bun test --filter "login"
```

## Test Coverage

### AuthContext ✅
- Initial state and loading
- Login flow (OAuth web + native mobile)
- Logout flow (cleanup, guards)
- Token refresh handling
- Session validation
- User refresh
- Re-authentication
- Auto-redirect logic
- Recursive logout prevention

### GridContext ✅
- Initial state
- Grid account loading
- Initiate sign-in (with guard)
- Complete sign-in (OTP verification)
- Refresh account
- Clear account
- SessionStorage handling
- User change handling

### Integration ✅
- Session restoration
- Auth state persistence
- Grid + Database sync
- Error handling
- Conversation management
- Real-world scenarios
- Concurrent operations

### E2E ✅
- Existing user login
- New user signup (via backend)
- Session recovery (crash, refresh)
- Database operations
- Error scenarios
- Network interruptions

## Prerequisites

### For Integration & E2E Tests
1. Test account must be set up:
   ```bash
   bun run test:setup
   ```

2. Environment variables in `.env.test`:
   ```
   EXPO_PUBLIC_SUPABASE_URL=...
   EXPO_PUBLIC_SUPABASE_ANON_KEY=...
   TEST_SUPABASE_EMAIL=...
   TEST_SUPABASE_PASSWORD=...
   MAILOSAUR_API_KEY=...
   MAILOSAUR_SERVER_ID=...
   EXPO_PUBLIC_GRID_ENV=production
   # Note: GRID_API_KEY is server-side only, not needed in client
   TEST_BACKEND_URL=http://localhost:3001
   ```

3. Backend server running (for E2E):
   ```bash
   cd apps/server
   bun run dev
   ```

## Testing Philosophy

1. **Unit tests** use mocks for fast, isolated testing
2. **Integration tests** use REAL services to catch real issues
3. **E2E tests** simulate complete user journeys
4. **No mocking** in integration/E2E tests - test what users experience

## Debugging Tests

```bash
# Run with debug output
DEBUG_TESTS=1 bun test __tests__/unit/AuthContext.test.tsx

# Run single test
bun test --filter "should prevent recursive logout"

# Run with timeout
bun test --timeout 60000 __tests__/e2e/auth-flows.test.ts
```

## Common Issues

### Unit Tests Failing
- Check that mocks are properly configured
- Verify setup files are imported
- Ensure React Testing Library cleanup is working

### Integration Tests Failing
- Verify `.env.test` has correct credentials
- Check that test account exists (`bun run test:setup`)
- Confirm Supabase/Grid services are accessible

### E2E Tests Failing
- Ensure backend server is running
- Verify Mailosaur is working (`bun run test:validate:mailosaur`)
- Check test account has sufficient balance
- Increase timeout for slow operations

## CI/CD Integration

Add to your CI pipeline:
```yaml
- name: Run Auth Tests
  run: |
    cd apps/client
    bun install
    bun run test:auth:all
```

## Next Steps

1. Add tests to CI/CD pipeline
2. Monitor test coverage
3. Add tests for new features
4. Keep tests fast and focused

