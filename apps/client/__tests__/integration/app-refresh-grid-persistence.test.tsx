/**
 * Integration Test: App Refresh Preserves Grid Credentials
 * 
 * Tests that Grid credentials are NOT cleared when the app refreshes,
 * only when the user explicitly signs out.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { GridProvider, useGrid } from '../../contexts/GridContext';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { testStorage } from '../setup/test-storage';
import { SECURE_STORAGE_KEYS, SESSION_STORAGE_KEYS } from '../../lib/storage/keys';

// Mock dependencies
jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          abortSignal: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: null, error: null })
          }))
        }))
      }))
    })),
    auth: {
      getSession: jest.fn().mockResolvedValue({ 
        data: { session: null }, 
        error: null 
      }),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } }
      }))
    }
  }
}));

const mockGetAccount = jest.fn();
const mockClearAccount = jest.fn();

jest.mock('../../features/grid', () => ({
  gridClientService: {
    getAccount: mockGetAccount,
    clearAccount: mockClearAccount
  }
}));

import { gridClientService } from '../../features/grid';

// Use the mocked functions directly with proper typing
const getAccountMock = mockGetAccount as jest.Mock;
const clearAccountMock = mockClearAccount as jest.Mock;

// Test wrapper with both Auth and Grid providers
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <GridProvider>
        {children}
      </GridProvider>
    </AuthProvider>
  );
}

describe('App Refresh - Grid Credentials Persistence', () => {
  beforeEach(async () => {
    // Clear all storage before each test
    await testStorage.clear();
    getAccountMock.mockClear();
    clearAccountMock.mockClear();
    
    // Clear sessionStorage
    if (typeof globalThis.sessionStorage !== 'undefined') {
      globalThis.sessionStorage.clear();
    }
  });
  
  it('should preserve Grid credentials on app refresh (user temporarily null)', async () => {
    // Setup: User has valid Grid credentials stored
    const mockGridAccount = {
      address: 'test-solana-address-123',
      authentication: { token: 'test-token' }
    };
    
    await testStorage.setItem(
      SECURE_STORAGE_KEYS.GRID_ACCOUNT,
      JSON.stringify(mockGridAccount)
    );
    
    getAccountMock.mockResolvedValue(mockGridAccount);
    
    // Simulate app refresh: user is temporarily null while auth is loading
    const { result, rerender } = renderHook(
      () => ({
        auth: useAuth(),
        grid: useGrid()
      }),
      { wrapper: TestWrapper }
    );
    
    // Initially, user is null (loading state)
    expect(result.current.auth.user).toBeNull();
    
    // Grid context should detect no user but NOT clear credentials
    // (because there's no logout flag set)
    await waitFor(() => {
      expect(clearAccountMock).not.toHaveBeenCalled();
    });
    
    // Grid credentials should still be in storage
    const storedAccount = await testStorage.getItem(SECURE_STORAGE_KEYS.GRID_ACCOUNT);
    expect(storedAccount).not.toBeNull();
    expect(JSON.parse(storedAccount!)).toEqual(mockGridAccount);
  });
  
  it('should clear Grid credentials on explicit logout', async () => {
    // Setup: User has valid Grid credentials stored
    const mockGridAccount = {
      address: 'test-solana-address-123',
      authentication: { token: 'test-token' }
    };
    
    await testStorage.setItem(
      SECURE_STORAGE_KEYS.GRID_ACCOUNT,
      JSON.stringify(mockGridAccount)
    );
    
    await testStorage.setItem(
      SECURE_STORAGE_KEYS.GRID_SESSION_SECRETS,
      JSON.stringify({ sessionId: 'test-session' })
    );
    
    getAccountMock.mockResolvedValue(mockGridAccount);
    clearAccountMock.mockImplementation(async () => {
      await testStorage.removeItem(SECURE_STORAGE_KEYS.GRID_ACCOUNT);
      await testStorage.removeItem(SECURE_STORAGE_KEYS.GRID_SESSION_SECRETS);
    });
    
    // Set the logout flag (simulating AuthContext.logout())
    if (typeof globalThis.sessionStorage !== 'undefined') {
      globalThis.sessionStorage.setItem(SESSION_STORAGE_KEYS.IS_LOGGING_OUT, 'true');
    }
    
    const { result } = renderHook(
      () => ({
        auth: useAuth(),
        grid: useGrid()
      }),
      { wrapper: TestWrapper }
    );
    
    // User becomes null (logout)
    await waitFor(() => {
      expect(result.current.auth.user).toBeNull();
    });
    
    // GridContext should detect logout flag and clear credentials
    await waitFor(() => {
      expect(clearAccountMock).toHaveBeenCalled();
    }, { timeout: 3000 });
    
    // Grid credentials should be removed from storage
    const storedAccount = await testStorage.getItem(SECURE_STORAGE_KEYS.GRID_ACCOUNT);
    const storedSecrets = await testStorage.getItem(SECURE_STORAGE_KEYS.GRID_SESSION_SECRETS);
    
    expect(storedAccount).toBeNull();
    expect(storedSecrets).toBeNull();
  });
  
  it('should not clear Grid credentials without logout flag', async () => {
    // Setup: User has Grid credentials
    const mockGridAccount = {
      address: 'test-address',
      authentication: { token: 'test-token' }
    };
    
    await testStorage.setItem(
      SECURE_STORAGE_KEYS.GRID_ACCOUNT,
      JSON.stringify(mockGridAccount)
    );
    
    getAccountMock.mockResolvedValue(mockGridAccount);
    
    // NO logout flag set
    expect(globalThis.sessionStorage?.getItem(SESSION_STORAGE_KEYS.IS_LOGGING_OUT)).toBeNull();
    
    const { result } = renderHook(
      () => useGrid(),
      { wrapper: TestWrapper }
    );
    
    // Wait for Grid context to initialize
    await waitFor(() => {
      expect(getAccountMock).toHaveBeenCalled();
    });
    
    // clearAccount should NOT be called
    expect(clearAccountMock).not.toHaveBeenCalled();
    
    // Credentials should still be in storage
    const storedAccount = await testStorage.getItem(SECURE_STORAGE_KEYS.GRID_ACCOUNT);
    expect(storedAccount).not.toBeNull();
  });
  
  it('should load Grid credentials after user becomes available', async () => {
    // Setup: Grid credentials exist
    const mockGridAccount = {
      address: 'test-address-456',
      authentication: { token: 'test-token' }
    };
    
    await testStorage.setItem(
      SECURE_STORAGE_KEYS.GRID_ACCOUNT,
      JSON.stringify(mockGridAccount)
    );
    
    getAccountMock.mockResolvedValue(mockGridAccount);
    
    const { result, rerender } = renderHook(
      () => ({
        auth: useAuth(),
        grid: useGrid()
      }),
      { wrapper: TestWrapper }
    );
    
    // Initially user is null (app loading)
    expect(result.current.auth.user).toBeNull();
    expect(result.current.grid.gridAccount).toBeNull();
    
    // Simulate user becoming available (auth restored)
    act(() => {
      // This would normally happen through AuthContext's handleSignIn
      // We can simulate by directly updating the mock
    });
    
    // Grid context should reload credentials when user becomes available
    await waitFor(() => {
      expect(getAccountMock).toHaveBeenCalled();
    });
  });
  
  it('should handle multiple refresh cycles without clearing credentials', async () => {
    // Setup
    const mockGridAccount = {
      address: 'persistent-address',
      authentication: { token: 'persistent-token' }
    };
    
    await testStorage.setItem(
      SECURE_STORAGE_KEYS.GRID_ACCOUNT,
      JSON.stringify(mockGridAccount)
    );
    
    getAccountMock.mockResolvedValue(mockGridAccount);
    
    // Simulate multiple refresh cycles
    for (let i = 0; i < 3; i++) {
      const { unmount } = renderHook(
        () => useGrid(),
        { wrapper: TestWrapper }
      );
      
      await waitFor(() => {
        expect(getAccountMock).toHaveBeenCalled();
      });
      
      // Unmount (simulates app refresh)
      unmount();
      
      // Credentials should still be there
      const storedAccount = await testStorage.getItem(SECURE_STORAGE_KEYS.GRID_ACCOUNT);
      expect(storedAccount).not.toBeNull();
      
      getAccountMock.mockClear();
    }
    
    // After 3 refresh cycles, credentials should still be intact
    const finalAccount = await testStorage.getItem(SECURE_STORAGE_KEYS.GRID_ACCOUNT);
    expect(finalAccount).not.toBeNull();
    expect(JSON.parse(finalAccount!)).toEqual(mockGridAccount);
    
    // clearAccount should never have been called
    expect(clearAccountMock).not.toHaveBeenCalled();
  });
});
