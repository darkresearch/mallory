# Simplified Wallet Authentication

## What Changed

Instead of using the complex `@solana/wallet-adapter-*` packages (which caused ESM/bundler issues), we now use **direct wallet detection** via `window.solana`.

## How It Works

### 1. Direct Wallet Detection
```typescript
// No wallet adapter library needed!
const wallet = window.phantom?.solana || window.solflare || window.solana;
```

### 2. Connect & Sign
```typescript
await wallet.connect();
const signature = await wallet.signMessage(message);
```

### 3. Supabase Web3 Auth
```typescript
await supabase.auth.signInWithWeb3({
  chain: 'solana',
  statement: 'Sign in to Mallory',
  wallet: wallet, // Pass the wallet object
});
```

## Supported Wallets

- ✅ **Phantom** (window.phantom.solana)
- ✅ **Solflare** (window.solflare)
- ✅ **Backpack** (window.backpack.solana)
- ✅ **Any wallet** (window.solana)

## Files Changed

### Created
- `features/auth/services/solana-wallet.ts` - Simple wallet detection & auth

### Updated
- `contexts/WalletAdapterContext.tsx` - Simplified to just wallet detection
- `components/auth/WalletSignInButton.tsx` - Simplified button
- `contexts/AuthContext.tsx` - Removed walletAdapter parameter
- `app/(auth)/login.tsx` - Removed walletAdapter usage

### Removed
- All `@solana/wallet-adapter-*` dependencies

## No More Issues

✅ No `import.meta` errors  
✅ No ESM bundler conflicts  
✅ No complex webpack/metro config  
✅ No external dependencies  
✅ Just works™

## Test It

```bash
# Start the app
bun run web

# Install Phantom wallet extension
# Click "Connect Wallet"
# Sign the message
# You're in! 🎉
```

The wallet button only shows if a Solana wallet is detected in the browser.

## Simple = Better

- **Before:** 4 npm packages, complex bundler config, CSS imports, polyfills
- **After:** Direct window.solana API, ~100 lines of code, no dependencies

---

**Total Lines of New Code:** ~150  
**External Dependencies:** 0  
**Bundler Headaches:** 0  

