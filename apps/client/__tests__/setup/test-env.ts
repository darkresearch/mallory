/**
 * Test Environment Setup
 * 
 * Load environment variables from .env.test (local) or from environment (CI)
 */

import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Load .env.test file (or fall back to .env)
 * Looks in client root directory (apps/client/)
 * 
 * In CI/CD, environment variables are already set by GitHub Actions,
 * so this will gracefully skip if .env.test doesn't exist.
 */
export function loadTestEnv(): void {
  // Client root is always the parent of __tests__
  const clientRoot = join(__dirname, '../..');
  
  // Try .env.test first, then fall back to .env
  const envTestPath = join(clientRoot, '.env.test');
  const envPath = join(clientRoot, '.env');
  
  let loadedFrom = null;
  
  for (const path of [envTestPath, envPath]) {
    try {
      const envContent = readFileSync(path, 'utf-8');
      
      envContent.split('\n').forEach((line) => {
        // Skip comments and empty lines
        if (line.startsWith('#') || !line.trim()) {
          return;
        }
        
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim();
          
          // Only set if not already in environment (CI takes precedence)
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      });
      
      loadedFrom = path;
      console.log(`✅ Loaded ${path.includes('.env.test') ? '.env.test' : '.env'}`);
      break;
    } catch (error) {
      // File doesn't exist, try next or skip (CI will have env vars set)
      continue;
    }
  }
  
  // In CI, env vars are set by GitHub Actions, so it's OK if no file is found
  if (!loadedFrom) {
    console.log('ℹ️  No .env file found (using environment variables from CI)');
  }
}

// Auto-load on import
loadTestEnv();

// Polyfill sessionStorage for Node.js test environment
if (typeof (globalThis as any).sessionStorage === 'undefined') {
  const storage = new Map<string, string>();
  
  (globalThis as any).sessionStorage = {
    getItem(key: string): string | null {
      return storage.get(key) || null;
    },
    setItem(key: string, value: string): void {
      storage.set(key, value);
    },
    removeItem(key: string): void {
      storage.delete(key);
    },
    clear(): void {
      storage.clear();
    },
    key(index: number): string | null {
      const keys = Array.from(storage.keys());
      return keys[index] || null;
    },
    get length(): number {
      return storage.size;
    },
  };
}

