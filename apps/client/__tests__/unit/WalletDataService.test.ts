/**
 * Unit Tests for Wallet Data Service
 * 
 * Tests that ensure wallet data service properly integrates with Grid client
 * and prevents the "gridClientService is not defined" error
 */

import { describe, test, expect } from 'bun:test';
import { readFile } from 'fs/promises';
import { join } from 'path';
import '../setup/test-env';

describe('WalletDataService', () => {
  describe('Module imports and dependencies', () => {
    test('should have gridClientService imported in data.ts', async () => {
      // Read the data.ts file and verify it imports gridClientService
      const dataFilePath = join(process.cwd(), 'features/wallet/services/data.ts');
      const fileContents = await readFile(dataFilePath, 'utf-8');
      
      // Check that gridClientService is imported
      expect(fileContents).toContain("import { gridClientService }");
      expect(fileContents).toContain("from '../../grid'");
      
      console.log('✅ gridClientService is properly imported in data.ts');
    });
    
    test('should export gridClientService from grid/services/index.ts', async () => {
      // Verify that gridClientService is exported from the grid services index
      const gridServicesIndexPath = join(process.cwd(), 'features/grid/services/index.ts');
      const fileContents = await readFile(gridServicesIndexPath, 'utf-8');
      
      // Check that it re-exports from gridClient
      expect(fileContents).toContain("export * from './gridClient'");
      
      console.log('✅ grid/services/index.ts exports from gridClient');
    });
    
    test('should have gridClientService class defined in gridClient.ts', async () => {
      // Verify that GridClientService class exists
      const gridClientPath = join(process.cwd(), 'features/grid/services/gridClient.ts');
      const fileContents = await readFile(gridClientPath, 'utf-8');
      
      // Check for GridClientService class and instance export
      expect(fileContents).toContain('class GridClientService');
      expect(fileContents).toContain('export const gridClientService = new GridClientService()');
      
      // Verify required methods exist
      const requiredMethods = [
        'getAccount(',
        'startSignIn(',
        'completeSignIn(',
        'sendTokens(',
        'clearAccount('
      ];
      
      for (const method of requiredMethods) {
        expect(fileContents).toContain(method);
      }
      
      console.log('✅ GridClientService class has all required methods');
    });
  });
  
  describe('Grid client integration in fetchEnrichedHoldings', () => {
    test('should use gridClientService.getAccount in data.ts', async () => {
      // Verify that the data.ts file actually uses gridClientService.getAccount()
      const dataFilePath = join(process.cwd(), 'features/wallet/services/data.ts');
      const fileContents = await readFile(dataFilePath, 'utf-8');
      
      // Check that gridClientService.getAccount() is called
      expect(fileContents).toContain('gridClientService.getAccount()');
      
      console.log('✅ gridClientService.getAccount() is used in data.ts');
    });
    
    test('should have walletDataService exported from wallet module', async () => {
      // Check that walletDataService is exported
      const dataFilePath = join(process.cwd(), 'features/wallet/services/data.ts');
      const fileContents = await readFile(dataFilePath, 'utf-8');
      
      // Check for walletDataService instance export
      expect(fileContents).toContain('class WalletDataService');
      expect(fileContents).toContain('export const walletDataService = new WalletDataService()');
      
      console.log('✅ walletDataService is properly exported');
    });
  });
  
  describe('Module dependency graph', () => {
    test('should maintain correct import order: lib -> grid -> wallet', async () => {
      // Verify import dependencies by analyzing imports in each file
      
      // 1. Check that grid imports lib
      const gridClientPath = join(process.cwd(), 'features/grid/services/gridClient.ts');
      const gridContents = await readFile(gridClientPath, 'utf-8');
      expect(gridContents).toContain("from '@/lib'");
      
      // 2. Check that wallet imports both lib and grid
      const walletDataPath = join(process.cwd(), 'features/wallet/services/data.ts');
      const walletContents = await readFile(walletDataPath, 'utf-8');
      expect(walletContents).toContain("from '../../../lib'");
      expect(walletContents).toContain("from '../../grid'");
      
      console.log('✅ Module dependency order is correct: lib -> grid -> wallet');
    });
    
    test('should not have circular dependencies', async () => {
      // Check that lib doesn't import from grid or wallet
      const configPath = join(process.cwd(), 'lib/config.ts');
      const configContents = await readFile(configPath, 'utf-8');
      
      expect(configContents).not.toContain("from '../features/grid");
      expect(configContents).not.toContain("from '../features/wallet");
      
      // Check that grid doesn't import from wallet
      const gridClientPath = join(process.cwd(), 'features/grid/services/gridClient.ts');
      const gridContents = await readFile(gridClientPath, 'utf-8');
      
      expect(gridContents).not.toContain("from '../../wallet");
      
      console.log('✅ No circular dependencies detected');
    });
  });
  
  describe('Error prevention', () => {
    test('should not use gridClientService without importing it', async () => {
      // This is a regression test for the original bug
      const dataFilePath = join(process.cwd(), 'features/wallet/services/data.ts');
      const fileContents = await readFile(dataFilePath, 'utf-8');
      
      // If gridClientService is used, it must be imported
      const usesGridClientService = fileContents.includes('gridClientService.');
      const importsGridClientService = fileContents.includes('import { gridClientService }');
      
      if (usesGridClientService) {
        expect(importsGridClientService).toBe(true);
      }
      
      console.log('✅ gridClientService is imported before use');
    });
  });
});
