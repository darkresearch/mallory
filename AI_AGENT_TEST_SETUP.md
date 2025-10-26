# Plan: Enable AI Agent to Test x402 Payments

## Current Situation Analysis

### What I Have Access To ✅
- ✅ Node.js (v22.20.0)
- ✅ Environment variables (can read `process.env`)
- ✅ File system access
- ✅ Can run shell commands
- ✅ Some env vars already set:
  - `NEXT_PUBLIC_SOLANA_RPC_URL`
  - `FEE_WALLET`

### What I DON'T Have ❌
- ❌ Bun runtime (command not found)
- ❌ Grid wallet credentials (session secrets + account data)
- ❌ Funded Solana wallet
- ❌ Grid API key for SDK

### What the Test Needs

The test (line 70 in `x402-payment.test.ts`) tries to:
```typescript
const gridAccount = await gridClientService.getAccount();
```

This calls `secureStorage.getItem('grid_account')` which:
- **On web:** Uses `sessionStorage` (not available in Node)
- **On mobile:** Uses expo-secure-store (not available in Node)
- **In tests:** Needs a mock/file-based storage

---

## The Problem

The test infrastructure assumes:
1. **Bun runtime** - Tests use `bun:test`
2. **Grid wallet exists** - In secure storage
3. **Wallet is funded** - With SOL + USDC
4. **React Native environment** - For `Platform.OS` check

But I'm running in:
- **Node.js** (not Bun)
- **No secure storage** (no browser, no mobile)
- **No Grid wallet** (not set up)

---

## Solution: Create AI Agent Test Environment

### Option A: Simplest (File-Based Storage Mock)

Create a test-specific storage that uses the filesystem instead of secure storage.

**What you need to provide:**
1. **Grid Session Secrets** (JSON)
2. **Grid Account Data** (JSON)
3. **Grid API Key** (string)
4. **Funded Wallet** (already created, just needs SOL + USDC)

**What I'll do:**
1. Create file-based storage adapter for tests
2. Store secrets in `/workspace/.test-secrets/` (gitignored)
3. Run tests using Node + file storage
4. Report results

### Option B: Use Environment Variables

Store Grid credentials as base64-encoded env vars.

**What you need to provide:**
```bash
# In Cursor settings or .env file
TEST_GRID_SESSION_SECRETS=<base64-encoded-json>
TEST_GRID_ACCOUNT=<base64-encoded-json>
TEST_GRID_API_KEY=<your-api-key>
EXPO_PUBLIC_GRID_API_KEY=<your-api-key>
EXPO_PUBLIC_GRID_ENV=mainnet
```

**What I'll do:**
1. Create env-based storage adapter
2. Decode secrets from env vars
3. Run tests
4. Clean up

### Option C: Use Cursor's Secrets Manager (If Available)

Use Cursor's built-in secrets/environment system.

**What you need to provide:**
- Same secrets as Option B, but through Cursor UI

---

## Recommended Approach: **Option A + B Hybrid**

### Phase 1: One-Time Setup (You Do This)

#### Step 1: Create Grid Test Wallet

If you don't have one yet:
```bash
cd apps/client
# You'll need Bun installed locally
bun run test:setup:interactive
```

This creates:
- Grid wallet
- Session secrets (stored in secure storage)
- Account data

#### Step 2: Extract Credentials

After setup, the wallet data is in secure storage. We need to export it:

**Create this helper script:**
```typescript
// apps/client/__tests__/scripts/export-for-agent.ts
import { gridClientService } from '../../features/grid/services/gridClient';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('🔐 Exporting Grid credentials for AI agent testing...\n');
  
  // Get Grid account
  const account = await gridClientService.getAccount();
  if (!account) {
    console.error('❌ No Grid account found. Run setup first.');
    process.exit(1);
  }
  
  // Get session secrets (from secure storage)
  const sessionSecretsJson = await secureStorage.getItem('grid_session_secrets');
  if (!sessionSecretsJson) {
    console.error('❌ No session secrets found.');
    process.exit(1);
  }
  
  console.log('✅ Found Grid credentials');
  console.log('📍 Address:', account.address);
  
  // Create .test-secrets directory (gitignored)
  const secretsDir = path.join(process.cwd(), '.test-secrets');
  if (!fs.existsSync(secretsDir)) {
    fs.mkdirSync(secretsDir, { recursive: true });
  }
  
  // Write to files
  fs.writeFileSync(
    path.join(secretsDir, 'grid_session_secrets.json'),
    sessionSecretsJson
  );
  
  fs.writeFileSync(
    path.join(secretsDir, 'grid_account.json'),
    JSON.stringify(account, null, 2)
  );
  
  // Also output as env vars for Cursor
  console.log('\n📋 For Cursor Environment Variables:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\nAdd these to Cursor settings or .env:\n');
  
  const sessionSecretsBase64 = Buffer.from(sessionSecretsJson).toString('base64');
  const accountBase64 = Buffer.from(JSON.stringify(account)).toString('base64');
  
  console.log(`TEST_GRID_SESSION_SECRETS=${sessionSecretsBase64}`);
  console.log(`TEST_GRID_ACCOUNT=${accountBase64}`);
  console.log(`TEST_GRID_API_KEY=<your-grid-api-key>`);
  console.log(`EXPO_PUBLIC_GRID_API_KEY=<your-grid-api-key>`);
  console.log(`EXPO_PUBLIC_GRID_ENV=mainnet`);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n✅ Credentials exported to .test-secrets/');
  console.log('⚠️  Keep these safe! They control your test wallet.\n');
}

main();
```

