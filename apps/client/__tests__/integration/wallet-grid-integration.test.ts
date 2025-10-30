/**
 * Integration Test - Wallet Holdings with Grid Client
 * 
 * End-to-end test that verifies the wallet holdings flow works correctly
 * with Grid client integration, preventing "gridClientService is not defined" errors
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import '../setup/test-env';
import { authenticateTestUser, loadGridSession } from '../setup/test-helpers';

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

  describe('Grid client availability in wallet service', () => {
    test('should be able to import walletDataService', async () => {
      const { walletDataService } = await import('../../features/wallet');
      
      expect(walletDataService).toBeDefined();
      expect(typeof walletDataService.getWalletData).toBe('function');
      
      console.log('✅ walletDataService imported successfully');
    });

    test('should be able to import gridClientService', async () => {
      const { gridClientService } = await import('../../features/grid');
      
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
      const { gridClientService } = await import('../../features/grid');
      
      // This will use the test storage that was set up
      const account = await gridClientService.getAccount();
      
      expect(account).toBeDefined();
      expect(account.address).toBeDefined();
      expect(typeof account.address).toBe('string');
      
      console.log('✅ Grid account retrieved successfully');
      console.log('   Address:', account.address);
    });
  });

  describe('Error handling', () => {
    test('should handle case when Grid account is not available', async () => {
      const { gridClientService } = await import('../../features/grid');
      
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

  describe('Module integration', () => {
    test('should have correct import chain: wallet -> grid -> lib', async () => {
      // Import in the correct dependency order
      const lib = await import('../../lib');
      const grid = await import('../../features/grid');
      const wallet = await import('../../features/wallet');
      
      // Verify all modules loaded successfully
      expect(lib.secureStorage).toBeDefined();
      expect(lib.config).toBeDefined();
      expect(grid.gridClientService).toBeDefined();
      expect(wallet.walletDataService).toBeDefined();
      
      console.log('✅ Module import chain is correct');
    });
  });
});
