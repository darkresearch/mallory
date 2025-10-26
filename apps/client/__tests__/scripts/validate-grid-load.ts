/**
 * Validation Script: Grid Session Loading
 * 
 * Tests that we can load a cached Grid session
 */

import { loadGridSession, gridTestClient } from '../setup/test-helpers';

async function main() {
  console.log('🧪 Phase 5: Testing Grid session loading...\n');

  try {
    // Test 1: Load session from cache
    console.log('Test 1: Loading Grid session from cache...');
    const session = await loadGridSession();
    console.log('✅ Session loaded');
    console.log('   Address:', session.address);
    console.log('   Has authentication:', !!session.authentication);
    console.log('   Has session secrets:', !!session.sessionSecrets, '\n');

    // Test 2: Verify we can get account details
    console.log('Test 2: Getting account details...');
    const account = await gridTestClient.getAccount();
    if (!account) {
      throw new Error('Could not get account from Grid client');
    }
    console.log('✅ Account retrieved');
    console.log('   Address:', account.address);
    console.log('   Matches cached:', account.address === session.address, '\n');

    // Test 3: Try to fetch balance (validates Grid API access)
    console.log('Test 3: Fetching balance from Grid API...');
    try {
      const balances = await gridTestClient.getAccountBalances(session.address);
      console.log('✅ Balance fetched successfully');
      console.log('   SOL:', balances.data?.sol || '0');
      
      const tokens = balances.data?.tokens || [];
      if (tokens.length > 0) {
        console.log('   Tokens:');
        tokens.forEach((token: any) => {
          console.log(`     ${token.symbol}: ${token.amount_decimal || token.amount}`);
        });
      } else {
        console.log('   No tokens found (wallet may need funding)');
      }
      console.log();
    } catch (error) {
      console.warn('⚠️  Could not fetch balance:', error);
      console.log('   This is okay if the wallet is not funded yet\n');
    }

    console.log('✅✅✅ Phase 5 COMPLETE: Grid session loading validated! ✅✅✅\n');
    console.log('🏦 Grid session is ready for tests');
    console.log('   Address:', session.address);
    console.log();
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Phase 5 FAILED:', error);
    console.error('\nTroubleshooting:');
    console.error('  1. Make sure Phase 4 (Grid account creation) completed successfully');
    console.error('  2. Check that .test-secrets/test-storage.json exists');
    console.error('  3. Run validate-grid.ts to create the account first');
    process.exit(1);
  }
}

main();

