/**
 * Validation Script: Chat API
 * 
 * Tests that we can call the chat API and receive streaming responses
 * Requires: Backend server running on TEST_BACKEND_URL
 */

import { authenticateTestUser } from '../setup/test-helpers';
import { createTestConversation } from '../utils/conversation-test';
import { sendChatMessage, parseStreamResponse } from '../utils/chat-api';

async function main() {
  console.log('🧪 Phase 7: Testing Chat API integration...\n');

  console.log('⚠️  Prerequisites:');
  console.log('   - Backend server must be running');
  console.log('   - Run: cd apps/server && bun run dev');
  console.log();

  try {
    // Step 1: Authenticate
    console.log('Step 1: Authenticating...');
    const auth = await authenticateTestUser();
    console.log('✅ Authenticated\n');

    // Step 2: Create conversation
    console.log('Step 2: Creating conversation...');
    const conversationId = await createTestConversation(auth.userId);
    console.log('✅ Conversation created\n');

    // Step 3: Send simple message (no payment required)
    console.log('Step 3: Sending simple chat message...');
    const response = await sendChatMessage(
      'Hello! What can you help me with?',
      conversationId,
      auth.accessToken
    );
    console.log('✅ API responded\n');

    // Step 4: Parse stream
    console.log('Step 4: Parsing streaming response...');
    const parsed = await parseStreamResponse(response);
    console.log('✅ Stream parsed');
    console.log('   Response length:', parsed.fullText.length);
    console.log('   Parts:', parsed.parts.length);
    console.log('   Has payment requirement:', parsed.hasPaymentRequirement, '\n');

    // Step 5: Verify we got actual content
    console.log('Step 5: Verifying AI response content...');
    if (parsed.fullText.length < 10) {
      throw new Error('Response too short, likely empty');
    }
    console.log('✅ AI responded with content\n');

    console.log('Preview of AI response:');
    console.log('─'.repeat(50));
    console.log(parsed.fullText.substring(0, 200) + '...');
    console.log('─'.repeat(50));
    console.log();

    console.log('✅✅✅ Phase 7 COMPLETE: Chat API validated! ✅✅✅\n');
    console.log('💬 Ready to test AI conversations');
    console.log();
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Phase 7 FAILED:', error);
    console.error('\nTroubleshooting:');
    console.error('  1. Make sure backend server is running');
    console.error('     cd apps/server && bun run dev');
    console.error('  2. Check TEST_BACKEND_URL in .env.test');
    console.error('  3. Verify auth token is valid (run validate-auth.ts)');
    console.error('  4. Check server logs for errors');
    process.exit(1);
  }
}

main();

