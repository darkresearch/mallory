/**
 * Test: Grid Spending Limit Approach
 * 
 * Tests using Grid's spending limit feature for transfers
 */

import { loadGridSession, gridTestClient } from '../setup/test-helpers';

async function main() {
  console.log('🧪 Testing Grid spending limit approach...\n');

  try {
    const gridSession = await loadGridSession();
    console.log('Grid address:', gridSession.address);
    console.log();

    // Test creating a spending limit
    console.log('Creating spending limit...');
    
    const spendingLimitResult = await gridTestClient.client.createSpendingLimit(
      gridSession.address,
      {
        amount: 100000, // 0.1 USDC (6 decimals)
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        period: 'one_time',
        destinations: ['6e3oXsDzefqyQ87x7mT2WtT6EfTsAEPyCgs9eN5Nt3zB'], // test address
        spending_limit_signers: []
      }
    );

    console.log('Spending limit result:', JSON.stringify(spendingLimitResult, null, 2));

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

