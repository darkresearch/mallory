/**
 * Test Environment Setup
 * 
 * Load environment variables from .env.test
 */

import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Load .env.test file (or fall back to .env)
 * Looks in client root directory (apps/client/)
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
          
          // ALWAYS override for test environment
          process.env[key] = value;
        }
      });
      
      loadedFrom = path;
      console.log(`✅ Loaded ${path.includes('.env.test') ? '.env.test' : '.env'}`);
      break;
    } catch (error) {
      // Try next file
      continue;
    }
  }
  
  if (!loadedFrom) {
    console.warn('⚠️  Could not load .env.test or .env');
  }
}

// Auto-load on import
loadTestEnv();

