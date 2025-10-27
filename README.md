# Mallory

Opinionated React Native crypto x AI chat app boilerplate with embedded wallet support, conversational AI, and dynamic UI component injection.

## 🏗️ Monorepo Structure

```
mallory/
├── apps/
│   ├── client/          # React Native app (iOS, Android, Web)
│   └── server/          # Backend API (Node.js + Express)
├── packages/
│   └── shared/          # Shared types and utilities
└── package.json         # Workspace configuration
```

## ✨ Features

### Client (Mobile & Web)
- 🔐 **Authentication**: Google OAuth via Supabase
- 💬 **AI Chat**: Streaming conversations with Claude
- 💰 **Embedded Wallet**: Grid-powered smart contract wallets
- 🔑 **Client-Side Signing**: Secure transaction signing (keys never leave device)
- 📱 **Cross-Platform**: iOS, Android, and Web from single codebase
- 🎨 **Modern UI**: Beautiful, responsive design with Reanimated

### Server (Backend API)
- 🤖 **AI Streaming**: Claude integration with Server-Sent Events and extended thinking
- 🔧 **AI Tools**: Web search (Exa), user memory (Supermemory), and 20+ Nansen data APIs
- 💰 **x402 Payments**: Server-side implementation for premium data access
- 💎 **Wallet Data**: Price enrichment via Birdeye API
- 🔒 **Secure Auth**: Supabase JWT validation
- 🚀 **Production Ready**: Comprehensive testing infrastructure

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ or Bun
- Git
- Expo CLI (optional, included in dependencies)

### 1. Clone and Install

```bash
git clone https://github.com/darkresearch/mallory.git
cd mallory
bun install
```

### 2. Environment Setup

#### Client Environment (`.env` in `apps/client/`)
```bash
# Copy from template
cp apps/client/.env.example apps/client/.env

# Required variables:
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_BACKEND_API_URL=http://localhost:3001
EXPO_PUBLIC_GRID_API_KEY=your-grid-api-key
EXPO_PUBLIC_GRID_ENV=sandbox
```

#### Server Environment (`.env` in `apps/server/`)
```bash
# Copy from template
cp apps/server/.env.example apps/server/.env

# Required variables:
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=sk-ant-your-key
BIRDEYE_API_KEY=your-birdeye-key
GRID_API_KEY=your-grid-api-key

# Optional (for AI tools):
EXA_API_KEY=your-exa-key
SUPERMEMORY_API_KEY=your-supermemory-key
```

### 3. Run Development Servers

#### Option A: Run Both (Client + Server)
```bash
bun run dev
```

#### Option B: Run Separately
```bash
# Terminal 1 - Backend
bun run server

# Terminal 2 - Client (Web)
bun run client
```

The client will be available at:
- Web: http://localhost:8081
- API: http://localhost:3001

## 📱 Client Development

See [apps/client/README.md](./apps/client/README.md) for detailed client documentation.

**Key Commands:**
```bash
cd apps/client

# Web
bun run web

# iOS (requires Mac + Xcode)
bun run ios

# Android (requires Android Studio)
bun run android
```

## 🔧 Server Development

See [apps/server/README.md](./apps/server/README.md) for detailed server documentation.

**API Endpoints:**
- `POST /api/chat` - AI chat streaming with tool calling
- `GET /api/wallet/holdings` - Wallet holdings with price data
- `GET /health` - Health check

**AI Tools:**
- `searchWeb` - Web search via Exa (always available)
- `addMemory` - User memory via Supermemory (optional)
- `nansen*` - 20+ Nansen API endpoints for blockchain analytics (requires x402 payments)

## 🔑 Grid Wallet Integration

Mallory uses [Grid](https://developers.squads.so) for embedded wallets:

- **Non-Custodial**: User private keys never exist - Grid uses secure enclaves and MPC
- **Email-Based Auth**: Simple OTP verification flow
- **Session Secrets**: Generated client-side, passed to backend only when needed for signing
- **Smart Contract Wallets**: Spending limits and programmable transactions
- **Production Ready**: Sandbox and production environments
- **x402 Integration**: Automatic micropayments for premium data APIs

Grid's architecture means neither the client nor server ever has access to user private keys, making it truly non-custodial while still providing seamless transaction signing.

## 📦 Shared Package

The `packages/shared` directory contains TypeScript types and utilities shared between client and server:

```typescript
import type { ChatRequest, HoldingsResponse } from '@darkresearch/mallory-shared';
import { X402PaymentService } from '@darkresearch/mallory-shared';
```

## 🚢 Deployment

### Client Deployment
- **Web**: Deploy to Vercel, Netlify, or any static host
- **iOS**: Deploy via Expo EAS or native build
- **Android**: Deploy via Expo EAS or native build

See [apps/client/README.md](./apps/client/README.md#deployment) for details.

### Server Deployment
- **Recommended**: Railway, Render, Fly.io
- **Node.js**: Any Node.js 18+ hosting

See [apps/server/README.md](./apps/server/README.md#deployment) for details.

## 🤝 Contributing

Contributions welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) first.

## 📄 License

Apache License 2.0 - see [LICENSE](./LICENSE) for details.

## 🆘 Support

- 📧 Email: hello@darkresearch.ai
- 🐛 Issues: [GitHub Issues](https://github.com/darkresearch/mallory/issues)
- 📚 Docs: [Full Documentation](./docs/)

## 🙏 Acknowledgments

Built with:
- [Expo](https://expo.dev) - React Native framework
- [Grid (Squads)](https://developers.squads.so) - Embedded wallets
- [Anthropic](https://anthropic.com) - Claude AI with extended thinking
- [Exa](https://exa.ai) - AI-powered web search
- [Supermemory](https://supermemory.ai) - User memory & RAG
- [Supabase](https://supabase.com) - Auth & database
- [Birdeye](https://birdeye.so) - Solana market data
- [Nansen](https://nansen.ai) - Blockchain analytics (via x402)
- [Faremeter](https://x402.org) - x402 payment protocol
- [streamdown-rn](https://www.npmjs.com/package/streamdown-rn) - React Native markdown streaming

---

**Made with ❤️ by [Dark](https://darkresearch.ai)**

