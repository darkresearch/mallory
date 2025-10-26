/**
 * Test Storage Adapter for AI Agent
 * 
 * Provides file-based and env-var based storage for Grid credentials
 * so the AI agent can run tests without browser/mobile environment.
 */

import * as fs from 'fs';
import * as path from 'path';

const SECRETS_DIR = path.join(__dirname, '../../.test-secrets');

/**
 * Test storage that works in Node.js environment
 * Tries multiple sources in order:
 * 1. Environment variables (base64 encoded)
 * 2. Files in .test-secrets/
 * 3. Returns null if not found
 */
export const testStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      // Try environment variable first (for CI/CD)
      const envKey = `TEST_${key.toUpperCase().replace(/-/g, '_')}`;
      if (process.env[envKey]) {
        console.log(`[TestStorage] Found ${key} in env var ${envKey}`);
        // Decode from base64
        return Buffer.from(process.env[envKey]!, 'base64').toString('utf-8');
      }

      // Try file in .test-secrets/
      const filePath = path.join(SECRETS_DIR, `${key}.json`);
      if (fs.existsSync(filePath)) {
        console.log(`[TestStorage] Found ${key} in file ${filePath}`);
        return fs.readFileSync(filePath, 'utf-8');
      }

      console.log(`[TestStorage] ${key} not found in env or files`);
      return null;
    } catch (error) {
      console.error(`[TestStorage] Error reading ${key}:`, error);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      // Write to file
      if (!fs.existsSync(SECRETS_DIR)) {
        fs.mkdirSync(SECRETS_DIR, { recursive: true });
      }
      
      const filePath = path.join(SECRETS_DIR, `${key}.json`);
      fs.writeFileSync(filePath, value, 'utf-8');
      console.log(`[TestStorage] Wrote ${key} to ${filePath}`);
    } catch (error) {
      console.error(`[TestStorage] Error writing ${key}:`, error);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      const filePath = path.join(SECRETS_DIR, `${key}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[TestStorage] Removed ${key}`);
      }
    } catch (error) {
      console.error(`[TestStorage] Error removing ${key}:`, error);
    }
  }
};

/**
 * Mock Grid Client Service for testing
 * Uses test storage instead of secure storage
 */
export class TestGridClientService {
  async getAccount() {
    const accountJson = await testStorage.getItem('grid_account');
    if (!accountJson) {
      return null;
    }
    
    try {
      return JSON.parse(accountJson);
    } catch (error) {
      console.error('[TestGridClient] Error parsing grid_account:', error);
      return null;
    }
  }

  async getSessionSecrets() {
    const secretsJson = await testStorage.getItem('grid_session_secrets');
    if (!secretsJson) {
      return null;
    }
    
    try {
      return JSON.parse(secretsJson);
    } catch (error) {
      console.error('[TestGridClient] Error parsing grid_session_secrets:', error);
      return null;
    }
  }

  async verifyCredentials(): Promise<boolean> {
    const account = await this.getAccount();
    const secrets = await this.getSessionSecrets();
    
    if (!account || !secrets) {
      console.error('[TestGridClient] Missing credentials');
      return false;
    }
    
    console.log('[TestGridClient] ✅ Credentials loaded:');
    console.log('  - Address:', account.address);
    console.log('  - Has session secrets:', !!secrets);
    console.log('  - Has authentication:', !!account.authentication);
    
    return true;
  }
}

/**
 * Helper to check if test environment is properly configured
 */
export async function checkTestEnvironment(): Promise<{
  ready: boolean;
  missing: string[];
  details: string;
}> {
  const missing: string[] = [];
  const details: string[] = [];

  // Check Grid credentials
  const testClient = new TestGridClientService();
  const account = await testClient.getAccount();
  const secrets = await testClient.getSessionSecrets();

  if (!account) {
    missing.push('Grid account data');
    details.push('❌ grid_account.json not found');
  } else {
    details.push(`✅ Grid account: ${account.address}`);
  }

  if (!secrets) {
    missing.push('Grid session secrets');
    details.push('❌ grid_session_secrets.json not found');
  } else {
    details.push('✅ Grid session secrets loaded');
  }

  // Check Grid API key
  if (!process.env.EXPO_PUBLIC_GRID_API_KEY && !process.env.TEST_GRID_API_KEY) {
    missing.push('Grid API key');
    details.push('❌ EXPO_PUBLIC_GRID_API_KEY not set');
  } else {
    details.push('✅ Grid API key configured');
  }

  // Check network configuration
  const network = process.env.TEST_NETWORK || 'mainnet';
  details.push(`📍 Network: ${network}`);

  return {
    ready: missing.length === 0,
    missing,
    details: details.join('\n')
  };
}
