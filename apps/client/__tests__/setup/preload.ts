/**
 * Bun Preload Script
 * 
 * Loaded before any test code to set up mocks and polyfills
 */

// Mock react-native before it's imported
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function (id: string) {
  if (id === 'react-native') {
    return {
      Platform: {
        OS: 'web',
        Version: '1.0',
        select: (obj: any) => obj.web || obj.default || Object.values(obj)[0],
      },
      StyleSheet: {
        create: (styles: any) => styles,
      },
      Dimensions: {
        get: () => ({ width: 375, height: 667 }),
      },
      View: () => null,
      Text: () => null,
    };
  }
  
  if (id === '@react-native-async-storage/async-storage') {
    return {
      default: {
        getItem: async () => null,
        setItem: async () => {},
        removeItem: async () => {},
      },
    };
  }
  
  return originalRequire.apply(this, arguments);
};

console.log('✅ Preload: React Native mocked');

// Load environment variables
import './test-env';

