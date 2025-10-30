---
name: Add Native Solana Wallet Support
about: Feature request to add support for native Solana wallets (Phantom, Solflare, etc.)
title: '[FEATURE] Add Native Solana Wallet Support'
labels: enhancement, wallet, solana
assignees: ''
---

## 🎯 Feature Request: Native Solana Wallet Support

### Summary
Add support for native Solana wallets (Phantom, Solflare, Backpack, etc.) to complement the existing Grid embedded wallet integration. This would give users the flexibility to connect their existing Solana wallets or use the embedded Grid wallet.

### Motivation
Currently, Mallory exclusively uses Grid's embedded smart contract wallets, which is great for onboarding new users. However, many crypto users already have existing Solana wallets with funds, NFTs, and established transaction history. Adding native wallet support would:

1. **Lower friction for existing crypto users** - Allow users to connect wallets they already use
2. **Increase accessibility** - Support users who prefer self-custody wallets like Phantom
3. **Expand use cases** - Enable DApp interactions that require standard wallet connections
4. **Maintain flexibility** - Keep Grid as the default for new users while supporting power users

### Current State
- ✅ Grid embedded wallet integration (via `@sqds/grid`)
- ✅ Solana dependencies installed (`@solana/web3.js`, `@solana/spl-token`)
- ✅ Basic Solana RPC connection infrastructure
- ✅ Transaction signing infrastructure (currently Grid-only)
- ❌ No native wallet adapter integration
- ❌ No wallet selection UI
- ❌ No multi-wallet management

### Proposed Solution

#### 1. Add Solana Wallet Adapter Dependencies
```bash
# Core wallet adapter packages
@solana/wallet-adapter-base
@solana/wallet-adapter-react
@solana/wallet-adapter-react-native

# Mobile-specific adapters
@solana-mobile/wallet-adapter-mobile

# Popular wallet adapters
@solana/wallet-adapter-phantom
@solana/wallet-adapter-solflare
@solana/wallet-adapter-backpack
```

#### 2. Architecture Changes

**WalletContext Enhancement:**
- Add wallet type selection (Grid vs Native)
- Support multiple wallet connections
- Unified interface for both wallet types

**New Components:**
- `WalletSelector.tsx` - UI for choosing wallet provider
- `NativeWalletConnect.tsx` - Native wallet connection flow
- `WalletSwitcher.tsx` - Toggle between connected wallets

**Service Layer:**
- Extract common wallet interface
- Implement adapters for both Grid and native wallets
- Unified transaction signing API

#### 3. User Experience Flow

```
┌─────────────────────────────────────┐
│   User Opens Wallet Screen          │
└───────────────┬─────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│   Wallet Type Selection              │
│   ┌─────────────────────────────┐   │
│   │ 🔐 Grid Wallet (Recommended)│   │
│   │    • Email-based            │   │
│   │    • No app required        │   │
│   └─────────────────────────────┘   │
│                                      │
│   ┌─────────────────────────────┐   │
│   │ 👻 Phantom Wallet           │   │
│   │    • Self-custody           │   │
│   │    • Mobile app required    │   │
│   └─────────────────────────────┘   │
│                                      │
│   ┌─────────────────────────────┐   │
│   │ 🌐 Solflare Wallet          │   │
│   └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

#### 4. Technical Implementation

**Phase 1: Foundation (1-2 days)**
- [ ] Install wallet adapter dependencies
- [ ] Create wallet type enum and interfaces
- [ ] Update WalletContext to support multiple wallet types
- [ ] Add wallet selection to settings

**Phase 2: Native Wallet Integration (2-3 days)**
- [ ] Implement mobile wallet adapter integration
- [ ] Build wallet connection UI components
- [ ] Add Phantom wallet support
- [ ] Add Solflare wallet support
- [ ] Implement transaction signing for native wallets

**Phase 3: Unified Experience (1-2 days)**
- [ ] Create unified wallet interface
- [ ] Build wallet switcher component
- [ ] Update SendModal to support both wallet types
- [ ] Update holdings display for native wallets

**Phase 4: Testing & Polish (1-2 days)**
- [ ] Unit tests for wallet adapters
- [ ] Integration tests for wallet switching
- [ ] E2E tests for native wallet flows
- [ ] Documentation updates

### Implementation Details

#### File Structure
```
apps/client/
├── features/
│   └── wallet/
│       ├── adapters/
│       │   ├── grid-adapter.ts      # Grid wallet adapter
│       │   ├── native-adapter.ts    # Native wallet adapter
│       │   └── wallet-interface.ts  # Common interface
│       ├── components/
│       │   ├── WalletSelector.tsx
│       │   ├── NativeWalletConnect.tsx
│       │   └── WalletSwitcher.tsx
│       └── services/
│           ├── wallet-factory.ts    # Factory for wallet instances
│           └── transaction-signer.ts # Unified signing
```

#### Code Example: Unified Wallet Interface
```typescript
// wallet-interface.ts
export interface WalletAdapter {
  type: 'grid' | 'phantom' | 'solflare' | 'backpack';
  address: string;
  connected: boolean;
  
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  signTransaction(transaction: Transaction): Promise<Transaction>;
  signAllTransactions(transactions: Transaction[]): Promise<Transaction[]>;
  signMessage(message: Uint8Array): Promise<Uint8Array>;
}

