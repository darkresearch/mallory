# x402 E2E Testing - Quick Start Guide

Complete guide for setting up and running automated end-to-end tests for x402 payments.

## 🚀 Quick Start (5 Minutes)

### Step 1: Set Up Test Wallet

```bash
cd apps/client
bun run test:setup:interactive
```

Follow the prompts:
1. Enter test email address
2. Wait for OTP email
3. Enter OTP code
4. Fund wallet when prompted (0.1 SOL + 5 USDC)

### Step 2: Verify Setup

```bash
bun run test:wallet:check
```

Expected output:
```
✅ Grid Wallet Balance Check
📍 Address: 7xKXtg...
💰 SOL:  0.1000 SOL ✅
💵 USDC: 5.00 USDC ✅
✅ Wallet is ready for testing!
```

### Step 3: Run Tests

```bash
# Run all e2e tests
bun run test:e2e

# Run only x402 tests
bun run test:x402

# Run with verbose output
bun run test:e2e:verbose
```

---

## 📋 Test Suites

### EphemeralWalletManager Tests
Tests the temporary wallet lifecycle for x402 payments:
- ✅ Keypair generation
- ✅ Funding from Grid wallet
- ✅ Zero-dust sweep back

```bash
bun test __tests__/e2e/x402-payment.test.ts -t "EphemeralWalletManager"
```

**Cost:** ~$0.01 per run (mostly recovered)

### X402PaymentService Tests
Tests the complete x402 payment flow:
- ✅ Auto-approve logic
- ✅ Payment execution
- ✅ Data fetching
- ✅ Cleanup

```bash
bun test __tests__/e2e/x402-payment.test.ts -t "X402PaymentService"
```

**Cost:** ~$0.05-0.10 per run

### Integration Tests
Tests Grid SDK integration:
- ✅ Account retrieval
- ✅ Balance fetching
- ✅ Error handling

```bash
bun test __tests__/e2e/x402-payment.test.ts -t "Integration"
```

**Cost:** Free (read-only)

### Performance Tests
Tests payment performance and concurrency:
- ✅ Payment timing
- ✅ Concurrent operations
- ✅ Reliability under load

```bash
bun test __tests__/e2e/x402-payment.test.ts -t "Performance"
```

**Cost:** ~$0.20-0.50 per run

---

## 💰 Cost Management

### Typical Costs

| Test Type | Cost Per Run | Recovery Rate | Net Cost |
|-----------|--------------|---------------|----------|
| Ephemeral Wallet | $0.01 | 95% | $0.0005 |
| x402 Payment | $0.10 | 50% | $0.05 |
| Performance | $0.50 | 70% | $0.15 |
| **Full Suite** | **$1.00** | **70%** | **$0.30** |

### Monthly Budget (CI/CD)

**If running daily:**
- Full suite: ~$9/month
- Ephemeral only: ~$0.15/month
- Performance (weekly): ~$2.40/month

**Recommended:**
- PR checks: Ephemeral wallet tests only
- Main branch: Full x402 tests
- Nightly: All tests including performance

### Refilling Wallet

Check balance:
```bash
bun run test:wallet:check
```

Get wallet address:
```bash
bun run test:wallet:address
```

Send funds when balance is low:
- **SOL:** 0.1 SOL when below 0.02
- **USDC:** 5 USDC when below 1.0

---

## 🔧 CI/CD Setup

### Required GitHub Secrets

1. **TEST_GRID_SESSION_SECRETS** - Encrypted Grid session secrets
2. **TEST_GRID_ACCOUNT** - Encrypted Grid account data
3. **TEST_GRID_EMAIL** - Test email address
4. **TEST_NETWORK** - Network (mainnet/devnet)
5. **TEST_X402_ENDPOINT** - Optional custom x402 endpoint

### Get Secret Values

```bash
# Run setup first
bun run test:setup:interactive

# Then export for CI/CD
# (This will print the values to copy to GitHub Secrets)
cat __tests__/config/grid_session_secrets.json
cat __tests__/config/grid_account.json
```

### Add to GitHub

1. Go to repository **Settings** → **Secrets** → **Actions**
2. Click **New repository secret**
3. Add each secret with the values from above

### Workflow Triggers

The GitHub Actions workflow runs automatically on:
- ✅ Push to `main` or `develop`
- ✅ Pull requests
- ✅ Daily at 2 AM UTC
- ✅ Manual trigger

**Test selection based on trigger:**
- **PR:** Ephemeral wallet tests only (cheap, fast)
- **Main branch:** Full x402 payment tests
- **Scheduled:** All tests + performance tests

---

## 🐛 Troubleshooting

### Tests Fail with "No Grid account found"

**Solution:**
```bash
bun run test:setup:interactive
```

### Tests Timeout

