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
  
  if (id === 'expo-router') {
    return {
      useLocalSearchParams: () => ({}),
      useRouter: () => ({
        push: () => {},
        replace: () => {},
        setParams: () => {},
        back: () => {},
      }),
      usePathname: () => '/chat',
      useSegments: () => ['chat'],
      Link: ({ children }: any) => children,
      Redirect: () => null,
      Stack: () => null,
      Tabs: () => null,
      router: {
        push: () => {},
        replace: () => {},
        back: () => {},
      },
    };
  }
  
  return originalRequire.apply(this, arguments);
};

console.log('✅ Preload: React Native mocked');

// Load environment variables
import './test-env';

