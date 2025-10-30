# Storage Key Audit - Grid & Auth Storage Inconsistencies

## 🚨 Issues Found

### Issue 1: Mixed Storage Types (secureStorage vs sessionStorage)

**Problem**: Grid-related data is stored in BOTH secureStorage and sessionStorage inconsistently.

#### Current State:

**secureStorage (Persistent, Secure):**
- `grid_account` - Grid account data with authentication tokens
- `grid_session_secrets` - Session secrets for transactions
- `mallory_grid_is_existing_user` - Flow hint for sign-in (SHOULD BE sessionStorage)
- `mallory_auth_token` - Supabase auth token
- `mallory_refresh_token` - Supabase refresh token

**sessionStorage (Temporary, Cleared on tab close):**
- `mallory_grid_user` - Grid user object during OTP flow
- `mallory_grid_is_existing_user` - Flow hint (DUPLICATE! Also in secureStorage)
- `mallory_auto_initiate_grid` - Flag to auto-start Grid sign-in
- `mallory_auto_initiate_email` - Email for auto-initiate
- `mallory_is_logging_out` - Logout flag
- `mallory_oauth_in_progress` - OAuth state flag
- `otp_return_path` - Return path after OTP
- `mallory_pending_send` - Pending transaction data

### Issue 2: Inconsistent Key Names

**Problem**: Some keys have `mallory_` prefix, others don't. No central constants file.

**Keys WITHOUT prefix:**
- `grid_account`
- `grid_session_secrets`
- `otp_return_path`

**Keys WITH prefix:**
- `mallory_auth_token`
- `mallory_refresh_token`
- `mallory_grid_user`
- `mallory_grid_is_existing_user`
- `mallory_auto_initiate_grid`
- `mallory_auto_initiate_email`
- `mallory_is_logging_out`
- `mallory_oauth_in_progress`
- `mallory_pending_send`

### Issue 3: Direct String Usage

**Problem**: Storage keys are hardcoded strings scattered across multiple files.

**Files with direct key usage:**
- `contexts/GridContext.tsx` - 10+ hardcoded keys
- `contexts/AuthContext.tsx` - AUTH_TOKEN_KEY constant, but duplicated
- `features/grid/services/gridClient.ts` - 6+ hardcoded keys
- `lib/auth/tokens.ts` - AUTH_TOKEN_KEY constant (duplicate definition!)
- `features/wallet/services/data.ts` - Hardcoded 'mallory_auth_token'
- `features/wallet/services/grid-api.ts` - Hardcoded 'mallory_auth_token'
- `hooks/useAIChat.ts` - Hardcoded keys
- `app/(main)/wallet.tsx` - Hardcoded 'mallory_pending_send'

### Issue 4: Duplicate Flow Hint Storage

**CRITICAL BUG**: `mallory_grid_is_existing_user` is stored in BOTH places:

**In gridClient.ts:**
```typescript
// Line 129 - WRONG! Should be sessionStorage
await secureStorage.setItem('mallory_grid_is_existing_user', String(isExistingUser));

// Line 196 - Getting from secureStorage
const isExistingUserStr = await secureStorage.getItem('mallory_grid_is_existing_user');

// Line 251 - Removing from secureStorage
await secureStorage.removeItem('mallory_grid_is_existing_user');
```

**In GridContext.tsx:**
```typescript
// Line 272 - Trying to remove from sessionStorage (BUT IT'S NOT THERE!)
sessionStorage.removeItem('mallory_grid_is_existing_user');

// Line 379 - Same issue
sessionStorage.removeItem('mallory_grid_is_existing_user');
```

**Result**: The flow hint is stored in secureStorage but GridContext tries to clean it from sessionStorage. This creates a leak - the hint is never properly cleaned up!

## 🎯 Recommended Solution

### 1. Create Central Storage Keys Constants

Create `apps/client/lib/storage/keys.ts`:

