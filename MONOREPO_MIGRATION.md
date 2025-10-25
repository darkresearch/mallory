# Monorepo Migration Guide

This document explains the restructuring of Mallory into a workspace-based monorepo.

## 📦 What Changed

### Repository Structure

**Before:**
```
mallory/
├── app/
├── components/
├── features/
├── lib/
└── package.json
```

**After:**
```
mallory/
├── apps/
│   ├── client/         # React Native app (all previous code)
│   └── server/         # New backend API
├── packages/
│   └── shared/         # Shared types
└── package.json        # Workspace config
```

### Key Changes

1. **All client code moved to `apps/client/`**
   - Preserves existing structure
   - All imports remain the same (using `@/` alias)
   - No breaking changes to client code

2. **New backend in `apps/server/`**
   - Express.js API server
   - Handles AI chat streaming
   - Provides wallet data enrichment
   - Open-source ready

3. **Shared types in `packages/shared/`**
   - API request/response types
   - Wallet/transaction types
   - Imported by both client and server

4. **Grid integration moved to client**
   - Transaction signing now happens client-side
   - Session secrets never sent to backend
   - More secure and transparent

## 🔄 Migration Steps

If you have an existing Mallory installation:

### 1. Backup Your Work
```bash
cp -r mallory mallory-backup
```

### 2. Pull Latest Changes
```bash
git pull origin main
```

### 3. Update Environment Variables

**Client (apps/client/.env):**
```bash
# Add Grid configuration
EXPO_PUBLIC_GRID_API_KEY=your-grid-api-key
EXPO_PUBLIC_GRID_ENV=sandbox
```

**Server (apps/server/.env):**
Create new `.env` file:
```bash
cp apps/server/.env.example apps/server/.env
# Fill in your API keys
```

### 4. Install Dependencies
```bash
bun install
```

### 5. Test the Migration
```bash
# Start both servers
bun run dev

# Or test separately
bun run client  # Should start on http://localhost:8081
bun run server  # Should start on http://localhost:3001
```

## 🔧 Code Changes Required

### Grid Integration

If you were using Grid wallet features:

**Before (backend signing):**
```typescript
import { gridService } from '@/features/grid';
const result = await gridService.createAccount();
```

**After (client-side signing):**
```typescript
import { gridClientService } from '@/features/grid/services/gridClient';
const result = await gridClientService.createAccount(email);
```

### API Endpoints Removed

The following backend Grid endpoints are no longer needed:
- `POST /api/grid/create-account` ❌
- `POST /api/grid/verify` ❌  
- `POST /api/wallet/send` ❌

These are now handled client-side with Grid SDK.

### API Endpoints Available

New backend provides:
- `POST /api/chat` ✅ - AI chat streaming
- `GET /api/wallet/holdings` ✅ - Wallet balance enrichment
- `GET /health` ✅ - Health check

## 🎯 Benefits

### Security
- ✅ Session secrets never leave the device
- ✅ Transaction signing happens client-side
- ✅ Reduced attack surface on backend
- ✅ Open-source friendly (no sensitive Grid logic)

### Developer Experience
- ✅ Clear separation of concerns
- ✅ Easier to understand codebase
- ✅ Workspace-based dependency management
- ✅ Shared types between client/server

### Deployment
- ✅ Client and server can be deployed independently
- ✅ Backend is minimal and easy to self-host
- ✅ No vendor lock-in

## 🆘 Troubleshooting

### "Workspace not found" errors
Run `bun install` from the monorepo root.

### Grid account creation fails
Ensure `EXPO_PUBLIC_GRID_API_KEY` is set in `apps/client/.env`.

### Chat streaming doesn't work
Ensure server is running and `EXPO_PUBLIC_BACKEND_API_URL=http://localhost:3001` in client `.env`.

### Backend won't start
Check all required env vars in `apps/server/.env`:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `BIRDEYE_API_KEY`
- `GRID_API_KEY`

## 📚 Further Reading

- [Root README](./README.md) - Complete documentation
- [Client README](./apps/client/README.md) - Client-specific docs
- [Server README](./apps/server/README.md) - Server-specific docs
- [API Documentation](./apps/server/docs/API.md) - API reference

## 🤝 Questions?

Open an issue or reach out at hello@darkresearch.ai

