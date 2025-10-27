# Mallory Server API Reference

Complete API documentation for Mallory backend server.

## Base URL

```
Development: http://localhost:3001
Production: https://your-api-domain.com
```

## Authentication

All endpoints (except `/health`) require authentication via Supabase JWT token:

```
Authorization: Bearer <supabase-jwt-token>
```

## Endpoints

### Health Check

```http
GET /health
```

Returns server status and version.

**Response 200:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "0.1.0"
}
```

---

### Chat Streaming

```http
POST /api/chat
Authorization: Required
Content-Type: application/json
```

Stream AI chat responses using Server-Sent Events (SSE).

**Request Body:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "What is Solana?"
    }
  ],
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "clientContext": {
    "timezone": "America/New_York",
    "currentTime": "2024-01-01T12:00:00Z",
    "currentDate": "2024-01-01",
    "device": "web"
  }
}
```

**Request Fields:**
- `messages` (required): Array of chat messages
  - `role`: "user", "assistant", or "system"
  - `content`: Message text
- `conversationId` (required): UUID of conversation
- `userId` (required): UUID of authenticated user
- `clientContext` (optional): Additional context for AI

**Response:**

Server-Sent Events stream with AI response chunks and tool calls.

**Stream Format:**
```
data: {"type": "text-delta", "textDelta": "Hello"}
data: {"type": "text-delta", "textDelta": " there!"}
data: {"type": "tool-call", "toolName": "searchWeb", "args": {"query": "..."}}
data: {"type": "tool-result", "result": {"title": "...", "url": "..."}}
data: {"type": "text-delta", "textDelta": "Based on the search..."}
data: {"type": "finish", "finishReason": "stop"}
```

**AI Tools:**

The AI has access to the following tools:

- **`searchWeb`** - Search the web for current information, news, and crypto data
  - Semantic search powered by Exa
  - Optimized for Solana ecosystem
  - Live crawling for breaking news
  - Always available

- **`addMemory`** - Store important facts about the user
  - User-scoped persistent memory
  - Auto-builds user profiles
  - Available if `SUPERMEMORY_API_KEY` is configured

The AI autonomously decides when to use tools based on the conversation context.

**Status Codes:**
- `200` - Success (SSE stream)
- `400` - Bad Request (missing/invalid parameters)
- `401` - Unauthorized (invalid or missing auth token)
- `500` - Internal Server Error

**Example (curl):**
```bash
curl -N -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}],"conversationId":"uuid","userId":"uuid"}' \
  http://localhost:3001/api/chat
```

---

### Wallet Holdings

```http
GET /api/wallet/holdings
Authorization: Required
```

Get user's wallet holdings enriched with price data.

**Response 200:**
```json
{
  "success": true,
  "holdings": [
    {
      "tokenAddress": "So11111111111111111111111111111111111111112",
      "symbol": "SOL",
      "balance": "1000000000",
      "decimals": 9,
      "uiAmount": 1.0,
      "price": 100.50,
      "value": 100.50,
      "name": "Solana",
      "logoUrl": "https://..."
    },
    {
      "tokenAddress": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "symbol": "USDC",
      "balance": "1000000",
      "decimals": 6,
      "uiAmount": 1.0,
      "price": 1.00,
      "value": 1.00,
      "name": "USD Coin",
      "logoUrl": "https://..."
    }
  ],
  "totalValue": 101.50,
  "smartAccountAddress": "GRIDxxx..."
}
```

**Response Fields:**
- `success`: Boolean indicating success
- `holdings`: Array of token holdings
  - `tokenAddress`: Token mint address
  - `symbol`: Token symbol (e.g., "SOL", "USDC")
  - `balance`: Raw balance as string
  - `decimals`: Token decimals
  - `uiAmount`: Human-readable amount
  - `price`: Current price in USD
  - `value`: Holding value in USD
  - `name`: Token name
  - `logoUrl`: Token logo URL
- `totalValue`: Total portfolio value in USD
- `smartAccountAddress`: User's Grid wallet address

**Status Codes:**
- `200` - Success
- `401` - Unauthorized
- `404` - Wallet not found
- `500` - Internal Server Error

**Error Response:**
```json
{
  "success": false,
  "holdings": [],
  "totalValue": 0,
  "error": "Error message"
}
```

---

## Error Responses

All errors follow a consistent format:

```json
{
  "error": "ERROR_TYPE",
  "message": "Human-readable error message"
}
```

Common error types:
- `UNAUTHORIZED` - Missing or invalid auth token
- `INVALID_REQUEST` - Bad request parameters
- `NOT_FOUND` - Resource not found
- `INTERNAL_ERROR` - Server error

## Rate Limits

Currently no rate limits enforced. Production deployments should implement:
- 100 requests/minute per user for chat
- 60 requests/minute per user for wallet endpoints

## CORS

Development mode allows all origins.

Production mode requires origins to be whitelisted via `ALLOWED_ORIGINS` environment variable.

## WebSocket / Realtime

Supabase real-time is used for:
- Live message updates in conversations
- Conversation list updates

No custom WebSocket implementation required on the backend.

## Grid Integration

**Note:** As of v0.1.0, Grid wallet operations (account creation, transaction signing) are handled entirely client-side using the Grid SDK. The backend only:
- Fetches wallet balances via Grid API
- Stores wallet addresses in Supabase

No Grid session secrets or signing keys are stored on the backend.

## Data Storage

### Supabase Tables

**users_grid:**
```sql
CREATE TABLE users_grid (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  grid_account_id TEXT,
  solana_wallet_address TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**conversations:**
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT,
  token_ca TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);
```

**messages:**
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  role TEXT NOT NULL,
  content TEXT,
  parts JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Row Level Security (RLS)

Enable RLS on all tables:

```sql
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE users_grid ENABLE ROW LEVEL SECURITY;

-- Example policies
CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
  ON conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

## External APIs

### Anthropic (Claude)
- **Purpose**: AI chat responses
- **Required**: Yes
- **Env Var**: `ANTHROPIC_API_KEY`

### Exa
- **Purpose**: Web search for current information
- **Required**: For AI tool calling
- **Env Var**: `EXA_API_KEY`
- **Features**: Semantic search, live crawling, crypto-optimized

### Supermemory
- **Purpose**: User memory and RAG
- **Required**: Optional (degrades gracefully)
- **Env Var**: `SUPERMEMORY_API_KEY`
- **Features**: Persistent user memories, profile building

### Birdeye
- **Purpose**: Token price and metadata
- **Required**: For wallet features
- **Env Var**: `BIRDEYE_API_KEY`

### Grid (Squads)
- **Purpose**: Wallet balance lookups
- **Required**: For wallet features
- **Env Var**: `GRID_API_KEY`, `GRID_ENV`

## Deployment Checklist

Before deploying to production:

- [ ] Set `NODE_ENV=production`
- [ ] Configure `ALLOWED_ORIGINS` for CORS
- [ ] Set all required environment variables
- [ ] Enable HTTPS
- [ ] Set up Supabase RLS policies
- [ ] Test authentication flow
- [ ] Test chat streaming
- [ ] Test wallet holdings
- [ ] Set up monitoring/logging
- [ ] Configure error tracking

## Support

For API questions or issues:
- GitHub Issues: https://github.com/darkresearch/mallory/issues
- Email: hello@darkresearch.ai

