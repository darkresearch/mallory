# Mallory v0.1.0 - Monorepo Migration

Summary of major changes in the monorepo restructure.

## 🎯 Goals Achieved

1. ✅ Restructured as workspace-based monorepo
2. ✅ Created minimal, open-source backend
3. ✅ Moved Grid transaction signing to client
4. ✅ Shared types between client/server
5. ✅ Production-ready separation of concerns

## 📦 Repository Structure

### New Structure
```
mallory/
├── apps/
│   ├── client/          # React Native app (was entire repo)
│   └── server/          # Backend API (new)
├── packages/
│   └── shared/          # Shared types (new)
├── package.json         # Workspace config (new)
├── README.md            # Updated for monorepo
├── SETUP.md             # New setup guide
├── CONTRIBUTING.md      # Updated for monorepo
└── MONOREPO_MIGRATION.md # Migration guide
```

### What Moved
- All previous code → `apps/client/`
- New backend → `apps/server/`
- Shared types → `packages/shared/`

## 🆕 New Features

### Backend Server (`apps/server/`)

**New files created:**
- `src/server.ts` - Express app entry point
- `src/middleware/auth.ts` - Supabase JWT validation
- `src/lib/supabase.ts` - Supabase client
- `src/routes/chat/index.ts` - AI chat streaming endpoint
- `src/routes/wallet/holdings.ts` - Wallet holdings with price data
- `package.json` - Server dependencies
- `tsconfig.json` - TypeScript configuration
- `.env.example` - Environment template
- `README.md` - Server documentation
- `docs/API.md` - API reference

**API Endpoints:**
- `GET /health` - Health check
- `POST /api/chat` - AI chat streaming (Anthropic)
- `GET /api/wallet/holdings` - Enriched wallet balances (Grid + Birdeye)

**Dependencies:**
- Express.js - Web framework
- @anthropic-ai/sdk - AI integration
- @supabase/supabase-js - Auth validation
- cors - CORS middleware
- dotenv - Environment variables

### Client Grid Integration (`apps/client/`)

**New files:**
- `features/grid/services/gridClient.ts` - Grid SDK wrapper

**Updated files:**
- `features/wallet/services/solana.ts` - Client-side transaction signing
- `components/grid/OtpVerificationModal.tsx` - Direct Grid SDK usage
- `lib/config.ts` - Added Grid API configuration
- `app.config.js` - Added Grid env vars to extra
- `.env` - Added Grid API key and environment

**Key Changes:**
- ❌ Removed backend Grid proxy (`features/grid/services/client.ts`)
- ✅ Added Grid SDK (`@sqds/grid`)
- ✅ Client-side account creation with OTP
- ✅ Client-side transaction signing
- ✅ Session secrets stored locally (never sent to backend)

### Shared Types (`packages/shared/`)

**New files:**
- `src/types/api.ts` - Chat request/response types
- `src/types/wallet.ts` - Wallet/transaction types
- `src/index.ts` - Barrel exports
- `package.json` - Package config
- `tsconfig.json` - TypeScript config

**Exported types:**
- `ChatRequest`, `ChatMessage`
- `HoldingsResponse`, `TokenHolding`
- `GridAccount`, `GridAccountStatus`
- `TransactionRequest`, `TransactionResponse`

## 🔄 Breaking Changes

### Grid API Integration

**Before:**
```typescript
import { gridService } from '@/features/grid';
await gridService.createAccount(); // Backend call
await gridService.verifyAccount(code); // Backend call
```

**After:**
```typescript
import { gridClientService } from '@/features/grid/services/gridClient';
await gridClientService.createAccount(email); // Client-side
await gridClientService.verifyAccount(user, code); // Client-side
```

### Backend Endpoints Removed

These endpoints are no longer needed (handled client-side):
- ❌ `POST /api/grid/create-account`
- ❌ `POST /api/grid/verify`
- ❌ `POST /api/wallet/send`

### Environment Variables

**New required variables:**

Client (`apps/client/.env`):
```bash
EXPO_PUBLIC_GRID_API_KEY=...
EXPO_PUBLIC_GRID_ENV=sandbox
```

Server (`apps/server/.env`):
```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=...
BIRDEYE_API_KEY=...
GRID_API_KEY=...
GRID_ENV=sandbox
```

## 🔒 Security Improvements

### Before
- ❌ Grid session keys stored on backend
- ❌ Transaction signing on backend
- ❌ Complex HPKE encryption flow
- ❌ Backend manages user wallet secrets

### After
- ✅ Session secrets stored client-side only
- ✅ All signing happens on device
- ✅ Grid SDK handles encryption
- ✅ Backend never sees private keys
- ✅ Open-source friendly architecture

## 📊 Impact Summary

### Lines of Code
- **Backend**: ~500 lines (new, minimal)
- **Shared**: ~100 lines (new types)
- **Client**: ~50 lines changed (Grid integration)
- **Total**: Removed ~2000 lines of backend Grid complexity

### Dependencies Added
- **Server**: 6 new packages
- **Client**: 1 new package (`@sqds/grid`)
- **Shared**: 0 runtime dependencies

### API Surface
- **Before**: 6+ endpoints
- **After**: 3 endpoints (health, chat, holdings)
- **Reduction**: 50% smaller API surface

## 🎓 Developer Experience

### Improved
- ✅ Clear client/server separation
- ✅ Workspace-based dependencies
- ✅ Shared types (no duplication)
- ✅ Better docs and examples
- ✅ Easier to contribute
- ✅ Simpler deployment

### Trade-offs
- ⚠️ More complex monorepo setup
- ⚠️ Two `.env` files to manage
- ⚠️ Requires backend deployment

## 📈 Next Steps

Potential future improvements:
- [ ] Add Docker Compose for local development
- [ ] Add integration tests
- [ ] Add CLI for project scaffolding
- [ ] Add web-specific optimizations
- [ ] Add rate limiting to backend
- [ ] Add request logging/monitoring
- [ ] Add automated deployment workflows

## 🐛 Known Issues

None currently. Please report issues at: https://github.com/darkresearch/mallory/issues

## 📝 Migration Checklist

If migrating from old structure:

- [ ] Pull latest code
- [ ] Run `bun install` from root
- [ ] Update client `.env` with Grid variables
- [ ] Create server `.env` from template
- [ ] Set up Supabase tables
- [ ] Test backend: `curl http://localhost:3001/health`
- [ ] Test client: Open http://localhost:8081
- [ ] Test Grid account creation
- [ ] Test chat streaming
- [ ] Test wallet holdings
- [ ] Test transaction signing

## 🎉 Summary

Mallory is now a production-ready, open-source monorepo with:
- Minimal backend (AI + data enrichment)
- Client-side wallet security
- Clear architecture
- Professional organization
- Easy to fork and customize

Perfect for building crypto x AI applications! 🚀

