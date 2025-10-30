# Grid Client Fix Implementation

## Issues Fixed

### Issue 1: Wallet Screen Can't Find Grid Account (pubkey missing)
**Problem**: Users couldn't see their pubkey or wallet holdings because the wallet screen was trying to access `user?.solanaAddress` which may not be immediately available.

**Root Cause**: The wallet screen was relying on `user?.solanaAddress` which is populated from the database and may lag behind. The Grid client service stores the address in secure storage, which is the source of truth.

**Solution**: Updated wallet screen to use Grid context's `gridAccount.address` or `solanaAddress` as the primary source, with `user?.solanaAddress` as a fallback.

**Files Changed**:
- `apps/client/app/(main)/wallet.tsx`

**Changes Made**:
1. Added `solanaAddress` to destructured useGrid() hook (line 30)
2. Updated `handleCopyAddress()` to use `gridAccount?.address || solanaAddress || user?.solanaAddress` (line 177)
3. Updated wallet address display to use `gridAccount?.address || solanaAddress || user?.solanaAddress` (line 272)
4. Updated DepositModal solanaAddress prop to use `gridAccount?.address || solanaAddress || user?.solanaAddress` (line 407)

### Issue 2: Grid State Cleared on App Refresh
**Problem**: Grid credentials were being cleared from secure storage on every app refresh, making users unable to access their wallet after refreshing the page.

**Root Cause**: The GridContext's useEffect was checking `if (!user?.id)` and immediately calling `clearGridAccount()`. During app initialization, `user` is temporarily `null` while the auth session is being restored from Supabase. This triggered the clear logic before the user object was populated, wiping out the Grid credentials.

**Solution**: Implemented an explicit logout flag mechanism:
1. AuthContext sets `mallory_is_logging_out` flag in sessionStorage when user clicks sign out
2. GridContext checks this flag - only clears secure storage if flag is set
3. On app refresh (flag not set), GridContext only clears React state but preserves secure storage

**Files Changed**:
- `apps/client/contexts/AuthContext.tsx`
- `apps/client/contexts/GridContext.tsx`

**Changes Made**:

#### AuthContext.tsx
- Added `sessionStorage.setItem('mallory_is_logging_out', 'true')` in `logout()` function (lines 342-345)
- This flag is set BEFORE clearing user state, so GridContext can detect explicit logout

#### GridContext.tsx
- Completely rewrote the `if (!user?.id)` logic (lines 61-104)
- Added check for `mallory_is_logging_out` flag (lines 67-69)
- If flag is set (explicit logout):
  - Clears React state
  - Clears secure storage via `clearGridAccount()`
  - Removes the flag after handling
- If flag is NOT set (app refresh/init):
  - Only clears React state
  - Preserves secure storage (Grid credentials remain intact)
  - Grid account will be reloaded when user.id becomes available

## Testing Recommendations

### Test Case 1: Wallet Screen Display
1. Log in to the app
2. Complete Grid sign-in if needed
3. Navigate to wallet screen
4. **Expected**: Wallet address (pubkey) should be visible
5. **Expected**: Can copy address by clicking on it
6. **Expected**: Deposit modal shows correct address

### Test Case 2: App Refresh Preserves Grid Session
1. Log in to the app
2. Complete Grid sign-in
3. Navigate to wallet screen and verify address is visible
4. Refresh the browser (F5 or Cmd+R)
5. **Expected**: After page loads, wallet address should still be visible
6. **Expected**: No need to complete Grid OTP again
7. **Expected**: Console should show "App refresh/init detected, clearing React state only (preserving Grid credentials)"

### Test Case 3: Explicit Logout Clears Everything
1. Log in to the app
2. Complete Grid sign-in
3. Navigate to wallet screen
4. Click "Sign out" button
5. **Expected**: Redirected to login screen
6. **Expected**: Console should show "Explicit logout detected, clearing Grid state"
7. **Expected**: Console should show "Grid credentials cleared from secure storage on logout"
8. Log in again with a DIFFERENT account
9. **Expected**: Previous user's wallet should NOT be accessible
10. **Expected**: New user should be prompted for Grid OTP

## Architecture Notes

### Logout Flag Pattern
We use sessionStorage to communicate logout intent between AuthContext and GridContext. This is necessary because:
1. Both contexts monitor `user?.id` independently
2. During logout, user becomes null, triggering both contexts' effects
3. GridContext needs to know if null is from logout or app init
4. sessionStorage persists across React renders and provides a simple flag mechanism

### Why Not Use a Shared State?
We could use a shared logout state, but:
- Introduces coupling between contexts
- sessionStorage is simpler and already used elsewhere in the codebase
- The flag pattern is self-documenting and easy to debug

### Grid Address Source of Truth
The Grid SDK stores authentication in secure storage on the device. This is the ONLY place where the Grid session secrets are stored. The database (`users_grid` table) stores the address for reference, but the actual authentication happens through secure storage.

Priority order for wallet address display:
1. `gridAccount.address` - Live Grid account from secure storage
2. `solanaAddress` - Grid context state (from secure storage)
3. `user.solanaAddress` - Database backup (may be stale)

## Potential Edge Cases

### Edge Case 1: User Closes Browser During Logout
If user closes browser mid-logout, the flag may remain in sessionStorage. This is safe because:
- On next app launch, user will be null (no Supabase session)
- Flag will be checked, Grid credentials will be cleared
- This is the desired behavior (security-first)

### Edge Case 2: Multiple Tabs
If user has multiple tabs open and logs out in one:
- Each tab has independent sessionStorage (not shared)
- Other tabs won't detect logout until they check Supabase session
- When they detect user=null, they won't have the flag, so won't clear Grid
- This could be a minor issue, but Supabase will sign out all tabs
- On next page interaction, all tabs will detect no session and log out

### Edge Case 3: Grid Session Expires But Supabase Still Valid
- WalletContext will fail to load wallet data (401 error)
- useTransactionGuard will detect invalid Grid session
- User will be prompted to complete OTP
- Grid credentials will be refreshed in secure storage
- This is handled by existing re-auth flow

## Conclusion

Both issues have been resolved:
1. ✅ Wallet screen now correctly displays Grid account address from secure storage
2. ✅ Grid credentials are preserved on app refresh, only cleared on explicit logout

The implementation maintains security (credentials cleared on logout) while providing a smooth UX (no re-auth on every page refresh).
