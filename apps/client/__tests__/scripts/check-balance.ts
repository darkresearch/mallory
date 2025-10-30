/**
 * Check Grid Wallet Balance
 * 
 * Utility script to check if test wallet is funded
 */

import { loadGridSession, gridTestClient } from '../setup/test-helpers';

async function main() {
  console.log('💰 Checking Grid wallet balance...\n');

  try {
    // Load Grid session
    const session = await loadGridSession();
    console.log('Grid Wallet Address:', session.address);
    console.log();

    // Fetch balances
    console.log('Fetching balances from Grid API...');
    const balances = await gridTestClient.getAccountBalances(session.address);

    if (!balances.data) {
      console.error('❌ No balance data returned');
      process.exit(1);
    }

    const solBalance = balances.data.sol || 0;
    const tokens = balances.data.tokens || [];

    console.log('✅ Balance fetched successfully\n');
    console.log('SOL Balance:', solBalance);
    console.log();

    if (tokens.length > 0) {
      console.log('Token Balances:');
      tokens.forEach((token: any) => {
        const amount = token.amount_decimal || token.amount;
        const symbol = token.symbol || 'UNKNOWN';
        console.log(`  ${symbol}: ${amount}`);
      });
      console.log();
    } else {
      console.log('No tokens found\n');
    }

    // Check if wallet is sufficiently funded
    const usdcToken = tokens.find((t: any) => 
      t.symbol === 'USDC' || t.symbol?.toUpperCase().includes('USDC')
    );
    const usdcBalance = usdcToken ? parseFloat(String(usdcToken.amount_decimal || usdcToken.amount)) : 0;

    console.log('Funding Status:');
    const solOk = solBalance >= 0.01;
    const usdcOk = usdcBalance >= 0.1;

    console.log(`  SOL:  ${solOk ? '✅' : '❌'} ${solBalance} (need >= 0.01)`);
    console.log(`  USDC: ${usdcOk ? '✅' : '❌'} ${usdcBalance} (need >= 0.1)`);
    console.log();

    if (solOk && usdcOk) {
      console.log('✅✅✅ Wallet is sufficiently funded for tests! ✅✅✅');
      process.exit(0);
    } else {
      console.log('⚠️  Wallet needs funding before running tests');
      console.log('\nPlease send to:', session.address);
      if (!solOk) console.log('  - At least 0.1 SOL');
      if (!usdcOk) console.log('  - At least 5 USDC');
      console.log();
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Failed to check balance:', error);
    console.error('\nTroubleshooting:');
    console.error('  1. Make sure Grid account was created (run validate-grid.ts)');
    console.error('  2. Check Grid API key is valid');
    console.error('  3. Verify network connection');
    process.exit(1);
  }
}

main();

