/**
 * Validation Script: Ephemeral Wallet Operations
 * 
 * Tests ephemeral wallet creation, funding, and sweep
 * WARNING: This uses real funds from the test wallet
 */

import { loadGridSession } from '../setup/test-helpers';
import { EphemeralWalletManagerTest } from '../utils/ephemeral-wallet-test';

async function main() {
  console.log('🧪 Phase 9a: Testing ephemeral wallet operations...\n');
  
  console.log('⚠️  This test uses REAL funds:');
  console.log('   - Sends ~0.10 USDC + 0.002 SOL to ephemeral wallet');
  console.log('   - Sweeps everything back to Grid');
  console.log('   - Net cost: ~$0.001 (transaction fees)');
  console.log();

  try {
    // Step 1: Load Grid session
    console.log('Step 1: Loading Grid session...');
    const gridSession = await loadGridSession();
    console.log('✅ Grid session loaded');
    console.log('   Address:', gridSession.address, '\n');

    // Step 2: Create ephemeral wallet
    console.log('Step 2: Creating ephemeral wallet...');
    const { keypair, address } = EphemeralWalletManagerTest.create();
    console.log('✅ Ephemeral wallet created');
    console.log('   Address:', address, '\n');

    // Step 3: Fund from Grid
    console.log('Step 3: Funding ephemeral wallet from Grid...');
    console.log('   Sending 0.10 USDC + 0.002 SOL...');
    const { usdcSignature, solSignature } = await EphemeralWalletManagerTest.fund(
      address,
      '0.10',
      '0.002'
    );
    console.log('✅ Funding complete');
    console.log('   USDC tx:', usdcSignature.substring(0, 20) + '...');
    console.log('   SOL tx:', solSignature.substring(0, 20) + '...\n');

    // Step 4: Wait for confirmation (need longer for ATA creation)
    console.log('Step 4: Waiting for blockchain confirmation...');
    console.log('   (Waiting 10s for ATA creation and funding to confirm)');
    await new Promise(resolve => setTimeout(resolve, 10000));
    console.log('✅ Transactions should be confirmed\n');

    // Step 5: Sweep back to Grid
    console.log('Step 5: Sweeping funds back to Grid...');
    const result = await EphemeralWalletManagerTest.sweepAll(
      keypair,
      gridSession.address,
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // USDC
    );

    console.log('✅ Sweep complete');
    console.log('   Tokens swept:', result.swept.tokens);
    console.log('   SOL swept:', result.swept.sol);
    console.log('   Rent recovered:', result.swept.rentRecovered, '\n');

    console.log('✅✅✅ Phase 9a COMPLETE: Ephemeral wallet validated! ✅✅✅\n');
    console.log('💰 Ephemeral wallet lifecycle works perfectly');
    console.log();
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Phase 9a FAILED:', error);
    console.error('\nTroubleshooting:');
    console.error('  1. Check Grid wallet is funded (run check-balance.ts)');
    console.error('  2. Verify EXPO_PUBLIC_SOLANA_RPC_URL is correct');
    console.error('  3. Check Solana network status');
    console.error('  4. Verify Grid session is valid (run validate-grid-load.ts)');
    process.exit(1);
  }
}

main();

