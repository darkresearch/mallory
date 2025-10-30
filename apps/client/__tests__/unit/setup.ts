/**
 * Unit Test Setup
 * 
 * Configuration for React Testing Library unit tests
 * - Mocks React Native components
 * - Sets up test environment
 * - Configures RTL
 */

// Load environment variables first
import '../setup/test-env';

// Import polyfills for React Native
import '../setup/polyfills';

// Configure RTL cleanup
import '@testing-library/jest-dom';

// Mock expo-router
const mockRouter = {
  push: () => {},
  replace: () => {},
  back: () => {},
  canDismiss: () => false,
  dismissAll: () => {},
  setParams: () => {},
};

// Mock window.sessionStorage for tests
global.sessionStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  length: 0,
  key: () => null,
};

// Export mocked router
export { mockRouter };

// Suppress console logs during tests (unless debugging)
const originalConsole = { ...console };
if (!process.env.DEBUG_TESTS) {
  global.console = {
    ...console,
    log: () => {},
    debug: () => {},
    info: () => {},
    warn: () => {},
  };
}

// Restore console for errors
global.console.error = originalConsole.error;

// Clean up after each test
import { cleanup } from '@testing-library/react';
import { afterEach } from 'bun:test';
afterEach(() => {
  cleanup();
});

