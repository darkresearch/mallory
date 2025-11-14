# OTP Screen Architecture Tests

This directory contains comprehensive tests for the new self-contained OTP screen architecture.

## Architecture Overview

The OTP screen follows a **self-contained component pattern**:

- **OTP session** is temporary workflow state that belongs to the OTP screen
- **GridContext** manages persistent app state (account, address) but NOT temporary OTP session
- **Storage** is the single source of truth for persistence (not context state)

### Why This Design?

| State Type | Where It Lives | Why |
|------------|----------------|-----|
| `gridAccount` | GridContext state | Persistent, used across app, multiple consumers |
| `gridOtpSession` | OTP screen local state | Temporary, single component, workflow-specific |

## Test Files

### Unit Tests: `__tests__/unit/VerifyOtpScreen.test.tsx`

Tests the OTP screen in isolation:

- ✅ Loading OTP session from secure storage on mount
- ✅ Local state management (not context-dependent)
- ✅ Resend code functionality (updates local state + storage)
- ✅ OTP verification with local session
- ✅ Error handling (expired codes, network errors, routing errors)
- ✅ Integration with GridContext actions (not state)
- ✅ Persistence across page refresh
- ✅ Cleanup on successful verification

**Run with:**
```bash
bun run test:unit:otp
```

### Integration Tests: `__tests__/integration/otp-screen-grid-integration.test.ts`

Tests the integration between GridContext and OTP screen:

- ✅ Full flow: `initiateGridSignIn()` → OTP screen → `completeGridSignIn()`
- ✅ GridContext writes to storage, OTP screen reads from storage
- ✅ OTP screen updates storage on resend
- ✅ GridContext clears storage after successful verification
- ✅ GridContext does NOT expose OTP session in state
- ✅ OTP screen independence (no context state dependency)
- ✅ Error recovery (verification failures, page refresh)
- ✅ Storage as single source of truth

**Run with:**
```bash
bun run test:integration:otp
```

## Test Coverage

### What We Test

#### 1. **Component Independence**
- OTP screen manages its own state
- No dependency on GridContext state updates
- No unnecessary re-renders from context changes

#### 2. **Storage Management**
- Loading from storage on mount
- Writing to storage on updates
- Storage as persistence layer (survives refresh)
- Cleanup on completion

#### 3. **Resend Flow**
- Updates local state immediately
- Writes to storage for persistence
- Both storage and state stay in sync
- Old session not used after resend

#### 4. **Error Handling**
- No OTP session (routing error)
- Corrupted storage data
- Expired OTP codes
- Network failures
- Verification failures

#### 5. **Integration Points**
- `initiateGridSignIn()` writes to storage
- OTP screen reads from storage
- `completeGridSignIn()` receives OTP session as parameter
- GridContext clears storage after success

#### 6. **Edge Cases**
- Page refresh during OTP flow
- App kill/restart on mobile
- Storage cleared mid-session
- Multiple resend attempts
- Logout during OTP flow

## Running Tests

### Run All OTP Tests
```bash
# Unit + Integration + E2E
bun run test:auth:all
```

### Run Unit Tests Only
```bash
bun run test:unit:otp
```

### Run Integration Tests Only
```bash
bun run test:integration:otp
```

### Run All Tests (Entire Suite)
```bash
bun run test:all
```

## CI/CD Integration

These tests are automatically run in GitHub Actions CI:

**Pipeline:** `.github/workflows/test.yml`

1. **Unit Tests Job** - Runs `test:unit` (includes OTP tests)
2. **Integration Tests Job** - Runs `test:integration` (includes OTP integration tests)
3. **E2E Tests Job** - Runs full authentication flows

**When tests run:**
- ✅ On push to `main` branch
- ✅ On PR when marked "ready for review"
- ✅ On manual workflow dispatch
- ❌ Skipped for draft PRs

**Test requirements for merge:**
- All unit tests must pass
- All integration tests must pass
- All E2E tests must pass
- Type checking must pass
- Build verification must pass

## Test Patterns

### Pattern 1: Self-Contained Component State
```typescript
// ✅ GOOD: Component owns its workflow state
const [otpSession, setOtpSession] = useState(null);

useEffect(() => {
  const loadSession = async () => {
    const stored = await secureStorage.getItem('GRID_OTP_SESSION');
    setOtpSession(JSON.parse(stored));
  };
  loadSession();
}, []); // Load once on mount

// ❌ BAD: Reading from context state (tight coupling)
const { gridOtpSession } = useGrid();
useEffect(() => {
  setOtpSession(gridOtpSession);
}, [gridOtpSession]); // Re-renders when context updates
```

### Pattern 2: Storage as Single Source of Truth
```typescript
// ✅ GOOD: Update both local state and storage
const handleResend = async () => {
  const { otpSession: newSession } = await startSignIn(email);
  
  // Update local state (immediate)
  setOtpSession(newSession);
  
  // Update storage (persistence)
  await secureStorage.setItem('GRID_OTP_SESSION', JSON.stringify(newSession));
};

// ❌ BAD: Only update local state (lost on refresh)
const handleResend = async () => {
  const { otpSession: newSession } = await startSignIn(email);
  setOtpSession(newSession); // Storage now stale!
};
```

### Pattern 3: Actions from Context, Data from Storage
```typescript
// ✅ GOOD: Use context for actions, storage for data
const { completeGridSignIn } = useGrid(); // Action only
const [otpSession, setOtpSession] = useState(null); // Local data

await completeGridSignIn(otpSession, otp); // Pass data as param

// ❌ BAD: Reading data from context
const { completeGridSignIn, gridOtpSession } = useGrid();
await completeGridSignIn(gridOtpSession, otp); // Tight coupling
```

## Debugging Tests

### Run with verbose output:
```bash
bun test __tests__/unit/VerifyOtpScreen.test.tsx --verbose
```

### Run specific test:
```bash
bun test __tests__/unit/VerifyOtpScreen.test.tsx --test "should load OTP session from secure storage"
```

### Debug test failures:
```bash
# Add console.log statements in tests
# Check test output for "✅" success markers
# Verify mock implementations match real behavior
```

## Best Practices

1. **Test Isolation**: Each test should be independent
2. **Mock Storage**: Use mock secure storage to avoid side effects
3. **Clear Setup**: Use `beforeEach` to reset mocks
4. **Descriptive Names**: Test names should explain what they verify
5. **Console Markers**: Use "✅" for success, "❌" for expected failures
6. **Real-World Scenarios**: Test actual user flows, not just happy paths

## Adding New Tests

When adding new OTP-related functionality:

1. Add unit test in `VerifyOtpScreen.test.tsx`
2. Add integration test in `otp-screen-grid-integration.test.ts`
3. Update this README with new test coverage
4. Ensure tests run in CI (should be automatic)
5. Add specific test command to `package.json` if needed

## Questions?

See the test files for detailed examples and patterns.
The tests are self-documenting with extensive comments.
