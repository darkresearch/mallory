# Mallory Server

Backend API for Mallory - provides AI chat streaming and wallet data enrichment.

## 📋 Features

- 🤖 **AI Chat Streaming**: Claude integration with Server-Sent Events and extended thinking
- 🔧 **AI Tools**: Web search (Exa), user memory (Supermemory), 20+ Nansen endpoints
- 💰 **x402 Payments**: Server-side payment handling for premium data APIs
- 💎 **Wallet Data**: Fetch and enrich wallet balances with market data
- 🔒 **Authentication**: Supabase JWT validation
- 🌐 **CORS**: Configurable cross-origin support
- 📝 **TypeScript**: Full type safety
- 🧪 **Production Ready**: Comprehensive testing infrastructure

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ or Bun
- Supabase project (for auth)
- Anthropic API key (for AI chat)
- Birdeye API key (for price data)
- Grid API key (for wallet balances)

### Installation

```bash
# From monorepo root
bun install

# Or in server directory
cd apps/server
bun install
```

## 🤖 AI Tools

The backend supports AI tool calling for enhanced chat capabilities:

### Web Search (Exa)
- **Purpose**: Search the web for current information, news, and crypto data
- **Optimization**: Tuned for Solana ecosystem and token research
- **Required**: `EXA_API_KEY` environment variable
- **Features**:
  - Semantic search (not keyword-based)
  - Live crawling for breaking news
  - Domain filtering for targeted results
  - Date range filtering
  - Content type filtering (news, research, PDFs)

### Memory (Supermemory)
- **Purpose**: User-scoped persistent memory and RAG
- **Features**:
  - AI can store facts about users
  - Memories persist across conversations
  - Auto-builds user profiles
- **Optional**: Set `SUPERMEMORY_API_KEY` to enable
- **Scoping**: Memories tagged with userId for privacy

### Nansen Blockchain Analytics (20+ Endpoints)
- **Purpose**: Premium blockchain analytics and on-chain data
- **Payment**: Requires x402 micropayments (~$0.001 per request)
- **Required**: `NANSEN_API_KEY` environment variable
- **Categories**:
  - **Wallet Analytics**: Historical balances, current balances, transactions
  - **Smart Money**: Netflows, holdings, DEX trades, Jupiter DCAs
  - **Token Analytics**: Screener, flows, holders, transfers, DEX trades
  - **PnL**: Summary, detailed PnL, leaderboard
  - **Relationships**: Counterparties, related wallets, labels
  - **Intelligence**: Flow intelligence, who bought/sold analysis

### How It Works

When a user sends a chat message, Claude can autonomously:
1. Call `searchWeb` to find current information
2. Call `addMemory` to remember user preferences
3. Call Nansen tools for blockchain analytics (auto-payment via x402)
4. Use tool results to provide better responses

Tool calls appear in the SSE stream for the client to display.

## 💰 x402 Payment Protocol

The server implements server-side x402 payment handling for premium data APIs:

### How It Works
1. Client sends Grid session secrets with chat request (optional)
2. Server detects when a Nansen tool is called
3. Server creates ephemeral wallet and funds it from Grid wallet
4. Server executes x402 payment using Faremeter protocol
5. Server fetches data and returns to AI
6. AI incorporates data into response
7. Server sweeps remaining funds back to Grid wallet

### Configuration
```bash
# Required for x402
NANSEN_API_KEY=your-nansen-key
GRID_API_KEY=your-grid-key
GRID_ENV=sandbox
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Auto-approval threshold
# Payments < $0.01 are auto-approved
```

### Security
- Ephemeral wallets are single-use
- Grid session secrets only sent when needed for payment
- All payments logged for audit trail
- Configurable spending limits

### Environment Setup

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Fill in your environment variables:
```bash
# Server
PORT=3001
NODE_ENV=development

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI
ANTHROPIC_API_KEY=sk-ant-your-key

# AI Tools (optional but recommended)
EXA_API_KEY=your-exa-key
SUPERMEMORY_API_KEY=your-supermemory-key

# Nansen (optional - for blockchain analytics)
NANSEN_API_KEY=your-nansen-key

# Wallet Data
BIRDEYE_API_KEY=your-birdeye-key

# Grid API
GRID_API_KEY=your-grid-api-key
GRID_ENV=sandbox

# Solana (for x402 payments)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# CORS (optional)
ALLOWED_ORIGINS=http://localhost:8081,http://localhost:19006
```