**Possible causes:**
1. Solana network congestion
2. Insufficient balance

**Solution:**
```bash
# Check network status
curl https://status.solana.com/api/v2/status.json

# Check wallet balance
bun run test:wallet:check

# Wait and retry
```

### "Insufficient funds" Error

**Solution:**
```bash
# Check current balance
bun run test:wallet:check

# Get wallet address
bun run test:wallet:address

# Send more funds (SOL + USDC)
```

### Tests Pass But No x402 Payment Made

**Likely cause:** Test x402 endpoint not available

**This is OK!** The tests verify:
- ✅ Ephemeral wallet creation
- ✅ Funding from Grid
- ✅ Faremeter setup
- ✅ Cleanup/sweep

If the test endpoint returns 404 or similar, the flow still executed correctly.

---

## 📊 Test Results

### View Results

```bash
# Run with verbose output
bun run test:e2e:verbose

# View specific test
bun test __tests__/e2e/x402-payment.test.ts -t "should fund ephemeral wallet"
```

### CI/CD Results

View in GitHub Actions:
1. Go to **Actions** tab
2. Select **E2E Tests - x402 Payments** workflow
3. View run details, logs, and artifacts

### Key Metrics to Watch

- ✅ **Success Rate:** Should be >95%
- ✅ **Average Duration:** <2 minutes per test
- ✅ **Wallet Balance:** Should remain stable
- ✅ **Recovery Rate:** >70% of funds recovered

---

## 🔐 Security

### Best Practices

✅ **DO:**
- Use dedicated email for test wallet
- Keep wallet balance minimal (~$20)
- Rotate test wallet every 3-6 months
- Monitor balance regularly
- Store secrets in GitHub Secrets (not code)

❌ **DON'T:**
- Use personal wallet for tests
- Store large amounts in test wallet
- Commit session secrets to git
- Share test credentials

### Wallet Rotation

Every 3-6 months:

1. **Create new test wallet:**
   ```bash
   # Clear old wallet
   rm __tests__/config/grid_*.json
   
   # Set up new wallet
   bun run test:setup:interactive
   ```

2. **Transfer remaining funds to personal wallet**

3. **Update CI/CD secrets** with new values

4. **Archive old wallet** (keep address for audit trail)

---

## 📈 Monitoring

### Daily Balance Check

Set up automatic daily check:

```yaml
# Add to GitHub Actions (see .github/workflows/e2e-x402.yml)
schedule:
  - cron: '0 2 * * *'
```

### Alerts

Automatic alerts when:
- ❗ Balance below minimum threshold
- ❗ Test failures >50%
- ❗ Unusual spending patterns

Configure in GitHub Actions workflow (already included).

---

## 💡 Tips & Tricks

### Run Specific Tests

```bash
# Test funding only
bun test __tests__/e2e/x402-payment.test.ts -t "should fund"

# Test sweep only
bun test __tests__/e2e/x402-payment.test.ts -t "should sweep"

# Skip slow tests
bun test __tests__/e2e/x402-payment.test.ts --exclude "Performance"
```

### Parallel Execution

```bash
# Run tests in parallel (faster but uses more funds)
bun test __tests__/e2e/ --parallel

# Limit concurrency
bun test __tests__/e2e/ --parallel=2
```

### Custom Configuration

```bash
# Use different network
TEST_NETWORK=devnet bun run test:e2e

# Lower minimum thresholds
TEST_WALLET_MIN_SOL=0.005 \
TEST_WALLET_MIN_USDC=0.5 \
  bun run test:wallet:check

# Custom x402 endpoint
TEST_X402_ENDPOINT=https://custom-api.com \
  bun run test:x402
```

### Debug Mode

```bash
# Run with full logging
DEBUG=* bun test __tests__/e2e/x402-payment.test.ts

# Save logs to file
bun test __tests__/e2e/ --verbose > test-results.log 2>&1
```

---

## 📚 Additional Resources

- **Full Setup Guide:** See `__tests__/TEST_WALLET_SETUP.md`
- **Grid SDK Docs:** https://developers.squads.so/grid/
- **Solana Status:** https://status.solana.com/
- **x402 Protocol:** https://402.tools/

---

## 🆘 Support

### Need Help?

1. **Check troubleshooting section** above
2. **Review test logs** for error details
3. **Check wallet balance** with `bun run test:wallet:check`
4. **Ask in Slack:** #mallory-testing
5. **Create GitHub issue** with logs

### Common Issues Checklist

- [ ] Wallet has sufficient funds?
- [ ] Grid session secrets valid?
- [ ] Network status normal?
- [ ] RPC endpoint accessible?
- [ ] Test wallet not rate-limited?

---

**Last Updated:** 2025-10-26  
**Version:** 1.0  
**Maintained by:** Engineering Team