// grid-adapter.ts
export class GridWalletAdapter implements WalletAdapter {
  type = 'grid' as const;
  // ... Grid-specific implementation
}

// native-adapter.ts
export class NativeWalletAdapter implements WalletAdapter {
  type: 'phantom' | 'solflare' | 'backpack';
  // ... Native wallet implementation using @solana/wallet-adapter
}
```

#### Enhanced WalletContext
```typescript
interface WalletContextType {
  // Existing Grid wallet state
  gridWallet: GridWalletAdapter | null;
  
  // New native wallet state
  nativeWallet: NativeWalletAdapter | null;
  
  // Active wallet
  activeWallet: WalletAdapter | null;
  
  // Wallet management
  selectWallet: (type: 'grid' | 'native') => void;
  connectNativeWallet: (walletName: string) => Promise<void>;
  disconnectWallet: () => Promise<void>;
  
  // Unified interface
  signTransaction: (tx: Transaction) => Promise<Transaction>;
}
```

### Platform Considerations

#### Mobile (iOS/Android)
- Use `@solana-mobile/wallet-adapter-mobile` for native wallet connections
- Implement deep linking for wallet app communication
- Handle wallet app installation prompts
- Support WalletConnect for web-based wallets

#### Web
- Use `@solana/wallet-adapter-react` for browser extension wallets
- Support multiple browser extensions simultaneously
- Implement wallet detection and availability checks

### Security Considerations
1. **Never store private keys** - All wallets are non-custodial
2. **Transaction verification** - Show clear transaction details before signing
3. **Connection permissions** - Explicit user approval for wallet connections
4. **Secure communication** - HTTPS/WSS for all wallet communications
5. **Session management** - Proper cleanup of wallet connections on logout

### User Settings & Preferences
- Default wallet type selection
- Remember last used wallet
- Quick wallet switching
- Multiple wallet management (advanced users)

### Documentation Requirements
- Update README with wallet options
- Add wallet setup guide for native wallets
- Create troubleshooting guide for wallet connections
- Document wallet switching workflows

### Testing Strategy
```bash
# Unit tests
apps/client/__tests__/unit/
├── adapters/
│   ├── GridAdapter.test.ts
│   ├── NativeAdapter.test.ts
│   └── WalletFactory.test.ts

# Integration tests
apps/client/__tests__/integration/
├── wallet-switching.test.ts
├── native-wallet-connection.test.ts
└── unified-transaction-signing.test.ts

# E2E tests
apps/client/__tests__/e2e/
├── phantom-wallet-flow.test.ts
└── wallet-type-selection.test.ts
```

### Dependencies
```json
{
  "dependencies": {
    "@solana/wallet-adapter-base": "^0.9.23",
    "@solana/wallet-adapter-react": "^0.15.35",
    "@solana/wallet-adapter-react-native": "^0.3.0",
    "@solana-mobile/wallet-adapter-mobile": "^2.1.3",
    "@solana/wallet-adapter-phantom": "^0.9.24",
    "@solana/wallet-adapter-solflare": "^0.6.28",
    "@solana/wallet-adapter-backpack": "^0.1.15"
  }
}
```

### Success Criteria
- [ ] Users can connect Phantom wallet on mobile
- [ ] Users can connect Solflare wallet on mobile
- [ ] Users can switch between Grid and native wallets seamlessly
- [ ] Transaction signing works with both wallet types
- [ ] Holdings display correctly for native wallets
- [ ] Token transfers work with native wallets
- [ ] All existing Grid wallet functionality remains intact
- [ ] Comprehensive test coverage (>80%)
- [ ] Documentation is complete and clear

### Alternative Approaches Considered

#### 1. Grid-Only (Current State)
**Pros:** Simpler, better onboarding for new users
**Cons:** Excludes existing crypto users, less flexibility

#### 2. Native-Only
**Pros:** Familiar to crypto users, standard approach
**Cons:** Higher barrier to entry, more complex UX for newcomers

#### 3. Hybrid Approach (Recommended)
**Pros:** Best of both worlds, maximum flexibility
**Cons:** More complex implementation, larger codebase

### Future Enhancements
- Multi-wallet portfolio view (combined holdings)
- Hardware wallet support (Ledger)
- Wallet import/export functionality
- Advanced wallet features (staking, NFTs)
- Cross-wallet transaction batching

### References
- [Solana Wallet Adapter](https://github.com/solana-labs/wallet-adapter)
- [Solana Mobile Wallet Adapter](https://github.com/solana-mobile/mobile-wallet-adapter)
- [Phantom Wallet Integration Guide](https://docs.phantom.app/developer-powertools/mobile-integrations)
- [Grid Documentation](https://developers.squads.so)

### Additional Context
This feature request aligns with Mallory's goal of being an opinionated yet flexible crypto x AI chat app. By supporting both embedded and native wallets, we can serve both new users (via Grid) and experienced crypto users (via native wallets) without compromising on either experience.

### Related Issues
- N/A (Initial feature request)

### Questions for Discussion
1. Should we support all major Solana wallets or start with just Phantom and Solflare?
2. What should be the default wallet type for new users?
3. Should we allow connecting multiple native wallets simultaneously?
4. How should we handle wallet migration (Grid → Native or vice versa)?
5. Should we support importing Grid wallet keys to native wallets?

---

**Priority:** Medium-High
**Complexity:** Medium
**Estimated Effort:** 6-9 days
**Impact:** High (significantly expands user base)
