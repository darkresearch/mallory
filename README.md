# Mallory

> **Opinionated** React Native crypto x AI chat app boilerplate with embedded wallet support, conversational AI, and dynamic UI component injection

Mallory is a production-ready, full-stack mobile boilerplate for building AI-powered chat applications with native cryptocurrency wallet integration. Built for developers who want to ship fast without sacrificing quality or making endless architectural decisions.

## What Makes Mallory Different?

Mallory solves the hard problems for modern applications, combining the latest scaffolding in crypto, AI, and mobile:

- ✅ **Embedded wallets that actually work** - Grid integration with KYC flows, not just "install MetaMask"
- ✅ **Streaming AI that feels native** - Token-by-token updates, not janky text replacements
- ✅ **Dynamic UI components** - LLMs inject charts, citations, and custom elements inline
- ✅ **AI tool visualization** - Chain of thought shows when backend calls tools (search, data APIs, etc.)
- ✅ **x402 payment compatible** - Works with backends that implement autonomous payment protocol
- ✅ **Security by default** - Server-side Supabase access, proper token validation, RLS policies
- ✅ **Production-grade state management** - Real-time subscriptions, optimistic updates, error boundaries
- ✅ **Actually cross-platform** - Native iOS/Android + Web, not "mobile-first with web hacks"

