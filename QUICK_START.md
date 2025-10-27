# Mallory Quick Start

Get Mallory running in under 10 minutes.

## 1️⃣ Install

```bash
git clone https://github.com/darkresearch/mallory.git
cd mallory
bun install
```

> **Note:** We use Bun for 3-10x faster installs. If you don't have Bun, install it from [bun.sh](https://bun.sh).

## 2️⃣ Configure Environment

### Client Configuration

```bash
cd apps/client
cp .env.example .env
```

Edit `apps/client/.env` - minimum required:

```bash
# Supabase (Required for auth)
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Backend (Required for chat)
EXPO_PUBLIC_BACKEND_API_URL=http://localhost:3001

# Grid Wallet (Required for wallet features)
EXPO_PUBLIC_GRID_API_KEY=your-grid-key
EXPO_PUBLIC_GRID_ENV=sandbox

# Solana RPC (Optional - has sensible defaults)
EXPO_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

### Server Configuration

```bash
cd ../server
cp .env.example .env
```

Edit `apps/server/.env` - minimum required:

```bash
# Server
PORT=3001
NODE_ENV=development

# Supabase (Required)
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# AI (Required for chat)
ANTHROPIC_API_KEY=your-anthropic-key

# Wallet & Pricing (Required for wallet features)
BIRDEYE_API_KEY=your-birdeye-key
GRID_API_KEY=your-grid-key
GRID_ENV=sandbox

# AI Tools (Optional but recommended)
EXA_API_KEY=your-exa-key
SUPERMEMORY_API_KEY=your-supermemory-key

# Nansen (Optional - for blockchain analytics)
NANSEN_API_KEY=your-nansen-key

# Solana (Optional - for x402 payments)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

## 3️⃣ Set Up Supabase Database

Run these SQL commands in your Supabase SQL Editor:

```sql
-- Create users_grid table
CREATE TABLE users_grid (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  grid_account_id TEXT,
  solana_wallet_address TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create conversations table
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  token_ca TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);

-- Create messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT,
  parts JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE users_grid ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users_grid
CREATE POLICY "Users can view own grid data"
  ON users_grid FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own grid data"
  ON users_grid FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own grid data"
  ON users_grid FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for conversations
CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
  ON conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON conversations FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for messages
CREATE POLICY "Users can view messages in own conversations"
  ON messages FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM conversations WHERE id = conversation_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can insert messages in own conversations"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM conversations WHERE id = conversation_id AND user_id = auth.uid())
  );
```

## 4️⃣ Run Development Servers

From the monorepo root:

```bash
bun run dev
```

This starts both the client and server concurrently.

**Access:**
- Client (web): http://localhost:8081
- Server (API): http://localhost:3001

### Alternative: Run Separately

**Terminal 1 - Server:**
```bash
cd apps/server
bun run dev
```

**Terminal 2 - Client:**
```bash
cd apps/client
bun run web
```

## 5️⃣ Test the App

1. **Open http://localhost:8081**
2. **Sign in with Google** (or create test account)
3. **Set up Grid wallet** (navigate to Wallet tab)
   - Enter email
   - Verify OTP
   - Wallet created!
4. **Send a chat message**
   - AI responds with streaming text
   - Try: "Search for the latest Solana news"
5. **View wallet holdings**
   - See your balances with live pricing

## 🔑 Get API Keys

### Required for Basic Features

- **Supabase**: https://supabase.com (free tier available)
  - Create new project → Get URL and anon key from Settings → API
- **Grid**: https://developers.squads.so (contact for API key)
- **Anthropic**: https://console.anthropic.com (Claude API)
- **Birdeye**: https://birdeye.so (Solana market data)

### Optional for Enhanced Features

- **Exa**: https://exa.ai (AI-powered web search)
- **Supermemory**: https://supermemory.ai (user memory & RAG)
- **Nansen**: https://nansen.ai (blockchain analytics - requires x402 setup)

## 🧪 Run Tests (Optional)

```bash
cd apps/client

# One-time setup
bun run test:setup

# Check test wallet balance
bun run test:balance

# Run validation tests
bun run test:validate:all

# Run E2E tests (requires funded test wallet)
bun run test:e2e
```

## 📱 Run on Mobile (Optional)

### iOS (requires Mac + Xcode)
```bash
cd apps/client
bun run ios
```

### Android (requires Android Studio)
```bash
cd apps/client
bun run android
```

## 🆘 Common Issues

### "Server won't start"
- Check that all environment variables are set in `apps/server/.env`
- Verify Supabase and Anthropic API keys are valid

### "Client Metro bundler error"
```bash
# Clear Metro cache
cd apps/client
rm -rf .expo .metro node_modules/.cache
bun install
bun run web
```

### "Grid wallet OTP not received"
- Check spam folder
- Wait 30 seconds between OTP requests
- Verify email is correct

### "Chat not streaming"
- Ensure server is running (http://localhost:3001/health should respond)
- Check `EXPO_PUBLIC_BACKEND_API_URL` in client `.env`
- Verify Anthropic API key has credits

## 📚 Next Steps

- **Full Setup Guide**: [SETUP.md](./SETUP.md)
- **Quick Reference**: [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
- **Contributing**: [CONTRIBUTING.md](./CONTRIBUTING.md)
- **Client Docs**: [apps/client/README.md](./apps/client/README.md)
- **Server Docs**: [apps/server/README.md](./apps/server/README.md)

## 💬 Support

- **GitHub Issues**: https://github.com/darkresearch/mallory/issues
- **Email**: hello@darkresearch.ai
- **Documentation**: [Full README](./README.md)

---

**Made by [Dark Research](https://darkresearch.ai)** ✨
