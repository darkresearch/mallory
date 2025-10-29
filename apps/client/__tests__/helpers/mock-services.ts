/**
 * Mock Services for Unit Tests
 * 
 * Provides mock implementations of external services
 * for isolated unit testing
 */

import { mock } from 'bun:test';

/**
 * Mock Supabase client for unit tests
 */
export function createMockSupabase() {
  return {
    auth: {
      getSession: mock(() => Promise.resolve({ data: { session: null }, error: null })),
      signInWithPassword: mock(() => Promise.resolve({ data: { user: null, session: null }, error: null })),
      signInWithOAuth: mock(() => Promise.resolve({ data: {}, error: null })),
      signInWithIdToken: mock(() => Promise.resolve({ data: { user: null, session: null }, error: null })),
      signOut: mock(() => Promise.resolve({ error: null })),
      onAuthStateChange: mock((callback: any) => ({
        data: { subscription: { unsubscribe: mock(() => {}) } }
      })),
    },
    from: mock((table: string) => ({
      select: mock(() => ({
        eq: mock(() => ({
          single: mock(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      delete: mock(() => ({
        eq: mock(() => ({
          like: mock(() => Promise.resolve({ data: null, error: null })),
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
    getAccount: mock(() => Promise.resolve(null)),
    startSignIn: mock(() => Promise.resolve({ 
      user: { id: 'mock-grid-user-id' },
      sessionSecrets: { key: 'mock-secret' }
    })),
    completeSignIn: mock(() => Promise.resolve({
      success: true,
      data: {
        address: 'mock-solana-address',
        authentication: { token: 'mock-token' }
      }
    })),
    clearAccount: mock(() => Promise.resolve()),
  };
}

/**
 * Mock expo-router for navigation tests
 */
export function createMockRouter() {
  return {
    push: mock(() => {}),
    replace: mock(() => {}),
    back: mock(() => {}),
    canDismiss: mock(() => false),
    dismissAll: mock(() => {}),
    setParams: mock(() => {}),
  };
}

/**
 * Mock secure storage
 */
export function createMockSecureStorage() {
  const storage = new Map<string, string>();
  
  return {
    setItem: mock(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    getItem: mock(async (key: string) => {
      return storage.get(key) || null;
    }),
    removeItem: mock(async (key: string) => {
      storage.delete(key);
    }),
    clear: mock(async () => {
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
    clearCache: mock(() => {}),
    getWalletData: mock(() => Promise.resolve(null)),
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

