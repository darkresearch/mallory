# AuthContext Refactor Plan

**Goal:** Split the 841-line `AuthContext` into 3 focused, maintainable contexts

---

## Current State Analysis

### What AuthContext Does Today (841 lines)

**Core Authentication (Supabase)**
- Google OAuth sign-in (web + mobile)
- Session management
- Token storage (secure)
- User data fetching from database
- Auto-redirect logic

**Grid Wallet Integration**
- Grid sign-in initiation
- OTP flow coordination
- Grid session management
- Grid account status tracking

**Session Validation**
- Token refresh handling
- Re-auth checking
- Coupled session validation (Supabase + Grid)
- Grid account data sync

**Complex Logout**
- 9-step comprehensive cleanup
- Native Google sign-out
- Grid credential clearing
- Token removal
- Storage clearing
- Navigation reset

**State Flags (8 total)**
1. `user` - Current user object
2. `isLoading` - Initial auth check
3. `needsReauth` - Re-auth required flag
4. `isCheckingReauth` - Re-auth check in progress
5. `isSigningIn` - OAuth flow in progress
6. Guard refs: `hasCheckedReauth`, `isInitiatingGridSignIn`, `isLoggingOut`

---

## Proposed Architecture: 3 Focused Contexts

### 1. AuthContext (Core Authentication Only)

**Responsibility:** Manage Supabase authentication and user identity

**State:**
```typescript
interface AuthContextType {
  // Core user state
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  // Core auth actions
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}
```

**What it handles:**
- ✓ Google OAuth (web + mobile)
- ✓ Supabase session management
- ✓ User data from `users` table
- ✓ Token storage (access + refresh)
- ✓ Basic logout (Supabase + tokens)

**What it DOESN'T handle:**
- ✗ Grid wallet logic
- ✗ OTP verification
- ✗ Re-auth checking
- ✗ Complex cleanup
- ✗ Navigation logic

**Size:** ~250 lines (70% reduction)

---

### 2. GridContext (Grid Wallet Management)

**Responsibility:** Manage Grid wallet integration and OTP flows

**State:**
```typescript
interface GridContextType {
  // Grid wallet state
  gridAccount: GridAccount | null;
  gridAccountStatus: 'not_created' | 'pending_verification' | 'active';
  solanaAddress: string | null;
  
  // OTP flow state
  isSigningInToGrid: boolean;
  otpRequired: boolean;
  gridUser: GridUser | null; // Temporary during OTP flow
  
  // Grid actions
  initiateGridSignIn: (email: string) => Promise<void>;
  completeGridSignIn: (gridUser: GridUser, otp: string) => Promise<void>;
  refreshGridAccount: (userId?: string) => Promise<void>;
  clearGridAccount: () => Promise<void>;
}
```

**What it handles:**
- ✓ Grid sign-in flow
- ✓ OTP orchestration
- ✓ Grid account creation
- ✓ Grid session secrets management
- ✓ Grid account data sync
- ✓ Navigation to OTP screen

**Dependencies:**
- Requires `AuthContext` for user email
- Standalone otherwise

**Size:** ~300 lines

---

### 3. SessionContext (Session Validation & Re-auth)

**Responsibility:** Monitor session health and coordinate re-authentication

**State:**
```typescript
interface SessionContextType {
  // Session health
  needsReauth: boolean;
  isCheckingReauth: boolean;
  lastSessionCheck: Date | null;
  
  // Session actions
  checkSessionHealth: () => Promise<void>;
  markReauthComplete: () => void;
  triggerReauth: () => Promise<void>; // For testing
}
```

**What it handles:**
- ✓ Coupled session validation (Supabase + Grid)
- ✓ Token refresh monitoring
- ✓ Re-auth status checking
- ✓ Session health checks

**Dependencies:**
- Requires `AuthContext` for user/token
- Requires `GridContext` for Grid session check

**Size:** ~150 lines

---

## Implementation Plan

### Step 1: Create GridContext (1 hour)

**Extract Grid-specific logic from AuthContext:**

```
AuthContext.tsx
├── checkAndInitiateGridSignIn()      → GridContext.initiateGridSignIn()
├── Grid sign-in logic                → GridContext
├── Grid session management           → GridContext
├── refreshGridAccount()              → GridContext.refreshGridAccount()
└── Grid account state                → GridContext state
```

**New file:** `apps/client/contexts/GridContext.tsx`

**Tasks:**
- [ ] Create `GridContext.tsx` with GridProvider
- [ ] Move Grid sign-in logic from AuthContext
- [ ] Move `refreshGridAccount` function
- [ ] Move Grid-related state and refs
- [ ] Update `_layout.tsx` to wrap with GridProvider
- [ ] Update components that use Grid logic

