# Test Wallet Setup Guide

This guide walks through setting up a Grid wallet for automated e2e testing of x402 payments.

## Overview

The e2e tests need a funded Grid wallet to test the complete payment flow:
1. **Grid wallet** → Funds ephemeral wallets
2. **Ephemeral wallets** → Make x402 payments
3. **Sweep back** → Return funds to Grid wallet

## Prerequisites

- **Grid Account**: Email-based Grid wallet (created via app or test script)
- **Mainnet Funds**: 
  - **0.05-0.1 SOL** for transaction fees (~$10-20)
  - **2-5 USDC** for test payments
- **Environment Access**: Ability to set environment variables in CI/CD

---

## Setup Steps

### Step 1: Create Grid Wallet for Testing

#### Option A: Create via Test Script (Recommended for CI/CD)

```bash
# Run interactive setup script
bun run test:setup:interactive
```

This will:
1. Prompt for test email address
2. Create Grid account
3. Send OTP to email
4. Prompt for OTP code
5. Complete account setup
6. Save session secrets to secure storage
7. Display wallet address for funding

#### Option B: Use Existing Grid Wallet

If you already have a Grid wallet in the app:

```bash
# Export Grid credentials from app
bun run test:setup:export
```

This will extract the Grid account from your app's secure storage and set it up for testing.

### Step 2: Fund the Test Wallet

After setup, you'll see output like:

```
✅ Grid wallet created!
📍 Address: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU

⚠️  IMPORTANT: Fund this wallet with:
   - 0.1 SOL (for transaction fees)
   - 5 USDC (for x402 test payments)
```

**How to fund:**

1. **Send SOL** (using any Solana wallet):
   ```
   To: <your-grid-wallet-address>
   Amount: 0.1 SOL
   Network: Mainnet
   ```

2. **Send USDC** (using any Solana wallet):
   ```
   To: <your-grid-wallet-address>
   Token: USDC (EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)
   Amount: 5 USDC
   Network: Mainnet
   ```

3. **Verify balances**:
   ```bash
   bun run test:wallet:check
   ```

   Expected output:
   ```
   ✅ Grid Wallet Balance Check
   📍 Address: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
   💰 SOL Balance: 0.1000 SOL
   💵 USDC Balance: 5.00 USDC
   ✅ Wallet is ready for testing!
   ```

### Step 3: Configure Environment Variables

#### Local Development

Create `.env.test` file:

```bash
# Grid Test Wallet Configuration
TEST_NETWORK=mainnet
TEST_GRID_EMAIL=your-test-email@example.com

# Optional: Test-specific settings
TEST_X402_ENDPOINT=https://api.nansen.ai/v1/x402-test
TEST_WALLET_MIN_SOL=0.01
TEST_WALLET_MIN_USDC=1.0
```

#### CI/CD (GitHub Actions)

Add these secrets to your repository:

```yaml
# .github/workflows/e2e-tests.yml
env:
  TEST_NETWORK: mainnet
  TEST_GRID_EMAIL: ${{ secrets.TEST_GRID_EMAIL }}
  TEST_GRID_SESSION_SECRETS: ${{ secrets.TEST_GRID_SESSION_SECRETS }}
  TEST_GRID_ACCOUNT: ${{ secrets.TEST_GRID_ACCOUNT }}
```

**How to get secret values:**

```bash
# Export Grid credentials for CI/CD
bun run test:setup:export-ci

# This will output:
# Copy these to your CI/CD secrets:
# 
# TEST_GRID_SESSION_SECRETS=<encrypted-json>
# TEST_GRID_ACCOUNT=<encrypted-json>
```

---

## Running Tests

### Run All E2E Tests

```bash
# Run complete e2e test suite
bun test __tests__/e2e/

# Run with verbose output
bun test __tests__/e2e/ --verbose

# Run specific test file
bun test __tests__/e2e/x402-payment.test.ts
```

### Run Individual Test Suites

```bash
# Test ephemeral wallet management only
bun test __tests__/e2e/x402-payment.test.ts -t "EphemeralWalletManager"

# Test full x402 payment flow
bun test __tests__/e2e/x402-payment.test.ts -t "X402PaymentService"

# Performance tests
bun test __tests__/e2e/x402-payment.test.ts -t "Performance"
```

---

## Test Wallet Management

### Check Wallet Balance

```bash
# Check current balance
bun run test:wallet:check

# Sample output:
# 📍 Grid Wallet: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
# 💰 SOL: 0.0847 SOL ($18.34)
# 💵 USDC: 3.45 USDC
# ✅ Sufficient funds for testing
```

### Refill Test Wallet

```bash
# Get wallet address for refilling
bun run test:wallet:address

# Output:
# 📍 Grid Wallet Address: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
# 
# Send funds to this address:
# - SOL for transaction fees
# - USDC for x402 payments
```

### Export Funds (Cleanup)

```bash
# Withdraw all funds from test wallet to personal wallet
bun run test:wallet:withdraw <YOUR_WALLET_ADDRESS>

# This will:
# 1. Transfer all USDC to your address
# 2. Transfer remaining SOL (minus fees) to your address
# 3. Close token accounts to recover rent
```

---

## Understanding Test Costs

### Per Test Run Costs

**Ephemeral Wallet Tests:**
- Funding: ~$0.10 USDC + 0.002 SOL
- Sweep back: Recovers most funds (zero dust)
- **Net cost per test:** ~$0.005 (transaction fees only)

