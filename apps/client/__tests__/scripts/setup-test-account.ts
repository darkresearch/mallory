/**
 * One-Time Test Account Setup
 * 
 * Creates Supabase user and Grid wallet for automated testing
 * Run this ONCE to set up the test infrastructure
 */

import { createTestUser, authenticateTestUser, createAndCacheGridAccount } from '../setup/test-helpers';

async function main() {
  console.log('🚀 Mallory Test Account Setup\n');
  console.log('━'.repeat(60));
  console.log('This script will:');
  console.log('  1. Create Supabase test user');
  console.log('  2. Create Grid wallet (with OTP via Mailosaur)');
  console.log('  3. Cache credentials for tests');
  console.log('  4. Output wallet address for funding');
  console.log('━'.repeat(60));
  console.log();

  try {
    // Step 1: Create Supabase user
    console.log('📋 Step 1/3: Creating Supabase test user...\n');
    const user = await createTestUser();
    console.log('✅ Supabase user ready');
    console.log('   Email:', user.email);
    console.log('   User ID:', user.userId);
    console.log();

    // Step 2: Create Grid wallet
    console.log('📋 Step 2/3: Creating Grid wallet...\n');
    console.log('⏳ This may take 30-60 seconds...');
    console.log('   - Calling Grid API');
    console.log('   - Waiting for OTP email');
    console.log('   - Verifying account');
    console.log();

    const gridSession = await createAndCacheGridAccount(user.email);
    
    console.log('✅ Grid wallet created!');
    console.log('   Address:', gridSession.address);
    console.log();

    // Step 3: Verify everything is cached
    console.log('📋 Step 3/3: Verifying setup...\n');
    
    const auth = await authenticateTestUser();
    console.log('✅ Can authenticate:', auth.email);
    
    const { loadGridSession } = await import('../setup/test-helpers');
    const loaded = await loadGridSession();
    console.log('✅ Can load Grid session:', loaded.address);
    
    console.log();
    console.log('✅✅✅ SETUP COMPLETE! ✅✅✅\n');
    console.log('━'.repeat(60));
    console.log('📍 NEXT STEP: Fund the wallet\n');
    console.log('Address: ' + gridSession.address);
    console.log('Network: Solana Mainnet');
    console.log('Required:');
    console.log('  - 0.1 SOL (for transaction fees)');
    console.log('  - 5 USDC (for X402 payments)');
    console.log();
    console.log('After funding, verify with:');
    console.log('  bun __tests__/scripts/check-balance.ts');
    console.log('━'.repeat(60));
    console.log();
    
    process.exit(0);
  } catch (error) {
    console.error('❌ SETUP FAILED:', error);
    console.error('\nIf you need to start over:');
    console.error('  1. Delete .test-secrets/test-storage.json');
    console.error('  2. Delete test user from Supabase dashboard');
    console.error('  3. Run this script again');
    process.exit(1);
  }
}

main();