**Files to update:**
- `apps/client/contexts/AuthContext.tsx` (remove Grid logic)
- `apps/client/app/_layout.tsx` (add GridProvider)
- `apps/client/app/(auth)/verify-otp.tsx` (use GridContext)
- `apps/client/components/wallet/` (use GridContext for address)

---

### Step 2: Create SessionContext (45 min)

**Extract session validation logic from AuthContext:**

```
AuthContext.tsx
├── needsReauth state                 → SessionContext
├── isCheckingReauth state            → SessionContext
├── hasCheckedReauth ref              → SessionContext
├── checkReauthStatus()               → SessionContext.checkSessionHealth()
├── checkReauthStatusForUser()        → SessionContext (internal)
├── completeReauth()                  → SessionContext.markReauthComplete()
├── triggerReauth()                   → SessionContext.triggerReauth()
└── Token refresh validation          → SessionContext
```

**New file:** `apps/client/contexts/SessionContext.tsx`

**Tasks:**
- [ ] Create `SessionContext.tsx` with SessionProvider
- [ ] Move re-auth checking logic
- [ ] Move session health validation
- [ ] Move token refresh monitoring
- [ ] Update `_layout.tsx` to wrap with SessionProvider
- [ ] Update AuthGate to use SessionContext

**Files to update:**
- `apps/client/contexts/AuthContext.tsx` (remove session logic)
- `apps/client/app/_layout.tsx` (add SessionProvider)
- `apps/client/components/auth/AuthGate.tsx` (use SessionContext)

---

### Step 3: Simplify AuthContext (30 min)

**Keep only core auth logic:**

```
AuthContext.tsx (simplified)
├── user state
├── isLoading state
├── login() - Google OAuth
├── logout() - Simple cleanup
├── refreshUser() - Reload user data
└── Token storage helpers
```

**Tasks:**
- [ ] Remove Grid logic (moved to GridContext)
- [ ] Remove re-auth logic (moved to SessionContext)
- [ ] Simplify logout (just auth cleanup)
- [ ] Remove Grid-related state
- [ ] Remove session validation
- [ ] Update auto-redirect logic (simpler)

**Result:** AuthContext goes from 841 → ~250 lines

---

### Step 4: Update Provider Nesting (15 min)

**Current:**
```tsx
<AuthProvider>
  <AuthGate>
    <ConversationsProvider>
      <WalletProvider>
        {children}
```

**New:**
```tsx
<AuthProvider>                    // Core auth (250 lines)
  <GridProvider>                  // Grid wallet (300 lines)
    <SessionProvider>             // Session health (150 lines)
      <AuthGate>                  // Uses SessionContext for needsReauth
        <ConversationsProvider>
          <WalletProvider>
            {children}
```

**Tasks:**
- [ ] Update `apps/client/app/_layout.tsx`
- [ ] Ensure correct nesting order
- [ ] Test provider initialization
- [ ] Verify no circular dependencies

---

### Step 5: Fix Component Usage (30 min)

**Components that need updates:**

1. **`AuthGate.tsx`**
   - Use `SessionContext` for `needsReauth`
   - Use `SessionContext` for `completeReauth`

2. **`verify-otp.tsx`**
   - Use `GridContext` for Grid sign-in
   - Use `AuthContext` for logout

3. **`wallet/` screens**
   - Use `GridContext` for `solanaAddress`
   - Use `GridContext` for `refreshGridAccount`

4. **`chat.tsx`**
   - Already uses `useAuth()` correctly
   - No changes needed

**Tasks:**
- [ ] Update AuthGate to use SessionContext
- [ ] Update OTP screen to use GridContext
- [ ] Update wallet components to use GridContext
- [ ] Verify all context consumers

---

### Step 6: Clean Up sessionStorage Pattern (30 min)

**Current problems:**
- Multiple places write to sessionStorage
- React state and sessionStorage diverge
- Hard to debug which is source of truth

**Solution: Create a reactive sessionStorage hook**

```typescript
// lib/storage/useSessionStorage.ts
export function useSessionStorage<T>(
  key: string, 
  defaultValue: T
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const item = sessionStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setStoredValue = useCallback((newValue: T) => {
    try {
      setValue(newValue);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(key, JSON.stringify(newValue));
      }
    } catch (error) {
      console.error('Error setting sessionStorage:', error);
    }
  }, [key]);

  return [value, setStoredValue];
}
```

**Usage in GridContext:**
```typescript
const [isOAuthInProgress, setIsOAuthInProgress] = useSessionStorage(
  'mallory_oauth_in_progress',
  false
);

const [gridUser, setGridUser] = useSessionStorage<GridUser | null>(
  'mallory_grid_user',
  null
);
```

**Tasks:**
- [ ] Create `useSessionStorage` hook
- [ ] Replace manual sessionStorage calls in GridContext
- [ ] Replace manual sessionStorage calls in verify-otp screen
- [ ] Test OAuth flow
- [ ] Test page refresh during OTP

---

