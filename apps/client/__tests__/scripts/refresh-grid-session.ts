/**
 * Refresh Grid Session
 * 
 * Re-authenticates Grid account when session expires
 */

import '../setup/test-env';  // Load environment first
import { gridTestClient } from '../setup/grid-test-client';
import { waitForOTP } from '../setup/mailosaur';
import { testStorage } from '../setup/test-storage';

async function main() {
  console.log('🔄 Refreshing Grid Session\n');
  console.log('This will:');
  console.log('  1. Request new OTP from Grid');
  console.log('  2. Wait for OTP email via Mailosaur');
  console.log('  3. Complete re-authentication');
  console.log('  4. Update cached session');
  console.log();

  try {
    const email = process.env.TEST_SUPABASE_EMAIL;
    if (!email) {
      throw new Error('TEST_SUPABASE_EMAIL not set');
    }

    // Step 1: Initiate re-auth
    console.log('Step 1: Initiating re-authentication...');
    const authData = await gridTestClient.reauthenticate(email);
    console.log('✅ OTP email requested\n');

    // Step 2: Wait for OTP
    console.log('Step 2: Waiting for OTP email...');
    const serverId = process.env.MAILOSAUR_SERVER_ID!;
    const otp = await waitForOTP(serverId, email);
    console.log('✅ OTP received:', otp, '\n');

    // Step 3: Complete re-auth
    console.log('Step 3: Completing re-authentication...');
    const result = await gridTestClient.completeReauth(authData, otp);
    
    if (result.success) {
      console.log('✅ Re-authentication successful!');
      console.log('   Address:', result.data.address);
      console.log('\n✅✅✅ Grid session refreshed! ✅✅✅\n');
      console.log('You can now run tests again.');
      process.exit(0);
    } else {
      throw new Error('Re-authentication failed: ' + result.error);
    }
  } catch (error) {
    console.error('❌ Failed to refresh session:', error);
    console.error('\nTroubleshooting:');
    console.error('  1. Check Mailosaur is working');
    console.error('  2. Check Grid API is accessible');
    console.error('  3. If this fails repeatedly, may need to contact Grid support');
    process.exit(1);
  }
}

main();

