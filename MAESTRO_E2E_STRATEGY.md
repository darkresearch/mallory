# Maestro E2E Testing Strategy for Mallory

## Problem Statement

**Current tests are NOT true end-to-end:**
- ❌ They test service classes directly (no UI)
- ❌ They don't test the actual chat flow
- ❌ They don't verify UI state changes
- ❌ They can't catch UI/UX issues
- ❌ They don't test the full user journey

**What we actually need to test:**
1. User opens chat
2. User asks question that requires x402 payment
3. AI returns payment requirement
4. App shows payment prompt (or auto-approves)
5. Payment executes in background
6. Result displays in chat
7. Grid wallet balance updates correctly

**Current "e2e" tests are really integration tests** - they're valuable but incomplete.

---

## Why Maestro?

[Maestro](https://maestro.dev/) is perfect for Mallory because:

✅ **React Native + Expo Support** - Works with your stack
✅ **Real Device Testing** - iOS, Android, and web
✅ **Simple YAML Syntax** - Easy to write and maintain
✅ **Cloud Testing** - Can run in CI/CD
✅ **Visual Assertions** - Can check if UI elements appear
✅ **Network Mocking** - Can simulate x402 responses
✅ **Crypto-Friendly** - Can handle wallet operations

---

## Architecture: Two-Tier Testing Strategy

### Tier 1: Unit/Integration Tests (Current - Keep These!)
**What:** Test service layer directly
**Tools:** Bun test
**Cost:** $0.01-0.10 per run
**Speed:** Fast (30s-2min)
**Coverage:**
- ✅ Grid wallet operations
- ✅ Ephemeral wallet lifecycle
- ✅ Transaction signing
- ✅ Error handling

**Value:** Fast feedback on core logic

### Tier 2: True E2E Tests (New - Add Maestro)
**What:** Test complete user journey
**Tools:** Maestro
**Cost:** $0.05-0.20 per run
**Speed:** Slower (2-5min)
**Coverage:**
- ✅ Chat UI interaction
- ✅ x402 payment prompts
- ✅ Payment status updates
- ✅ Result display in chat
- ✅ Wallet balance updates
- ✅ Error messages to user

**Value:** Catch UI/UX issues and integration problems

---

## Maestro Test Flows

### Flow 1: Happy Path - x402 Auto-Approved Payment

```yaml
# apps/client/__tests__/maestro/x402-auto-approved.yaml
appId: com.darkresearch.mallory
---
# Setup: Login and navigate to chat
- launchApp
- tapOn: "Login"
- inputText: "${TEST_EMAIL}"
- tapOn: "Continue"
- inputText: "${TEST_PASSWORD}"
- tapOn: "Sign In"
- assertVisible: "Chat"

# Navigate to chat screen
- tapOn: "Chat"
- assertVisible: "Send message"

# Trigger x402 payment by asking question
- tapOn: "Send message"
- inputText: "Show me Nansen whale activity for 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1"
- tapOn: "Send"

# AI should respond with tool invocation
- assertVisible: 
    text: "Analyzing"
    timeout: 5000

# Payment should auto-execute (under threshold)
- assertVisible:
    text: "Payment processing"
    timeout: 10000
    
# Wait for payment to complete
- assertVisible:
    text: "Payment successful"
    timeout: 30000

# Check that results are displayed
- assertVisible:
    text: "Whale Activity"
    timeout: 5000

# Verify wallet balance decreased
- tapOn: "Wallet"
- assertVisible: "Balance"
- extendedWaitUntil:
    visible: 
      text: ".*USDC"
      regex: true
    timeout: 5000

# Take screenshot for manual verification
- takeScreenshot: "x402-auto-approved-complete"
```

### Flow 2: Manual Approval Required

```yaml
# apps/client/__tests__/maestro/x402-manual-approval.yaml
appId: com.darkresearch.mallory
---
- launchApp
- tapOn: "Login"
# ... login steps ...
- tapOn: "Chat"

# Ask expensive question (above auto-approve threshold)
- tapOn: "Send message"
- inputText: "Generate comprehensive DeFi report for last 30 days"
- tapOn: "Send"

# Wait for AI response
- assertVisible:
    text: "Analyzing"
    timeout: 5000

# Should see payment approval prompt
- assertVisible:
    text: "Payment Required"
    timeout: 10000

- assertVisible:
    text: "5.00 USDC"

- assertVisible: "Approve"
- assertVisible: "Decline"

# User approves payment
- tapOn: "Approve"

# Payment should execute
- assertVisible:
    text: "Processing payment"
    timeout: 5000

# Wait for completion
- assertVisible:
    text: "Payment successful"
    timeout: 45000

# Results should appear
- assertVisible:
    text: "Report"
    timeout: 5000

- takeScreenshot: "x402-manual-approved"
```

### Flow 3: Payment Failure Handling

```yaml
# apps/client/__tests__/maestro/x402-payment-failure.yaml
appId: com.darkresearch.mallory
---
- launchApp
# ... login ...

# Simulate insufficient funds by using test account with low balance
- tapOn: "Chat"
- inputText: "Show whale activity" # Triggers x402
- tapOn: "Send"

# Should detect insufficient funds
- assertVisible:
    text: "Insufficient funds"
    timeout: 15000

# Should show helpful error
- assertVisible:
    text: "Add funds"

# User can tap to go to wallet
- tapOn: "Add funds"
- assertVisible: "Wallet"
- assertVisible: "Receive"

- takeScreenshot: "x402-insufficient-funds"
```

### Flow 4: Network Error During Payment

```yaml
# apps/client/__tests__/maestro/x402-network-error.yaml
appId: com.darkresearch.mallory
---
- launchApp
# ... login ...

# Enable airplane mode to simulate network failure
- setAirplaneMode: true

- tapOn: "Chat"
- inputText: "Show whale activity"
- tapOn: "Send"

# Should show network error
- assertVisible:
    text: "Network error"
    timeout: 15000

- assertVisible:
    text: "Retry"

# Restore network
- setAirplaneMode: false

# Retry payment
- tapOn: "Retry"

# Should succeed this time
- assertVisible:
    text: "Payment successful"
    timeout: 30000

- takeScreenshot: "x402-network-recovery"
```

### Flow 5: Concurrent Payment Requests

```yaml
# apps/client/__tests__/maestro/x402-concurrent.yaml
appId: com.darkresearch.mallory
---
- launchApp
# ... login ...

- tapOn: "Chat"

# Send multiple questions quickly
- inputText: "Show whale activity for address A"
- tapOn: "Send"

- inputText: "Show whale activity for address B"
- tapOn: "Send"

- inputText: "Show whale activity for address C"
- tapOn: "Send"

# Should see multiple payment processing
- assertVisible:
    text: "Payment processing"
    timeout: 5000

# All should complete
- assertVisible:
    text: "3 payments completed"
    timeout: 60000

# All results should appear
- scroll

- assertVisible: "address A"
- assertVisible: "address B"  
- assertVisible: "address C"

- takeScreenshot: "x402-concurrent-complete"
```

### Flow 6: Full User Journey (Smoke Test)

```yaml
# apps/client/__tests__/maestro/full-user-journey.yaml
appId: com.darkresearch.mallory
---
# 1. Fresh app launch
- launchApp:
    clearState: true

# 2. Onboarding/Login
- tapOn: "Get Started"
- tapOn: "Login"
- inputText: "${TEST_EMAIL}"
- tapOn: "Continue"
- inputText: "${TEST_PASSWORD}"
- tapOn: "Sign In"

# 3. Check wallet (should have Grid wallet)
- tapOn: "Wallet"
- assertVisible: "Grid Wallet"
- assertVisible:
    text: ".*SOL"
    regex: true
- assertVisible:
    text: ".*USDC"
    regex: true
- takeScreenshot: "wallet-initial"

# 4. Start chat conversation
- tapOn: "Chat"
- tapOn: "Send message"
- inputText: "Hello, what can you help me with?"
- tapOn: "Send"
- assertVisible:
    text: ".*can help.*"
    regex: true
    timeout: 10000

# 5. Ask question requiring x402 payment
- inputText: "Show me whale activity for vitalik.eth"
- tapOn: "Send"

# 6. Wait for payment processing
- assertVisible:
    text: "Payment"
    timeout: 15000

# 7. Wait for results
- assertVisible:
    text: "Whale Activity"
    timeout: 45000

# 8. Check wallet balance decreased
- tapOn: "Wallet"
- takeScreenshot: "wallet-after-payment"

# 9. Verify transaction history
- tapOn: "Transactions"
- assertVisible: "x402 Payment"
- assertVisible:
    text: "0.0[5-9] USDC"
    regex: true

# 10. Return to chat and continue conversation
- tapOn: "Chat"
- assertVisible: "Whale Activity"
- inputText: "Can you summarize this?"
- tapOn: "Send"
- assertVisible:
    text: ".*summary.*"
    regex: true
    timeout: 15000

- takeScreenshot: "full-journey-complete"
```

---

## Setup & Configuration

### Installation

```bash
# Install Maestro CLI
curl -Ls "https://get.maestro.mobile.dev" | bash

# Or with brew
brew tap mobile-dev-io/tap
brew install maestro
```

### Project Structure

```
apps/client/
├── __tests__/
│   ├── maestro/
│   │   ├── flows/
│   │   │   ├── x402-auto-approved.yaml
│   │   │   ├── x402-manual-approval.yaml
│   │   │   ├── x402-payment-failure.yaml
│   │   │   ├── x402-network-error.yaml
│   │   │   ├── x402-concurrent.yaml
│   │   │   └── full-user-journey.yaml
│   │   ├── config/
│   │   │   ├── maestro.yaml           # Global config
│   │   │   └── test-data.yaml         # Test data
│   │   └── scripts/
│   │       ├── setup-maestro-env.sh   # Setup script
│   │       └── run-maestro-tests.sh   # Test runner
│   ├── e2e/                            # Keep existing integration tests
│   └── unit/                           # Unit tests
```

### Configuration File

```yaml
# apps/client/__tests__/maestro/config/maestro.yaml
# Global Maestro configuration for Mallory

# App configuration
appId: com.darkresearch.mallory
platform: 
  - ios
  - android

# Test environment
env:
  TEST_EMAIL: "test@mallory.dev"
  TEST_PASSWORD: "${MAESTRO_TEST_PASSWORD}"
  TEST_GRID_EMAIL: "${MAESTRO_GRID_EMAIL}"
  TEST_WALLET_ADDRESS: "${MAESTRO_WALLET_ADDRESS}"

# Network configuration
tags:
  - x402
  - payments
  - wallet

# Timeouts
timeout:
  default: 30000
  long: 60000

# Screenshots
screenshots:
  enabled: true
  path: "__tests__/maestro/screenshots"

# Video recording
recording:
  enabled: true
  path: "__tests__/maestro/recordings"
```

### Test Data

```yaml
# apps/client/__tests__/maestro/config/test-data.yaml
# Test data for Maestro flows

wallets:
  test_wallet_funded:
    address: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
    sol_balance: 0.1
    usdc_balance: 5.0
  
  test_wallet_low_balance:
    address: "5xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
    sol_balance: 0.001
    usdc_balance: 0.01

test_prompts:
  cheap_x402:
    - "Show whale activity for vitalik.eth"
    - "Get DeFi stats for 0x742d35..."
    - "Latest transactions for address..."
  
  expensive_x402:
    - "Generate 30-day DeFi report"
    - "Complete wallet analysis with historical data"
    - "Full smart money tracking report"

x402_endpoints:
  nansen: "https://api.nansen.ai/v1/x402"
  supermemory: "https://api.supermemory.ai/x402"
```

---

## Running Maestro Tests

### Local Testing

```bash
# Run single flow
maestro test apps/client/__tests__/maestro/flows/x402-auto-approved.yaml

# Run all x402 tests
maestro test apps/client/__tests__/maestro/flows/x402-*.yaml

# Run on specific device
maestro test --device "iPhone 15 Pro" x402-auto-approved.yaml

# Run with custom env vars
maestro test \
  --env TEST_EMAIL=test@example.com \
  --env MAESTRO_TEST_PASSWORD=secret123 \
  x402-auto-approved.yaml

# Run with video recording
maestro test --record x402-auto-approved.yaml
```

### Running in CI/CD

```bash
# Use Maestro Cloud for CI/CD
maestro cloud \
  --apiKey $MAESTRO_API_KEY \
  --app apps/client/build/app-release.apk \
  --flow apps/client/__tests__/maestro/flows/
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/maestro-e2e.yml
name: Maestro E2E Tests

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]
  schedule:
    - cron: '0 4 * * *' # Daily at 4 AM

jobs:
  maestro-android:
    runs-on: ubuntu-latest
    timeout-minutes: 45
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
      
      - name: Install dependencies
        working-directory: apps/client
        run: bun install
      
      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'
      
      - name: Setup Android SDK
        uses: android-actions/setup-android@v3
      
      - name: Build Android APK
        working-directory: apps/client
        run: |
          expo prebuild --platform android
          cd android
          ./gradlew assembleRelease
      
      - name: Setup Maestro
        run: |
          curl -Ls "https://get.maestro.mobile.dev" | bash
          echo "$HOME/.maestro/bin" >> $GITHUB_PATH
      
      - name: Run Maestro Tests
        env:
          MAESTRO_TEST_PASSWORD: ${{ secrets.TEST_PASSWORD }}
          MAESTRO_GRID_EMAIL: ${{ secrets.TEST_GRID_EMAIL }}
          MAESTRO_WALLET_ADDRESS: ${{ secrets.TEST_GRID_ADDRESS }}
        working-directory: apps/client
        run: |
          maestro test \
            --format junit \
            --output __tests__/maestro/results/junit.xml \
            __tests__/maestro/flows/*.yaml
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: maestro-test-results
          path: |
            apps/client/__tests__/maestro/screenshots/
            apps/client/__tests__/maestro/recordings/
            apps/client/__tests__/maestro/results/
      
      - name: Upload to Maestro Cloud
        if: github.ref == 'refs/heads/main'
        env:
          MAESTRO_API_KEY: ${{ secrets.MAESTRO_API_KEY }}
        run: |
          maestro cloud \
            --app apps/client/android/app/build/outputs/apk/release/app-release.apk \
            --flow apps/client/__tests__/maestro/flows/ \
            --name "Mallory E2E - ${{ github.sha }}"

  maestro-ios:
    runs-on: macos-latest
    timeout-minutes: 60
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
      
      - name: Install dependencies
        working-directory: apps/client
        run: bun install
      
      - name: Setup Xcode
        uses: maxim-lobanov/setup-xcode@v1
        with:
          xcode-version: latest-stable
      
      - name: Build iOS App
        working-directory: apps/client
        run: |
          expo prebuild --platform ios
          cd ios
          xcodebuild -workspace Mallory.xcworkspace \
            -scheme Mallory \
            -configuration Release \
            -sdk iphonesimulator \
            -derivedDataPath build
      
      - name: Setup Maestro
        run: |
          brew tap mobile-dev-io/tap
          brew install maestro
      
      - name: Start iOS Simulator
        run: |
          xcrun simctl boot "iPhone 15 Pro" || true
      
      - name: Run Maestro Tests
        env:
          MAESTRO_TEST_PASSWORD: ${{ secrets.TEST_PASSWORD }}
          MAESTRO_GRID_EMAIL: ${{ secrets.TEST_GRID_EMAIL }}
        working-directory: apps/client
        run: |
          maestro test \
            --format junit \
            --output __tests__/maestro/results/junit.xml \
            __tests__/maestro/flows/*.yaml
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: maestro-ios-results
          path: apps/client/__tests__/maestro/
```

---

## Hybrid Testing Strategy

### When to Use Each

| Test Type | Tool | When | Cost | Speed |
|-----------|------|------|------|-------|
| **Unit Tests** | Bun | Always (pre-commit) | Free | 1-5s |
| **Integration Tests** | Bun | PR checks | $0.01-0.10 | 30s-2min |
| **UI E2E (Maestro)** | Maestro | Main branch | $0.05-0.20 | 2-5min |
| **Full E2E** | Maestro | Nightly/Release | $0.20-0.50 | 5-10min |

### Recommended CI/CD Flow

```
Pull Request:
├─ Unit tests (fast)
├─ Integration tests (core logic)
└─ Maestro smoke test (critical path only)

Main Branch:
├─ All unit tests
├─ All integration tests
└─ Maestro full suite

Nightly:
├─ All tests
├─ Maestro stress tests
└─ Performance tests

Release:
├─ Full regression (all tests)
├─ Maestro on all platforms
└─ Manual QA sign-off
```

---

## Cost Comparison

### Current Integration Tests
- **Per run:** $0.01-0.10
- **Monthly (daily):** ~$15
- **Coverage:** 70% (no UI)

### With Maestro E2E
- **Per run:** $0.05-0.20
- **Monthly (selective):** ~$25
- **Coverage:** 95% (includes UI)

### Combined Strategy
- **Integration tests:** Run on every PR (cheap, fast)
- **Maestro E2E:** Run on main + nightly (comprehensive)
- **Total monthly:** ~$30-40
- **Coverage:** 95%+ with UI confidence

**ROI:** Catches UI bugs before production, saves hours of manual testing

---

## Benefits of Maestro

### vs Manual Testing
- ✅ **Faster:** 5min vs 30min per test
- ✅ **Consistent:** Same steps every time
- ✅ **Parallel:** Run multiple devices
- ✅ **Regression:** Catch old bugs
- ✅ **Cost:** $0.20 vs $15 (engineer time)

### vs Current Tests
- ✅ **Real UI:** Tests actual user experience
- ✅ **Visual bugs:** Catches layout issues
- ✅ **UX issues:** Finds confusing flows
- ✅ **Integration:** Tests full stack
- ✅ **Device-specific:** Find iOS/Android bugs

### vs Other Tools (Detox, Appium)
- ✅ **Simpler:** YAML vs JavaScript
- ✅ **Faster:** Less setup overhead
- ✅ **Cloud:** Built-in CI/CD support
- ✅ **Maintenance:** Less brittle tests
- ✅ **Learning curve:** Easier for team

---

## Next Steps

### Phase 1: Proof of Concept (1-2 hours)
1. Install Maestro CLI
2. Create one simple flow (login + chat)
3. Run locally on simulator
4. Verify it works

### Phase 2: Core Flows (4-6 hours)
1. x402 auto-approved payment
2. Manual approval flow
3. Error handling
4. Full user journey

### Phase 3: CI/CD Integration (2-3 hours)
1. Set up GitHub Actions
2. Configure Maestro Cloud
3. Add to PR checks
4. Set up nightly runs

### Phase 4: Expand Coverage (ongoing)
1. Add edge cases
2. Add performance tests
3. Add stress tests
4. Monitor and improve

**Total setup time:** ~10-15 hours
**Ongoing maintenance:** ~1-2 hours/week

---

## Recommendation

**Keep both types of tests:**

1. **Integration tests (current)** for:
   - Fast feedback
   - Core logic validation
   - Grid/wallet operations
   - PR checks (cheap)

2. **Maestro E2E** for:
   - UI validation
   - Full user journeys
   - Visual regression
   - Main branch + nightly (comprehensive)

**This gives you:**
- ✅ Fast PR feedback (integration)
- ✅ High confidence (Maestro)
- ✅ Cost effective (~$30-40/month)
- ✅ Comprehensive coverage (95%+)

Would you like me to:
1. Create the Maestro flows?
2. Set up the CI/CD integration?
3. Write a quick start guide for Maestro?
