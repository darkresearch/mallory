# 🚀 Quick Start Guide - Mallory with Infinite Memory

Everything is set up! Just need to configure your environment variables.

## 1. Add Required Environment Variables

Add these to your `apps/server/.env` file:

```bash
# Infinite Memory (OpenMemory)
OPENMEMORY_URL=http://localhost:8080
OPENMEMORY_API_KEY=openmemory_dev_key

# Embeddings Provider (choose one):
# Option 1: Gemini (FREE!) - Get key from https://aistudio.google.com/apikey
GEMINI_API_KEY=your-gemini-key-here

# Option 2: OpenAI (paid)
# OPENAI_API_KEY=sk-your-openai-key-here

# Keep your existing variables:
# SUPABASE_URL=...
# SUPABASE_ANON_KEY=...
# ANTHROPIC_API_KEY=...
# etc.
```

## 2. Start Everything

```bash
# From the root of the project, run:
bun run dev
```

This will start:
- ✅ Client (web) on http://localhost:8081
- ✅ Server (API) on http://localhost:3000
- ✅ OpenMemory on http://localhost:8080

## 3. Test It!

1. Open http://localhost:8081 in your browser
2. Start a conversation
3. Ask the AI to remember something
4. The infinite memory system will:
   - Store messages in OpenMemory (check `services/openmemory/backend/data/openmemory.sqlite`)
   - Retrieve relevant context semantically
   - Manage token budgets automatically

## What Changed?

**Old:** Supermemory proxy (broken) ❌  
**New:** Infinite Memory + OpenMemory (working!) ✅

Your chat now has:
- Semantic retrieval of relevant past messages
- Hybrid strategy (recent + relevant)
- Token-aware budget management
- Automatic conversation storage
- Works with any conversation length

## Troubleshooting

### "OPENMEMORY_API_KEY is required"
Add the variables from step 1 to `apps/server/.env`

### OpenMemory not starting
Check if port 8080 is available:
```bash
lsof -i :8080
# If something is using it, kill it or change OM_PORT in services/openmemory/backend/.env
```

### Need to reset memory?
```bash
rm services/openmemory/backend/data/openmemory.sqlite
```

## Environment Variables Quick Reference

```bash
# Required for Infinite Memory
OPENMEMORY_URL=http://localhost:8080
OPENMEMORY_API_KEY=openmemory_dev_key
OPENAI_API_KEY=sk-...

# Your existing Mallory variables
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
# ... etc
```

Ready to chat with infinite memory! 🧠✨

