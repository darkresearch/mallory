# Solana Wallet Support - Issue Documentation Summary

This document provides an overview of the Solana wallet support issue documentation created for the Mallory project.

## 📁 Files Created

### 1. `.github/ISSUE_TEMPLATE/feature-solana-wallet-support.md` (315 lines)
**Most comprehensive technical specification**

**Contents:**
- Full technical architecture and design
- Detailed implementation plan with code examples
- Security considerations and best practices
- Complete testing strategy
- File structure and organization
- Dependencies with version numbers
- Success criteria and metrics
- Future enhancement roadmap
- Open questions for discussion

**Best for:**
- GitHub Issue template (via web interface)
- Technical reference during implementation
- Architecture planning discussions

---

### 2. `ISSUE_SOLANA_WALLET_SUPPORT.md` (172 lines)
**Medium-length version with visual diagrams**

**Contents:**
- Clear summary and motivation
- Current state vs. proposed solution
- Visual user flow diagram
- Implementation phases with checklists
- Architecture overview with code snippets
- Platform-specific considerations
- Success criteria
- Impact assessment
- References and resources

**Best for:**
- Quick reference document
- Sharing with stakeholders
- Project planning meetings
- Developer onboarding to the feature

---

### 3. `.github/ISSUE_TEMPLATE/solana-wallet-github-issue.md` (125 lines)
**Copy-paste ready GitHub issue format**

**Contents:**
- Standard GitHub issue structure (problem/solution/alternatives)
- Implementation checklist by phase
- Essential technical details
- File structure
- Security considerations
- Success metrics
- Open questions

**Best for:**
- Direct copy-paste into GitHub Issues
- Quick issue creation
- Balance of detail and brevity

---

### 4. `.github/ISSUE_TEMPLATE/README.md`
**Guide for using the issue templates**

**Contents:**
- Overview of all templates
- When to use each template
- How to use them (web interface, copy-paste, reference)
- Instructions for creating new templates

---

## 🎯 Quick Start Guide

### To Create a GitHub Issue:

**Option A - Via GitHub Web Interface:**
1. Go to https://github.com/darkresearch/mallory/issues/new/choose
2. Click "Add Native Solana Wallet Support" template
3. Review and submit

**Option B - Manual Copy-Paste:**
1. Open `.github/ISSUE_TEMPLATE/solana-wallet-github-issue.md`
2. Copy contents
3. Go to https://github.com/darkresearch/mallory/issues/new
4. Paste and submit

**Option C - Reference During Development:**
1. Use `ISSUE_SOLANA_WALLET_SUPPORT.md` for quick reference
2. Use `.github/ISSUE_TEMPLATE/feature-solana-wallet-support.md` for detailed specs

---

## 📋 Implementation Summary

The proposed Solana wallet support feature includes:

### Core Features:
✅ Support for Phantom wallet
✅ Support for Solflare wallet  
✅ Unified wallet interface (Grid + Native)
✅ Seamless wallet switching
✅ Transaction signing for all wallet types
✅ Holdings display for native wallets

### Technical Approach:
- **Adapter Pattern** - Unified interface for Grid and native wallets
- **Mobile-First** - Using `@solana-mobile/wallet-adapter-mobile`
- **Non-Breaking** - Preserves all existing Grid functionality
- **Security-First** - All wallets remain non-custodial

### Timeline:
- **Phase 1:** Foundation (1-2 days)
- **Phase 2:** Native Integration (2-3 days)
- **Phase 3:** UI/UX (1-2 days)
- **Phase 4:** Testing & Docs (1-2 days)
- **Total:** 6-9 days estimated

---

## 🎨 User Experience

```
Current State (Grid Only):
User → Email OTP → Grid Wallet → Send/Receive

Proposed State (Hybrid):
User → Choose Wallet Type
  ├── Grid Wallet (Email OTP) → Send/Receive
  └── Native Wallet (Phantom/Solflare) → Send/Receive
```

---

## 🔑 Key Benefits

1. **Expands User Base** - Existing crypto users can use their wallets
2. **Maintains Simplicity** - Grid remains default for new users
3. **Increases Flexibility** - Power users get self-custody options
4. **Ecosystem Integration** - Better integration with Solana DApps

---

## 📊 Success Metrics

- ✅ Phantom wallet connection working
- ✅ Solflare wallet connection working
- ✅ Wallet switching without issues
- ✅ All features work with native wallets
- ✅ Test coverage >80%
- ✅ Zero breaking changes to Grid functionality

---

## 🔐 Security

All proposed solutions maintain:
- Non-custodial architecture
- No private key storage
- Transaction verification UI
- Explicit user approval for connections
- Secure communication (HTTPS/WSS)
- Proper session management

---

## 📚 Dependencies to Add

```json
{
  "@solana/wallet-adapter-base": "^0.9.23",
  "@solana/wallet-adapter-react-native": "^0.3.0",
  "@solana-mobile/wallet-adapter-mobile": "^2.1.3",
  "@solana/wallet-adapter-phantom": "^0.9.24",
  "@solana/wallet-adapter-solflare": "^0.6.28"
}
```

---

## 🏗️ Architecture

### New File Structure:
```
apps/client/features/wallet/
├── adapters/
│   ├── grid-adapter.ts          # Wraps existing Grid code
│   ├── native-adapter.ts        # Native wallet integration
│   └── wallet-interface.ts      # Common interface
├── components/
│   ├── WalletSelector.tsx       # Choose wallet type
│   ├── NativeWalletConnect.tsx  # Native connection flow
│   └── WalletSwitcher.tsx       # Toggle between wallets
└── services/
    └── wallet-factory.ts        # Create wallet instances
```

### Unified Interface:
```typescript
interface WalletAdapter {
  type: 'grid' | 'phantom' | 'solflare' | 'backpack';
  address: string;
  connected: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  signTransaction(tx: Transaction): Promise<Transaction>;
}
```

---

## 💭 Open Questions

1. Should we support all major Solana wallets initially or start with Phantom + Solflare?
2. What should be the default wallet type for new users?
3. Allow multiple native wallets connected simultaneously?
4. Wallet migration strategy (Grid ↔ Native)?
5. Support importing Grid wallet keys to native wallets?

---

## 📖 References

- [Solana Wallet Adapter](https://github.com/solana-labs/wallet-adapter)
- [Solana Mobile Wallet Adapter](https://github.com/solana-mobile/mobile-wallet-adapter)
- [Phantom Integration Guide](https://docs.phantom.app/developer-powertools/mobile-integrations)
- [Grid Documentation](https://developers.squads.so)
- [Mallory Repository](https://github.com/darkresearch/mallory)

---

## 📞 Contact

- **GitHub Issues:** https://github.com/darkresearch/mallory/issues
- **Discussions:** https://github.com/darkresearch/mallory/discussions
- **Email:** hello@darkresearch.ai

---

**Status:** 📝 Documentation Complete
**Next Step:** Create GitHub Issue and begin implementation
**Estimated Effort:** 6-9 days
**Impact:** High - Significantly expands addressable user base
