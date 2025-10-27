# 🚀 Quick Reference Card

## Daily Development Commands

```bash
# Start everything (client + server)
bun run dev

# Run client only (web)
bun run client

# Run server only
bun run server

# Type checking
cd apps/client && bun run type-check
cd apps/server && bun run type-check
```

## Testing Commands

```bash
# Navigate to client for all test commands
cd apps/client

# One-time setup (creates test accounts)
bun run test:setup

# Check wallet balance
bun run test:balance

# Run all validation tests
bun run test:validate:all

# Run specific validations
bun run test:validate:storage      # Storage system
bun run test:validate:mailosaur    # Email/OTP
bun run test:validate:auth         # Supabase auth
bun run test:validate:grid         # Grid wallet
bun run test:validate:conversation # Conversations
bun run test:validate:chat         # Chat API

# Run E2E tests
bun run test:e2e                   # All E2E tests
bun run test:grid                  # Grid payment tests
bun run test:x402                  # x402 payment tests
bun run test:x402:nansen           # Nansen integration tests
```

## Project Structure

```
mallory/
├── apps/
│   ├── client/          # React Native app
│   │   ├── app/         # Expo Router screens
│   │   ├── components/  # UI components
│   │   ├── features/    # Feature modules
│   │   ├── hooks/       # Custom hooks
│   │   └── __tests__/   # E2E tests
│   └── server/          # Backend API
│       ├── src/
│       │   ├── routes/  # API endpoints
│       │   └── services/# Business logic
│       └── prompts/     # AI prompts
└── packages/
    └── shared/          # Shared types
        ├── types/       # API types
        ├── x402/        # x402 payment logic
        └── grid/        # Grid utilities
```

## Key Technologies

### Client
- **Framework**: React Native (Expo)
- **Navigation**: Expo Router (file-based)
- **AI**: Vercel AI SDK
- **Markdown**: streamdown-rn
- **Wallet**: @sqds/grid
- **Auth**: @supabase/supabase-js

### Server
- **Framework**: Express
- **AI**: Anthropic SDK (Claude)
- **Tools**: Exa (search), Supermemory (memory)
- **Data**: Nansen (blockchain analytics)
- **Payments**: Faremeter (x402 protocol)
- **Auth**: Supabase

## Environment Variables

### Client (apps/client/.env)
```bash
# Supabase (Required)
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Backend (Required)
EXPO_PUBLIC_BACKEND_API_URL=http://localhost:3001

# Grid Wallet (Required)
EXPO_PUBLIC_GRID_API_KEY=your-grid-key
EXPO_PUBLIC_GRID_ENV=sandbox

# Solana (Optional)
EXPO_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

### Server (apps/server/.env)
```bash
# Server
PORT=3001
NODE_ENV=development

# Supabase (Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# AI (Required)
ANTHROPIC_API_KEY=sk-ant-your-key

# AI Tools (Optional)
EXA_API_KEY=your-exa-key
SUPERMEMORY_API_KEY=your-supermemory-key

# Wallet & Payments (Required for features)
BIRDEYE_API_KEY=your-birdeye-key
GRID_API_KEY=your-grid-key
GRID_ENV=sandbox

# Nansen (Optional - for blockchain analytics)
NANSEN_API_KEY=your-nansen-key
```

## Key Features

### ✅ AI Chat
- Streaming responses with Claude
- Extended thinking mode (up to 15K tokens)
- Multi-step agent reasoning
- 20+ AI tools (search, memory, Nansen)
- Dynamic UI component injection

### ✅ Grid Wallet
- Client-side session secret generation
- Server-side transaction signing
- Email-based OTP authentication
- Mainnet and testnet support
- x402 payment integration

### ✅ x402 Payments
- Server-side implementation
- Ephemeral wallet management
- Auto-approval for micro-payments (<$0.01)
- Integration with Nansen APIs
- Faremeter protocol compliance

### ✅ Nansen Integration
20+ blockchain analytics endpoints:
- Historical balances
- Smart money tracking
- DEX trades & transfers
- Portfolio analytics
- PnL calculations
- Token screening
- Flow intelligence

### ✅ Testing Infrastructure
- Mailosaur integration for OTP
- Automated E2E test suite
- Grid wallet test setup
- Chat API validation
- x402 payment testing

## API Endpoints

### Health Check
```
GET /health
```

### Chat Streaming
```
POST /api/chat
Authorization: Bearer <token>
Body: { messages, conversationId, userId, clientContext, gridSessionSecrets?, gridSession? }
```

### Wallet Holdings
```
GET /api/wallet/holdings
Authorization: Bearer <token>
```

### Grid Proxy Endpoints
```
POST /api/grid/init-account
POST /api/grid/verify-otp
POST /api/grid/send-tokens
GET  /api/grid/balances
```

## Common Workflows

### Setting Up a New Developer

1. Clone repo: `git clone https://github.com/darkresearch/mallory.git`
2. Install: `bun install`
3. Configure: Copy `.env.example` files and fill in credentials
4. Run: `bun run dev`

### Adding a New AI Tool

1. Create tool in `apps/server/src/routes/chat/tools/`
2. Register in `apps/server/src/routes/chat/tools/registry.ts`
3. Add to tools object in `apps/server/src/routes/chat/index.ts`
4. Update system prompt if needed
5. Test with chat endpoint

### Debugging x402 Payments

1. Enable verbose logging: Set `NODE_ENV=development`
2. Check Grid wallet balance: `bun run test:balance`
3. Verify session secrets are loaded
4. Test with small payment first
5. Check Solana explorer for transactions

### Running E2E Tests

1. Setup test account: `bun run test:setup`
2. Fund wallet (shown in setup output)
3. Start server: `bun run server`
4. Run tests: `bun run test:e2e`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Server won't start | Check environment variables in `apps/server/.env` |
| Client Metro error | Clear cache: `rm -rf apps/client/.expo apps/client/.metro` |
| Grid OTP timeout | Check email, wait 30s between attempts |
| x402 payment fails | Verify Grid wallet has USDC + SOL |
| Tests timeout | Start backend server first |
| Type errors | Run `bun run type-check` in affected package |

## Performance Tips

- Use `bun` instead of `npm` for 3-10x faster installs
- Enable caching in Metro bundler
- Use production Grid environment for real users
- Implement rate limiting in production
- Monitor Anthropic API token usage
- Cache Nansen API responses when possible

## Security Checklist

- [ ] Grid session secrets stored securely (never in logs)
- [ ] Supabase RLS policies enabled
- [ ] Backend validates all JWT tokens
- [ ] CORS configured for production
- [ ] Environment variables not committed
- [ ] API keys rotated regularly
- [ ] x402 payment limits enforced

## Quick Links

- **Main Repo**: https://github.com/darkresearch/mallory
- **Grid Docs**: https://developers.squads.so
- **Nansen API**: https://docs.nansen.ai
- **x402 Protocol**: https://x402.org
- **Vercel AI SDK**: https://sdk.vercel.ai
- **streamdown-rn**: https://www.npmjs.com/package/streamdown-rn

---

**Need Help?** 
- 📧 Email: hello@darkresearch.ai
- 🐛 Issues: https://github.com/darkresearch/mallory/issues
- 📚 Full Docs: [README.md](./README.md)
