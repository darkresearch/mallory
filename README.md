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
- 🏷️ **Version Tracking**: Automatic version display with git commit hash

### Server (Backend API)
- 🤖 **AI Streaming**: Claude integration with Server-Sent Events and extended thinking
- 🔧 **AI Tools**: Web search (Exa), user memory (Supermemory), and 20+ Nansen data APIs
- 💰 **x402 Payments**: Server-side implementation for premium data access
- 💎 **Wallet Data**: Price enrichment via Birdeye API
- 🔒 **Secure Auth**: Supabase JWT validation
- 🚀 **Production Ready**: Comprehensive testing infrastructure

### Monorepo Management
- 🔄 **Synchronized Versioning**: Single command updates all packages
- 🏷️ **Automatic Releases**: GitHub releases created on version tags
- 📝 **Generated Changelogs**: Commit history automatically compiled

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

# Infinite Memory (OpenMemory for infinite context):
OPENMEMORY_URL=http://localhost:8080
OPENMEMORY_API_KEY=your-openmemory-key
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

## 🧪 Testing

Mallory has comprehensive test coverage: unit tests, integration tests, and E2E tests.

**Run tests:**
```bash
cd apps/client

# Fast tests (unit + integration)
bun test

# E2E tests (requires backend running)
bun run test:e2e

# AI-powered tests (optional - expensive)
# These use Claude to verify response completeness and test 200k+ token conversations
bun test __tests__/e2e/chat-message-flow.test.ts  # ~5-10 min, ~$1-2
bun test __tests__/e2e/long-context.test.ts       # ~10-20 min, ~$2-3
```

**CI/CD:**
- Regular tests run on every PR
- AI tests only run when `[run-ai-tests]` is in commit message:
  ```bash
  git commit -m "fix: improve streaming [run-ai-tests]"
  ```

See [apps/client/__tests__/CHAT_STATE_TESTS.md](./apps/client/__tests__/CHAT_STATE_TESTS.md) for full testing documentation.

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

## 🛠 Troubleshooting
---
### Google OAuth “Unsupported provider” — Full Setup Guide (Web + Expo RN)
The 400 response means Supabase doesn’t know about the Google provider yet. Here’s the full fix, covering both the browser login flow and the native Expo app.

#### 1. Enable Google in Supabase
- Go to **Supabase dashboard → your project → Authentication → Providers → Google**.
- Toggle **Enable** on. Supabase now expects a Google Client ID/secret.
Make a note of the **Redirect URL** shown at the top (it looks like `https://<project-ref>.supabase.co/auth/v1/callback`). You’ll paste that into Google Cloud Console in a moment.

#### 2. Create Google OAuth credentials
- Open <https://console.cloud.google.com/apis/credentials> (select the project you’ll use for Mallory).
- Ensure the *OAuth consent screen* is configured (app name, support email, scopes, test users).
- Click **Create credentials → OAuth client ID**.
- Choose **Web application** (works for both the web and native flows Mallory uses).
- Fill in:
   - **Authorized redirect URIs**: add the Supabase callback from step 1, e.g.
     ```
     https://<project-ref>.supabase.co/auth/v1/callback
     ```
   - **Authorized JavaScript origins** aren’t required for Supabase, but you can add your local web origin (e.g. `http://localhost:8081`) if you’re running the web client.
- Save. Copy the generated **Client ID** and **Client secret**.

> **What about `exp://…`?**  
> That kind of URI applies when you’re using Expo’s WebView-based AuthSession. Mallory’s native flow uses `@react-native-google-signin/google-signin`, which talks directly to Google Play Services and does **not** need (or accept) an `exp://` URI. So you can skip adding exp:// schemes here.

#### 3. Paste credentials back into Supabase
Still on the Google provider page in Supabase:
- Paste the **Client ID** and **Client secret** you just copied.
- Click **Save**.
Supabase now accepts Google logins.

#### 4. Update Mallory’s configuration (web + Expo)
Whether you’re running the browser app or the Expo-native build, you need the same Google client ID available at runtime.
- Edit `apps/client/.env` (or wherever you manage env vars) and set:
   ```ini
   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=<the web client ID from Google>
   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<optional iOS client ID if you generated one>
   ```
   Mallory’s native layer uses the “Web application” client for Android; for iOS you can optionally create an iOS-specific client and set it here.
- If you’re running the web client, also ensure the same ID is present; the `config.ts` module pulls from these `EXPO_PUBLIC_*` variables.
- Restart Expo / Metro (and rebuild Android/iOS if needed) so the new env values take effect.

#### 5. Test both surfaces
- **Web**: open the browser client, click **Continue with Google**, finish the Google OAuth flow; you should be redirected to Supabase, then back into Mallory with a logged-in session.
- **Expo + Android/iOS**: rebuild (`bun run android` or `bun run ios`), trigger **Continue with Google**. The native Google Sign-In dialog should appear. After you grant access, Supabase will issue the session tokens and Mallory should log you in.

##### TL;DR on local dev URLs
- **Web (browser)**: your “local dev URL” is the origin where your web app runs (e.g. `http://localhost:8081`). Add it under “Authorized JavaScript origins” if you need to load Google scripts directly (not strictly required for Supabase-based OAuth, but harmless).
- **Expo React Native**: no `exp://` redirect URI is required for the Google Sign-In library Mallory uses. Just ensure the web client ID is configured and Supabase has the provider enabled.
Once those steps are done, the “Unsupported provider: provider is not enabled” error disappears for both web and native runs.
---

## 🏷️ Version Management

Mallory uses synchronized semantic versioning across all packages.

### Auto-Release via PR

Include `[release: v*.*.*]` in your PR title:

```
feat: add new wallet feature [release: v0.2.0]
```

When merged to `main`, the version automatically bumps and a GitHub release is created! 🚀

### Manual Release

```bash
bun scripts/sync-version.js 0.2.0
git add . && git commit -m "chore: bump version to 0.2.0"
git tag v0.2.0 && git push && git push --tags
```

See [VERSION.mdx](./VERSION.mdx) for details.

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

