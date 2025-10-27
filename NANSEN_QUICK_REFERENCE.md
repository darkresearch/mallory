# Nansen API Quick Reference

Quick reference for all 21 Nansen endpoints available through X402 micropayments.

---

## Smart Money Endpoints

### 1. Smart Money Netflows
```typescript
Tool: nansenSmartMoneyNetflows
Chains: ethereum, solana
Query: "What are smart money net flows on Ethereum?"
Data: Net flow metrics (24h, 7d, 30d)
```

### 2. Smart Money Holdings
```typescript
Tool: nansenSmartMoneyHoldings
Chains: ethereum, solana
Query: "What tokens do smart money wallets hold?"
Data: Current holdings by top wallets
```

### 3. Smart Money DEX Trades
```typescript
Tool: nansenSmartMoneyDexTrades
Chains: ethereum, solana
Query: "Recent DEX trades by smart money in last 24h"
Data: All DEX trades by smart money traders
```

### 4. Smart Money Jupiter DCAs
```typescript
Tool: nansenSmartMoneyJupiterDcas
Chains: solana (Jupiter only)
Query: "Show me Jupiter DCA orders by smart money"
Data: DCA orders on Solana
```

---

## Profiler Endpoints (Address-based)

### 5. Historical Balances
```typescript
Tool: nansenHistoricalBalances
Chains: ethereum, solana, polygon
Query: "Show me vitalik.eth's token balances on Jan 1, 2024"
Data: Historical holdings over time
```

### 6. Current Balance
```typescript
Tool: nansenCurrentBalance
Chains: ethereum, solana
Query: "What are vitalik.eth's current token balances?"
Data: Real-time token holdings
```

### 7. Transactions
```typescript
Tool: nansenTransactions
Chains: ethereum, solana
Query: "Show transaction history for vitalik.eth"
Data: List of all transactions
```

### 8. Counterparties
```typescript
Tool: nansenCounterparties
Chains: ethereum, solana
Query: "Who does vitalik.eth interact with most?"
Data: Top interaction partners
```

### 9. Related Wallets
```typescript
Tool: nansenRelatedWallets
Chains: ethereum, solana
Query: "Show me wallets related to vitalik.eth"
Data: Wallet clusters and connections
```

### 10. PnL Summary
```typescript
Tool: nansenPnlSummary
Chains: ethereum, solana
Query: "What is vitalik.eth's trading profit/loss summary?"
Data: PnL summary with top 5 trades
```

### 11. PnL Full History
```typescript
Tool: nansenPnl
Chains: ethereum, solana
Query: "Show all past trades for vitalik.eth"
Data: Complete trading history
```

### 12. Address Labels
```typescript
Tool: nansenLabels
Chains: ethereum, solana
Query: "What labels does vitalik.eth have?"
Data: Address classification and labels
```

---

## Token God Mode Endpoints (Token-based)

### 13. Token Screener
```typescript
Tool: nansenTokenScreener
Chains: ethereum, solana
Query: "Screen tokens on Ethereum with analytics"
Data: Token screening with real-time analytics
```

### 14. Flow Intelligence
```typescript
Tool: nansenFlowIntelligence
Chains: ethereum, solana
Query: "What is the flow intelligence for UNI token?"
Data: Token flow summary
```

### 15. Token Holders
```typescript
Tool: nansenHolders
Chains: ethereum, solana
Query: "Who are the top holders of UNI token?"
Data: Top addresses holding the token
```

### 16. Token Flows
```typescript
Tool: nansenFlows
Chains: ethereum, solana
Query: "What are the inflows/outflows for UNI token?"
Data: Net flow data
```

### 17. Who Bought/Sold
```typescript
Tool: nansenWhoBoughtSold
Chains: ethereum, solana
Query: "Who recently bought or sold UNI token?"
Data: Recent buyers and sellers
```

### 18. Token DEX Trades
```typescript
Tool: nansenTokenDexTrades
Chains: ethereum, solana
Query: "Show me DEX trades for UNI token"
Data: All DEX trades
```

### 19. Token Transfers
```typescript
Tool: nansenTokenTransfers
Chains: ethereum, solana
Query: "Show me large transfers of UNI token"
Data: Top token transfers
```

### 20. Token Jupiter DCAs
```typescript
Tool: nansenTokenJupiterDcas
Chains: solana (Jupiter only)
Query: "Show Jupiter DCA orders for SOL token"
Data: DCA orders for specific token
```

### 21. PnL Leaderboard
```typescript
Tool: nansenPnlLeaderboard
Chains: ethereum, solana
Query: "Who are the top traders of UNI token?"
Data: PnL rankings for token traders
```

---

## Portfolio Endpoint

### 22. DeFi Holdings
```typescript
Tool: nansenPortfolio
Chains: ethereum, solana
Query: "What are vitalik.eth's DeFi positions?"
Data: DeFi holdings, staking, LP positions
```

---

## Example Addresses for Testing

### Ethereum:
- `vitalik.eth` / `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045`
- `0x28c6c06298d514db089934071355e5743bf21d60` (Binance)

### Solana:
- `DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ6aDQLWK1` (Example wallet)

### Token Addresses:
- **UNI**: `0x1f9840a85d5af5bf1d1762f925bdaddc4201f984` (Ethereum)
- **SOL**: Native token on Solana

---

## Cost Structure

- **Per API call**: $0.001 USDC
- **Transaction fees**: ~$0.00001 SOL
- **Fund recovery**: ~90% of funded amount
- **Net cost per call**: ~$0.001

**Auto-approval threshold**: < $0.01 (all Nansen calls auto-approved)

---

## Testing Commands

```bash
# Run comprehensive test (all endpoints)
cd apps/client
bun run test:x402:nansen:all

# Run individual endpoint tests  
bun test __tests__/e2e/x402-nansen-smart-money-netflows.test.ts --timeout 300000
bun test __tests__/e2e/x402-nansen-smart-money-holdings.test.ts --timeout 300000

# Original test (historical balances)
bun run test:x402:nansen

# Refresh Grid session if expired
bun __tests__/scripts/refresh-grid-session.ts
```

---

## Tool Naming Convention

Pattern: `nansen[Category][Endpoint]`

**Examples**:
- `nansenSmartMoneyNetflows` - Smart Money category, Netflows endpoint
- `nansenCurrentBalance` - Profiler category, Current Balance endpoint
- `nansenTokenScreener` - Token God Mode category, Screener endpoint
- `nansenPortfolio` - Portfolio category, DeFi Holdings endpoint

---

## API Response Sizes (from testing)

**Small** (< 5 KB):
- Flow Intelligence: 651 bytes
- Token Flows: 2.25 KB
- Smart Money Jupiter DCAs: 1.50 KB

**Medium** (5-30 KB):
- Who Bought/Sold: 25.33 KB
- PnL Leaderboard: 6.24 KB

**Large** (30+ KB):
- Token Holders: 34.3 KB
- Token Transfers: 45.1 KB
- Token DEX Trades: 58.6 KB

---

## Notes

- All endpoints use POST method with JSON bodies
- All endpoints go through Corbits proxy: `https://nansen.api.corbits.dev`
- Payment is handled automatically via Faremeter
- Date ranges default to last 24 hours where applicable
- Multi-chain queries return combined results


