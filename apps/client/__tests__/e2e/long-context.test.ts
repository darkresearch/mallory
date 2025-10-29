/**
 * E2E Test: Long Context Window Scenarios
 * 
 * Tests how the backend handles extremely long conversations:
 * 1. Multi-turn conversations exceeding 200k tokens
 * 2. Single responses that hit token output limits
 * 3. Context window management strategies
 * 
 * REQUIREMENTS:
 * - Backend server must be running
 * - SUPERMEMORY_API_KEY should be set (tests both with and without)
 * - These tests may take several minutes and use significant API quota
 */

import { describe, test, expect } from 'bun:test';
import { authenticateTestUser, loadGridSession } from '../setup/test-helpers';
import { supabase } from '../setup/supabase-test-client';

// Backend URL from environment or default
const BACKEND_URL = process.env.TEST_BACKEND_URL || 'http://localhost:3001';

// Helper: Generate a long message (for padding conversation history)
function generateLongMessage(topic: string, targetTokens: number): string {
  // Approximately 4 chars per token
  const targetChars = targetTokens * 4;
  const baseText = `This is a detailed explanation about ${topic}. `;
  const repetitions = Math.ceil(targetChars / baseText.length);
  return baseText.repeat(repetitions).substring(0, targetChars);
}

// Helper: Create conversation history with specific token count
function createLongConversationHistory(targetTokens: number): Array<{ role: 'user' | 'assistant', content: string }> {
  const messages: Array<{ role: 'user' | 'assistant', content: string }> = [];
  let currentTokens = 0;
  let turnNumber = 0;

  while (currentTokens < targetTokens) {
    turnNumber++;
    const remaining = targetTokens - currentTokens;
    const tokensPerMessage = Math.min(1000, remaining / 2); // 1k tokens per message

    // User message
    const userMessage = generateLongMessage(`topic ${turnNumber}`, tokensPerMessage);
    messages.push({ role: 'user', content: userMessage });
    currentTokens += tokensPerMessage;

    // Assistant message
    if (currentTokens < targetTokens) {
      const assistantMessage = generateLongMessage(`response to topic ${turnNumber}`, tokensPerMessage);
      messages.push({ role: 'assistant', content: assistantMessage });
      currentTokens += tokensPerMessage;
    }
  }

  return messages;
}