**This is the boilerplate we built for [Dark's](https://darkresearch.ai) Scout**, our upcoming consumer finance app. Now it's yours.

---

## Quick Start

```bash
# Clone and install
git clone https://github.com/darkresearch/mallory.git
cd mallory
bun install

# Configure
cp .env.example .env
# Edit .env with your Supabase credentials

# Run web (no native setup needed)
bun run web

# Or run native (requires expo prebuild first)
bun expo prebuild
bun run ios      # or: bun run android
```

**Need a backend?** See [Backend Requirements](#backend-requirements) below.

---

## Why Mallory is Opinionated

Every dependency was selected for a reason:

### **Embedded Wallet Infrastructure: [Squads Grid](https://www.squads.so/grid)**
- Non-custodial Solana wallets managed via API
- No private key management complexity
- Built-in KYC/compliance flows
- Production-ready transaction signing
- **Why Grid?** An enterprise-grade embedded wallet solution that doesn't require you to become a custodian, and the only solution that forgoes vendor lock-in.

### **Backend-as-a-Service: [Supabase](https://supabase.com)**
- PostgreSQL database with automatic APIs
- Built-in authentication with Row Level Security (RLS)
- Realtime subscriptions for live chat updates
- Edge functions for serverless logic
- **Why Supabase?** Open-source, self-hostable, and replaces 5+ separate services

### **AI Streaming: [Vercel AI SDK](https://sdk.vercel.ai)**
- Framework-agnostic streaming chat (powered by [StreamdownRN](https://www.npmjs.com/package/streamdown-rn))
- Built-in React hooks (`useChat`, streaming state)
- Supports tool calling and dynamic UI
- Works with any LLM provider
- **Why Vercel AI SDK?** Best-in-class developer experience for streaming AI responses

### **Cross-Platform: [Expo](https://expo.dev)**
- Single codebase for iOS, Android, and Web
- Native performance with managed workflow
- Over-the-air updates
- Cloud builds (no need for Xcode/Android Studio)
- **Why Expo?** The modern way to build React Native apps

### **Markdown Rendering: [StreamdownRN](https://www.npmjs.com/package/streamdown-rn)**
- Mobile-compatible port of [Vercel's streamdown](https://github.com/vercel/ai/tree/main/packages/streamdown) (built by Dark)
- Streaming markdown parser for React Native
- Dynamic component injection from LLM responses
- Syntax highlighting, math equations, tables
- **Why StreamdownRN?** Vercel's streamdown is web-only. We ported it to React Native with native optimizations

### **x402 Payment Protocol (Backend Feature)**
When connected to an x402-enabled backend, Mallory visualizes autonomous AI payments:
- Backend implements [x402 protocol](https://x402.org) for micropayments
- AI agents pay for premium APIs (Nansen, Dune, etc.) automatically
- Client displays payment activity in Chain of Thought UI
- Uses Grid wallet for sub-cent USDC payments on Solana
- **Why x402?** Unlocks premium data sources without manual payment UX

**Note:** x402 implementation lives on the backend for security. Mallory provides the UI to display tool usage and payment activity.

## Features

✨ **AI Chat**
- Streaming responses with backend tool execution
- Chain of thought visualization (shows AI reasoning + tool calls)
- Dynamic component injection from LLM responses
- Context-aware conversations with history

🔐 **Authentication**
- Google OAuth (native + web)
- Supabase session management
- Automatic token refresh
- Row-level security

💰 **Embedded Wallet**
- Non-custodial Solana wallets via Grid
- Deposit, send, and balance tracking
- Real-time price updates
- Transaction history

🎨 **Dynamic UI**
- LLM-controllable component registry
- Type-safe component definitions
- Inline citations, code blocks, charts
- Extensible for custom components

🌐 **Cross-Platform**
- iOS (native)
- Android (native)
- Web (progressive web app)
- Shared codebase, platform-specific optimizations

## What's Included Out of the Box

Mallory ships with **production-ready implementations** of complex features:

### **Authentication System**
- Google OAuth with platform-specific flows (native on mobile, web redirect on desktop)
- Supabase session management with automatic refresh
- Protected routes with `AuthGate` component
- Reauth detection and recovery flows

### **Chat Interface**
- Streaming AI responses with token-by-token rendering
- Message persistence with conversation history
- Chain of thought visualization (shows backend tool execution)
- Tool call display with friendly names ("Exa Search", "Supermemory", etc.)
- Copy, share, and regenerate actions
- Smart scroll behavior (auto-scroll on new messages, preserve scroll on history load)

### **Wallet Features**
- Grid embedded wallet creation and verification
- Deposit modal with QR code and copy-to-clipboard
- Send flow with validation and confirmation
- Real-time balance updates via Supabase subscriptions
- Transaction history
- Price tracking for holdings

### **Dynamic Components**
- Powered by [streamdown-rn](https://www.npmjs.com/package/streamdown-rn) (Dark's React Native port of Vercel's streamdown)
- `<Citation>` - Inline source citations with links
- Syntax highlighting for 20+ languages  
- Math equation rendering (KaTeX)
- Markdown tables, lists, blockquotes
- **Extensible:** Add your own components to the registry

### **Tool & Payment Visualization**
- Chain of thought UI shows backend tool execution
- Tool display names mapping ("searchWeb" → "Exa Search")
- x402 payment activity display (when using compatible backend)
- No tool execution in client (security best practice)

### **Developer Experience**
- Full TypeScript coverage with strict mode
- Feature module architecture (easy to add/remove features)
- Bun for 3-10x faster installs
- Hot reload that actually works
- Component registry unit tests

## Architectural Principles

Mallory follows specific design principles that make it production-ready:

### **1. Server-Side Security**
- All Supabase access uses **service role keys on the backend**
- Client never gets direct database access (RLS as defense-in-depth only)
- API endpoints validate tokens and enforce authorization
- **Why?** Client-side security is an illusion; real security lives on the server

### **2. Streaming-First AI**
- All AI responses stream token-by-token
- UI updates in real-time as responses arrive
- Uses Vercel AI SDK's React hooks (`useChat`)
- **Why?** Streaming is table stakes for modern AI UX

### **3. Component Registry for Dynamic UI**
- LLMs can inject typed components into markdown responses
- `<Citation>`, `<PriceChart>`, `<TokenCard>`, etc.
- Type-safe with JSON schema validation
- **Why?** Text-only AI responses are limiting; dynamic UI unlocks new possibilities

### **4. Feature-Module Architecture**
- Each feature (`auth`, `chat`, `wallet`) is self-contained
- Features export clean service APIs
- Hooks encapsulate feature logic
- **Why?** Makes the codebase maintainable and testable

### **5. Mobile-First, Web-Compatible**
- Designed for native mobile performance
- Web is a first-class citizen (not an afterthought)
- Platform-specific optimizations where needed
- **Why?** Most crypto users are on mobile; distribution needs web

## Tech Stack

### Core Dependencies

| Category | Library | Version | Purpose |
|----------|---------|---------|---------|
| **Framework** | React Native | 0.81 | Cross-platform mobile framework |
| **Expo** | expo | ^54.0 | Managed React Native workflow |
| **Navigation** | expo-router | ~6.0 | File-based routing |
| **AI SDK** | ai (Vercel) | ^5.0 | Streaming AI responses |
| **AI Provider** | @ai-sdk/anthropic | ^2.0 | Claude integration |
| **Markdown** | [streamdown-rn](https://www.npmjs.com/package/streamdown-rn) | ^0.1.2 | React Native port of Vercel's streamdown |
| **Database** | @supabase/supabase-js | ^2.51 | Supabase client SDK |
| **Blockchain** | @solana/web3.js | ^1.98 | Solana blockchain interactions |
| **State** | React Context | Built-in | Global state management |
| **Styling** | StyleSheet API | Built-in | React Native styling |
| **Animation** | react-native-reanimated | ^4.1 | 60fps animations |

### Notable Choices

**Why Bun?** 3-10x faster than npm, native TypeScript support, workspace management.

**Why Context over Redux/Zustand?** Simpler API, built-in, sufficient for this scope. Upgrade if you need time-travel debugging.

**Why Expo Router?** Type-safe, file-based routing. Feels like Next.js for mobile.

**Why @ai-sdk over LangChain?** Lighter weight, better streaming support, framework-agnostic.

**Why streamdown-rn?** Vercel's [streamdown](https://github.com/vercel/ai/tree/main/packages/streamdown) is excellent but web-only. We ported it to React Native with optimizations for mobile rendering, touch interactions, and native clipboard support. Open sourced at [npmjs.com/package/streamdown-rn](https://www.npmjs.com/package/streamdown-rn).

## Getting Started

### Prerequisites

- Node.js 18+ or Bun (Bun recommended)
- iOS development: macOS with Xcode 14+
- Android development: Android Studio
- Expo CLI (optional, can use `bunx expo` instead)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/darkresearch/mallory.git
cd mallory
```

2. Install dependencies:
```bash
bun install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your configuration values (see Configuration section below).

4. **Generate native projects** (required for iOS/Android):
```bash
bun expo prebuild
```

This generates the `ios/` and `android/` folders with your app's branding from `app.config.js`.

5. Start the development server:
```bash
bun start
```

6. Run on your platform:
```bash
# Web (no prebuild needed)
bun run web

# iOS (requires step 4)
bun run ios

# Android (requires step 4)
bun run android
```

## Configuration

Mallory requires the following environment variables:

### Required

- `EXPO_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key (client-side key)
- `EXPO_PUBLIC_BACKEND_API_URL` - Your backend API endpoint (production only; dev uses localhost:3001)

### Optional (for full features)

- `EXPO_PUBLIC_WEB_OAUTH_REDIRECT_URL` - OAuth redirect URL for web-based Google login (defaults to http://localhost:8081)
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` - Google OAuth iOS Client ID (required for iOS native auth)
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` - Google OAuth Android Client ID (required for Android native auth)
- `EXPO_PUBLIC_SOLANA_RPC_URL` - Solana RPC endpoint for wallet features (defaults to mainnet-beta)
- `EXPO_PUBLIC_TERMS_URL` - Terms of Service URL (displayed on login screen if provided)
- `EXPO_PUBLIC_PRIVACY_URL` - Privacy Policy URL (displayed on login screen if provided)

See [.env.example](.env.example) for detailed configuration documentation.

### Branding Customization

Update `app.config.js` to customize your app:

- `name` - App display name
- `slug` - URL-friendly identifier
- `bundleIdentifier` / `package` - iOS/Android bundle identifiers
- `scheme` - Deep linking scheme
- Icons and splash screens in `assets/`

## Architecture

### Directory Structure

```
mallory/
├── app/                      # Expo Router pages
│   ├── (auth)/              # Authentication screens
│   └── (main)/              # Main app screens
├── components/              # Reusable components
│   ├── chat/               # Chat-specific components
│   ├── registry/           # Dynamic UI component registry
│   ├── ui/                 # Base UI components
│   └── wallet/             # Wallet components
├── contexts/               # React Context providers
├── features/               # Feature modules
│   ├── auth/              # Authentication logic
│   ├── chat/              # Chat functionality
│   ├── grid/              # Grid API integration
│   └── wallet/            # Wallet operations
├── hooks/                 # Custom React hooks
└── lib/                   # Utility libraries
```

### Key Architectural Patterns

#### **Component Registry System**
Dynamic, type-safe components that LLMs can inject into responses:

```typescript
// LLM outputs markdown with components
<Citation url="https://..." title="Research paper" />

// Registry validates and renders
<InlineCitation url="https://..." title="Research paper" />
```

See `components/registry/README.md` for the full component catalog.

#### **Feature Module Pattern**
Each feature is self-contained with clean boundaries:

```
features/wallet/
├── index.ts              # Public API
├── hooks/                # React hooks
└── services/             # Business logic
    ├── solana.ts         # Blockchain interactions
    ├── grid-api.ts       # Grid wallet API
    └── data.ts           # Data fetching
```

Import via feature index: `import { walletService } from '@/features/wallet'`

#### **Authentication Flow**
- **Web**: Supabase OAuth (redirects to Google)
- **Mobile**: Native Google Sign-In SDK (better UX)
- **Backend**: Validates Supabase tokens, enforces RLS
- **Unified**: Same session tokens work across all platforms

#### **Real-Time Updates**
Supabase realtime subscriptions for:
- New messages in conversations
- Wallet balance changes
- Transaction confirmations

#### **Grid Wallet Integration**
- Embedded Solana wallets (no seed phrases for users)
- KYC verification flow (OTP-based)
- Backend proxies all Grid API calls
- Transaction signing via Grid API

## Deployment

### Native Builds

The native `ios/` and `android/` folders are not included in the repository. Generate them first:

```bash
# Generate native folders from app.config.js
bun expo prebuild

# iOS: Install CocoaPods dependencies
cd ios && pod install && cd ..

# Build for iOS
bun run build:ios

# Build for Android
bun run build:android
```

**Note:** The prebuild command uses your `app.config.js` settings to generate properly configured native projects with your app name, bundle ID, and branding.

### Web Deployment

Build for web production:

```bash
bun run web:export
```

The output will be in the `dist/` directory, ready for deployment to any static hosting service.

### EAS Build (Recommended)

For managed cloud builds via Expo Application Services (no local Xcode/Android Studio needed):

```bash
# Install EAS CLI globally
bun add -g eas-cli

# Configure EAS (generates eas.json if needed)
eas build:configure

# Build for production
eas build --platform ios
eas build --platform android

# Or build both at once
eas build --platform all
```

**Benefits:**
- No need for local Xcode or Android Studio
- Builds in the cloud
- Automatic code signing
- Perfect for CI/CD

## Backend Requirements

Mallory requires a backend API that implements the contract in [docs/API.md](docs/API.md). You have three options:

### Option 1: Dark Hosted Backend (Production-Ready)

Get instant access to a fully managed backend:

**Included:**
- ✅ Streaming chat API with Claude integration
- ✅ AI tool implementations (web search, memory, data APIs)
- ✅ x402 payment protocol (autonomous API payments)
- ✅ Managed Supabase instance (PostgreSQL + Realtime)
- ✅ Grid wallet API integration
- ✅ Production monitoring and uptime SLA
- ✅ Regular security updates

**Contact:** hello@darkresearch.ai

**Best for:** Production apps, MVPs, teams that want to focus on product not infrastructure.

### Option 2: Self-Hosted Backend

Build your own backend using the provided API specification.

**Required:**
- Supabase instance (cloud or self-hosted)
- Streaming chat API endpoint (`/api/chat`)
- Grid API integration (for wallet features)
- Authentication middleware
- **Optional:** AI tools (search, data APIs) and x402 payment protocol

**Reference Implementation:** Contact Dark for access to the reference backend codebase.

**Best for:** Teams with backend expertise, custom requirements, or self-hosting needs.

### Option 3: Minimal Backend (Web Only)

For web-only deployments without wallet features:

**Required:**
- Supabase instance
- API route for streaming chat (`/api/chat`)
- Authentication validation

**Skip:**
- Grid integration
- Wallet endpoints
- AI tools and x402 payment protocol

**Best for:** Simple chat apps, prototypes, or web-only deployments.

## Licensing & Support

### Open Source (Apache 2.0)

Mallory is **free and open-source** under the Apache 2.0 license:
- ✅ Use commercially
- ✅ Modify and distribute
- ✅ Keep your changes private
- ✅ No attribution required (but appreciated!)

### Commercial Services

**For teams that want to move faster:**

🚀 **Managed Backend**
- Fully hosted infrastructure
- Grid + Supabase + AI all configured
- x402 payment protocol enabled
- Production monitoring and SLA
- **Contact:** hello@darkresearch.ai

🏷️ **White-Label Hosting**
- Custom branding and domain
- Dedicated infrastructure
- Priority support
- Custom feature development
- **Contact:** hello@darkresearch.ai

### Community Support

- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - Architecture questions, best practices
- **Discord** (coming soon) - Real-time community help

**Enterprise customers** get priority email/Slack support with guaranteed response times.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on:

- Reporting issues
- Submitting pull requests
- Code style and conventions
- Development workflow

## Credits

Built with ❤️ by [Dark Research](https://darkresearch.ai)

**About Dark:** We build AI-first financial infrastructure. Mallory powers Scout, our production AI financial assistant serving thousands of users.

**Open Source Contributions:**
- [streamdown-rn](https://www.npmjs.com/package/streamdown-rn) - React Native port of Vercel's streamdown library
- [Mallory](https://github.com/darkresearch/mallory) - This boilerplate

---

## License

Copyright 2025 Dark Research, LLC

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for details.

You are free to use Mallory commercially, modify it, and distribute it. No attribution required (but we'd love a star ⭐️).
