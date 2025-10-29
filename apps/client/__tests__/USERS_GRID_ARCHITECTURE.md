# Test Architecture Update: users_grid

## Decision

**Client no longer queries `users_grid` table.**

### Architecture

```
Client:
  └─ gridClientService.getAccount() (secure storage)
     └─ Returns: { address, authentication }
     
Backend:
  └─ users_grid table (database)
     └─ Used by: /api/wallet/holdings (to lookup wallet address)
```

### What Changed

**Before:**
```typescript
// Client queried both secure storage AND database
const account = await gridClientService.getAccount();
const { data } = await supabase.from('users_grid').select('*');
setSolanaAddress(data?.solana_wallet_address || account?.address);
```

**After:**
```typescript
// Client uses ONLY secure storage
const account = await gridClientService.getAccount();
if (account) {
  setSolanaAddress(account.address);  // Single source of truth
  setGridAccountStatus('active');
}
```

### Why?

1. **Single source of truth** - Wallet address comes from Grid SDK
2. **Simpler auth** - No database dependency for wallet operations
3. **Backend still works** - Backend uses `users_grid` for holdings API
4. **Better separation** - Client = secure storage, Backend = database

### Test Updates Needed

**Remove from integration/E2E tests:**
- ❌ Client queries to `users_grid` 
- ❌ Expectations that client-side Grid data comes from database

**Keep in tests:**
- ✅ Backend syncs to `users_grid` (after OTP completion)
- ✅ Backend holdings API uses `users_grid`
- ✅ Client gets wallet address from `gridClientService.getAccount()`

### Migration

No migration needed! Backend already syncs to `users_grid`, so the table continues to work for backend operations.

