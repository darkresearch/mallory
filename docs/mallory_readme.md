# Mallory Project Overview

## Project Description
Mallory is an opinionated React Native crypto x AI chat app boilerplate with embedded wallet support, conversational AI, and dynamic UI component injection.

## Monorepo Structure
```
mallory/
├── apps/
│   ├── client/          # React Native app (iOS, Android, Web)
│   └── server/          # Backend API (Node.js + Express)
├── packages/
│   └── shared/          # Shared types and utilities
└── package.json         # Workspace configuration
```

## Key Features

### Client (Mobile & Web)
- Authentication: Google OAuth via Supabase
- AI Chat: Streaming conversations with Claude
- Embedded Wallet: Grid-powered smart contract wallets
- Client-Side Signing: Secure transaction signing (keys never leave device)
- Cross-Platform: iOS, Android, and Web from single codebase
- Modern UI: Beautiful, responsive design with Reanimated
- Version Tracking: Automatic version display with git commit hash

### Server (Backend API)
- AI Streaming: Claude integration with Server-Sent Events and extended thinking
- AI Tools: Web search (Exa), user memory (Supermemory), and 20+ Nansen data APIs
- x402 Payments: Server-side implementation for premium data access
- Wallet Data: Price enrichment via Birdeye API
- Secure Auth: Supabase JWT validation
- Production Ready: Comprehensive testing infrastructure

## Tech Stack
- Frontend: Expo, React Native, Reanimated
- Backend: Node.js, Express
- AI: Anthropic Claude
- Search: Exa AI-powered search
- Memory: Supermemory for user context
- Blockchain Data: Nansen via x402
- Market Data: Birdeye for Solana prices
- Wallet: Grid (Squads)
- Auth: Supabase

## Key Integration Points

### Grid Wallet Integration
- Non-Custodial: User private keys never exist - Grid uses secure enclaves and MPC
- Email-Based Auth: Simple OTP verification flow
- Session Secrets: Generated client-side, passed to backend only when needed for signing
- Smart Contract Wallets: Spending limits and programmable transactions
- Production Ready: Sandbox and production environments
- x402 Integration: Automatic micropayments for premium data APIs

### Anthropic AI Integration
- Streaming conversations with extended thinking
- Tool calling capabilities (web search, Nansen data, user memory)
- Message structure handling for tool_use and tool_result blocks

### x402 Payment Protocol
- Integration via Faremeter/Corbits
- Automatic micropayments for premium data APIs
- Each Nansen API call costs 0.001 USDC (one-tenth of a cent)

## Key Files & Components

### Server Architecture
- `/apps/server/src/server.ts` - Main server entry point
- `/apps/server/src/routes/chat/index.ts` - AI chat streaming with tool message transformation
- `/apps/server/src/lib/messageTransform.ts` - Handles Anthropic API message structure requirements

### Client Architecture
- `/apps/client/app/(main)/chat.tsx` - Main chat interface
- `/apps/client/hooks/useActiveConversation.ts` - Conversation management
- `/apps/client/contexts/GridContext.tsx` - Grid wallet management
- `/apps/client/components/chat/ChatManager.tsx` - Chat message handling

## Recent Key Fixes

### Tool Message Structure Fix
- Fixed Anthropic API error: "tool_use ids were found without tool_result blocks immediately after"
- Implemented message transformation in `/apps/server/src/lib/messageTransform.ts`
- Added validation and auto-fixing for tool-use message structure
- Ensures proper pairing of tool_use and tool_result blocks

### Conversation Management
- Improved conversation loading and caching
- Fixed refresh bugs with chat loading stability
- Enhanced message persistence and proper stream handling

## Development Commands

### Running the App
```bash
# Start both client (web) and server
bun run dev

# Start client only
bun run client

# Start server only
bun run server
```

### Testing
```bash
# Unit tests
bun test:unit

# Integration tests  
bun test:integration

# E2E tests
bun test:e2e:web
```

## Environment Setup
- Client: apps/client/.env with Supabase and backend API config
- Server: apps/server/.env with Anthropic, Supabase, and API keys
- Grid API key required for wallet functionality