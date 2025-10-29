/**
 * Validation Script: Grid Account Creation
 * 
 * Tests Grid account creation with OTP via Mailosaur
 * WARNING: This will create a real Grid account - only run once!
 */

import { authenticateTestUser, createAndCacheGridAccount } from '../setup/test-helpers';

async function main() {
  console.log('🧪 Phase 4: Testing Grid account creation...\n');
  console.log('⚠️  WARNING: This creates a REAL Grid account');
  console.log('   Only run this ONCE to set up the test account');
  console.log('   After creation, use validate-grid-load.ts to test loading\n');

  try {
    // Step 1: Authenticate
    console.log('Step 1: Authenticating test user...');
    const auth = await authenticateTestUser();
    console.log('✅ Authenticated');
    console.log('   Email:', auth.email, '\n');

    // Step 2: Create Grid account
    console.log('Step 2: Creating Grid account...');
    console.log('   This will:');
    console.log('   1. Call Grid API to create account');
    console.log('   2. Wait for OTP email (may take 30-60 seconds)');
    console.log('   3. Verify account with OTP');
    console.log('   4. Save session secrets to storage\n');

    const gridSession = await createAndCacheGridAccount(auth.email);

    console.log('✅ Grid account created successfully!');
    console.log('   Address:', gridSession.address);
    console.log('   Has authentication:', !!gridSession.authentication);
    console.log('   Has session secrets:', !!gridSession.sessionSecrets, '\n');

    // Step 3: Verify we can access the stored session
    console.log('Step 3: Verifying session was cached...');
    const { loadGridSession } = await import('../setup/test-helpers');
    const loaded = await loadGridSession();
    
    if (loaded.address !== gridSession.address) {
      throw new Error('Loaded address does not match created address');
    }
    
    console.log('✅ Session cached and loadable\n');

    console.log('✅✅✅ Phase 4 COMPLETE: Grid account created! ✅✅✅\n');
    console.log('📍 IMPORTANT: Fund this wallet before running tests:');
    console.log('   Address:', gridSession.address);
    console.log('   Network: Solana Devnet (sandbox)');
    console.log('   Required:');
    console.log('   - 0.1 SOL (for transaction fees)');
    console.log('   - 5 USDC-Dev (for X402 payments)');
    console.log();
    console.log('After funding, run: bun __tests__/scripts/check-balance.ts');
    console.log();
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Phase 4 FAILED:', error);
    console.error('\nTroubleshooting:');
    console.error('  1. Check EXPO_PUBLIC_GRID_ENV in .env.test');
    console.error('  2. Verify backend server is running if needed');
    console.error('  3. Verify Mailosaur is working (run validate-mailosaur.ts)');
    console.error('  4. Check Grid API status');
    console.error('  5. If OTP timeout, check spam folder or try again');
    console.error('  Note: GRID_API_KEY is server-side only');
    process.exit(1);
  }
}

main();

