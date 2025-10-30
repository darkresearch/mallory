/**
 * Test Preload Script
 * 
 * This file is loaded BEFORE any tests run to set up the environment.
 * Use with: bun test --preload ./test-preload.ts
 */

/// <reference path="../bun-types.d.ts" />

// Mock React Native core module
const mockReactNative = {
  Platform: {
    OS: 'web',
    Version: '1.0',
    select: (obj: any) => obj.web || obj.default || Object.values(obj)[0],
    constants: {},
    isTV: false,
    isTesting: true,
  },
  StyleSheet: {
    create: (styles: any) => styles,
    flatten: (style: any) => style,
  },
  Dimensions: {
    get: () => ({ width: 375, height: 667 }),
    addEventListener: () => ({ remove: () => {} }),
  },
  AppState: {
    currentState: 'active',
    addEventListener: () => ({ remove: () => {} }),
  },
  Alert: {
    alert: () => {},
  },
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  ScrollView: 'ScrollView',
  TextInput: 'TextInput',
  Image: 'Image',
  Button: 'Button',
};

// Mock Expo Router
const mockExpoRouter = {
  Stack: () => null,
  Tabs: () => null,
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    back: () => {},
    canGoBack: () => false,
    setParams: () => {},
  }),
  usePathname: () => '/',
  useSegments: () => [],
  useLocalSearchParams: () => ({}),
  router: {
    push: () => {},
    replace: () => {},
    back: () => {},
    canGoBack: () => false,
    setParams: () => {},
  },
  Link: 'Link',
  Redirect: 'Redirect',
};

// Mock Expo SecureStore
const mockExpoSecureStore = {
  getItemAsync: async () => null,
  setItemAsync: async () => {},
  deleteItemAsync: async () => {},
};

// Register mocks using Bun's module system
import { plugin } from 'bun';

// Use Bun's test mock system
// @ts-expect-error Bun is a global provided by Bun runtime
if (typeof Bun !== 'undefined' && Bun.jest) {
  // @ts-expect-error Bun is a global provided by Bun runtime
  Bun.jest.mock('react-native', () => mockReactNative);
  // @ts-expect-error Bun is a global provided by Bun runtime
  Bun.jest.mock('expo-router', () => mockExpoRouter);
  // @ts-expect-error Bun is a global provided by Bun runtime
  Bun.jest.mock('expo-secure-store', () => mockExpoSecureStore);
}

console.log('✅ Test preload complete');