### Run Development Server

```bash
bun run dev
```

Server will start on http://localhost:3001

## 📡 API Endpoints

### Health Check
```
GET /health
```

Returns server status and version.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "0.1.0"
}
```

### Chat Streaming
```
POST /api/chat
Authorization: Bearer <supabase-jwt-token>
```

Stream AI chat responses.

**Request Body:**
```json
{
  "messages": [
    { "role": "user", "content": "Hello!" }
  ],
  "conversationId": "uuid",
  "userId": "uuid",
  "clientContext": {
    "timezone": "America/New_York",
    "currentTime": "2024-01-01T12:00:00Z"
  }
}
```

**Response:**
Server-Sent Events (SSE) stream with AI responses.

### Wallet Holdings
```
GET /api/wallet/holdings
Authorization: Bearer <supabase-jwt-token>
```

Get enriched wallet holdings with price data.

**Response:**
```json
{
  "success": true,
  "holdings": [
    {
      "tokenAddress": "So11111...",
      "symbol": "SOL",
      "balance": "1000000000",
      "decimals": 9,
      "uiAmount": 1.0,
      "price": 100.50,
      "value": 100.50,
      "name": "Solana",
      "logoUrl": "https://..."
    }
  ],
  "totalValue": 100.50,
  "smartAccountAddress": "GRIDxxx..."
}
```

## 🔐 Authentication

All endpoints (except `/health`) require a valid Supabase JWT token in the Authorization header:

```
Authorization: Bearer <jwt-token>
```

The server validates tokens using Supabase's `auth.getUser()` API.

## 🗄️ Database

Requires Supabase with the following table:

**`users_grid` table:**
```sql
CREATE TABLE users_grid (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  grid_account_id TEXT,
  solana_wallet_address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🌐 CORS Configuration

In development, all origins are allowed.

In production, set `ALLOWED_ORIGINS` in `.env`:
```bash
ALLOWED_ORIGINS=https://your-app.com,https://www.your-app.com
```

## 🚢 Deployment

### Railway (Recommended)

1. Create new project on Railway
2. Connect GitHub repo
3. Set root directory to `apps/server`
4. Add environment variables
5. Deploy!

### Render

1. Create new Web Service
2. Set root directory: `apps/server`
3. Build command: `bun install && bun run build`
4. Start command: `bun run start`
5. Add environment variables

### Docker (Coming Soon)

```bash
docker build -t mallory-server .
docker run -p 3001:3001 --env-file .env mallory-server
```

## 🐛 Debugging

Enable debug logging by setting:
```bash
NODE_ENV=development
```

Server logs include:
- `✅` Success operations
- `❌` Errors
- `💬` Chat requests
- `💰` Wallet operations
- `🔒` Auth events
- `🤖` AI agent steps
- `🔧` Tool calls
- `💸` x402 payments
- `🧠` Extended thinking

### Debugging x402 Payments

Enable verbose x402 logging:
```bash
NODE_ENV=development
```

Check logs for:
- `🔄 [x402] Starting payment flow`
- `💰 [x402] Funding ephemeral wallet`
- `✅ [x402] Payment transaction built`
- `🌐 [x402] Retrying request with payment header`

### Testing Grid Integration

Test Grid signing without the full app:
```bash
cd apps/server
bun test-grid-signing.ts
```

## 📚 API Documentation

See [docs/API.md](./docs/API.md) for complete API reference.

## 🧪 Testing

The server can be tested using the comprehensive E2E test suite in the client:

```bash
# From apps/client
bun run test:validate:chat    # Test chat API
bun run test:x402             # Test x402 payments
bun run test:x402:nansen      # Test Nansen integration
```

See [../client/__tests__/README.md](../client/__tests__/README.md) for full testing documentation.

## 🔧 Development

### Type Checking
```bash
bun run type-check
```

### Building
```bash
bun run build
```

Output will be in `dist/` directory.

## 🤝 Contributing

See root [CONTRIBUTING.md](../../CONTRIBUTING.md) for contribution guidelines.

## 📄 License

MIT License - see [LICENSE](../../LICENSE) for details.

