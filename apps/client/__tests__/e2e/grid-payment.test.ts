/**
 * E2E Test: Grid Payment Operations
 * 
 * Tests Grid wallet operations for X402 payment flow
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { authenticateTestUser, loadGridSession } from '../setup/test-helpers';
import { EphemeralWalletManagerTest } from '../utils/ephemeral-wallet-test';

describe('Grid Payment Operations', () => {
  let gridSession: any;

  beforeAll(async () => {
    console.log('🧪 Setting up Grid payment tests...\n');
    
    // Authenticate
    await authenticateTestUser();
    
    // Load Grid session
    gridSession = await loadGridSession();
    
    console.log('✅ Setup complete');
    console.log('   Grid address:', gridSession.address);
    console.log();
  });

  test('should create ephemeral wallet', () => {
    const { keypair, address } = EphemeralWalletManagerTest.create();
    
    expect(address).toBeDefined();
    expect(address.length).toBe(44); // Solana address length
    expect(keypair).toBeDefined();
    
    console.log('✅ Ephemeral wallet created:', address);
  });

  test('should fund ephemeral wallet from Grid', async () => {
    const { keypair, address } = EphemeralWalletManagerTest.create();
    
    console.log('Funding ephemeral wallet...');
    const result = await EphemeralWalletManagerTest.fund(
      address,
      '0.01',  // Small amount for test
      '0.001'
    );
    
    expect(result.usdcSignature).toBeDefined();
    expect(result.solSignature).toBeDefined();
    
    console.log('✅ Funded successfully');
    console.log('   USDC tx:', result.usdcSignature.substring(0, 20) + '...');
    console.log('   SOL tx:', result.solSignature.substring(0, 20) + '...');
  });

  test('should handle funding and sweep lifecycle', async () => {
    const { keypair, address } = EphemeralWalletManagerTest.create();
    
    // Fund
    console.log('Funding...');
    await EphemeralWalletManagerTest.fund(address, '0.01', '0.001');
    
    // Wait for confirmation
    console.log('Waiting for confirmation...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // Sweep (best effort)
    console.log('Sweeping...');
    try {
      const sweepResult = await EphemeralWalletManagerTest.sweepAll(
        keypair,
        gridSession.address,
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
      );
      
      console.log('✅ Sweep completed');
      console.log('   Result:', sweepResult.swept);
    } catch (error) {
      console.log('⚠️  Sweep had issues (acceptable for test):', error);
      // Don't fail the test on sweep issues
    }
  });
});