```typescript
/**
 * Centralized storage keys for the Mallory app
 * 
 * NAMING CONVENTION:
 * - All keys use 'mallory_' prefix for namespacing
 * - Use snake_case for consistency
 * - Group by category (auth, grid, session)
 */

// ═══════════════════════════════════════════════════════════════
// SECURE STORAGE KEYS (Persistent across app sessions)
// ═══════════════════════════════════════════════════════════════

export const SECURE_STORAGE_KEYS = {
  // Authentication
  AUTH_TOKEN: 'mallory_auth_token',
  REFRESH_TOKEN: 'mallory_refresh_token',
  
  // Grid Wallet (Persistent credentials)
  GRID_ACCOUNT: 'mallory_grid_account',
  GRID_SESSION_SECRETS: 'mallory_grid_session_secrets',
} as const;

// ═══════════════════════════════════════════════════════════════
// SESSION STORAGE KEYS (Temporary, cleared on tab close)
// ═══════════════════════════════════════════════════════════════

export const SESSION_STORAGE_KEYS = {
  // OAuth Flow
  OAUTH_IN_PROGRESS: 'mallory_oauth_in_progress',
  
  // Grid Sign-In Flow
  GRID_USER: 'mallory_grid_user',
  GRID_IS_EXISTING_USER: 'mallory_grid_is_existing_user',
  GRID_AUTO_INITIATE: 'mallory_auto_initiate_grid',
  GRID_AUTO_INITIATE_EMAIL: 'mallory_auto_initiate_email',
  
  // OTP Flow
  OTP_RETURN_PATH: 'mallory_otp_return_path',
  
  // Logout
  IS_LOGGING_OUT: 'mallory_is_logging_out',
  
  // Transactions
  PENDING_SEND: 'mallory_pending_send',
} as const;

// Type helpers for compile-time safety
export type SecureStorageKey = typeof SECURE_STORAGE_KEYS[keyof typeof SECURE_STORAGE_KEYS];
export type SessionStorageKey = typeof SESSION_STORAGE_KEYS[keyof typeof SESSION_STORAGE_KEYS];
```

### 2. Storage Type Rules

**Use secureStorage for:**
- Authentication tokens (persist across sessions)
- Grid wallet credentials (persist across sessions)
- Any sensitive data that should survive app restart

**Use sessionStorage for:**
- Temporary flow state (OAuth, OTP)
- UI flags (logout in progress)
- Navigation state (return paths)
- Pending actions (transactions)

### 3. Fix Flow Hint Storage

**Current (BROKEN):**
```typescript
// gridClient.ts - stores in secureStorage
await secureStorage.setItem('mallory_grid_is_existing_user', ...)

// GridContext.tsx - tries to remove from sessionStorage
sessionStorage.removeItem('mallory_grid_is_existing_user')
```

**Fixed:**
```typescript
// gridClient.ts - store in sessionStorage (temporary flow hint)
if (typeof window !== 'undefined' && window.sessionStorage) {
  sessionStorage.setItem(SESSION_STORAGE_KEYS.GRID_IS_EXISTING_USER, String(isExistingUser));
}

// gridClient.ts - read from sessionStorage
const isExistingUserStr = typeof window !== 'undefined' && window.sessionStorage
  ? sessionStorage.getItem(SESSION_STORAGE_KEYS.GRID_IS_EXISTING_USER)
  : null;

// GridContext.tsx - remove from sessionStorage (WORKS NOW!)
sessionStorage.removeItem(SESSION_STORAGE_KEYS.GRID_IS_EXISTING_USER);
```

## 📋 Implementation Checklist

- [ ] Create `apps/client/lib/storage/keys.ts` with all constants
- [ ] Update `apps/client/lib/storage/index.ts` to export keys
- [ ] Update `contexts/GridContext.tsx` to use constants
- [ ] Update `contexts/AuthContext.tsx` to use constants (remove duplicate AUTH_TOKEN_KEY)
- [ ] Update `features/grid/services/gridClient.ts` to use constants and fix flow hint storage
- [ ] Update `lib/auth/tokens.ts` to import constants (remove duplicate AUTH_TOKEN_KEY)
- [ ] Update `features/wallet/services/data.ts` to use constants
- [ ] Update `features/wallet/services/grid-api.ts` to use constants
- [ ] Update `hooks/useAIChat.ts` to use constants
- [ ] Update `app/(main)/wallet.tsx` to use constants
- [ ] Update all tests to use constants

## 🔍 Verification Steps

1. **Test Grid Sign-In Flow**: Verify flow hint is properly stored and cleaned up
2. **Test App Refresh**: Verify Grid credentials persist across refresh
3. **Test Logout**: Verify all Grid data is cleared on logout
4. **Test Multi-Tab**: Verify session storage doesn't leak between tabs
5. **Check for Orphaned Keys**: Verify no old keys remain in storage after operations

## 📊 Impact Analysis

### Files to Update: 11 core files
- Core contexts: 2 files
- Grid features: 1 file  
- Auth features: 2 files
- Wallet features: 2 files
- Hooks: 1 file
- Screens: 1 file
- Storage lib: 2 files

### Breaking Changes: None
- All changes are internal implementation details
- No API changes
- Storage keys maintain backwards compatibility (can migrate old keys)

### Risk Level: Low
- Changes are straightforward replacements
- Can be done incrementally
- Each file can be tested independently
