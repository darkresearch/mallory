/**
 * Mock Services for Unit Tests
 * 
 * Provides mock implementations of external services
 * for isolated unit testing
 */

import { jest } from '@jest/globals';

/**
 * Mock Supabase client for unit tests
 */
export function createMockSupabase() {
  return {
    auth: {
      getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      signInWithPassword: jest.fn(() => Promise.resolve({ data: { user: null, session: null }, error: null })),
      signInWithOAuth: jest.fn(() => Promise.resolve({ data: {}, error: null })),
      signInWithIdToken: jest.fn(() => Promise.resolve({ data: { user: null, session: null }, error: null })),
      signOut: jest.fn(() => Promise.resolve({ error: null })),
      onAuthStateChange: jest.fn((callback: any) => ({
        data: { subscription: { unsubscribe: jest.fn(() => {}) } }
      })),
    },
    from: jest.fn((table: string) => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => ({
          like: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
  };
}

/**
 * Mock Grid client for unit tests
 */
export function createMockGridClient() {
  return {
    getAccount: jest.fn(() => Promise.resolve(null)),
    startSignIn: jest.fn(() => Promise.resolve({ 
      user: { id: 'mock-grid-user-id' },
      sessionSecrets: { key: 'mock-secret' }
    })),
    completeSignIn: jest.fn(() => Promise.resolve({
      success: true,
      data: {
        address: 'mock-solana-address',
        authentication: { token: 'mock-token' }
      }
    })),
    clearAccount: jest.fn(() => Promise.resolve()),
  };
}

/**
 * Mock expo-router for navigation tests
 */
export function createMockRouter() {
  return {
    push: jest.fn(() => {}),
    replace: jest.fn(() => {}),
    back: jest.fn(() => {}),
    canDismiss: jest.fn(() => false),
    dismissAll: jest.fn(() => {}),
    setParams: jest.fn(() => {}),
  };
}

/**
 * Mock secure storage
 */
export function createMockSecureStorage() {
  const storage = new Map<string, string>();
  
  return {
    setItem: jest.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    getItem: jest.fn(async (key: string) => {
      return storage.get(key) || null;
    }),
    removeItem: jest.fn(async (key: string) => {
      storage.delete(key);
    }),
    clear: jest.fn(async () => {
      storage.clear();
    }),
    // Access to internal storage for test assertions
    _storage: storage,
  };
}

/**
 * Mock wallet data service
 */
export function createMockWalletDataService() {
  return {
    clearCache: jest.fn(() => {}),
    getWalletData: jest.fn(() => Promise.resolve(null)),
  };
}

/**
 * Create a mock user object
 */
export function createMockUser(overrides = {}) {
  return {
    id: 'mock-user-id',
    email: 'test@example.com',
    displayName: 'Test User',
    profilePicture: 'https://example.com/avatar.jpg',
    instantBuyAmount: 100,
    instayieldEnabled: false,
    hasCompletedOnboarding: true,
    solanaAddress: null,
    gridAccountStatus: 'not_created' as const,
    gridAccountId: null,
    ...overrides,
  };
}

/**
 * Create a mock session object
 */
export function createMockSession(overrides = {}) {
  return {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_at: Date.now() + 3600000, // 1 hour from now
    user: {
      id: 'mock-user-id',
      email: 'test@example.com',
      user_metadata: {
        name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
      },
    },
    ...overrides,
  };
}

