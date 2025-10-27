# Mallory Setup Guide

Complete guide to setting up and running Mallory monorepo.

## 📋 Prerequisites

- **Bun** or Node.js 18+
- **Supabase Account**: https://supabase.com
- **Grid API Key**: https://developers.squads.so
- **Anthropic API Key**: https://console.anthropic.com
- **Birdeye API Key** (optional): https://birdeye.so

## 🚀 Installation

### 1. Clone Repository

```bash
git clone https://github.com/darkresearch/mallory.git
cd mallory
```

### 2. Install Dependencies

```bash
bun install
```

This installs dependencies for all workspace packages (client, server, shared).

### 3. Configure Environment Variables

#### Client Configuration

```bash
cd apps/client
cp .env.example .env
```

Edit `apps/client/.env` with your values:

```bash
# Supabase (Required)
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Backend API (Required)
EXPO_PUBLIC_BACKEND_API_URL=http://localhost:3001

# Grid Wallet (Required for wallet features)
EXPO_PUBLIC_GRID_API_KEY=your-grid-api-key
EXPO_PUBLIC_GRID_ENV=sandbox

# Google OAuth (Optional - for auth)
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-ios-client-id
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-android-client-id

# Solana RPC (Optional)
EXPO_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# OAuth Redirect (Optional - for web)
EXPO_PUBLIC_WEB_OAUTH_REDIRECT_URL=http://localhost:8081
```

#### Server Configuration

```bash
cd ../server
cp .env.example .env
```

Edit `apps/server/.env` with your values:

```bash
# Server
PORT=3001
NODE_ENV=development

# Supabase (Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI (Required for chat)
ANTHROPIC_API_KEY=sk-ant-your-key

# AI Tools (Optional but recommended)
EXA_API_KEY=your-exa-key
SUPERMEMORY_API_KEY=your-supermemory-key

# Wallet Data (Required for holdings)
BIRDEYE_API_KEY=your-birdeye-key
GRID_API_KEY=your-grid-api-key
GRID_ENV=sandbox

# CORS (Optional)
ALLOWED_ORIGINS=http://localhost:8081,http://localhost:19006
```

### 4. Set Up Supabase

Run these SQL commands in your Supabase SQL editor:

```sql
-- Create users_grid table
CREATE TABLE users_grid (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  grid_account_id TEXT,
  solana_wallet_address TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE users_grid ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own grid data"
  ON users_grid FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own grid data"
  ON users_grid FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own grid data"
  ON users_grid FOR UPDATE
  USING (auth.uid() = id);

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

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

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

-- Enable real-time for messages
ALTER TABLE messages REPLICA IDENTITY FULL;
```

### 5. Configure Google OAuth (Optional)

If you want Google sign-in:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials
3. Add authorized redirect URIs:
   - `http://localhost:8081` (for local dev)
   - Your Supabase auth callback URL
4. Copy client IDs to your `.env` files

## 🎯 Running the App

### Option 1: Run Both (Recommended)

```bash
# From monorepo root
bun run dev
```

This starts both client and server concurrently.

- Client (web): http://localhost:8081
- Server (API): http://localhost:3001

### Option 2: Run Separately

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

### Option 3: Run Client Only (Native)

```bash
cd apps/client

# iOS (requires Mac + Xcode)
bun run ios

# Android (requires Android Studio)
bun run android
```

## ✅ Verification Checklist

Test the complete setup:

### Backend Health
```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "...",
  "version": "0.1.0"
}
```

### Client Access
Open http://localhost:8081 in your browser.

Expected:
- Login screen appears
- "Continue with Google" button visible
- No errors in console (check browser DevTools)

### Full Flow Test

1. ✅ **Sign in with Google**
   - Click "Continue with Google"
   - Complete OAuth flow
   - Redirected to app

2. ✅ **Create Grid Wallet**
   - Navigate to Wallet tab
   - Click "Set Up Wallet"
   - Enter email, receive OTP
   - Verify OTP
   - Wallet created successfully

3. ✅ **Send Chat Message**
   - Navigate to Chat tab
   - Type a message
   - AI responds with streaming text
   - No errors

4. ✅ **View Wallet Holdings**
   - Navigate to Wallet tab
   - Holdings load with price data
   - Total value displayed

5. ✅ **Send Transaction** (requires funded wallet)
   - Click "Send" in wallet
   - Enter recipient address and amount
   - Transaction signed client-side
   - Success message appears

## 🐛 Troubleshooting

### Server won't start

**Error: "Missing Supabase environment variables"**
- Check `apps/server/.env` has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

**Error: "ANTHROPIC_API_KEY is required"**
- Add valid Anthropic API key to `apps/server/.env`

### Client errors

**Error: "EXPO_PUBLIC_SUPABASE_URL is required"**
- Check `apps/client/.env` has all required variables
- Stop and restart dev server (Ctrl+C, then `bun run web`)
- Clear Metro cache: `rm -rf apps/client/.expo apps/client/.metro`

**Error: "Backend API unreachable"**
- Ensure server is running on http://localhost:3001
- Check `EXPO_PUBLIC_BACKEND_API_URL` in client `.env`

### Grid wallet issues

**Error: "Grid API key invalid"**
- Verify `EXPO_PUBLIC_GRID_API_KEY` in client `.env`
- Check Grid environment (sandbox vs production)

**Error: "Session secrets not found"**
- Clear app data and create Grid account again
- Session secrets are stored in secure storage

### Chat streaming issues

**Stream cuts off or doesn't appear:**
- Check browser console for errors
- Verify server logs show "Chat stream started"
- Ensure Anthropic API key is valid

## 📚 Next Steps

- [API Documentation](./apps/server/docs/API.md)
- [Grid SDK Reference](https://developers.squads.so/grid/v1/sdk-reference/reference/v0.1.0/quickstart)
- [Deployment Guide](./README.md#deployment)

## 🆘 Getting Help

- GitHub Issues: https://github.com/darkresearch/mallory/issues
- Email: hello@darkresearch.ai
- Discord: (coming soon)

Happy building! 🚀

