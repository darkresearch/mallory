/**
 * Unit Tests for Wallet Data Service
 * 
 * Tests that ensure wallet data service properly integrates with Grid client
 * and prevents the "gridClientService is not defined" error
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import '../setup/test-env';

describe('WalletDataService', () => {
  describe('Module imports and dependencies', () => {
    test('should have gridClientService imported in data.ts', async () => {
      // Read the data.ts file and verify it imports gridClientService
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const dataFilePath = path.join(process.cwd(), 'features/wallet/services/data.ts');
      const fileContents = await fs.readFile(dataFilePath, 'utf-8');
      
      // Check that gridClientService is imported
      expect(fileContents).toContain("import { gridClientService }");
      expect(fileContents).toContain("from '../../grid'");
      
      console.log('✅ gridClientService is properly imported in data.ts');
    });
    
    test('should export gridClientService from grid/services', async () => {
      // Verify that gridClientService is properly exported from the grid module
      const { gridClientService } = await import('../../../features/grid');
      
      expect(gridClientService).toBeDefined();
      expect(typeof gridClientService.getAccount).toBe('function');
      expect(typeof gridClientService.startSignIn).toBe('function');
      expect(typeof gridClientService.completeSignIn).toBe('function');
      
      console.log('✅ gridClientService is properly exported from grid module');
    });
    
    test('should have all required methods on gridClientService', async () => {
      const { gridClientService } = await import('../../../features/grid');
      
      // Verify all methods that wallet data service depends on
      const requiredMethods = [
        'getAccount',
        'startSignIn', 
        'completeSignIn',
        'sendTokens',
        'clearAccount'
      ];
      
      for (const method of requiredMethods) {
        expect(typeof (gridClientService as any)[method]).toBe('function');
      }
      
      console.log('✅ All required gridClientService methods are available');
    });
  });
  
  describe('Grid client integration in fetchEnrichedHoldings', () => {
    test('should be able to import walletDataService without errors', async () => {
      // This test will fail at import time if gridClientService is not defined
      const { walletDataService } = await import('../../../features/wallet');
      
      expect(walletDataService).toBeDefined();
      expect(typeof walletDataService.getWalletData).toBe('function');
      expect(typeof walletDataService.refreshWalletData).toBe('function');
      
      console.log('✅ walletDataService imports successfully (no undefined dependencies)');
    });
    
    test('should have gridClientService.getAccount called in data.ts', async () => {
      // Verify that the data.ts file actually uses gridClientService.getAccount()
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const dataFilePath = path.join(process.cwd(), 'features/wallet/services/data.ts');
      const fileContents = await fs.readFile(dataFilePath, 'utf-8');
      
      // Check that gridClientService.getAccount() is called
      expect(fileContents).toContain('gridClientService.getAccount()');
      
      console.log('✅ gridClientService.getAccount() is used in data.ts');
    });
  });
  
  describe('Module dependency graph', () => {
    test('should maintain correct import order: lib -> grid -> wallet', async () => {
      // Verify that modules can be imported in the correct dependency order
      
      // 1. First, lib should work standalone
      const lib = await import('../../../lib');
      expect(lib.secureStorage).toBeDefined();
      expect(lib.config).toBeDefined();
      
      // 2. Then grid (depends on lib)
      const grid = await import('../../../features/grid');
      expect(grid.gridClientService).toBeDefined();
      
      // 3. Finally wallet (depends on lib + grid)
      const wallet = await import('../../../features/wallet');
      expect(wallet.walletDataService).toBeDefined();
      
      console.log('✅ Module dependency order is correct');
    });
  });
});
