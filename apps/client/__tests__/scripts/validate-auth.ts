/**
 * Validation Script: Supabase Auth
 * 
 * Tests that we can create and authenticate test users
 */

import { createTestUser, authenticateTestUser } from '../setup/test-helpers';

async function main() {
  console.log('🧪 Phase 3: Testing Supabase authentication...\n');

  try {
    // Test 1: Create or verify test user exists
    console.log('Test 1: Creating/verifying test user...');
    const user = await createTestUser();
    console.log('✅ User ready');
    console.log('   User ID:', user.userId);
    console.log('   Email:', user.email, '\n');

    // Test 2: Authenticate with email/password
    console.log('Test 2: Authenticating with email/password...');
    const auth = await authenticateTestUser();
    console.log('✅ Authentication successful');
    console.log('   User ID:', auth.userId);
    console.log('   Email:', auth.email);
    console.log('   Access Token:', auth.accessToken.substring(0, 20) + '...', '\n');

    // Test 3: Verify token format
    console.log('Test 3: Verifying token format...');
    if (!auth.accessToken.startsWith('eyJ')) {
      throw new Error('Token does not appear to be a valid JWT');
    }
    console.log('✅ Token format valid (JWT)\n');

    // Test 4: Verify user IDs match
    console.log('Test 4: Verifying user consistency...');
    if (user.userId !== auth.userId) {
      throw new Error('User IDs do not match between creation and auth');
    }
    console.log('✅ User IDs match\n');

    console.log('✅✅✅ Phase 3 COMPLETE: Supabase auth validated! ✅✅✅\n');
    console.log('🔐 Test user is ready:');
    console.log('   Email:', auth.email);
    console.log('   User ID:', auth.userId);
    console.log();
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Phase 3 FAILED:', error);
    console.error('\nTroubleshooting:');
    console.error('  1. Check EXPO_PUBLIC_SUPABASE_URL in .env.test');
    console.error('  2. Check EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.test');
    console.error('  3. Check TEST_SUPABASE_EMAIL and TEST_SUPABASE_PASSWORD');
    console.error('  4. Verify Supabase project is active');
    console.error('  5. Check if email/password auth is enabled in Supabase dashboard');
    process.exit(1);
  }
}

main();

