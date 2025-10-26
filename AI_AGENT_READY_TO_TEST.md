# 🤖 AI Agent Can Test x402 Now!

## What I Created

I've set up everything needed for me (the AI agent) to test x402 payments. Here's what's ready:

### 1. **Export Script** ✅
`apps/client/__tests__/scripts/export-for-agent.js`
- Instructions for extracting Grid credentials from your app
- Creates `.test-secrets/` directory (gitignored)
- Provides both file and env var formats

### 2. **Test Storage Adapter** ✅
`apps/client/__tests__/utils/test-storage.ts`
- File-based storage that works in Node.js
- Can read from files or environment variables
- Replaces browser/mobile secure storage for tests

### 3. **Test Runner** ✅
`apps/client/__tests__/scripts/agent-test-runner.js`
- Pre-flight checks before running tests
- Verifies credentials are loaded
- Checks wallet balances
- Validates environment

---

## What I Need From You

### Quick Checklist:

```bash
# 1. Do you have a Grid wallet already?
# If NO, create one:
bun run test:setup:interactive  # in apps/client/

# 2. Fund it:
# Send to the address shown:
#   - 0.1 SOL
#   - 5 USDC

# 3. Export credentials:
# Open Mallory web app → DevTools → Console → Run:
sessionStorage.getItem("grid_session_secrets")
sessionStorage.getItem("grid_account")

# 4. Save the output:
# Create these files in apps/client/.test-secrets/:
#   - grid_session_secrets.json
#   - grid_account.json

# 5. Also need your Grid API key:
# Get from: https://grid.squads.xyz/
```

---

## Three Ways to Provide Credentials

### Option 1: Direct File Paste (Easiest)

Just paste the contents in chat:

```
Here are my Grid credentials:

grid_session_secrets.json:
{"encryptedPrivateKey": "...", "publicKey": "..."}

grid_account.json:
{"address": "7xKXtg2...", "authentication": {...}}

Grid API Key: grid_xxx...
```

I'll save them to `.test-secrets/` and run tests.

### Option 2: Create Files Yourself

```bash
# In apps/client/.test-secrets/
cat > grid_session_secrets.json << 'EOF'
<paste-session-secrets-json-here>
EOF

cat > grid_account.json << 'EOF'
<paste-grid-account-json-here>
EOF

# Set env vars
export EXPO_PUBLIC_GRID_API_KEY=<your-key>
export EXPO_PUBLIC_GRID_ENV=mainnet
```

Then tell me: "Credentials are in `.test-secrets/`"

### Option 3: Environment Variables Only

```bash
# Base64 encode and set env vars
export TEST_GRID_SESSION_SECRETS=$(cat grid_session_secrets.json | base64)
export TEST_GRID_ACCOUNT=$(cat grid_account.json | base64)
export EXPO_PUBLIC_GRID_API_KEY=<your-key>
export EXPO_PUBLIC_GRID_ENV=mainnet
```

Then tell me: "Credentials are in environment variables"

---

## What Happens After You Provide Them

1. **I'll verify credentials:**
   ```bash
   node apps/client/__tests__/scripts/agent-test-runner.js
   ```
   This checks:
   - ✅ Grid account loads
   - ✅ Session secrets present
   - ✅ Wallet has SOL
   - ✅ Wallet has USDC
   - ✅ Grid API key set

2. **I'll run x402 tests:**
   - Create ephemeral wallet
   - Fund from Grid wallet
   - Execute x402 payment
   - Sweep funds back
   - Report results

3. **You'll see:**
   - Transaction signatures
   - Balance before/after
   - Payment flow timing
   - Any errors (with details)

---

## Example: What to Paste

Here's the format I need (with fake data as example):

```
Grid API Key: grid_pk_abc123...

grid_session_secrets.json:
{
  "encryptedPrivateKey": "xxyyzz...",
  "publicKey": "AbCd...",
  "salt": "...",
  "iv": "..."
}

grid_account.json:
{
  "address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "authentication": {
    "token": "...",
    "refreshToken": "...",
    "expiresAt": 1234567890
  },
  "id": "grid_account_123",
  "status": "active"
}
```

---

## Security Notes

### What's Sensitive:
- ⚠️ **Session secrets** - Can sign transactions
- ⚠️ **Authentication tokens** - Can access Grid API

### Mitigation:
- ✅ Test wallet only (~$20 max)
- ✅ `.test-secrets/` is gitignored
- ✅ Can rotate wallet anytime
- ✅ I won't log or store permanently

### Best Practice:
1. Use dedicated test wallet
2. Only fund with small amount
3. Rotate every 3-6 months
4. Can create new one anytime

---

## Ready to Go!

Once you provide:
1. Grid session secrets (JSON)
2. Grid account data (JSON)
3. Grid API key (string)

I can:
- ✅ Run x402 payment tests
- ✅ Verify payments work end-to-end
- ✅ Test on real mainnet
- ✅ Report results with transaction signatures
- ✅ Re-run anytime you want

**Time estimate:** 2-5 minutes per test run

---

## Questions?

- **Q: Do you have Bun?**
  A: No, but my test runner uses Node.js which works fine

- **Q: Can you access my local app?**
  A: No, that's why I need the exported credentials

- **Q: Is this secure?**
  A: As secure as having a test wallet with $20. Use dedicated wallet, not personal funds.

- **Q: Can I revoke access?**
  A: Yes! Just create a new Grid wallet anytime

- **Q: Will tests cost money?**
  A: Yes, ~$0.01-0.10 per test run (real mainnet transactions)

---

## Ready When You Are!

Just paste the credentials and say "run tests" - I'll handle the rest! 🚀
