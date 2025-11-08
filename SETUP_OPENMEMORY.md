# OpenMemory Setup for Mallory

This guide covers running OpenMemory locally for development and deploying for production.

## Local Development (SQLite)

**Zero dependencies - just OpenAI API key!**

### 1. Run Setup Script

```bash
./services/openmemory-setup.sh
```

This will:
- Create `.env` configuration with SQLite
- Build OpenMemory
- Create data directory

### 2. Configure Environment

Add to your `.env` file (or export):

```bash
# Required
OPENAI_API_KEY=sk-...your-key

# Optional (defaults shown)
OPENMEMORY_URL=http://localhost:8080
OPENMEMORY_API_KEY=openmemory_dev_key
```

### 3. Start Everything

```bash
# Start client + server + OpenMemory
bun run dev

# Or just server + OpenMemory (no client)
bun run dev:server
```

That's it! OpenMemory will:
- Run on `http://localhost:8080`
- Store memories in `services/openmemory/backend/data/openmemory.sqlite`
- Work with zero external dependencies

## Production Deployment (Redis)

### Option A: Render

**1. Create Redis instance:**
- Dashboard → New → Redis
- Choose plan (Free tier: 25MB)
- Copy the **Internal Redis URL**

**2. Deploy OpenMemory:**
- New → Web Service
- Connect to OpenMemory repo
- Environment variables:
  ```
  OM_DB_TYPE=redis
  OM_REDIS_URL=<internal redis URL>
  OM_EMBED_PROVIDER=openai
  OM_OPENAI_API_KEY=<your key>
  OM_API_KEY=<random secure string>
  OM_PORT=8080
  OM_TIER=smart
  OM_VEC_DIM=1536
  ```

**3. Deploy Mallory:**
- Environment variables:
  ```
  OPENMEMORY_URL=https://your-openmemory.onrender.com
  OPENMEMORY_API_KEY=<same as above>
  ```

### Option B: Railway

**1. Add Redis:**
- New → Database → Redis
- Railway auto-sets `REDIS_URL`

**2. Deploy OpenMemory:**
- New → GitHub Repo
- Environment variables:
  ```
  OM_DB_TYPE=redis
  OM_REDIS_URL=${{Redis.REDIS_URL}}  # Railway template variable
  OM_EMBED_PROVIDER=openai
  OM_OPENAI_API_KEY=<your key>
  OM_API_KEY=<random secure string>
  OM_PORT=8080
  OM_TIER=smart
  OM_VEC_DIM=1536
  ```

**3. Deploy Mallory:**
- Reference OpenMemory URL via Railway's service URL

## Storage Options

| Option | Best For | Setup | Cost |
|--------|----------|-------|------|
| **SQLite** | Local dev | Zero config | Free |
| **Redis (managed)** | Production | Simple | $7-21/mo |
| **PostgreSQL** | Enterprise | Complex | Varies |

## Troubleshooting

### OpenMemory not starting

```bash
# Check if port 8080 is in use
lsof -i :8080

# Check OpenMemory logs
cd services/openmemory/backend
bun start
```

### Connection refused

- Verify `OPENMEMORY_URL=http://localhost:8080` (not https locally)
- Check OpenMemory is running: `curl http://localhost:8080/health`

### Embeddings failing

- Verify `OPENAI_API_KEY` is set correctly
- Check OpenAI API quota/billing

## Data Location

**Local (SQLite):**
```
services/openmemory/backend/data/openmemory.sqlite
```

**To reset local memory:**
```bash
rm services/openmemory/backend/data/openmemory.sqlite
```

**Production (Redis):**
- Managed by cloud provider
- Use provider's dashboard for backups/monitoring

