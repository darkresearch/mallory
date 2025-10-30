# Feature Request: Add Native Solana Wallet Support

## 📝 Issue Summary
Add support for native Solana wallets (Phantom, Solflare, Backpack, etc.) to complement the existing Grid embedded wallet integration, giving users flexibility to connect their existing Solana wallets.

## 🎯 Motivation
- **Existing crypto users** can connect wallets they already use with funds and transaction history
- **Lower barrier** for users who prefer self-custody wallets like Phantom
- **Expand use cases** for DApp interactions requiring standard wallet connections
- **Maintain flexibility** - Keep Grid as default for new users, support power users with native wallets

## 🔍 Current State
- ✅ Grid embedded wallet via `@sqds/grid`
- ✅ Solana infrastructure (`@solana/web3.js`, `@solana/spl-token`)
- ✅ Basic RPC connection and transaction infrastructure
- ❌ No native wallet adapter integration
- ❌ No wallet selection UI
- ❌ No multi-wallet management

## 💡 Proposed Solution

### Dependencies to Add
```json
{
  "@solana/wallet-adapter-base": "^0.9.23",
  "@solana/wallet-adapter-react-native": "^0.3.0",
  "@solana-mobile/wallet-adapter-mobile": "^2.1.3",
  "@solana/wallet-adapter-phantom": "^0.9.24",
  "@solana/wallet-adapter-solflare": "^0.6.28"
}
```

### Implementation Phases

#### Phase 1: Foundation (1-2 days)
- [ ] Install wallet adapter dependencies
- [ ] Create wallet type interfaces (Grid vs Native)
- [ ] Update WalletContext for multiple wallet types
- [ ] Add wallet selection to settings

#### Phase 2: Native Wallet Integration (2-3 days)
- [ ] Implement mobile wallet adapter
- [ ] Build wallet connection UI
- [ ] Add Phantom wallet support
- [ ] Add Solflare wallet support
- [ ] Implement transaction signing for native wallets

#### Phase 3: Unified Experience (1-2 days)
- [ ] Create unified wallet interface
- [ ] Build wallet switcher component
- [ ] Update SendModal for both wallet types
- [ ] Update holdings display

#### Phase 4: Testing & Polish (1-2 days)
- [ ] Unit tests for wallet adapters
- [ ] Integration tests for wallet switching
- [ ] E2E tests for native wallet flows
- [ ] Documentation updates

## 🏗️ Architecture

### Unified Wallet Interface
```typescript
interface WalletAdapter {
  type: 'grid' | 'phantom' | 'solflare' | 'backpack';
  address: string;
  connected: boolean;
  
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  signTransaction(tx: Transaction): Promise<Transaction>;
  signMessage(message: Uint8Array): Promise<Uint8Array>;
}
```

### File Structure
```
apps/client/features/wallet/
├── adapters/
│   ├── grid-adapter.ts          # Grid wallet adapter
│   ├── native-adapter.ts        # Native wallet adapter
│   └── wallet-interface.ts      # Common interface
├── components/
│   ├── WalletSelector.tsx       # Wallet type chooser
│   ├── NativeWalletConnect.tsx  # Native connection flow
│   └── WalletSwitcher.tsx       # Toggle wallets
└── services/
    ├── wallet-factory.ts        # Wallet instance factory
    └── transaction-signer.ts    # Unified signing API
```

## 🎨 User Flow
```
Wallet Screen
    ↓
┌─────────────────────────┐
│ Choose Wallet Type      │
│ • Grid (Recommended)    │
│   - Email-based         │
│   - No app needed       │
│                         │
│ • Phantom Wallet        │
│   - Self-custody        │
│   - App required        │
│                         │
│ • Solflare Wallet       │
└─────────────────────────┘
```

## 🔐 Security Considerations
- ✅ Never store private keys (all wallets non-custodial)
- ✅ Transaction verification UI before signing
- ✅ Explicit user approval for connections
- ✅ Secure HTTPS/WSS communications
- ✅ Proper session cleanup on logout

## 📊 Success Criteria
- [ ] Users can connect Phantom wallet on mobile
- [ ] Users can connect Solflare wallet on mobile
- [ ] Seamless switching between Grid and native wallets
- [ ] Transaction signing works with both types
- [ ] Holdings display correctly for native wallets
- [ ] Token transfers work with native wallets
- [ ] All existing Grid functionality intact
- [ ] Test coverage >80%
- [ ] Complete documentation

## 🚀 Platform Support

### Mobile (iOS/Android)
- Use `@solana-mobile/wallet-adapter-mobile`
- Deep linking for wallet app communication
- Wallet app installation prompts
- WalletConnect for web-based wallets

### Web
- Browser extension wallet support
- Multiple simultaneous connections
- Wallet detection and availability checks

## 📈 Impact
- **User Base:** Opens app to existing crypto users
- **Flexibility:** Maintains Grid for newbies, adds native for power users
- **Ecosystem:** Better integration with broader Solana ecosystem
- **Complexity:** Medium (6-9 days estimated)

## 🔮 Future Enhancements
- Multi-wallet portfolio view (combined holdings)
- Hardware wallet support (Ledger)
- Wallet import/export
- Advanced features (staking, NFTs)
- Cross-wallet transaction batching

## 📚 References
- [Solana Wallet Adapter](https://github.com/solana-labs/wallet-adapter)
- [Solana Mobile Wallet Adapter](https://github.com/solana-mobile/mobile-wallet-adapter)
- [Phantom Integration Guide](https://docs.phantom.app/developer-powertools/mobile-integrations)
- [Grid Documentation](https://developers.squads.so)

## 💭 Open Questions
1. Start with just Phantom and Solflare, or support all major wallets?
2. Default wallet type for new users?
3. Allow multiple native wallet connections simultaneously?
4. Wallet migration strategy (Grid ↔ Native)?
5. Support importing Grid wallet keys to native wallets?

---

**Labels:** `enhancement`, `wallet`, `solana`, `good-first-issue`
**Priority:** Medium-High  
**Estimated Effort:** 6-9 days  
**Impact:** High - Significantly expands addressable user base
