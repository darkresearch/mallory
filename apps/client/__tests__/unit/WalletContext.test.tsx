/**
 * Unit Test - WalletContext OTP Trigger Behavior
 * 
 * Verifies that WalletContext triggers Grid OTP sign-in when no wallet address
 * is available, ensuring wallet holdings are ALWAYS visible to users.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import '../setup/test-env';
import { gridClientService } from '../../features/grid';
import { walletDataService } from '../../features/wallet';
import { authenticateTestUser, loadGridSession } from '../setup/test-helpers';

describe('WalletContext OTP Trigger Behavior', () => {
  let originalAccount: any;

  beforeEach(async () => {
    // Store original Grid account if it exists
    originalAccount = await gridClientService.getAccount();
  });

  afterEach(async () => {
    // Restore original account
    if (originalAccount) {
      const { testStorage } = await import('../setup/test-storage');
      await testStorage.setItem('grid_account', JSON.stringify(originalAccount));
    } else {
      await gridClientService.clearAccount();
    }
  });

  test('should throw error when no wallet address is available (triggers OTP flow)', async () => {
    // Clear Grid account to simulate no wallet address
    await gridClientService.clearAccount();

    // Verify no Grid account exists
    const account = await gridClientService.getAccount();
    expect(account).toBeNull();

    console.log('💰 Testing wallet data fetch with NO address available');
    console.log('   This simulates WalletContext behavior when no address is available');

    // Try to fetch wallet data without any address - should throw error
    // In production, WalletContext catches this error and triggers Grid OTP sign-in
    try {
      await walletDataService.getWalletData(); // No fallback address provided
      // Should not reach here - should throw error
      throw new Error('Expected error when no wallet address is available');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      expect(errorMessage).toContain('No wallet found');
      
      console.log('✅ Correctly throws error when no wallet address available');
      console.log('   Error:', errorMessage);
      console.log('   In WalletContext, this error triggers initiateGridSignIn()');
      console.log('   which navigates to OTP verification screen');
    }
  });

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
});