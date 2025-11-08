/**
 * E2E Test: Extended Thinking API Compliance
 * 
 * Tests that messages comply with Anthropic's extended thinking API requirements:
 * "When `thinking` is enabled, a final `assistant` message must start with a thinking block
 * (preceeding the lastmost set of `tool_use` and `tool_result` blocks)."
 * 
 * This test specifically replicates the error:
 * "messages.3.content.0.type: Expected `thinking` or `redacted_thinking`, but found `text`."
 * 
 * REQUIREMENTS:
 * - Backend server must be running
 * - Extended thinking must be enabled in backend
 */

import { describe, test, expect } from 'bun:test';
import { authenticateTestUser, loadGridSession } from '../setup/test-helpers';
import { supabase } from '../setup/supabase-test-client';

// Backend URL from environment or default
const BACKEND_URL = process.env.TEST_BACKEND_URL || 'http://localhost:3001';

// Helper to wait for messages to be saved
async function waitForMessages(conversationId: string, minCount: number = 1, maxWaitMs: number = 10000) {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    
    if (messages && messages.length >= minCount) {
      return messages;
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return [];
}

// Helper to send a message and get response
async function sendChatMessage(
  message: string,
  conversationId: string,
  accessToken: string,
  gridSession: any
): Promise<{ response: Response; error?: string }> {
  const requestBody = {
    messages: [
      {
        role: 'user',
        content: message,
        parts: [{ type: 'text', text: message }],
      },
    ],
    conversationId,
    gridSessionSecrets: gridSession.sessionSecrets,
    gridSession: {
      address: gridSession.address,
      authentication: gridSession.authentication,
    },
    clientContext: {
      platform: 'test',
      version: '1.0.0-test',
    },
  };

  const response = await fetch(`${BACKEND_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(requestBody),
  });

  // Parse stream to check for errors
  if (response.ok && response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let errorMessage = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('3:')) {
            // Error line
            try {
              const errorData = JSON.parse(line.substring(2));
              if (errorData.error) {
                errorMessage = errorData.error;
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (e) {
      // Stream reading error
    }

    return { response, error: errorMessage };
  }

  return { response };
}

describe('Extended Thinking API Compliance (E2E)', () => {
  test('CRITICAL: should not fail with thinking block error when asking market questions', async () => {
    console.log('🧠 Testing extended thinking compliance for market questions\n');
    console.log('   Replicating error: "Expected `thinking` or `redacted_thinking`, but found `text`"');
    console.log();

    // ============================================
    // STEP 1: Authenticate Test User
    // ============================================
    console.log('📋 Step 1/5: Authenticating test user...\n');
    
    const { userId, email, accessToken } = await authenticateTestUser();
    const gridSession = await loadGridSession();
    
    console.log('✅ Test user authenticated:');
    console.log('   User ID:', userId);
    console.log('   Email:', email);
    console.log();

    // ============================================
    // STEP 2: Create Test Conversation
    // ============================================
    console.log('📋 Step 2/5: Creating test conversation...\n');
    
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        title: 'Test: Extended Thinking Compliance',
      })
      .select()
      .single();

    if (convError || !conversation) {
      throw new Error('Failed to create test conversation');
    }

    const conversationId = conversation.id;
    console.log('✅ Conversation created:', conversationId);
    console.log();

    // ============================================
    // STEP 3: Send a market question (reproduces error)
    // ============================================
    console.log('📋 Step 3/5: Sending market question that triggers the error...\n');
    
    const marketQuestion = "okay - what's going on in the markets today?";
    console.log('   Question:', marketQuestion);
    console.log();

    const { response, error } = await sendChatMessage(
      marketQuestion,
      conversationId,
      accessToken,
      gridSession
    );

    console.log('✅ Response received:');
    console.log('   Status:', response.status);
    console.log('   Has Error:', !!error);
    if (error) {
      console.log('   Error:', error);
    }
    console.log();

    // Check if we got the specific thinking block error
    const hasThinkingError = error && (
      error.includes('Expected `thinking` or `redacted_thinking`, but found `text`') ||
      error.includes('must start with a thinking block')
    );

    if (hasThinkingError) {
      console.error('❌ FAILED: Got the thinking block compliance error!');
      console.error('   This means assistant messages are not starting with thinking blocks');
      console.error('   when extended thinking is enabled.');
      console.error();
      console.error('   Error details:', error);
      console.error();
      throw new Error('Extended thinking compliance error detected: Assistant message does not start with thinking block');
    }

    // Should succeed without errors
    expect(response.ok).toBe(true);
    expect(error).toBeFalsy();

    // ============================================
    // STEP 4: Verify messages were saved correctly
    // ============================================
    console.log('📋 Step 4/5: Verifying message structure in database...\n');
    
    await waitForMessages(conversationId, 2);

    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    expect(msgError).toBeNull();
    expect(messages).toBeDefined();
    expect(messages!.length).toBeGreaterThanOrEqual(2);

    console.log(`✅ Found ${messages!.length} messages in database`);
    console.log();

    // Check if any assistant messages have the correct structure
    const assistantMessages = messages!.filter(m => m.role === 'assistant');
    console.log(`   Assistant messages: ${assistantMessages.length}`);
    
    for (const msg of assistantMessages) {
      const parts = msg.parts || [];
      console.log(`   Message ${msg.id}:`);
      console.log(`     - Parts: ${parts.length}`);
      
      // Check if message has tool calls
      const hasToolCalls = parts.some((p: any) => p.type === 'tool-call');
      if (hasToolCalls) {
        console.log('     - Has tool calls: YES');
        
        // Check if first part is thinking
        const firstPartType = parts.length > 0 ? parts[0].type : null;
        console.log(`     - First part type: ${firstPartType}`);
        
        if (firstPartType !== 'thinking' && firstPartType !== 'reasoning') {
          console.warn('     ⚠️ WARNING: Assistant message with tool calls does not start with thinking/reasoning block');
        } else {
          console.log('     ✅ Correctly starts with thinking/reasoning block');
        }
      }
    }
    console.log();

    // ============================================
    // STEP 5: Send follow-up to test conversation history
    // ============================================
    console.log('📋 Step 5/5: Testing with conversation history...\n');
    
    const followUp = "And what about crypto specifically?";
    console.log('   Follow-up:', followUp);
    console.log();

    const { response: response2, error: error2 } = await sendChatMessage(
      followUp,
      conversationId,
      accessToken,
      gridSession
    );

    console.log('✅ Follow-up response received:');
    console.log('   Status:', response2.status);
    console.log('   Has Error:', !!error2);
    if (error2) {
      console.log('   Error:', error2);
    }
    console.log();

    const hasThinkingError2 = error2 && (
      error2.includes('Expected `thinking` or `redacted_thinking`, but found `text`') ||
      error2.includes('must start with a thinking block')
    );

    if (hasThinkingError2) {
      console.error('❌ FAILED: Got thinking block error on follow-up message!');
      console.error('   Error details:', error2);
      console.error();
      throw new Error('Extended thinking compliance error on follow-up: Assistant message does not start with thinking block');
    }

    expect(response2.ok).toBe(true);
    expect(error2).toBeFalsy();

    console.log('✅ Test completed successfully');
    console.log('   No extended thinking compliance errors detected');
    console.log();
  }, 120000); // 2 minute timeout

  test('CRITICAL: should handle assistant messages without tool calls correctly', async () => {
    console.log('🧠 Testing extended thinking for simple questions (no tools)\n');

    const { userId, accessToken } = await authenticateTestUser();
    const gridSession = await loadGridSession();
    
    const { data: conversation } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        title: 'Test: Simple Question',
      })
      .select()
      .single();

    const conversationId = conversation!.id;

    // Simple question that shouldn't trigger tools
    const simpleQuestion = "What is 2 + 2?";
    console.log('   Question:', simpleQuestion);
    console.log();

    const { response, error } = await sendChatMessage(
      simpleQuestion,
      conversationId,
      accessToken,
      gridSession
    );

    console.log('✅ Response received:');
    console.log('   Status:', response.status);
    console.log('   Has Error:', !!error);
    console.log();

    const hasThinkingError = error && (
      error.includes('Expected `thinking` or `redacted_thinking`, but found `text`') ||
      error.includes('must start with a thinking block')
    );

    if (hasThinkingError) {
      console.error('❌ FAILED: Got thinking block error on simple question!');
      console.error('   Error details:', error);
      console.error();
      throw new Error('Extended thinking compliance error on simple question');
    }

    expect(response.ok).toBe(true);
    expect(error).toBeFalsy();

    console.log('✅ Simple question handled correctly');
    console.log();
  }, 60000);

  test('CRITICAL: should handle multi-turn conversation with tools correctly', async () => {
    console.log('🧠 Testing extended thinking in multi-turn conversation with tools\n');

    const { userId, accessToken } = await authenticateTestUser();
    const gridSession = await loadGridSession();
    
    const { data: conversation } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        title: 'Test: Multi-turn with Tools',
      })
      .select()
      .single();

    const conversationId = conversation!.id;

    // Turn 1: Question that triggers a tool
    console.log('   Turn 1: Asking about Bitcoin price...');
    const { response: r1, error: e1 } = await sendChatMessage(
      "What's the Bitcoin price?",
      conversationId,
      accessToken,
      gridSession
    );

    expect(r1.ok).toBe(true);
    if (e1?.includes('Expected `thinking`')) {
      throw new Error('Turn 1 failed with thinking block error');
    }

    await waitForMessages(conversationId, 2);
    console.log('   ✅ Turn 1 completed');

    // Turn 2: Follow-up that might trigger another tool
    console.log('   Turn 2: Asking follow-up...');
    const { response: r2, error: e2 } = await sendChatMessage(
      "How about Ethereum?",
      conversationId,
      accessToken,
      gridSession
    );

    expect(r2.ok).toBe(true);
    if (e2?.includes('Expected `thinking`')) {
      throw new Error('Turn 2 failed with thinking block error');
    }

    await waitForMessages(conversationId, 4);
    console.log('   ✅ Turn 2 completed');

    // Turn 3: Market question (the problematic one from user report)
    console.log('   Turn 3: Asking about markets (problematic case)...');
    const { response: r3, error: e3 } = await sendChatMessage(
      "okay - what's going on in the markets today?",
      conversationId,
      accessToken,
      gridSession
    );

    expect(r3.ok).toBe(true);
    if (e3?.includes('Expected `thinking`')) {
      console.error('❌ FAILED on Turn 3 (market question)!');
      console.error('   This is the exact case reported by the user');
      console.error('   Error:', e3);
      throw new Error('Turn 3 failed with thinking block error - exact reproduction of user issue');
    }

    console.log('   ✅ Turn 3 completed');
    console.log();
    console.log('✅ Multi-turn conversation completed successfully');
    console.log('   All messages complied with extended thinking requirements');
    console.log();
  }, 180000); // 3 minute timeout for multi-turn
});
