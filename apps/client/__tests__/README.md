# Mallory Automated Testing

Automated end-to-end testing for X402 payment flow with Supabase Auth, Grid wallets, and Mailosaur OTP integration.

## Quick Start

### One-Time Setup

```bash
# 1. Run setup script (creates accounts, generates credentials)
bun run test:setup

# 2. Fund the wallet (address will be displayed)
# Network: Solana Mainnet
# Send: 0.1 SOL + 5 USDC

# 3. Verify wallet is funded
bun run test:balance
```

### Running Tests

```bash
# Run all validation tests
bun run test:validate:all

# Run specific validations
bun run test:validate:storage      # Phase 1: Storage
bun run test:validate:mailosaur    # Phase 2: Mailosaur
bun run test:validate:auth         # Phase 3: Supabase Auth
bun run test:validate:grid-load    # Phase 5: Grid Session
bun run test:validate:conversation # Phase 6: Conversations
bun run test:validate:chat         # Phase 7: Chat API (needs server running)

# Run E2E tests (once implemented)
bun run test:e2e
```

## Architecture

### Test Flow

```
1. Authenticate via Supabase (email/password)
2. Load cached Grid session
3. Create new conversation for test
4. Send message to chat API
5. Parse stream for payment requirement
6. Execute X402 payment via Grid
7. Send result back to AI
8. Validate complete flow
```

### Key Principles

- **Maximum code reuse**: Import production services directly
- **Minimal test code**: Only auth swap and Mailosaur OTP
- **No UI testing**: Direct API calls for speed/reliability
- **One account, many tests**: Grid account created once, reused forever
- **Fresh conversation per test**: Each test gets clean conversation state

## Directory Structure

```
__tests__/
├── setup/
│   ├── test-env.ts              # Load .env.test
│   ├── test-storage.ts          # Mock secure storage
│   ├── supabase-test-client.ts  # Supabase without React Native
│   ├── grid-test-client.ts      # Grid without React Native
│   ├── mailosaur.ts             # OTP retrieval
│   ├── test-helpers.ts          # Main test utilities
│   └── polyfills.ts             # Environment polyfills
├── utils/
│   ├── conversation-test.ts     # Conversation creation
│   ├── chat-api.ts              # Chat API utilities
│   └── x402-test.ts             # X402 payment (TODO)
├── scripts/
│   ├── setup-test-account.ts    # One-time setup
│   ├── check-balance.ts         # Check wallet funding
│   └── validate-*.ts            # Phase validation scripts
└── e2e/
    └── (tests will go here)
```

## Environment Variables

File: `.env.test` (git-ignored)

```env
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://noejgsvffdeuetezagba.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-key>

# Test Account
TEST_SUPABASE_EMAIL=mallory-testing@7kboxsdj.mailosaur.net
TEST_SUPABASE_PASSWORD=TestMallory2025!Secure#Grid

# Mailosaur
MAILOSAUR_API_KEY=1LfTVNH3bCPqakZm6xmu6BWecWwnrAsP
MAILOSAUR_SERVER_ID=7kboxsdj

# Grid
EXPO_PUBLIC_GRID_ENV=production
# Note: GRID_API_KEY is server-side only, not needed in client tests

# Server
TEST_BACKEND_URL=http://localhost:3001
```

## Test Account Info

After running `bun run test:setup`, you'll have:

**Supabase User:**
- Email: `mallory-testing@7kboxsdj.mailosaur.net`
- User ID: (generated during setup)

**Grid Wallet:**
- Address: `Cm3JboRankogPCAhHiin5msHjWmCD8sbNBxVwjBUa1Vz`
- Network: Solana Mainnet
- Environment: Grid Production

**Credentials Stored:**
- `.test-secrets/test-storage.json` - All cached data
- Grid session secrets (never expires unless revoked)

## Validation Phases

### ✅ Phase 1: Storage Mock
Tests that test-storage.ts works (file persistence, CRUD operations)

### ✅ Phase 2: Mailosaur Integration
Tests Mailosaur API connection and email retrieval

### ✅ Phase 3: Supabase Auth
Tests user creation and email/password authentication

### ✅ Phase 4: Grid Account Creation
Creates Grid wallet with OTP via Mailosaur (run ONCE)

### ✅ Phase 5: Grid Session Loading
Tests loading cached Grid credentials

### ✅ Phase 6: Conversation Creation
Tests creating conversations in Supabase

### ⏸️ Phase 7: Chat API (pending server)
Tests calling /api/chat endpoint (needs backend running)

### 🚧 Phase 8: Payment Detection (TODO)
Tests parsing payment requirements from AI stream

### 🚧 Phase 9: X402 Payment (TODO)
Tests executing X402 payments via Grid

### 🚧 Phase 10: Full E2E Test (TODO)
Complete end-to-end test of entire flow

## Troubleshooting

### "Grid session not found"
Run the setup script: `bun run test:setup`

### "Timeout waiting for OTP"
- Check Mailosaur inbox has emails
- Try clearing old emails
- Verify MAILOSAUR_SERVER_ID is correct

### "Insufficient funds"
Fund the wallet:
```bash
# Get the address
bun run test:balance

# Send SOL and USDC to displayed address
```

### "Backend not running"
Start the backend server:
```bash
cd apps/server
bun run dev
```

## Next Steps

1. ✅ **Phases 1-6 complete** - Foundation is solid
2. **Fund the wallet** - Required before proceeding
3. **Start backend server** - Required for Phase 7+
4. **Implement Phase 8-9** - X402 payment logic
5. **Create E2E tests** - Full integration tests

## Cost Estimate

- **Setup (one-time)**: ~$0
- **Per test run**: ~$0.01-0.05 (mostly Nansen API costs)
- **Monthly (daily runs)**: ~$1-5

## Security

- `.env.test` is git-ignored (contains passwords)
- `.test-secrets/` is git-ignored (contains session keys)
- Test account uses Mailosaur (disposable email)
- Grid session secrets never leave local machine
- Separate test account from production users

## Maintenance

- Grid session: Does not expire (no re-auth needed)
- Supabase session: Auto-refreshed by Supabase SDK
- Test wallet: Refund as needed (sweep back to main wallet)

