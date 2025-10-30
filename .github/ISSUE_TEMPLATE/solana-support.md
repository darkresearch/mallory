---
name: Enhanced Solana Support
about: Add comprehensive Solana blockchain integration
title: '[FEATURE] Add comprehensive Solana support'
labels: ['enhancement', 'solana', 'blockchain']
assignees: ''
---

## 🎯 Objective

Add comprehensive Solana blockchain support to Mallory, building upon the existing basic integration to provide a full-featured Solana wallet experience with DeFi capabilities.

## 📋 Current State

Mallory currently has:
- ✅ Basic Solana wallet service (`apps/client/features/wallet/services/solana.ts`)
- ✅ Grid wallet integration with Solana support
- ✅ Birdeye API integration for Solana market data
- ✅ @solana/web3.js and @solana/spl-token dependencies
- ✅ Basic send token functionality via Grid
- ⚠️ Several TODO items in the Solana service (transaction signing, token balance fetching)

## 🚀 Proposed Enhancements

### 1. Complete Wallet Functionality

#### Token Management
- [ ] Implement `getTokenBalances()` to fetch all SPL token balances
  - Use `getParsedTokenAccountsByOwner` from @solana/web3.js
  - Include token metadata (name, symbol, decimals)
  - Display token icons using metadata URI
- [ ] Add support for NFT detection and display
  - Fetch NFTs from the wallet using Metaplex standards
  - Display NFT collections and individual NFTs
- [ ] Implement token account management
  - Create associated token accounts when needed
  - Close empty token accounts to reclaim SOL

#### Transaction Features
- [ ] Complete transaction signing implementation
  - Integrate with Grid's signing capabilities
  - Support both SOL and SPL token transfers
  - Add transaction fee estimation
- [ ] Add transaction history
  - Fetch recent transactions using `getConfirmedSignaturesForAddress2`
  - Parse and display transaction details
  - Show transaction status (confirmed, failed, pending)
- [ ] Implement multi-signature support (if using Grid smart wallets)

### 2. DeFi Integration

#### DEX Integration
- [ ] Add Jupiter Aggregator integration for token swaps
  - Best price routing across Solana DEXs
  - Slippage protection
  - Price impact warnings
- [ ] Implement swap UI in the wallet
  - Token selection with search
  - Price quotes and routing display
  - Transaction confirmation flow

#### Staking
- [ ] Add SOL staking support
  - List available validators with APY
  - Stake/unstake functionality
  - Show staking rewards and history
- [ ] Support liquid staking tokens (mSOL, stSOL, jitoSOL)

#### Portfolio Analytics
- [ ] Enhanced portfolio tracking
  - Total portfolio value in USD
  - 24h/7d/30d price changes
  - Token allocation breakdown
  - Historical performance charts
- [ ] Integrate Helius or Shyft API for better data
  - Faster transaction parsing
  - Better token metadata
  - DeFi position tracking (Lending, LPs, etc.)

### 3. User Experience Improvements

#### Wallet UI
- [ ] Create dedicated Solana wallet screen
  - Token list with balances and values
  - Send/Receive/Swap action buttons
  - Transaction history
- [ ] Add QR code generation for receiving
- [ ] Implement address book for frequent recipients
- [ ] Add network selector (mainnet/devnet/testnet)

#### AI Chat Integration
- [ ] Add Solana-specific AI tools
  - `getWalletBalance` - Check SOL and token balances
  - `getTokenPrice` - Get current token prices
  - `swapTokens` - Execute token swaps via Jupiter
  - `stakeSOL` - Stake SOL with validators
  - `getTransactionHistory` - Fetch recent transactions
- [ ] Enable natural language wallet interactions
  - "How much SOL do I have?"
  - "Send 1 SOL to [address]"
  - "Swap 10 USDC to SOL"

### 4. Developer Experience

#### Testing
- [ ] Add comprehensive tests for Solana service
  - Unit tests for wallet functions
  - Integration tests with devnet
  - E2E tests for send/receive flows
- [ ] Add mock Solana connection for testing
- [ ] Create test utilities for Solana transactions

#### Documentation
- [ ] Document Solana wallet setup process
- [ ] Add API documentation for Solana endpoints
- [ ] Create tutorials for common operations
  - Setting up wallet
  - Sending tokens
  - Using DEX features
- [ ] Add troubleshooting guide

#### Configuration
- [ ] Add Solana-specific environment variables
  - RPC endpoint configuration (Helius, Quicknode, etc.)
  - Commitment level settings
  - Network selection (mainnet/devnet/testnet)
- [ ] Support custom RPC endpoints for better performance

### 5. Backend API Enhancements

#### Server-side Solana Support
- [ ] Add Solana endpoints to backend API
  - `GET /api/solana/balance/:address` - Get wallet balance
  - `GET /api/solana/tokens/:address` - Get token balances
  - `GET /api/solana/transactions/:address` - Get transaction history
  - `POST /api/solana/swap` - Execute swaps with session secret
- [ ] Integrate Jupiter API on backend for better swap routing
- [ ] Add transaction monitoring and webhooks
- [ ] Implement rate limiting and caching for RPC calls

#### Data Enrichment
- [ ] Enhance Birdeye integration
  - Token price history
  - Trading volume data
  - Market trends and analytics
- [ ] Add alternative data sources
  - CoinGecko for pricing
  - Helius for transactions
  - Metaplex for NFT metadata

### 6. Security Enhancements

- [ ] Implement transaction simulation before signing
  - Preview balance changes
  - Detect malicious transactions
  - Show all account interactions
- [ ] Add spending limits via Grid smart wallets
- [ ] Implement session-based approvals for recurring transactions
- [ ] Add security warnings for high-value transactions

## 🎨 UI/UX Mockups

Consider these screens:
1. **Wallet Home**: Token list with total portfolio value
2. **Send Screen**: Recipient input, amount, token selector
3. **Swap Screen**: Token pair selector, amount inputs, swap button
4. **Transaction History**: List of recent transactions with details
5. **Staking Screen**: Validator list, stake/unstake interface

## 📊 Success Metrics

- [ ] All TODOs in `solana.ts` are resolved
- [ ] Users can view all token balances with USD values
- [ ] Send/receive flows work seamlessly
- [ ] Swap integration provides competitive rates
- [ ] Transaction history is accurate and complete
- [ ] AI can answer Solana wallet queries
- [ ] Test coverage > 80% for Solana features

## 🔗 Related Resources

- [Solana Web3.js Docs](https://solana-labs.github.io/solana-web3.js/)
- [Jupiter Aggregator](https://docs.jup.ag/)
- [Birdeye API Docs](https://docs.birdeye.so/)
- [Grid SDK Docs](https://developers.squads.so)
- [Metaplex Docs](https://docs.metaplex.com/)
- [Helius Docs](https://docs.helius.dev/)

## 🏷️ Labels

- `enhancement`
- `solana`
- `blockchain`
- `wallet`
- `defi`

## 💡 Additional Notes

This is a comprehensive enhancement that can be broken down into smaller, incremental PRs. Suggested implementation order:

1. **Phase 1**: Complete basic wallet functionality (token balances, transaction history)
2. **Phase 2**: Add DEX integration for swaps
3. **Phase 3**: Implement staking features
4. **Phase 4**: Enhance AI chat integration
5. **Phase 5**: Add advanced features (NFTs, multi-sig, etc.)

Each phase should include tests, documentation, and UI updates.
