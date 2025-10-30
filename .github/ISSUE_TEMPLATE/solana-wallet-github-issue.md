<!-- This file can be copy-pasted directly into a GitHub issue -->

**Is your feature request related to a problem? Please describe.**
Currently, Mallory only supports Grid embedded wallets. While this is great for onboarding new users, many experienced crypto users already have existing Solana wallets (Phantom, Solflare, etc.) with funds, NFTs, and transaction history. They cannot use these wallets with Mallory.

**Describe the solution you'd like**
Add support for native Solana wallet connections alongside the existing Grid wallet integration. Users should be able to:
- Connect their existing Phantom or Solflare wallets
- Switch between Grid and native wallets
- Use all existing features (send, receive, view holdings) with native wallets
- Keep Grid as the recommended option for new users

**Describe alternatives you've considered**
1. **Grid-only** (current) - Simpler but excludes existing crypto users
2. **Native-only** - Familiar to crypto users but harder for newcomers
3. **Hybrid approach** (recommended) - Best of both worlds

**Technical Implementation**

Dependencies needed:
```json
{
  "@solana/wallet-adapter-base": "^0.9.23",
  "@solana/wallet-adapter-react-native": "^0.3.0",
  "@solana-mobile/wallet-adapter-mobile": "^2.1.3",
  "@solana/wallet-adapter-phantom": "^0.9.24",
  "@solana/wallet-adapter-solflare": "^0.6.28"
}
```

Implementation checklist:

**Phase 1: Foundation** (~1-2 days)
- [ ] Install wallet adapter dependencies
- [ ] Create `WalletAdapter` interface for unified wallet API
- [ ] Update `WalletContext` to support multiple wallet types
- [ ] Add wallet type selection enum (`'grid' | 'phantom' | 'solflare'`)

**Phase 2: Native Wallet Integration** (~2-3 days)
- [ ] Implement `GridWalletAdapter` wrapping existing Grid code
- [ ] Implement `NativeWalletAdapter` using `@solana-mobile/wallet-adapter-mobile`
- [ ] Create `WalletSelector` component for choosing wallet type
- [ ] Create `NativeWalletConnect` component for connection flow
- [ ] Implement transaction signing for native wallets
- [ ] Add Phantom wallet support
- [ ] Add Solflare wallet support

**Phase 3: UI Integration** (~1-2 days)
- [ ] Create `WalletSwitcher` component for toggling between wallets
- [ ] Update `SendModal` to work with both wallet types
- [ ] Update `WalletItem` to show wallet type badge
- [ ] Update holdings display to support native wallets
- [ ] Add wallet management screen

**Phase 4: Testing & Documentation** (~1-2 days)
- [ ] Unit tests for `GridWalletAdapter`
- [ ] Unit tests for `NativeWalletAdapter`
- [ ] Integration tests for wallet switching
- [ ] E2E test for Phantom connection flow
- [ ] Update README with wallet options
- [ ] Create wallet setup documentation
- [ ] Add troubleshooting guide

**Additional context**
This aligns with Mallory's vision of being both opinionated (Grid by default) and flexible (native wallets for power users). It would significantly expand the addressable user base without compromising the onboarding experience.

**File structure:**
```
apps/client/features/wallet/
├── adapters/
│   ├── grid-adapter.ts
│   ├── native-adapter.ts
│   └── wallet-interface.ts
├── components/
│   ├── WalletSelector.tsx
│   ├── NativeWalletConnect.tsx
│   └── WalletSwitcher.tsx
└── services/
    └── wallet-factory.ts
```

**Security considerations:**
- ✅ All wallets remain non-custodial
- ✅ Transaction verification UI before signing
- ✅ Explicit connection approval required
- ✅ Proper session cleanup on logout

**Success metrics:**
- Users can connect Phantom wallet
- Users can connect Solflare wallet  
- Seamless wallet switching
- All features work with native wallets
- Test coverage >80%

**Estimated effort:** 6-9 days
**Priority:** Medium-High
**Impact:** High - Opens app to existing crypto users

**Questions:**
1. Should we support all major Solana wallets initially or just Phantom + Solflare?
2. Should Grid remain the default for new users?
3. Allow multiple native wallets connected simultaneously?
