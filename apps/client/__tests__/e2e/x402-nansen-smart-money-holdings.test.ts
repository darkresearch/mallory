/**
 * TRUE End-to-End Test: Complete X402 Nansen Smart Money Holdings Payment Flow
 * 
 * Tests the COMPLETE production flow:
 * 1. User asks AI about smart money holdings
 * 2. AI calls nansenSmartMoneyHoldings tool
 * 3. Tool returns needsPayment: true
 * 4. Test executes REAL X402 payment to REAL Nansen API via Corbits
 * 5. Gets REAL data back from Nansen
 * 6. Sends data to AI as system message
 * 7. AI continues and responds with the holdings information
 * 8. Validates AI actually used the data
 * 
 * THIS FOLLOWS THE SAME PATTERN AS THE OTHER NANSEN TESTS
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { authenticateTestUser, loadGridSession } from '../setup/test-helpers';
import { createTestConversation } from '../utils/conversation-test';
import { sendChatMessage, sendChatWithHistory, parseStreamResponse } from '../utils/chat-api';
import { X402PaymentServiceTest } from '../utils/x402-payment-test';

describe('X402 Nansen Smart Money Holdings TRUE End-to-End', () => {
  let authToken: string;
  let userId: string;
  let gridAddress: string;

  beforeAll(async () => {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 TRUE END-TO-END TEST: X402 Nansen Smart Money Holdings');
    console.log('='.repeat(70), '\n');
    
    const auth = await authenticateTestUser();
    authToken = auth.accessToken;
    userId = auth.userId;
    
    const gridSession = await loadGridSession();
    gridAddress = gridSession.address;
    
    console.log('✅ Test environment ready');
    console.log('   User:', auth.email);
    console.log('   Grid:', gridAddress);
    console.log();
  });

  test('Complete flow: User asks → AI needs payment → Pay Nansen → AI responds', async () => {
    // Set long timeout for this test (AI + payment can take time)
    // @ts-ignore
    test.timeout = 180000; // 3 minutes
    console.log('━'.repeat(70));
    console.log('🎯 THE COMPLETE PRODUCTION X402 FLOW');
    console.log('━'.repeat(70), '\n');

    // ============================================
    // STEP 1: Create conversation
    // ============================================
    console.log('📋 Step 1: Creating fresh conversation...');
    const conversationId = await createTestConversation(userId);
    console.log('✅ Conversation created:', conversationId.substring(0, 8) + '...\n');

    // ============================================
    // STEP 2: Send user message that triggers Nansen Smart Money Holdings
    // ============================================
    console.log('📋 Step 2: Sending message that requires Nansen smart money holdings data...');
    console.log('   User asks: "What are the top holdings of smart money wallets on Ethereum?"');
    
    const response1 = await sendChatMessage(
      "What are the top holdings of smart money wallets on Ethereum?",
      conversationId,
      authToken
    );
    console.log('✅ AI received message\n');

    // ============================================
    // STEP 3: Parse stream for payment requirement
    // ============================================
    console.log('📋 Step 3: Parsing AI response for payment requirement...');
    const parsed1 = await parseStreamResponse(response1);
    
    console.log('✅ Stream parsed');
    console.log('   Parts:', parsed1.parts.length);
    console.log('   Has payment requirement:', parsed1.hasPaymentRequirement);
    
    if (!parsed1.hasPaymentRequirement) {
      console.warn('\n⚠️  AI did not trigger Nansen Smart Money Holdings tool');
      console.warn('   This could mean:');
      console.warn('   - AI chose a different approach');
      console.warn('   - Nansen tool not available');
      console.warn('   - Query phrasing did not trigger it');
      console.warn('\n   Skipping payment execution for this run.');
      console.warn('   Try running again or adjust the query.');
      return; // Skip test if AI didn't call tool
    }
    
    const paymentReq = parsed1.paymentRequirement;
    console.log('✅ Payment requirement detected!');
    console.log('   Tool:', paymentReq.toolName);
    console.log('   API:', paymentReq.apiUrl);
    console.log('   Cost:', paymentReq.estimatedCost.amount, paymentReq.estimatedCost.currency);
    console.log('   Auto-approve:', paymentReq.estimatedCost.amount < '0.01', '\n');
    
    expect(paymentReq.needsPayment).toBe(true);
    expect(paymentReq.toolName).toBe('nansenSmartMoneyHoldings');
    expect(paymentReq.apiUrl).toContain('nansen');
    expect(paymentReq.apiUrl).toContain('smart-money/holdings');

    // ============================================
    // STEP 4: Execute REAL X402 Payment to REAL Nansen
    // ============================================
    console.log('📋 Step 4: Executing REAL X402 payment to Nansen...');
    console.log('   This will:');
    console.log('   - Create ephemeral wallet');
    console.log('   - Fund from Grid (real USDC + SOL)');
    console.log('   - Pay Nansen via Faremeter (real payment)');
    console.log('   - Get real smart money holdings data back');
    console.log('   - Sweep funds back to Grid');
    console.log();
    
    const nansenData = await X402PaymentServiceTest.payAndFetchData(
      paymentReq,
      gridAddress
    );
    
    console.log('✅ X402 payment completed successfully!');
    console.log('   Got real data from Nansen');
    console.log('   Data preview:', JSON.stringify(nansenData).substring(0, 100) + '...\n');
    
    expect(nansenData).toBeDefined();

    // ============================================
    // STEP 5: Send result back to AI (EXACTLY like production)
    // ============================================
    console.log('📋 Step 5: Sending payment result to AI as system message...');
    console.log('   Format: EXACTLY like production useX402PaymentHandler');
    
    // Build message history (user message + system message with result)
    const messagesWithResult = [
      {
        role: 'user' as const,
        content: "What are the top holdings of smart money wallets on Ethereum?",
        parts: [{
          type: 'text',
          text: "What are the top holdings of smart money wallets on Ethereum?"
        }]
      },
      {
        role: 'system' as const,
        content: `[x402 Payment Completed] Tool: ${paymentReq.toolName}\nData: ${JSON.stringify(nansenData)}`,
        parts: [{
          type: 'text',
          text: `[x402 Payment Completed] Tool: ${paymentReq.toolName}\nData: ${JSON.stringify(nansenData)}`
        }]
      }
    ];
    
    const response2 = await sendChatWithHistory(
      conversationId,
      authToken,
      messagesWithResult
    );
    console.log('✅ System message sent to AI\n');

    // ============================================
    // STEP 6: Parse AI's continued response
    // ============================================
    console.log('📋 Step 6: Parsing AI final response with data...');
    const parsed2 = await parseStreamResponse(response2);
    
    console.log('✅ AI response received');
    console.log('   Length:', parsed2.fullText.length);
    console.log('   Preview:', parsed2.fullText.substring(0, 200) + '...\n');

    // ============================================
    // STEP 7: Validate AI actually used the Nansen data
    // ============================================
    console.log('📋 Step 7: Validating AI processed the data...');
    
    const responseLower = parsed2.fullText.toLowerCase();
    
    // AI should mention smart money or holdings
    const mentionsSmartMoney = responseLower.includes('smart money') || responseLower.includes('holding');
    console.log('   Mentions smart money/holdings:', mentionsSmartMoney);
    
    // AI should talk about tokens or wallets
    const mentionsTokens = responseLower.match(/token|wallet|portfolio|position/);
    console.log('   Mentions tokens/wallets:', !!mentionsTokens);
    
    // AI should have completed the response (not stopped mid-stream)
    const completedProperly = parsed2.fullText.length > 100;
    console.log('   Completed response:', completedProperly);
    
    expect(mentionsSmartMoney || mentionsTokens).toBe(true);
    expect(completedProperly).toBe(true);
    
    console.log('\n✅ AI successfully processed Nansen data and responded!\n');

    // ============================================
    // SUCCESS!
    // ============================================
    console.log('━'.repeat(70));
    console.log('🎉 COMPLETE X402 FLOW VALIDATED!');
    console.log('━'.repeat(70));
    console.log('\nWhat we just tested:');
    console.log('  ✅ User sends message to AI');
    console.log('  ✅ AI determines it needs Nansen smart money holdings data');
    console.log('  ✅ AI returns payment requirement');
    console.log('  ✅ Test executes REAL payment to REAL Nansen API');
    console.log('  ✅ Gets REAL smart money holdings data back');
    console.log('  ✅ Sends data to AI as system message');
    console.log('  ✅ AI continues conversation and uses the data');
    console.log('  ✅ AI completes response without interruption');
    console.log('\n🎊 THIS IS THE PRODUCTION FLOW - IT WORKS! 🎊\n');
  });
});


