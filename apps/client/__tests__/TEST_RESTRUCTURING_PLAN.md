# Nansen Test Restructuring Plan

## Goal
Create one test file per Nansen endpoint for clean, modular testing.

## Current State
- 4 individual endpoint tests (netflows, holdings, dex-trades, historical-balances)
- 1 mega-test file with 18 endpoints mixed together
- Inconsistent naming (true-e2e vs smart-money-netflows)

## Target State
- ~21 individual endpoint test files
- Consistent naming: `x402-nansen-{endpoint-name}.test.ts`
- Shared test helper for DRY
- Easy to run individually or all together

## Implementation Steps

### 1. Create Shared Test Template
**File**: `__tests__/utils/nansen-test-template.ts`
- Reusable function: `testNansenEndpoint(config)`
- Config: `{ name, query, expectedToolName, urlFragment }`
- Returns: Standardized test result

### 2. Keep/Rename Existing Individual Tests
- ✅ Keep: `x402-nansen-smart-money-netflows.test.ts`
- ✅ Keep: `x402-nansen-smart-money-holdings.test.ts`
- ✅ Keep: `x402-nansen-smart-money-dex-trades.test.ts`
- 🔄 Rename: `x402-nansen-true-e2e.test.ts` → `x402-nansen-historical-balances.test.ts`

### 3. Extract from All-Endpoints Test
Create new files from `x402-nansen-all-endpoints.test.ts`:

**Smart Money:**
1. `x402-nansen-smart-money-jupiter-dcas.test.ts`

**Profiler:**
2. `x402-nansen-current-balance.test.ts`
3. `x402-nansen-transactions.test.ts`
4. `x402-nansen-counterparties.test.ts`
5. `x402-nansen-related-wallets.test.ts`
6. `x402-nansen-pnl-summary.test.ts`
7. `x402-nansen-pnl.test.ts`
8. `x402-nansen-labels.test.ts`

**Token God Mode:**
9. `x402-nansen-token-screener.test.ts`
10. `x402-nansen-flow-intelligence.test.ts`
11. `x402-nansen-holders.test.ts`
12. `x402-nansen-flows.test.ts`
13. `x402-nansen-who-bought-sold.test.ts`
14. `x402-nansen-token-dex-trades.test.ts`
15. `x402-nansen-token-transfers.test.ts`
16. `x402-nansen-token-jupiter-dcas.test.ts`
17. `x402-nansen-pnl-leaderboard.test.ts`
18. `x402-nansen-portfolio.test.ts`

### 4. Delete Old Files
- ❌ Delete: `x402-nansen-all-endpoints.test.ts` (replaced by individual files)
- ❌ Delete: `x402-full-flow.test.ts` (mock endpoint, not useful)
- ❌ Delete: `x402-complete.test.ts` (redundant with grid-payment.test.ts)

### 5. Create Convenience Script
**File**: `__tests__/scripts/run-all-nansen-tests.sh`
```bash
#!/bin/bash
bun test __tests__/e2e/x402-nansen-*.test.ts
```

## File Structure After
```
__tests__/
  e2e/
    x402-nansen-current-balance.test.ts
    x402-nansen-counterparties.test.ts
    x402-nansen-flow-intelligence.test.ts
    x402-nansen-flows.test.ts
    x402-nansen-historical-balances.test.ts (renamed)
    x402-nansen-holders.test.ts
    x402-nansen-labels.test.ts
    x402-nansen-pnl-leaderboard.test.ts
    x402-nansen-pnl-summary.test.ts
    x402-nansen-pnl.test.ts
    x402-nansen-portfolio.test.ts
    x402-nansen-related-wallets.test.ts
    x402-nansen-smart-money-dex-trades.test.ts
    x402-nansen-smart-money-holdings.test.ts
    x402-nansen-smart-money-jupiter-dcas.test.ts
    x402-nansen-smart-money-netflows.test.ts
    x402-nansen-token-dex-trades.test.ts
    x402-nansen-token-jupiter-dcas.test.ts
    x402-nansen-token-screener.test.ts
    x402-nansen-token-transfers.test.ts
    x402-nansen-transactions.test.ts
    x402-nansen-who-bought-sold.test.ts
    grid-payment.test.ts (keep - tests Grid fundamentals)
  utils/
    nansen-test-template.ts (new - DRY helper)
  scripts/
    run-all-nansen-tests.sh (new - convenience)
```

## Benefits
✅ One file per endpoint (clear responsibility)
✅ Easy to run individually
✅ Easy to see which endpoint failed
✅ Easy to add new endpoints
✅ Consistent naming convention
✅ DRY via shared template

