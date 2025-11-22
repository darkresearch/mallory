import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { chatRouter } from './routes/chat/index.js';
import { holdingsRouter } from './routes/wallet/holdings.js';
import gridRouter from './routes/grid.js';
import authRouter from './routes/auth.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:8081', 'http://localhost:19006'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // In development, allow all origins
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // In production, check against whitelist
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

/**
 * TODO: LONG-TERM ARCHITECTURE IMPROVEMENT
 * 
 * Current State:
 * - Client loads full conversation history from Supabase
 * - Client sends entire history + new message to server on every request
 * - As conversations grow, request payload grows (currently mitigated with 10MB limit)
 * 
 * Better Architecture:
 * 1. Client sends ONLY: new user message + conversationId
 * 2. Server loads conversation history from Supabase using conversationId
 * 3. Server appends new user message to loaded history
 * 4. Server applies existing smart context strategy (Supermemory/windowing)
 * 5. Server sends to Claude
 * 
 * Benefits:
 * - Eliminates body size concerns (new messages are ~1KB vs entire history ~1-10MB)
 * - Reduces network payload by ~99% for long conversations
 * - Centralizes conversation management on server (single source of truth)
 * - More scalable and efficient architecture
 * - Existing smart context windowing still works identically
 * 
 * Implementation Steps:
 * 1. Add Supabase client to server (already available via auth middleware)
 * 2. Modify /api/chat route to load history if not provided in request
 * 3. Update client to send only new message (keep history loading as fallback)
 * 4. Test thoroughly to ensure message ordering and metadata preservation
 * 5. Remove client-side history loading once server-side loading is stable
 */

// Body parsing middleware - increased limit for large conversation histories
// TODO: Long-term fix - refactor to server-side history loading
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '0.1.0'
  });
});

// API routes
app.use('/api/chat', chatRouter);
app.use('/api/wallet/holdings', holdingsRouter);
app.use('/api/grid', gridRouter);
app.use('/api/auth', authRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found` 
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Check OpenMemory connection
async function checkOpenMemory() {
  const openMemoryUrl = process.env.OPENMEMORY_URL;
  const openMemoryApiKey = process.env.OPENMEMORY_API_KEY;
  
  if (!openMemoryUrl || !openMemoryApiKey) {
    console.log('⚠️  OpenMemory: Not configured (OPENMEMORY_URL or OPENMEMORY_API_KEY missing)');
    console.log('   Infinite memory will be disabled. Add to .env to enable.');
    return;
  }

  try {
    // Test with cavira.app OpenMemory - try root endpoint or a simple query
    // cavira.app OpenMemory may not have /health, so we test basic connectivity
    const testUrl = `${openMemoryUrl}/`;
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${openMemoryApiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(2000), // 2 second timeout
    });

    // Only HTTP 200 indicates successful connection
    if (response.status === 200) {
      console.log(`✅ OpenMemory: Connected (${openMemoryUrl})`);
      console.log(`   Infinite memory enabled with semantic retrieval`);
    } else if (response.status === 401) {
      console.log(`❌ OpenMemory: Authentication failed (${openMemoryUrl})`);
      console.log(`   Invalid API key. Check OPENMEMORY_API_KEY in .env`);
      console.log(`   Infinite memory will be disabled until this is fixed.`);
    } else if (response.status === 404) {
      console.log(`⚠️  OpenMemory: Endpoint not found (HTTP 404)`);
      console.log(`   OpenMemory server is reachable but endpoint may be incorrect`);
      console.log(`   Check OPENMEMORY_URL in .env`);
    } else {
      console.log(`⚠️  OpenMemory: Unreachable (HTTP ${response.status})`);
      console.log(`   Check that OpenMemory is running on ${openMemoryUrl}`);
    }
  } catch (error) {
    console.log(`❌ OpenMemory: Connection failed (${openMemoryUrl})`);
    console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.log(`   Run: bash services/openmemory-setup.sh`);
    console.log(`   Then: cd services/openmemory/backend && bun start`);
  }
}

// Start server
app.listen(PORT, async () => {
  console.log('');
  console.log('🚀 Mallory Server Started');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔐 CORS: ${process.env.NODE_ENV === 'development' ? 'All origins (dev mode)' : allowedOrigins.join(', ')}`);
  console.log('');
  console.log('📡 Available endpoints:');
  console.log(`   GET  /health - Health check`);
  console.log(`   POST /api/chat - AI chat streaming`);
  console.log(`   GET  /api/wallet/holdings - Wallet holdings`);
  console.log(`   POST /api/grid/init-account - Grid init (CORS proxy)`);
  console.log(`   POST /api/grid/verify-otp - Grid OTP verify (CORS proxy)`);
  console.log(`   POST /api/grid/send-tokens - Grid token transfer (CORS proxy)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  
  // Log infinite-memory version
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const infiniteMemoryPkgPath = join(__dirname, '../node_modules/infinite-memory/package.json');
    const infiniteMemoryPkg = JSON.parse(readFileSync(infiniteMemoryPkgPath, 'utf-8'));
    console.log(`📦 infinite-memory version: ${infiniteMemoryPkg.version}`);
    console.log('');
  } catch (error) {
    console.log('⚠️  Could not read infinite-memory version');
    console.log('');
  }
  
  // Check OpenMemory connection
  await checkOpenMemory();
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

