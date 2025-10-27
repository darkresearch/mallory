# Wallet Authentication Testing Guide

## Prerequisites

Before testing, make sure you've completed these setup steps:

### 1. Run Database Migration

Go to your Supabase Dashboard → SQL Editor and run the migration:

```bash
# File: migrations/add_wallet_auth_support.sql
```

Or copy and paste this SQL:

```sql
ALTER TABLE users_grid 
ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'email' CHECK (account_type IN ('email', 'signer'));

ALTER TABLE users_grid 
ADD COLUMN IF NOT EXISTS wallet_public_key TEXT;

UPDATE users_grid 
SET account_type = 'email' 
WHERE account_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_grid_wallet_public_key 
ON users_grid(wallet_public_key) 
WHERE wallet_public_key IS NOT NULL;
```

### 2. Install a Solana Wallet Browser Extension

Install one of these wallet extensions in your browser:
- [Phantom](https://phantom.app/) (Recommended)
- [Solflare](https://solflare.com/)
- [Backpack](https://www.backpack.app/)

Make sure you have a wallet set up with some SOL for testing.

### 3. Start Development Servers

```bash
# Terminal 1 - Backend
cd apps/server
bun run dev

# Terminal 2 - Frontend (Web)
cd apps/client  
bun run web
```

## Testing the Wallet Authentication Flow

### Test 1: New User Sign-In with Wallet

1. **Open the app** in your browser: http://localhost:8081

2. **You should see two sign-in buttons:**
   - "Continue with Google" (white button)
   - "Connect Wallet" (purple button)

3. **Click "Connect Wallet"**
   - A wallet selection modal should appear
   - Select your wallet (e.g., Phantom)

4. **Approve the connection** in your wallet
   - Your wallet will ask you to approve connecting to the site
   - Click "Connect" or "Approve"

5. **Sign the authentication message**
   - Your wallet will show a message to sign
   - Message should say "Sign in to Mallory"
   - Click "Sign" or "Approve"

6. **Expected behavior:**
   - You should be redirected to the main app
   - A Grid signer-based account is created automatically (no OTP needed!)
   - Check browser console for success logs:
     ```
     ✅ Solana wallet authentication successful
     ✅ Signer-based Grid account created
     ```

7. **Verify in Supabase Dashboard:**
   - Go to Authentication → Users
   - Find your new user (no email, just wallet address)
   - Go to Table Editor → users_grid
   - Should see entry with:
     - `account_type`: "signer"
     - `wallet_public_key`: Your wallet's public key
     - `solana_wallet_address`: Grid account address
     - `grid_account_status`: "active"

### Test 2: Existing Google User Can Continue Using Google

1. **Sign out** if logged in
2. **Click "Continue with Google"**
3. **Sign in with Google OAuth**
4. **Expected behavior:**
   - Works exactly as before
   - Creates email-based Grid account
   - Shows OTP modal for verification
   - `account_type` in database: "email"

### Test 3: Wallet User Can Access Wallet Features

1. **Sign in with your wallet** (from Test 1)
2. **Navigate to Wallet screen**
3. **Check that you can see:**
   - Your Grid wallet address
   - SOL and token balances
   - Transaction history

4. **Try sending tokens:**
   - Click send button
   - Enter recipient and amount
   - Transaction should work (signed via Grid, not your wallet)

### Test 4: Sign Out and Sign Back In

1. **Sign in with wallet**
2. **Sign out**
3. **Sign in again with the same wallet**
4. **Expected behavior:**
   - Should reconnect without creating a new account
   - Grid account data loaded from secure storage
   - No database errors

## Browser Console Debugging

### Success Flow Logs

You should see these logs in order:

```
🔐 Starting wallet login...
🔐 Wallet connected: [YourPublicKey]
🔐 Requesting signature from Supabase...
✅ Solana wallet authentication successful
✅ User ID: [UUID]
✅ Wallet address: [PublicKey]
🏦 Checking Grid account...
🏦 No Grid account in secure storage, checking database...
🏦 Creating signer-based Grid account for wallet user
🔐 Creating Grid signer account for wallet: [PublicKey]
🔐 Backend proxy response: { success: true, data: {...} }
✅ Grid signer account created
✅ Signer-based Grid account created
```

### Backend Logs

In your server terminal:

```
🔐 [Grid Proxy] Creating signer-based account for wallet: [PublicKey]
🔐 [Grid Proxy] Grid API response: { success: true, ... }
✅ Grid signer account synced to database: [GridAddress]
```

## Common Issues & Troubleshooting

### Issue: "Wallet adapter not available"
**Solution:** Make sure you're on web platform (not mobile) and wallet extension is installed.

### Issue: Wallet modal doesn't appear
**Solution:** 
- Check browser console for errors
- Make sure wallet extension is enabled
- Try refreshing the page

### Issue: "User rejected signature"
**Solution:** This is normal if you clicked "Reject" in your wallet. Just try again and click "Approve".

### Issue: Database error about account_type column
**Solution:** Run the database migration (see Prerequisites).

### Issue: Grid account creation fails
**Solution:** 
- Check that GRID_API_KEY is set in server .env
- Check that Grid environment is correct (sandbox vs production)
- Check server logs for detailed error

## Next Steps

After successful testing, you can:

1. **Deploy to production**
   - Update Supabase redirect URLs
   - Set Grid environment to "production"
   - Test with production wallet addresses

2. **Add mobile wallet adapter** (coming next!)
   - Implement Solana Mobile Wallet Adapter
   - Test on iOS/Android devices
   - Support wallet apps like Phantom Mobile

3. **Add wallet linking**
   - Allow Google users to link their wallet
   - Support multiple auth methods per user
   - Use Supabase identity linking

## Testing Checklist

- [ ] Database migration completed
- [ ] Wallet extension installed
- [ ] Backend server running
- [ ] Frontend server running
- [ ] New wallet user sign-in works
- [ ] Google OAuth still works
- [ ] Grid account created for wallet users
- [ ] Database has correct account_type
- [ ] Wallet features accessible
- [ ] Sign out/in works
- [ ] No console errors
- [ ] No backend errors

---

**Note:** This is the web-only implementation. Mobile wallet adapter support will be added separately.

