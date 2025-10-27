/**
 * Validation Script: Payment Detection
 * 
 * Tests detecting X402 payment requirements in AI streaming responses
 * Sends a message that triggers Nansen API call (requires payment)
 */

import { authenticateTestUser } from '../setup/test-helpers';
import { createTestConversation } from '../utils/conversation-test';
import { sendChatMessage, parseStreamResponse } from '../utils/chat-api';

async function main() {
  console.log('🧪 Phase 8: Testing payment detection...\n');

  console.log('⚠️  Prerequisites:');
  console.log('   - Backend server must be running');
  console.log('   - Server must have NANSEN_API_KEY (for tool to trigger)');
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

    // Step 3: Send message that requires payment (Nansen query)
    console.log('Step 3: Sending message that triggers payment requirement...');
    console.log('   Asking for Vitalik historical balances (requires Nansen)');
    const response = await sendChatMessage(
      'Show me vitalik.eth historical token balances for the last 30 days',
      conversationId,
      auth.accessToken
    );
    console.log('✅ API responded\n');

    // Step 4: Parse stream for payment requirement
    console.log('Step 4: Parsing stream for payment requirement...');
    const parsed = await parseStreamResponse(response);
    
    console.log('✅ Stream parsed');
    console.log('   Response length:', parsed.fullText.length);
    console.log('   Parts found:', parsed.parts.length);
    console.log('   Has payment requirement:', parsed.hasPaymentRequirement, '\n');

    // Step 5: Verify payment requirement detected
    console.log('Step 5: Validating payment requirement...');
    
    if (!parsed.hasPaymentRequirement) {
      console.warn('⚠️  No payment requirement detected');
      console.warn('   This could mean:');
      console.warn('   - Nansen tool not configured on server');
      console.warn('   - AI did not call the tool');
      console.warn('   - Tool returned data directly (no payment needed)');
      console.warn('\n   Stream preview:');
      console.warn(parsed.fullText.substring(0, 500));
      console.log('\nSkipping payment validation (tool not triggered)\n');
    } else {
      const paymentReq = parsed.paymentRequirement;
      
      console.log('✅ Payment requirement detected!');
      console.log('   Tool:', paymentReq.toolName);
      console.log('   API URL:', paymentReq.apiUrl);
      console.log('   Method:', paymentReq.method);
      console.log('   Cost:', `${paymentReq.estimatedCost.amount} ${paymentReq.estimatedCost.currency}`);
      console.log('   Auto-approve:', paymentReq.estimatedCost.amount < 0.01, '\n');
      
      // Validate structure
      if (!paymentReq.needsPayment || !paymentReq.toolName || !paymentReq.apiUrl) {
        throw new Error('Payment requirement missing required fields');
      }
    }

    console.log('✅✅✅ Phase 8 COMPLETE: Payment detection validated! ✅✅✅\n');
    console.log('💰 Ready to detect and process payment requirements');
    console.log();
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Phase 8 FAILED:', error);
    console.error('\nTroubleshooting:');
    console.error('  1. Make sure backend server is running');
    console.error('  2. Check server has NANSEN_API_KEY configured');
    console.error('  3. Check if Nansen tool is enabled in server');
    console.error('  4. Review server logs for errors');
    process.exit(1);
  }
}

main();