## Testing Plan

### Critical Paths to Test

1. **Fresh Sign-In Flow**
   - [ ] Click "Continue with Google"
   - [ ] Complete Google OAuth
   - [ ] Redirected to OTP screen
   - [ ] Enter OTP code
   - [ ] See chat screen with wallet address

2. **Returning User**
   - [ ] Refresh page
   - [ ] User session restored
   - [ ] Grid session still valid
   - [ ] No OTP required

3. **Session Expiry**
   - [ ] User session expires (simulate)
   - [ ] `needsReauth` becomes true
   - [ ] OTP modal appears
   - [ ] Complete OTP
   - [ ] Modal closes, access restored

4. **Logout**
   - [ ] Click logout
   - [ ] All state cleared
   - [ ] Redirected to login
   - [ ] No residual data

5. **Grid Account Creation**
   - [ ] New user completes OAuth
   - [ ] Grid account created automatically
   - [ ] Solana address displayed in wallet

### Regression Tests

- [ ] All existing E2E tests pass
- [ ] No console errors
- [ ] No React warnings
- [ ] Context providers render correctly
- [ ] Navigation works as expected

---

## Migration Checklist

### Pre-Migration
- [ ] Review current AuthContext thoroughly
- [ ] Document all current behaviors
- [ ] Run all tests and record results
- [ ] Take git snapshot

### During Migration
- [ ] Create GridContext (Step 1)
- [ ] Create SessionContext (Step 2)
- [ ] Simplify AuthContext (Step 3)
- [ ] Update provider nesting (Step 4)
- [ ] Fix component usage (Step 5)
- [ ] Clean up sessionStorage (Step 6)

### Post-Migration
- [ ] All tests passing
- [ ] Manual testing complete
- [ ] No console errors
- [ ] Code review
- [ ] Update documentation
- [ ] Deploy to staging
- [ ] Monitor for issues

---

## Benefits After Refactor

### Code Quality
- ✅ 841 lines → 3 focused contexts (~700 lines total)
- ✅ Each context < 300 lines
- ✅ Single responsibility principle
- ✅ Easier to understand
- ✅ Easier to test

### Maintainability
- ✅ Clear separation of concerns
- ✅ Easy to find relevant logic
- ✅ Reduced coupling
- ✅ Better error isolation

### Developer Experience
- ✅ Faster onboarding
- ✅ Easier debugging
- ✅ Clearer dependencies
- ✅ Better TypeScript types

### Performance
- ✅ More granular re-renders
- ✅ Only affected contexts update
- ✅ Smaller context payloads

---

## Risks & Mitigations

### Risk: Breaking existing functionality
**Mitigation:** 
- Thorough testing at each step
- Keep git history clean for easy rollback
- Test critical paths manually

### Risk: Introducing new bugs
**Mitigation:**
- No new features, only refactoring
- Maintain same external API where possible
- Comprehensive test coverage

### Risk: Performance regression
**Mitigation:**
- Profile before and after
- Monitor re-render counts
- Use React DevTools Profiler

### Risk: Time overrun
**Mitigation:**
- Work in small, testable increments
- Can pause between steps
- Each step is independently valuable

---

## Timeline

**Total Estimate:** 4-5 hours

| Step | Task | Time | Can Pause After? |
|------|------|------|------------------|
| 1 | Create GridContext | 1h | ✅ Yes |
| 2 | Create SessionContext | 45m | ✅ Yes |
| 3 | Simplify AuthContext | 30m | ✅ Yes |
| 4 | Update provider nesting | 15m | ❌ No (must complete) |
| 5 | Fix component usage | 30m | ❌ No (must complete) |
| 6 | Clean up sessionStorage | 30m | ✅ Yes |
| 7 | Testing & validation | 1h | ❌ No (must complete) |

**Recommended approach:** Complete Steps 1-3 separately, then do Steps 4-5 together in one session.

---

## Questions to Answer Before Starting

1. **Do we want to keep backward compatibility?**
   - Option A: Keep old `useAuth()` hook with same API (facade pattern)
   - Option B: Update all consumers to use new hooks

2. **Should SessionContext auto-check on mount?**
   - Current: Only checks manually
   - Proposed: Auto-check every 5 minutes when app is active

3. **Where should navigation logic live?**
   - Current: In AuthContext (redirects to login/chat)
   - Proposed: Move to AuthGate component? Or keep in contexts?

4. **Should we extract common logout logic?**
   - Multiple contexts need cleanup
   - Could create `useLogout()` hook that coordinates all three contexts

---

## Success Criteria

- [ ] All existing tests pass
- [ ] Manual testing shows same behavior
- [ ] AuthContext < 300 lines
- [ ] GridContext < 350 lines
- [ ] SessionContext < 200 lines
- [ ] No new bugs introduced
- [ ] Code is easier to understand
- [ ] Developer feedback is positive

