# Mallory Monorepo - Verification Checklist

Use this checklist to verify the monorepo implementation is working correctly.

## 📦 Structure Verification

### Directory Structure
```bash
cd /Users/osprey/repos/dark/mallory

# Verify monorepo structure
ls -la apps/client    # Should exist
ls -la apps/server    # Should exist
ls -la packages/shared # Should exist
cat package.json      # Should have "workspaces" field
```

Expected output:
- ✅ `apps/client/` directory exists
- ✅ `apps/server/` directory exists
- ✅ `packages/shared/` directory exists
- ✅ Root `package.json` has workspaces configuration

### Package Names
```bash
grep '"name"' package.json
grep '"name"' apps/client/package.json
grep '"name"' apps/server/package.json
grep '"name"' packages/shared/package.json
```

Expected:
- ✅ Root: `"name": "mallory"`
- ✅ Client: `"name": "@darkresearch/mallory-client"`
- ✅ Server: `"name": "@darkresearch/mallory-server"`
- ✅ Shared: `"name": "@darkresearch/mallory-shared"`

## 🔧 Dependencies Verification

### Workspace Dependencies
```bash
cd /Users/osprey/repos/dark/mallory
bun install
```

Expected:
- ✅ Installs without errors
- ✅ Creates `node_modules/` at root
- ✅ Links workspace packages

### Grid SDK
```bash
cd apps/client
grep "@sqds/grid" package.json
```

Expected:
- ✅ Shows `"@sqds/grid": "^0.1.0"`

### Server Dependencies
```bash
cd apps/server
grep "express" package.json
grep "@anthropic-ai/sdk" package.json
```

Expected:
- ✅ Express is listed
- ✅ Anthropic SDK is listed

## 🌐 Environment Configuration

### Client .env
```bash
cd apps/client
cat .env | grep EXPO_PUBLIC_GRID
```

Expected:
- ✅ `EXPO_PUBLIC_GRID_API_KEY=...`
- ✅ `EXPO_PUBLIC_GRID_ENV=production` (or sandbox)

### Server .env
```bash
cd ../server
cat .env | grep ANTHROPIC
cat .env | grep SUPABASE
cat .env | grep GRID
```

Expected:
- ✅ `ANTHROPIC_API_KEY=sk-ant-...`
- ✅ `SUPABASE_URL=https://...`
- ✅ `SUPABASE_SERVICE_ROLE_KEY=...`
- ✅ `GRID_API_KEY=...`

## 🚀 Runtime Verification

### Server Startup
```bash
cd apps/server
bun run dev
```

Expected output:
```
🚀 Mallory Server Started
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Port: 3001
🌍 Environment: development
...
📡 Available endpoints:
   GET  /health - Health check
   POST /api/chat - AI chat streaming
   GET  /api/wallet/holdings - Wallet holdings
```

Checks:
- ✅ Server starts without errors
- ✅ Port 3001 is listening
- ✅ All endpoints listed

### Health Endpoint
```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-...",
  "version": "0.1.0"
}
```

### Client Startup
```bash
cd apps/client
bun run web
```

Expected output:
```
Starting project at /Users/osprey/repos/dark/mallory/apps/client
...
📋 Config loaded: { ... gridApiKey: 'loaded', gridEnv: 'production' }
...
› Web is waiting on http://localhost:8081
```

Checks:
- ✅ Client starts without errors
- ✅ Config shows gridApiKey: 'loaded'
- ✅ No Supabase errors
- ✅ Opens on http://localhost:8081

### Browser Console
Open http://localhost:8081 and check browser console:

Expected:
- ✅ No red errors
- ✅ Config loaded successfully
- ✅ Supabase client initialized
- ✅ Grid client initialized (when Grid code runs)

## 🧪 Feature Testing

### 1. Authentication
- [ ] Navigate to http://localhost:8081
- [ ] See login screen
- [ ] Click "Continue with Google"
- [ ] Complete OAuth flow
- [ ] Redirected to app

