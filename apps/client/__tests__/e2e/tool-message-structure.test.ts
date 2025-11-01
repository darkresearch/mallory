/**
 * Integration test: Verify tool_use/tool_result message structure
 * 
 * This test validates that the message transformation fixes the Anthropic API
 * error: "tool_use ids were found without tool_result blocks immediately after"
 */

import { describe, test, expect } from 'bun:test';
import { authenticateTestUser } from '../setup/test-helpers';
import { createTestConversation } from '../utils/conversation-test';
import { sendChatMessage, waitForAssistantMessage } from '../utils/chat-api';
import { supabase } from '../../lib/supabase';

describe('Tool Message Structure Integration Test', () => {
  test('handles tool calls in conversation history correctly', async () => {
    const auth = await authenticateTestUser();
    const conversationId = await createTestConversation(auth.userId);

    console.log('💬 Step 1: Send message that triggers tool call');
    await sendChatMessage(
      "What is the current Bitcoin price?",
      conversationId,
      auth.accessToken
    );

    // Wait for assistant response with tool call
    await waitForAssistantMessage(conversationId);

    console.log('💬 Step 2: Load conversation history from database');
    const { data: messagesFromDb, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    expect(error).toBeNull();
    expect(messagesFromDb).toBeDefined();
    expect(messagesFromDb!.length).toBeGreaterThan(0);

    console.log('💬 Step 3: Send follow-up message (this will load history)');
    // This is where the bug would occur - when loading conversation history
    // with tool calls and sending to Anthropic API again
    const response = await sendChatMessage(
      "Thanks! And what about Ethereum?",
      conversationId,
      auth.accessToken
    );

    // If there's an error about tool_use/tool_result mismatch, this will fail
    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);

    // Wait for the follow-up response
    await waitForAssistantMessage(conversationId, 2); // 2nd assistant message

    console.log('✅ Test passed: No tool_use/tool_result structure errors');
  }, 60000); // 60 second timeout

  test('correctly structures messages with tool calls when reloading conversation', async () => {
    const auth = await authenticateTestUser();
    const conversationId = await createTestConversation(auth.userId);

    // Simulate a conversation with tool calls
    console.log('💬 Sending message that will trigger Nansen tool');
    await sendChatMessage(
      "What were vitalik.eth's token balances yesterday?",
      conversationId,
      auth.accessToken
    );

    await waitForAssistantMessage(conversationId);

    // Load the conversation history
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    console.log('📊 Loaded messages:', messages?.length);

    // Check for tool-related parts
    const assistantMessages = messages?.filter(m => m.role === 'assistant') || [];
    const hasToolParts = assistantMessages.some(m => {
      const parts = m.metadata?.parts || [];
      return parts.some((p: any) => p.type === 'tool-call' || p.type === 'tool-result');
    });

    console.log('🔧 Has tool parts:', hasToolParts);

    // Send another message to trigger history reload
    const response = await sendChatMessage(
      "And what about today?",
      conversationId,
      auth.accessToken
    );

    expect(response.ok).toBe(true);
    
    // The key test: no Anthropic API error about tool_use/tool_result structure
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let foundError = false;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      if (chunk.includes('tool_use ids were found without tool_result')) {
        foundError = true;
        break;
      }
    }

    expect(foundError).toBe(false);
    console.log('✅ No tool_use/tool_result structure errors detected');
  }, 90000); // 90 second timeout for Nansen calls
});