**Full x402 Payment Flow:**
- Funding: ~$0.05 USDC + 0.001 SOL
- x402 payment: Variable (depends on endpoint)
- Sweep back: Recovers remaining funds
- **Net cost per test:** ~$0.05-0.10 (payment + fees)

**Complete Test Suite (all tests):**
- **Total cost:** ~$0.50-1.00 per full run
- **Monthly cost** (if run daily): ~$15-30

### Recommended Wallet Balance

- **Minimum:** 0.05 SOL + 2 USDC
- **Recommended:** 0.1 SOL + 5 USDC
- **For CI/CD (monthly):** 0.5 SOL + 20 USDC

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests - x402 Payments

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    # Run daily at 2 AM UTC
    - cron: '0 2 * * *'

jobs:
  e2e-x402:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      
      - name: Install dependencies
        run: bun install
      
      - name: Setup test Grid wallet
        env:
          TEST_GRID_SESSION_SECRETS: ${{ secrets.TEST_GRID_SESSION_SECRETS }}
          TEST_GRID_ACCOUNT: ${{ secrets.TEST_GRID_ACCOUNT }}
        run: |
          # Restore Grid credentials from secrets
          bun run test:setup:restore
      
      - name: Check wallet balance
        run: bun run test:wallet:check
      
      - name: Run e2e tests
        env:
          TEST_NETWORK: mainnet
          TEST_GRID_EMAIL: ${{ secrets.TEST_GRID_EMAIL }}
        run: |
          bun test __tests__/e2e/x402-payment.test.ts
      
      - name: Check final balance
        if: always()
        run: bun run test:wallet:check
      
      - name: Alert on low balance
        if: failure()
        run: |
          bun run test:wallet:check-alert
          # Send notification if balance is too low
```

---

## Troubleshooting

### "No Grid account found in test environment"

**Cause:** Test wallet not set up correctly.

**Solution:**
```bash
bun run test:setup:interactive
```

### "Insufficient SOL balance"

**Cause:** Test wallet needs more SOL for transaction fees.

**Solution:**
```bash
# Check current balance
bun run test:wallet:check

# Send more SOL to the address shown
```

### "Insufficient USDC balance"

**Cause:** Test wallet needs more USDC for x402 payments.

**Solution:**
```bash
# Check current balance
bun run test:wallet:check

# Send more USDC to the address shown
```

### "Session secrets not found"

**Cause:** Grid session secrets not properly saved.

**Solution:**
```bash
# Re-run setup
bun run test:setup:interactive
```

### Tests timing out

**Cause:** Solana network congestion or insufficient priority fees.

**Solution:**
- Check Solana network status: https://status.solana.com/
- Increase test timeouts in `x402-payment.test.ts`
- Wait and retry

---

## Security Best Practices

### ⚠️ DO NOT:
- ❌ Store large amounts in test wallet (only what's needed)
- ❌ Use personal wallet for tests
- ❌ Commit session secrets to git
- ❌ Share test wallet credentials publicly

### ✅ DO:
- ✅ Use dedicated email for test wallet
- ✅ Store credentials in CI/CD secrets
- ✅ Monitor wallet balance regularly
- ✅ Set up alerts for low balance
- ✅ Rotate test wallet periodically (every 3-6 months)

---

## Monitoring & Alerts

### Set Up Balance Alerts

```bash
# Configure alert thresholds
bun run test:wallet:configure-alerts

# Set minimum thresholds:
# - SOL: 0.01 (for transaction fees)
# - USDC: 1.0 (for test payments)
```

### Daily Balance Report (CI/CD)

Add to GitHub Actions:

```yaml
- name: Daily wallet balance report
  if: github.event_name == 'schedule'
  run: |
    bun run test:wallet:report
```

---

## Advanced Configuration

### Custom Test Network (Devnet)

```bash
# Set up for devnet testing
TEST_NETWORK=devnet bun run test:setup:interactive

# Run tests on devnet
TEST_NETWORK=devnet bun test __tests__/e2e/
```

**Note:** Devnet doesn't support real x402 payments, so this is mainly for testing the funding/sweep flow.

### Custom x402 Endpoint

```bash
# Test against custom x402 endpoint
TEST_X402_ENDPOINT=https://your-api.com/x402 \
  bun test __tests__/e2e/x402-payment.test.ts
```

### Parallel Test Execution

```bash
# Run tests in parallel (faster but uses more funds)
bun test __tests__/e2e/ --parallel

# Limit parallelism
bun test __tests__/e2e/ --parallel=2
```

---

## Cost Optimization

### Reduce Test Costs

1. **Use smaller test amounts** (edit `TEST_CONFIG` in test file):
   ```typescript
   testUsdcAmount: '0.05',  // Minimum viable amount
   testSolAmount: '0.001',  // Minimum for fees
   ```

2. **Skip expensive tests in PR checks**:
   ```yaml
   # Only run full suite on main branch
   - name: Run quick tests
     if: github.ref != 'refs/heads/main'
     run: bun test __tests__/e2e/ -t "EphemeralWalletManager"
   ```

3. **Run full suite less frequently**:
   - PRs: Only ephemeral wallet tests
   - Main branch: Full suite
   - Nightly: Full suite with performance tests

---

## Questions?

- **Slack:** #mallory-testing
- **Email:** dev@darkresearch.xyz
- **Issues:** https://github.com/your-org/mallory/issues

---

**Last Updated:** 2025-10-26  
**Maintained by:** Engineering Team
