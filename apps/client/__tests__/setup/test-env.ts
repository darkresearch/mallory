/**
 * Test Environment Setup
 * 
 * Load environment variables from .env.test
 */

import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Load .env.test file
 */
export function loadTestEnv(): void {
  const envPath = join(process.cwd(), '.env.test');
  
  try {
    const envContent = readFileSync(envPath, 'utf-8');
    
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
    
    console.log('✅ Loaded .env.test');
  } catch (error) {
    console.warn('⚠️  Could not load .env.test:', error);
  }
}

// Auto-load on import
loadTestEnv();