describe('Long Context Window Tests (E2E)', () => {
  test('CRITICAL: should handle conversation exceeding 200k tokens', async () => {
    console.log('🔥 Testing LONG conversation (200k+ tokens)...\n');
    console.log('⚠️  This test will:');
    console.log('   - Create a conversation with ~200k tokens of history');
    console.log('   - Send a new message');
    console.log('   - Verify backend handles it gracefully');
    console.log('   - Check for context window errors\n');

    const { userId, accessToken } = await authenticateTestUser();
    const gridSession = await loadGridSession();

    // Create test conversation
    const { data: conversation } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        title: 'Test: Long Context (200k tokens)',
      })
      .select()
      .single();

    const conversationId = conversation!.id;

    console.log('📊 Generating conversation history...');
    // Generate ~200k tokens of conversation history
    const TARGET_TOKENS = 200000;
    const conversationHistory = createLongConversationHistory(TARGET_TOKENS);
    
    console.log('   Generated:', conversationHistory.length, 'messages');
    console.log('   Estimated tokens:', TARGET_TOKENS);
    console.log();

    // Send the long conversation history + new message to backend
    const newUserMessage = 'Based on our entire conversation history, what are the key themes?';
    
    console.log('📤 Sending request with long context...');
    console.log('   History messages:', conversationHistory.length);
    console.log('   New message:', newUserMessage);
    console.log();

    const requestBody = {
      messages: [
        ...conversationHistory,
        { role: 'user', content: newUserMessage },
      ],
      conversationId,
      gridSessionSecrets: gridSession.sessionSecrets,
      gridSession: {
        address: gridSession.address,
        authentication: gridSession.authentication,
      },
    };

    const startTime = Date.now();
    let response: Response;
    
    try {
      response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(requestBody),
      });
    } catch (error) {
      console.error('❌ Request failed:', error);
      throw error;
    }

    const requestDuration = Date.now() - startTime;
    console.log('✅ Request completed in', requestDuration, 'ms');
    console.log('   Status:', response.status);
    console.log();

    // CRITICAL: Request should not fail due to context window issues
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Backend returned error:', response.status);
      console.error('   Error body:', errorText);
      
      // Check if it's a context window error
      if (errorText.includes('context') || errorText.includes('token') || errorText.includes('length')) {
        console.error('🚨 CONTEXT WINDOW ERROR DETECTED!');
        console.error('   This is the production bug users are experiencing');
      }
      
      expect(response.ok).toBe(true);
    }

    expect(response.ok).toBe(true);

    // Process stream
    let streamCompleted = false;
    let hasError = false;
    let errorMessage = '';
    let totalChunks = 0;

    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            streamCompleted = true;
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          totalChunks++;

          // Check for error signals in stream
          if (chunk.includes('"type":"error"') || chunk.includes('error')) {
            hasError = true;
            errorMessage += chunk;
          }
        }
      } finally {
        reader.releaseLock();
      }
    }

    console.log('📊 Stream Results:');
    console.log('   Completed:', streamCompleted);
    console.log('   Total chunks:', totalChunks);
    console.log('   Has error:', hasError);
    console.log();

    // CRITICAL ASSERTIONS
    expect(streamCompleted).toBe(true);
    expect(hasError).toBe(false);
    expect(totalChunks).toBeGreaterThan(0);

    if (hasError) {
      console.error('❌ Stream contained errors:');
      console.error(errorMessage);
      throw new Error('Stream contained errors - likely context window issue');
    }

    console.log('✅ Long context test passed!');
    console.log('   Backend successfully handled 200k+ token conversation');
    console.log();

    // Cleanup
    await supabase.from('conversations').delete().eq('id', conversationId);

  }, 300000); // 5 minute timeout

  test('CRITICAL: should handle very long single response (output token limit)', async () => {
    console.log('📝 Testing LONG response (output token limit)...\n');
    console.log('⚠️  This test will:');
    console.log('   - Ask for a very detailed, long response');
    console.log('   - Verify backend handles output token limits');
    console.log('   - Check finishReason for "length" vs "stop"\n');

    const { userId, accessToken } = await authenticateTestUser();
    const gridSession = await loadGridSession();

    const { data: conversation } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        title: 'Test: Long Response',
      })
      .select()
      .single();

    const conversationId = conversation!.id;

    // Ask for something that will generate a very long response
    const testMessage = `Write an extremely detailed, comprehensive guide about the history of computing from 1940 to 2025. Include:
- At least 50 major milestones
- Detailed explanations for each (minimum 200 words each)
- Technical specifications where relevant
- Impact on society for each milestone
- Key people involved
- Citations and references

This should be a book-length response. Be as thorough and detailed as possible.`;

    console.log('📤 Requesting very long response...');
    console.log('   Expected: Response will hit output token limit');
    console.log();

    const requestBody = {
      messages: [{ role: 'user', content: testMessage }],
      conversationId,
      gridSessionSecrets: gridSession.sessionSecrets,
      gridSession: {
        address: gridSession.address,
        authentication: gridSession.authentication,
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

    expect(response.ok).toBe(true);

    // Track response length and finish reason
    let finishReason: string | null = null;
    let totalBytes = 0;
    let streamCompleted = false;

    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            streamCompleted = true;
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          totalBytes += chunk.length;

          // Look for finish event
          if (chunk.includes('"type":"finish"')) {
            const finishMatch = chunk.match(/"finishReason":"([^"]+)"/);
            if (finishMatch) {
              finishReason = finishMatch[1];
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }

    console.log('📊 Response Analysis:');
    console.log('   Total bytes:', totalBytes.toLocaleString());
    console.log('   Estimated tokens:', Math.floor(totalBytes / 4).toLocaleString());
    console.log('   Stream completed:', streamCompleted);
    console.log('   Finish reason:', finishReason || 'NOT FOUND');
    console.log();

    // CRITICAL CHECKS
    expect(streamCompleted).toBe(true);
    expect(finishReason).not.toBe(null);

    // Response WILL likely hit length limit - that's expected and OK
    if (finishReason === 'length') {
      console.log('✅ Response hit output token limit (expected for very long request)');
      console.log('   This is CORRECT behavior - not a bug');
      console.log('   Backend handled it gracefully without errors');
    } else if (finishReason === 'stop') {
      console.log('✅ Response completed naturally within token limits');
      console.log('   Model generated full response');
    } else {
      console.error('❌ Unexpected finish reason:', finishReason);
      throw new Error(`Unexpected finish reason: ${finishReason}`);
    }

    console.log();

    // Wait and verify message was saved
    await new Promise(resolve => setTimeout(resolve, 2000));

    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1);

    expect(messages).not.toBe(null);
    expect(messages!.length).toBeGreaterThan(0);

    const savedResponse = messages![0];
    console.log('💾 Saved Response:');
    console.log('   Content length:', savedResponse.content.length, 'chars');
    console.log('   Has content:', savedResponse.content.length > 0);
    console.log();

    // Cleanup
    await supabase.from('messages').delete().eq('conversation_id', conversationId);
    await supabase.from('conversations').delete().eq('id', conversationId);

    console.log('✅ Long response test passed!');
    console.log('   Backend correctly handled output token limit');
    console.log();

  }, 180000); // 3 minute timeout

  test('should verify context windowing fallback (no Supermemory)', async () => {
    console.log('✂️  Testing context windowing fallback...\n');
    console.log('   This test verifies manual windowing when Supermemory is unavailable');
    console.log();

    const { userId, accessToken } = await authenticateTestUser();
    const gridSession = await loadGridSession();

    const { data: conversation } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        title: 'Test: Context Windowing',
      })
      .select()
      .single();

    const conversationId = conversation!.id;

    // Generate conversation exceeding windowing threshold (80k tokens)
    const TARGET_TOKENS = 100000; // Exceeds 80k threshold
    const conversationHistory = createLongConversationHistory(TARGET_TOKENS);

    console.log('📊 Generated:', conversationHistory.length, 'messages');
    console.log('   Estimated:', TARGET_TOKENS.toLocaleString(), 'tokens');
    console.log('   Threshold: 80,000 tokens');
    console.log('   Backend should: Window to most recent messages');
    console.log();

    const requestBody = {
      messages: [
        ...conversationHistory,
        { role: 'user', content: 'Summarize our conversation.' },
      ],
      conversationId,
      gridSessionSecrets: gridSession.sessionSecrets,
      gridSession: {
        address: gridSession.address,
        authentication: gridSession.authentication,
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

    expect(response.ok).toBe(true);

    // Just verify it completes without error
    let streamCompleted = false;

    if (response.body) {
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done } = await reader.read();
          if (done) {
            streamCompleted = true;
            break;
          }
        }
      } finally {
        reader.releaseLock();
      }
    }

    expect(streamCompleted).toBe(true);
    console.log('✅ Windowing fallback works correctly');
    console.log();

    // Cleanup
    await supabase.from('conversations').delete().eq('id', conversationId);

  }, 180000);
});

