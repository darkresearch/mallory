/**
 * Polyfills for Node.js/Bun test environment
 * 
 * Makes production code work in tests by providing missing browser/React Native APIs
 */

import { testStorage } from './test-storage';

// Load environment variables FIRST
import './test-env';

// Mock React Native module before any imports
import { mock, register } from 'bun:test';

// Register mock for react-native
register('./mock-react-native', () => ({
  Platform: {
    OS: 'web',
    Version: '1.0',
    select: (obj: any) => obj.web || obj.default || obj.ios || obj.android || Object.values(obj)[0],
    constants: {},
    isTV: false,
    isTesting: true,
  },
  StyleSheet: {
    create: (styles: any) => styles,
  },
  Dimensions: {
    get: () => ({ width: 375, height: 667 }),
  },
}));

// Polyfill sessionStorage for Node.js
// Production code uses sessionStorage when Platform.OS === 'web'
if (typeof sessionStorage === 'undefined') {
  // Create a synchronous wrapper around async testStorage
  // This works because testStorage operations complete synchronously in practice
  const storage = new Map<string, string>();
  
  (global as any).sessionStorage = {
    getItem(key: string): string | null {
      // For sync compatibility, load from cache
      return storage.get(key) || null;
    },
    
    setItem(key: string, value: string): void {
      storage.set(key, value);
      // Persist async (fire and forget)
      testStorage.setItem(key, value).catch(console.error);
    },
    
    removeItem(key: string): void {
      storage.delete(key);
      // Persist async (fire and forget)
      testStorage.removeItem(key).catch(console.error);
    },
    
    clear(): void {
      storage.clear();
      testStorage.clear().catch(console.error);
    },
    
    key(index: number): string | null {
      const keys = Array.from(storage.keys());
      return keys[index] || null;
    },
    
    get length(): number {
      return storage.size;
    },
  };
  
  console.log('✅ Polyfill: sessionStorage → testStorage');
}

console.log('✅ Test environment ready');

export { };