### 2. Chat
- [ ] Navigate to Chat tab
- [ ] Type a message
- [ ] Press send
- [ ] AI response streams in
- [ ] No errors in console

### 3. Wallet Holdings
- [ ] Navigate to Wallet tab
- [ ] Holdings load (or shows "Set up wallet" if none)
- [ ] Prices displayed
- [ ] Total value calculated

### 4. Grid Wallet Setup
- [ ] Click "Set Up Wallet"
- [ ] Enter email
- [ ] OTP modal appears
- [ ] Check email for code
- [ ] Enter 6-digit code
- [ ] Wallet created successfully
- [ ] Wallet address displayed

### 5. Transaction (Optional - requires funded wallet)
- [ ] Click "Send" button
- [ ] Enter recipient address
- [ ] Enter amount
- [ ] Transaction signs client-side
- [ ] Success message appears
- [ ] Transaction appears on Solana Explorer

## 🔍 Code Quality Checks

### TypeScript Compilation
```bash
# Client
cd apps/client
bun run type-check

# Server
cd ../server
bun run type-check

# Shared
cd ../../packages/shared
bun run type-check
```

Expected:
- ✅ All compile without errors

### No Backend Grid Calls
```bash
cd apps/client
grep -r "/api/grid" . --include="*.ts" --include="*.tsx"
```

Expected:
- ✅ No matches found

### Grid SDK Usage
```bash
cd apps/client
grep -r "gridClientService" features/ components/
```

Expected:
- ✅ Found in:
  - `features/wallet/services/solana.ts`
  - `components/grid/OtpVerificationModal.tsx`
  - `features/grid/services/gridClient.ts`

## 📝 Documentation Verification

### Files Exist
```bash
cd /Users/osprey/repos/dark/mallory
ls -la *.md
```

Expected:
- ✅ `README.md`
- ✅ `SETUP.md`
- ✅ `QUICK_START.md`
- ✅ `CONTRIBUTING.md`
- ✅ `MONOREPO_MIGRATION.md`
- ✅ `CHANGES.md`
- ✅ `IMPLEMENTATION_SUMMARY.md`
- ✅ `VERIFICATION_CHECKLIST.md`

### Server Docs
```bash
ls -la apps/server/README.md
ls -la apps/server/docs/API.md
```

Expected:
- ✅ Both files exist

## ✅ Final Checks

- [ ] All package.json files have correct names
- [ ] All .env files configured
- [ ] Server starts without errors
- [ ] Client starts without errors
- [ ] Health endpoint responds
- [ ] Chat streaming works
- [ ] Grid SDK integrated
- [ ] No TypeScript errors
- [ ] Documentation complete
- [ ] Git history preserved

## 🎉 Success Criteria

If ALL of the following are true, implementation is successful:

1. ✅ Monorepo structure created correctly
2. ✅ Client moved to `apps/client/` without breaking
3. ✅ Server created in `apps/server/` and runs
4. ✅ Shared types package created
5. ✅ Grid SDK integrated on client
6. ✅ Old Grid backend code removed
7. ✅ Environment variables configured
8. ✅ All documentation created
9. ✅ Server endpoints respond correctly
10. ✅ Client can communicate with server

## 📊 Validation Results

Fill this out after testing:

| Check | Status | Notes |
|-------|--------|-------|
| Monorepo structure | ⬜ | |
| Dependencies install | ⬜ | |
| Server starts | ⬜ | |
| Client starts | ⬜ | |
| Health endpoint | ⬜ | |
| Auth works | ⬜ | |
| Chat streaming | ⬜ | |
| Wallet holdings | ⬜ | |
| Grid account creation | ⬜ | |
| Transaction signing | ⬜ | |

## 🐛 Issue Reporting

If any checks fail, report with:
1. Which check failed
2. Error message/logs
3. Environment details (OS, Node version)
4. Steps to reproduce

Email: hello@darkresearch.ai
GitHub: https://github.com/darkresearch/mallory/issues

