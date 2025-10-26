/**
 * Validation Script: Conversation Creation
 * 
 * Tests that we can create conversations in Supabase
 */

import { authenticateTestUser } from '../setup/test-helpers';
import { createTestConversation } from '../utils/conversation-test';

async function main() {
  console.log('🧪 Phase 6: Testing conversation creation...\n');

  try {
    // Step 1: Authenticate
    console.log('Step 1: Authenticating...');
    const auth = await authenticateTestUser();
    console.log('✅ Authenticated\n');

    // Step 2: Create conversation
    console.log('Step 2: Creating conversation...');
    const conversationId = await createTestConversation(auth.userId);
    console.log('✅ Conversation created');
    console.log('   ID:', conversationId, '\n');

    // Step 3: Create another conversation (test multiple)
    console.log('Step 3: Creating second conversation...');
    const conversationId2 = await createTestConversation(auth.userId);
    console.log('✅ Second conversation created');
    console.log('   ID:', conversationId2, '\n');

    // Step 4: Verify they're different
    console.log('Step 4: Verifying conversations are unique...');
    if (conversationId === conversationId2) {
      throw new Error('Conversation IDs should be unique');
    }
    console.log('✅ Conversation IDs are unique\n');

    console.log('✅✅✅ Phase 6 COMPLETE: Conversation creation validated! ✅✅✅\n');
    console.log('💬 Ready to create conversations for tests');
    console.log();
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Phase 6 FAILED:', error);
    console.error('\nTroubleshooting:');
    console.error('  1. Check Supabase connection (validate-auth.ts)');
    console.error('  2. Verify conversations table exists in Supabase');
    console.error('  3. Check RLS policies allow insert for authenticated users');
    process.exit(1);
  }
}

main();

