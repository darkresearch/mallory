# Signup Flow E2E Test - Production Integration ✅

## Overview
Successfully implemented a comprehensive end-to-end test for the user signup flow that uses **PRODUCTION code paths** to validate the real user experience.

## Key Principle: Testing Production Code

✅ **This test validates the ACTUAL production flow:**
- Uses backend API endpoints (same as production app)
- Grid operations proxied through backend
- Database synchronization verified
- Only difference: email/password auth instead of Google OAuth

## What Was Implemented

### 1. Email Generation Utilities ✅
**File**: `apps/client/__tests__/utils/mailosaur-helpers.ts`

- `generateTestEmail()`: Creates random test emails using Mailosaur domain
- `generateTestPassword()`: Generates secure random passwords
- Ensures uniqueness with random ID + timestamp combination

### 2. Signup Helper Functions ✅
**File**: `apps/client/__tests__/setup/test-helpers.ts`

Added two new functions:

- **`signupNewUser(email, password)`**: 
  - Creates Supabase account with email/password
  - Disables email confirmation (for testing)
  - Returns userId, email, and session
  
- **`completeGridSignupProduction(email, accessToken)`**:
  - Calls backend `/api/grid/start-sign-in` (PRODUCTION API)
  - Waits for OTP via Mailosaur (90s timeout)
  - Generates session secrets (same as production)
  - Calls backend `/api/grid/complete-sign-in` (PRODUCTION API)
  - Backend syncs to database
  - Returns Grid session (address, authentication, sessionSecrets)

### 3. E2E Signup Test ✅
**File**: `apps/client/__tests__/e2e/signup-flow.test.ts`

Complete test flow using **PRODUCTION code paths**:
1. Generate random email and password
2. Create Supabase account
3. Verify authentication works
4. **Call backend API to start Grid signup**
5. Wait for and process OTP
6. **Call backend API to complete Grid signup**
7. Verify Grid account is active
8. Verify database sync occurred
9. Log complete credentials

Test timeout: 120 seconds (2 minutes)

### 4. Test Script ✅
**File**: `apps/client/package.json`

Added command: `bun run test:signup`

## Requirements

### Backend Server Must Be Running
```bash
# Terminal 1: Start backend
cd apps/server
bun run dev

# Terminal 2: Run test
cd apps/client
bun run test:signup
```

### Environment Variables
Ensure `.env.test` has:
- `MAILOSAUR_API_KEY`
- `MAILOSAUR_SERVER_ID`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_GRID_ENV`
- Note: `GRID_API_KEY` is server-side only
- `TEST_BACKEND_URL` (default: http://localhost:3001)

## Test Output

```
🚀 Starting E2E Signup Flow Test (PRODUCTION PATH)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ℹ️  This test uses PRODUCTION code:
   - Backend API for Grid operations
   - Same flow as real users (except email/password auth)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Step 1/4: Generating test credentials...
✅ Generated test credentials:
   Email: mallory-test-zyddv2fbmha2m4tk@7kboxsdj.mailosaur.net
   Password: 6!@h***

📋 Step 2/4: Creating Supabase account...
✅ Supabase account created:
   User ID: 490aa4c7-ad9b-4330-a22b-bbe71708a586
   Email: mallory-test-zyddv2fbmha2m4tk@7kboxsdj.mailosaur.net
   Has Session: true
   Access Token: eyJhbGciOiJIUzI1NiIs...

📋 Step 3/4: Creating Grid wallet via backend...
⏳ This may take 30-90 seconds...
   - Calling backend /api/grid/start-sign-in
   - Backend calls Grid SDK
   - Waiting for OTP email via Mailosaur
   - Calling backend /api/grid/complete-sign-in
   - Backend syncs to database

🏦 Starting Grid signup for: mallory-test-zyddv2fbmha2m4tk@7kboxsdj.mailosaur.net
   Using PRODUCTION code path (backend API)
🔐 Calling backend /api/grid/start-sign-in...
✅ Backend initiated Grid sign-in, OTP sent to email
📧 Waiting for NEW OTP email...
✅ OTP received: 161808
🔐 Generating session secrets...
🔐 Calling backend /api/grid/complete-sign-in...
✅ Grid account verified successfully via backend
   Address: AVNgTANuwBJkG8rRy6ZQTFu154QwV2gF6boKaMSMjb5i

📋 Step 4/4: Verifying complete setup...

✅✅✅ SIGNUP FLOW COMPLETE! ✅✅✅

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Test Account Created:

Supabase:
  User ID: 490aa4c7-ad9b-4330-a22b-bbe71708a586
  Email: mallory-test-zyddv2fbmha2m4tk@7kboxsdj.mailosaur.net
  Password: 6!@hBorgj#@vGXmL

Grid:
  Wallet Address: AVNgTANuwBJkG8rRy6ZQTFu154QwV2gF6boKaMSMjb5i
  Network: Solana Mainnet

✅ Backend Integration:
  - Used production API endpoints
  - Data synced to database
  - Same flow as production users

🗒️  Note: Account left in place (no cleanup)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Production Code Path Validation

### What Gets Tested ✅
- Backend `/api/grid/start-sign-in` endpoint
- Backend `/api/grid/complete-sign-in` endpoint
- Grid SDK integration via backend proxy
- Database synchronization (users_grid table)
- Session secret generation
- OTP flow (Grid → Email → Mailosaur → Backend)
- Full authentication lifecycle

### What's Different from Production ⚠️
- **Auth Method**: Email/password instead of Google OAuth
  - Reason: Testing requires programmatic auth
  - Everything else uses production code

### Why This Matters
✅ Tests the actual code users will run
✅ Validates backend logic and database sync
✅ Catches integration issues between services
✅ Verifies end-to-end flow, not just individual pieces

## Architecture Highlights

- **Production Grid Service**: Uses `gridClientService` via backend API
- **Backend Proxy**: All Grid operations go through `/api/grid/*` endpoints
- **Database Sync**: Backend writes to `users_grid` table automatically
- **Session Management**: Same secret generation as production
- **OTP Flow**: Identical to production (Grid → Email → Client)

## Next Steps

You can now:
1. Run `bun run test:signup` to test complete signup flow
2. Verify database records in Supabase dashboard
3. Add more test cases (e.g., error scenarios, edge cases)
4. Integrate into CI/CD pipeline (with backend running)
5. Test other flows that depend on authenticated users

## Troubleshooting

### "Backend not running"
Start the backend server:
```bash
cd apps/server
bun run dev
```

### "Backend start-sign-in failed: 401"
Check that Supabase auth token is valid and backend can verify it.

### "Timeout waiting for OTP"
Check Mailosaur inbox and ensure Grid can send emails to your test domain.

