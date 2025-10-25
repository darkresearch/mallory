# Mallory Quick Start

Get Mallory running in 5 minutes.

## 1️⃣ Install

```bash
git clone https://github.com/darkresearch/mallory.git
cd mallory
bun install
```

## 2️⃣ Configure

### Client
```bash
cd apps/client
cp .env.example .env
```

Edit `.env` - minimum required:
```bash
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_BACKEND_API_URL=http://localhost:3001
EXPO_PUBLIC_GRID_API_KEY=your-grid-key
EXPO_PUBLIC_GRID_ENV=sandbox
```

### Server
```bash
cd ../server
cp .env.example .env
```

Edit `.env` - minimum required:
```bash
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-key
ANTHROPIC_API_KEY=your-anthropic-key
BIRDEYE_API_KEY=your-birdeye-key
GRID_API_KEY=your-grid-key

# Optional (for AI tools):
EXA_API_KEY=your-exa-key
SUPERMEMORY_API_KEY=your-supermemory-key
```

## 3️⃣ Run

From monorepo root:
```bash
bun run dev
```

Opens:
- Client: http://localhost:8081
- Server: http://localhost:3001

## 4️⃣ Test

1. Open http://localhost:8081
2. Sign in with Google
3. Create Grid wallet (Wallet tab)
4. Send a chat message
5. View wallet holdings

## 📚 Full Documentation

See [SETUP.md](./SETUP.md) for complete setup guide.

## 🔑 Get API Keys

- **Supabase**: https://supabase.com (free tier)
- **Grid**: https://developers.squads.so (contact for API key)
- **Anthropic**: https://console.anthropic.com (Claude API)
- **Exa**: https://exa.ai (web search - optional)
- **Supermemory**: https://supermemory.ai (memory/RAG - optional)
- **Birdeye**: https://birdeye.so (Solana market data)

## 🆘 Issues?

- Check [SETUP.md](./SETUP.md#troubleshooting)
- Open issue: https://github.com/darkresearch/mallory/issues
- Email: hello@darkresearch.ai

