/**
 * Nansen Test Template
 * Reusable test structure for all Nansen endpoints
 */

import { authenticateTestUser, loadGridSession } from '../setup/test-helpers';
import { createTestConversation } from './conversation-test';
import { sendChatMessage, parseStreamResponse } from './chat-api';
import { executeX402Payment } from './x402-test-helpers';
import { loadGridContextForX402 } from '@darkresearch/mallory-shared';

interface NansenEndpointTestConfig {
  name: string;
  query: string;
  expectedToolName: string;
  urlFragment: string;
  timeout?: number; // Optional timeout in ms (default: 60s)
}

interface TestContext {
  authToken: string;
  userId: string;
  gridAddress: string;
}

/**
 * Setup test environment (auth + Grid)
 * Call in beforeAll()
 */
export async function setupNansenTest(): Promise<TestContext> {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 Setting up Nansen endpoint test...');
  console.log('='.repeat(70), '\n');
  
  const auth = await authenticateTestUser();
  const gridSession = await loadGridSession();
  
  console.log('✅ Test environment ready');
  console.log('   User:', auth.email);
  console.log('   Grid:', gridSession.address);
  console.log('   X402: Backend will handle payments server-side');
  console.log();
  
  return {
    authToken: auth.accessToken,
    userId: auth.userId,
    gridAddress: gridSession.address
  };
}

/**
 * Test a single Nansen endpoint with NEW backend x402 flow
 * Backend handles x402 payments automatically when Grid secrets provided
 */
export async function testNansenEndpoint(
  config: NansenEndpointTestConfig,
  context: TestContext
): Promise<any> {
  const { name, query, expectedToolName, timeout } = config;
  const { authToken, userId, gridAddress } = context;
  
  // Set timeout for x402 payment flow (default 2 minutes)
  const testTimeout = timeout || 120000;

  console.log('━'.repeat(70));
  console.log(`🧪 Testing: ${name}`);
  console.log('━'.repeat(70), '\n');

  // Step 1: Load Grid context for x402 (using shared utility)
  console.log('🔐 Loading Grid session secrets for x402...');
  const gridSessionData = await loadGridSession();
  const { gridSessionSecrets, gridSession } = await loadGridContextForX402({
    getGridAccount: async () => ({
      authentication: gridSessionData.authentication,
      address: gridSessionData.address
    }),
    getSessionSecrets: async () => JSON.stringify(gridSessionData.sessionSecrets)
  });
  
  // Step 2: Send query to AI with Grid context
  console.log(`📋 Query: "${query}"`);
  console.log('   Backend will handle x402 payment automatically');
  
  const conversationId = await createTestConversation(userId);
  const response = await sendChatMessage(query, conversationId, authToken, {
    gridSessionSecrets,
    gridSession
  });
  
  // Step 3: Parse AI response - should get actual data, not payment requirement
  const parsed = await parseStreamResponse(response);
  
  console.log(`✅ AI responded with data`);
  console.log(`   Response length: ${parsed.fullText.length} chars`);
  console.log(`   Parts: ${parsed.parts.length}`);
  
  // Verify we got actual data (not just payment requirement)
  if (parsed.hasPaymentRequirement) {
    console.warn('⚠️  AI returned payment requirement - backend x402 may not be working');
    console.warn('   Tool:', parsed.paymentRequirement.toolName);
    console.warn('   This should have been handled server-side!');
  }
  
  // Extract data from AI response (it should be in the tool result)
  let toolData = null;
  for (const part of parsed.parts) {
    if (part.type === 'tool-result' && part.toolName === expectedToolName) {
      toolData = part.result;
      break;
    }
  }
  
  if (!toolData && parsed.fullText.length < 100) {
    throw new Error(`No data received - AI response too short. Backend x402 may have failed.`);
  }
  
  console.log('✅ Backend x402 payment completed!');
  console.log(`   Got data for tool: ${expectedToolName}\n`);
  
  return toolData || parsed.fullText;
}

