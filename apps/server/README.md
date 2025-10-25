# Mallory Server

Backend API for Mallory - provides AI chat streaming and wallet data enrichment.

## 📋 Features

- 🤖 **AI Chat Streaming**: Claude integration with Server-Sent Events
- 💰 **Wallet Holdings**: Fetch and enrich wallet balances with market data
- 🔒 **Authentication**: Supabase JWT validation
- 🌐 **CORS**: Configurable cross-origin support
- 📝 **TypeScript**: Full type safety

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

### How It Works

When a user sends a chat message, Claude can autonomously:
1. Call `searchWeb` to find current information
2. Call `addMemory` to remember user preferences
3. Use tool results to provide better responses

Tool calls appear in the SSE stream for the client to display.

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

# Wallet Data
BIRDEYE_API_KEY=your-birdeye-key

# Grid API
GRID_API_KEY=your-grid-api-key
GRID_ENV=sandbox

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

## 📚 API Documentation

See [docs/API.md](./docs/API.md) for complete API reference.

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

