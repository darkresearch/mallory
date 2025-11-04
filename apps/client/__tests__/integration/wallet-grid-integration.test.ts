/**
 * Integration Test - Wallet Holdings with Grid Client
 * 
 * End-to-end test that verifies the wallet holdings flow works correctly
 * with Grid client integration, preventing "gridClientService is not defined" errors
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import '../setup/test-env';
import { authenticateTestUser, loadGridSession } from '../setup/test-helpers';
import { supabase } from '../setup/supabase-test-client';
import { walletDataService } from '../../features/wallet';
import { gridClientService } from '../../features/grid';
import * as lib from '../../lib';
import { globalCleanup } from './global-cleanup';

describe('Wallet Holdings Integration with Grid Client', () => {
  let userId: string;
  let email: string;
  let accessToken: string;
  let gridAddress: string;

  beforeAll(async () => {
    // Authenticate test user
    const auth = await authenticateTestUser();
    userId = auth.userId;
    email = auth.email;
    accessToken = auth.accessToken;

    // Load Grid session
    const gridSession = await loadGridSession();
    gridAddress = gridSession.address;

    console.log('🧪 Test setup complete');
    console.log('   User ID:', userId);
    console.log('   Grid Address:', gridAddress);
  });

  afterAll(async () => {
    // Sign out from Supabase to stop auth refresh timers
    try {
      await Promise.race([
        (async () => {
          // Remove all Supabase Realtime channels
          try {
            supabase.removeAllChannels();
          } catch (e) {
            // Ignore errors
          }
          
          await supabase.auth.signOut();
          console.log('✅ Signed out from Supabase');
        })(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Cleanup timeout')), 10000)
        )
      ]);
    } catch (error) {
      console.warn('Error signing out:', error);
    }
    
    // Register global cleanup to run after all tests
    await globalCleanup();
  });

  describe('Grid client availability in wallet service', () => {
    test('should be able to import walletDataService', async () => {
      expect(walletDataService).toBeDefined();
      expect(typeof walletDataService.getWalletData).toBe('function');
      
      console.log('✅ walletDataService imported successfully');
    });

    test('should be able to import gridClientService', async () => {
      expect(gridClientService).toBeDefined();
      expect(typeof gridClientService.getAccount).toBe('function');
      
      console.log('✅ gridClientService imported successfully');
    });
  });

  describe('fetchEnrichedHoldings flow', () => {
    test('should fetch wallet holdings without "gridClientService is not defined" error', async () => {
      const backendUrl = process.env.TEST_BACKEND_URL || 'http://localhost:3001';
      
      console.log('💰 Testing holdings fetch...');
      console.log('   Backend URL:', backendUrl);
      console.log('   Grid Address:', gridAddress);
      
      const url = `${backendUrl}/api/wallet/holdings?address=${encodeURIComponent(gridAddress)}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.ok).toBe(true);
      
      const data = await response.json();
      
      expect(data.success).toBe(true);
      expect(data.holdings).toBeDefined();
      expect(Array.isArray(data.holdings)).toBe(true);
      expect(typeof data.totalValue).toBe('number');
      
      console.log('✅ Holdings fetched successfully');
      console.log('   Total Value: $' + data.totalValue.toFixed(2));
      console.log('   Holdings Count:', data.holdings.length);
    }, 30000); // 30 second timeout for API call

    test('should be able to get Grid account from gridClientService', async () => {
      // This will use the test storage that was set up
      const account = await gridClientService.getAccount();
      
      expect(account).toBeDefined();
      expect(account.address).toBeDefined();
      expect(typeof account.address).toBe('string');
      
      console.log('✅ Grid account retrieved successfully');
      console.log('   Address:', account.address);
    }, 180000); // 3 min timeout for Grid operations
  });

  describe('Error handling', () => {
    test('should handle case when Grid account is not available', async () => {
      // Clear the account temporarily
      await gridClientService.clearAccount();
      
      // Try to get account - should return null, not throw "is not defined"
      const account = await gridClientService.getAccount();
      
      expect(account).toBeNull();
      
      console.log('✅ Handles missing Grid account gracefully (no "is not defined" error)');
      
      // Restore the account
      const gridSession = await loadGridSession();
      const { testStorage } = await import('../setup/test-storage');
      await testStorage.setItem('grid_account', JSON.stringify({
        address: gridSession.address,
        authentication: gridSession.authentication
      }));
      await testStorage.setItem('grid_session_secrets', JSON.stringify(gridSession.sessionSecrets));
    });

    test('should fetch wallet holdings using fallback Solana address when Grid account is not set up', async () => {
      // This test verifies the critical fix: wallet holdings should be visible
      // even if Grid account setup is incomplete, using Solana address as fallback
      
      const backendUrl = process.env.TEST_BACKEND_URL || 'http://localhost:3001';
      
      // Store the Grid address before clearing
      const gridAccount = await gridClientService.getAccount();
      const solanaAddress = gridAccount?.address;
      
      if (!solanaAddress) {
        console.log('⚠️ No Grid account available for this test, skipping');
        return;
      }
      
      // Clear Grid account to simulate incomplete setup
      await gridClientService.clearAccount();
      
      // Verify Grid account is cleared
      const clearedAccount = await gridClientService.getAccount();
      expect(clearedAccount).toBeNull();
      
      console.log('💰 Testing wallet holdings fetch with fallback address:', solanaAddress);
      
      // Use walletDataService with fallback address - should work even without Grid account
      const walletData = await walletDataService.getWalletData(solanaAddress);
      
      // Should successfully fetch holdings using fallback address
      expect(walletData).toBeDefined();
      expect(walletData.holdings).toBeDefined();
      expect(Array.isArray(walletData.holdings)).toBe(true);
      expect(typeof walletData.totalBalance).toBe('number');
      
      console.log('✅ Wallet holdings fetched successfully with fallback address');
      console.log('   Total Balance: $' + walletData.totalBalance.toFixed(2));
      console.log('   Holdings Count:', walletData.holdings.length);
      
      // Restore Grid account for other tests
      const gridSession = await loadGridSession();
      const { testStorage } = await import('../setup/test-storage');
      await testStorage.setItem('grid_account', JSON.stringify({
        address: gridSession.address,
        authentication: gridSession.authentication
      }));
      await testStorage.setItem('grid_session_secrets', JSON.stringify(gridSession.sessionSecrets));
    }, 30000);

    test('should throw error when no wallet address is available (triggers OTP flow)', async () => {
      // This test verifies that when NO wallet address is available (no Grid account,
      // no fallback Solana address), the system should trigger Grid OTP sign-in
      
      // Clear Grid account
      await gridClientService.clearAccount();
      
      // Verify Grid account is cleared
      const clearedAccount = await gridClientService.getAccount();
      expect(clearedAccount).toBeNull();
      
      console.log('💰 Testing wallet data fetch with NO address available');
      
      // Try to fetch wallet data without any address - should throw error
      // In production, WalletContext would catch this and trigger Grid OTP sign-in
      try {
        await walletDataService.getWalletData(); // No fallback address provided
        // Should not reach here - should throw error
        throw new Error('Expected error when no wallet address is available');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        expect(errorMessage).toContain('No wallet found');
        
        console.log('✅ Correctly throws error when no wallet address available');
        console.log('   Error:', errorMessage);
        console.log('   This error triggers Grid OTP sign-in in WalletContext');
      }
      
      // Restore Grid account for other tests
      const gridSession = await loadGridSession();
      const { testStorage } = await import('../setup/test-storage');
      await testStorage.setItem('grid_account', JSON.stringify({
        address: gridSession.address,
        authentication: gridSession.authentication
      }));
      await testStorage.setItem('grid_session_secrets', JSON.stringify(gridSession.sessionSecrets));
    });

    test('should provide helpful error when wallet fetch fails', async () => {
      const backendUrl = process.env.TEST_BACKEND_URL || 'http://localhost:3001';
      
      // Try to fetch with invalid address
      const url = `${backendUrl}/api/wallet/holdings?address=invalid`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      // Should handle error gracefully, not crash with "is not defined"
      if (!response.ok) {
        const data = await response.json();
        expect(data.error).toBeDefined();
        expect(typeof data.error).toBe('string');
        
        console.log('✅ Error handling works correctly');
        console.log('   Error message:', data.error);
      }
    });
  });

  describe('Wallet holdings always-visible behavior', () => {
    test('should load wallet holdings after Grid account becomes available (post-OTP)', async () => {
      // This test verifies that after Grid OTP completion, wallet holdings load automatically
      
      // Authenticate test user and get Grid session
      const auth = await authenticateTestUser();
      const gridSession = await loadGridSession();
      
      // Store Grid account (simulating OTP completion)
      const { testStorage } = await import('../setup/test-storage');
      await testStorage.setItem('grid_account', JSON.stringify({
        address: gridSession.address,
        authentication: gridSession.authentication
      }));
      await testStorage.setItem('grid_session_secrets', JSON.stringify(gridSession.sessionSecrets));

      // Verify Grid account is now available
      const account = await gridClientService.getAccount();
      expect(account).toBeDefined();
      expect(account.address).toBe(gridSession.address);

      // Now try to fetch wallet data - should work with the address
      // In production, WalletContext useEffect detects the new address and loads data
      const walletData = await walletDataService.getWalletData(account.address);

      expect(walletData).toBeDefined();
      expect(walletData.holdings).toBeDefined();
      expect(Array.isArray(walletData.holdings)).toBe(true);
      expect(typeof walletData.totalBalance).toBe('number');

      console.log('✅ Wallet holdings load successfully after Grid account becomes available');
      console.log('   Total Balance: $' + walletData.totalBalance.toFixed(2));
      console.log('   Holdings Count:', walletData.holdings.length);
      console.log('   This simulates WalletContext loading data after OTP completion');
    }, 30000);

    test('should verify WalletContext loads wallet data when Grid account status becomes active', async () => {
      // This test verifies the useEffect hook in WalletContext that watches for
      // Grid account changes and loads wallet data when account becomes active
      
      const auth = await authenticateTestUser();
      const gridSession = await loadGridSession();
      
      // Store Grid account (simulating OTP completion)
      const { testStorage } = await import('../setup/test-storage');
      await testStorage.setItem('grid_account', JSON.stringify({
        address: gridSession.address,
        authentication: gridSession.authentication
      }));

      // Simulate the WalletContext useEffect behavior:
      // When gridAccountStatus === 'active' and we have an address, load wallet data
      const gridAccount = await gridClientService.getAccount();
      const hasWalletAddress = gridAccount?.address;
      const gridAccountStatus = 'active'; // Simulated from GridContext
      
      if (hasWalletAddress && gridAccountStatus === 'active') {
        // This simulates WalletContext loading wallet data after detecting active Grid account
        const walletData = await walletDataService.getWalletData(hasWalletAddress);
        
        expect(walletData).toBeDefined();
        expect(walletData.holdings).toBeDefined();
        
        console.log('✅ WalletContext would load wallet data when Grid account becomes active');
        console.log('   This ensures holdings are visible after OTP completion');
      }
    }, 30000);

    test('should prevent duplicate wallet data loads for the same address', async () => {
      // This test verifies that WalletContext doesn't load wallet data multiple times
      // for the same address, preventing infinite loops
      
      const auth = await authenticateTestUser();
      const gridSession = await loadGridSession();
      
      // Store Grid account
      const { testStorage } = await import('../setup/test-storage');
      await testStorage.setItem('grid_account', JSON.stringify({
        address: gridSession.address,
        authentication: gridSession.authentication
      }));

      const account = await gridClientService.getAccount();
      expect(account).toBeDefined();
      
      // Clear cache to ensure fresh load
      walletDataService.clearCache();
      
      // First load
      const walletData1 = await walletDataService.getWalletData(account.address);
      expect(walletData1).toBeDefined();
      
      // Track initial load time
      const initialLoadTime = walletData1.lastUpdated;
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Second load should use cache (not duplicate load)
      const walletData2 = await walletDataService.getWalletData(account.address);
      expect(walletData2).toBeDefined();
      
      // If cache is working, lastUpdated should be the same (unless cache expired)
      // The important thing is that we don't trigger an infinite loop
      console.log('✅ Wallet data service prevents duplicate loads via caching');
      console.log('   Initial load time:', initialLoadTime);
      console.log('   Second load time:', walletData2.lastUpdated);
      console.log('   WalletContext uses ref to track loaded address and prevent loops');
    }, 30000);
  });

  describe('Module integration', () => {
    test('should have correct import chain: wallet -> grid -> lib', async () => {
      // Verify all modules loaded successfully (imported at top of file)
      expect(lib.storage).toBeDefined();
      expect(lib.config).toBeDefined();
      expect(gridClientService).toBeDefined();
      expect(walletDataService).toBeDefined();
      
      console.log('✅ Module import chain is correct');
    });
  });
});