**Run it:**
```bash
bun apps/client/__tests__/scripts/export-for-agent.ts
```

#### Step 3: Fund the Wallet

Send to the address shown:
- **0.1 SOL** for transaction fees
- **5 USDC** for test payments

#### Step 4: Provide to AI Agent

**Option A - Copy files:**
```bash
# Show me the contents (I'll store them securely)
cat apps/client/.test-secrets/grid_session_secrets.json
cat apps/client/.test-secrets/grid_account.json
```

**Option B - Set env vars in Cursor:**
1. Open Cursor Settings
2. Find environment variables section
3. Paste the base64 strings from script output

**Option C - Create .env file:**
```bash
# Create apps/client/.env.test (I can read this)
cat > apps/client/.env.test << 'EOF'
TEST_GRID_SESSION_SECRETS=<base64-from-export-script>
TEST_GRID_ACCOUNT=<base64-from-export-script>
TEST_GRID_API_KEY=<your-api-key>
EXPO_PUBLIC_GRID_API_KEY=<your-api-key>
EXPO_PUBLIC_GRID_ENV=mainnet
TEST_NETWORK=mainnet
EOF
```

---

### Phase 2: I Set Up Test Adapter

Once you provide credentials, I'll:

1. **Create file-based storage adapter** that works in Node:
```typescript
// __tests__/utils/test-storage.ts
export const testStorage = {
  async getItem(key: string): Promise<string | null> {
    // Read from .test-secrets/ or decode from env vars
    if (process.env[`TEST_${key.toUpperCase()}`]) {
      return Buffer.from(
        process.env[`TEST_${key.toUpperCase()}`], 
        'base64'
      ).toString('utf-8');
    }
    
    const filePath = path.join(__dirname, '../../.test-secrets', `${key}.json`);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
    
    return null;
  }
};
```

2. **Modify Grid client for tests** to use test storage

3. **Run the tests** and report results

---

## What I Need From You (Checklist)

### Minimum Requirements:

- [ ] **Grid API Key** 
  - Get from: https://grid.squads.xyz/
  - Needed for: Grid SDK initialization
  - Can be: Public API key (read-only is fine)

- [ ] **Grid Session Secrets** (JSON)
  - Contains: Encrypted keypair for signing
  - Security: Keep private, used for tx signing
  - Format: `{"encryptedPrivateKey": "...", "publicKey": "..."}`

- [ ] **Grid Account Data** (JSON)
  - Contains: Wallet address, authentication data
  - Security: Less sensitive (address is public)
  - Format: `{"address": "...", "authentication": {...}}`

- [ ] **Funded Wallet**
  - Amount: 0.1 SOL + 5 USDC
  - Network: Mainnet
  - Purpose: Make real x402 payments

### How to Provide:

**Easiest:** Run the export script I provided above, then:

```bash
# Show me these (I'll handle securely):
cat apps/client/.test-secrets/grid_session_secrets.json
cat apps/client/.test-secrets/grid_account.json

# And tell me your Grid API key
echo "Grid API Key: <your-key>"
```

**Alternative:** Set environment variables in Cursor settings (if you know how)

---

## What Happens After You Provide Credentials

1. **I'll create test storage adapter** (~5 min)
2. **I'll run the tests** using Node
3. **I'll report results:**
   - ✅ Ephemeral wallet creation
   - ✅ Funding from Grid wallet
   - ✅ x402 payment execution
   - ✅ Sweep back to Grid
   - 📊 Transaction signatures
   - 💰 Final wallet balance

4. **I can re-run anytime** you want to test x402

---

## Security Considerations

### What's Safe to Share:
- ✅ Grid API key (can be public/read-only)
- ✅ Wallet address (public on blockchain anyway)
- ✅ Grid account data (contains address + metadata)

### What's Sensitive:
- ⚠️ Session secrets (used for transaction signing)
- ⚠️ If compromised: Someone could sign txs from your test wallet
- ⚠️ Mitigation: Only fund test wallet with small amounts (~$20)

### Best Practices:
- ✅ Use dedicated test wallet (not personal funds)
- ✅ Keep balance low (~$20 max)
- ✅ Rotate test wallet every 3-6 months
- ✅ Store in `.test-secrets/` (gitignored)
- ✅ Can revoke by creating new wallet anytime

---

## Summary

**What I need:**
1. Grid session secrets (JSON)
2. Grid account data (JSON)  
3. Grid API key (string)
4. Funded wallet (0.1 SOL + 5 USDC)

**How to give it to me:**
1. Run the export script I provided
2. Copy/paste the JSON files
3. Tell me your Grid API key

**What I'll do:**
1. Set up test storage adapter
2. Run x402 payment tests
3. Report results with tx signatures
4. Can re-run anytime

**Time to set up:** ~15 minutes for you, ~10 minutes for me

---

## Ready to Start?

Let me know when you have:
1. ✅ Grid wallet created (or want help creating)
2. ✅ Wallet funded (0.1 SOL + 5 USDC)
3. ✅ Credentials exported (using script above)

Then just paste the credentials and I'll get the tests running!
