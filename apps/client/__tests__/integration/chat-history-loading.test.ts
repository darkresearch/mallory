/**
 * Integration Tests: Chat History Loading
 * 
 * Tests chat history loading with real Supabase:
 * - Loading messages from database
 * - Conversation loading logic
 * - Real-time updates
 * - Error handling
 * - Edge cases
 * 
 * REQUIREMENTS:
 * - Supabase connection
 * - Test user credentials
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import './setup';
import { setupTestUserSession, cleanupTestData, supabase } from './setup';
import { loadMessagesFromSupabase } from '../../features/chat/services/messages';
import { secureStorage, SECURE_STORAGE_KEYS } from '../../lib/storage';
import { getCurrentOrCreateConversation, createNewConversation } from '../../features/chat';

const GLOBAL_TOKEN_ID = '00000000-0000-0000-0000-000000000000';

describe('Chat History Integration Tests', () => {
  let testSession: {
    userId: string;
    email: string;
    accessToken: string;
    gridSession: any;
  };

  let testConversationIds: string[] = [];

  beforeAll(async () => {
    console.log('🔧 Setting up test user session for chat history tests...');
    testSession = await setupTestUserSession();
    console.log('✅ Test session ready');
    console.log('   User ID:', testSession.userId);
  });

  afterAll(async () => {
    console.log('🧹 Cleaning up test data...');
    
    // Delete all test conversations and messages
    for (const convId of testConversationIds) {
      await supabase.from('messages').delete().eq('conversation_id', convId);
      await supabase.from('conversations').delete().eq('id', convId);
    }
    
    await cleanupTestData(testSession.userId);
    console.log('✅ Cleanup complete');
  });

  describe('Message Loading', () => {
    test('should load empty conversation history', async () => {
      const { data: conversation } = await supabase
        .from('conversations')
        .insert({
          user_id: testSession.userId,
          token_ca: GLOBAL_TOKEN_ID,
          title: 'Test: Empty History',
        })
        .select()
        .single();

      testConversationIds.push(conversation!.id);

      const messages = await loadMessagesFromSupabase(conversation!.id);

      expect(messages).toEqual([]);
      expect(messages.length).toBe(0);
    });

    test('should load conversation with multiple messages', async () => {
      const { data: conversation } = await supabase
        .from('conversations')
        .insert({
          user_id: testSession.userId,
          token_ca: GLOBAL_TOKEN_ID,
          title: 'Test: Multiple Messages',
        })
        .select()
        .single();

      testConversationIds.push(conversation!.id);

      // Insert test messages
      const messages = [
        {
          conversation_id: conversation!.id,
          role: 'user',
          content: 'First question',
          metadata: { parts: [{ type: 'text', text: 'First question' }] },
          created_at: new Date('2024-01-01T00:00:00Z').toISOString(),
        },
        {
          conversation_id: conversation!.id,
          role: 'assistant',
          content: 'First answer',
          metadata: { parts: [{ type: 'text', text: 'First answer' }] },
          created_at: new Date('2024-01-01T00:01:00Z').toISOString(),
        },
        {
          conversation_id: conversation!.id,
          role: 'user',
          content: 'Follow-up question',
          metadata: { parts: [{ type: 'text', text: 'Follow-up question' }] },
          created_at: new Date('2024-01-01T00:02:00Z').toISOString(),
        },
      ];

      await supabase.from('messages').insert(messages);

      const loadedMessages = await loadMessagesFromSupabase(conversation!.id);

      expect(loadedMessages.length).toBe(3);
      expect(loadedMessages[0].role).toBe('user');
      expect((loadedMessages[0] as any).content).toBe('First question');
      expect(loadedMessages[1].role).toBe('assistant');
      expect(loadedMessages[2].role).toBe('user');
    });

    test('should preserve message order (oldest first)', async () => {
      const { data: conversation } = await supabase
        .from('conversations')
        .insert({
          user_id: testSession.userId,
          token_ca: GLOBAL_TOKEN_ID,
          title: 'Test: Message Order',
        })
        .select()
        .single();

      testConversationIds.push(conversation!.id);

      // Insert messages out of order
      const messages = [
        {
          conversation_id: conversation!.id,
          role: 'user',
          content: 'Message 3',
          metadata: { parts: [{ type: 'text', text: 'Message 3' }] },
          created_at: new Date('2024-01-01T00:02:00Z').toISOString(),
        },
        {
          conversation_id: conversation!.id,
          role: 'user',
          content: 'Message 1',
          metadata: { parts: [{ type: 'text', text: 'Message 1' }] },
          created_at: new Date('2024-01-01T00:00:00Z').toISOString(),
        },
        {
          conversation_id: conversation!.id,
          role: 'user',
          content: 'Message 2',
          metadata: { parts: [{ type: 'text', text: 'Message 2' }] },
          created_at: new Date('2024-01-01T00:01:00Z').toISOString(),
        },
      ];

      await supabase.from('messages').insert(messages);

      const loadedMessages = await loadMessagesFromSupabase(conversation!.id);

      expect(loadedMessages.length).toBe(3);
      expect((loadedMessages[0] as any).content).toBe('Message 1');
      expect((loadedMessages[1] as any).content).toBe('Message 2');
      expect((loadedMessages[2] as any).content).toBe('Message 3');
    });

    test('should load messages with reasoning parts', async () => {
      const { data: conversation } = await supabase
        .from('conversations')
        .insert({
          user_id: testSession.userId,
          token_ca: GLOBAL_TOKEN_ID,
          title: 'Test: Reasoning Parts',
        })
        .select()
        .single();

      testConversationIds.push(conversation!.id);

      const message = {
        conversation_id: conversation!.id,
        role: 'assistant',
        content: 'Final answer',
        metadata: {
          parts: [
            { type: 'reasoning', text: 'Let me think...' },
            { type: 'text', text: 'Final answer' },
          ],
        },
        created_at: new Date().toISOString(),
      };

      await supabase.from('messages').insert(message);

      const loadedMessages = await loadMessagesFromSupabase(conversation!.id);

      expect(loadedMessages.length).toBe(1);
      expect(loadedMessages[0].parts.length).toBe(2);
      expect(loadedMessages[0].parts[0].type).toBe('reasoning');
      expect(loadedMessages[0].parts[1].type).toBe('text');
    });

    test('should handle messages with tool calls', async () => {
      const { data: conversation } = await supabase
        .from('conversations')
        .insert({
          user_id: testSession.userId,
          token_ca: GLOBAL_TOKEN_ID,
          title: 'Test: Tool Calls',
        })
        .select()
        .single();

      testConversationIds.push(conversation!.id);

      const message = {
        conversation_id: conversation!.id,
        role: 'assistant',
        content: 'Tool result',
        metadata: {
          parts: [
            { type: 'reasoning', text: 'Need to call tool' },
            { type: 'tool_call', name: 'search', args: { query: 'test' } },
            { type: 'text', text: 'Tool result' },
          ],
        },
        created_at: new Date().toISOString(),
      };

      await supabase.from('messages').insert(message);

      const loadedMessages = await loadMessagesFromSupabase(conversation!.id);

      expect(loadedMessages.length).toBe(1);
      expect(loadedMessages[0].parts.length).toBe(3);
      expect(loadedMessages[0].parts[1].type).toBe('tool_call');
    });
  });

  describe('Conversation Loading', () => {
    test('should load most recent conversation when no active stored', async () => {
      // Create multiple conversations
      const conversations = [];
      for (let i = 0; i < 3; i++) {
        const { data } = await supabase
          .from('conversations')
          .insert({
            user_id: testSession.userId,
            token_ca: GLOBAL_TOKEN_ID,
            title: `Test: Conversation ${i}`,
            created_at: new Date(2024, 0, 1, i).toISOString(),
            updated_at: new Date(2024, 0, 1, i).toISOString(),
          })
          .select()
          .single();
        conversations.push(data!);
      }

      testConversationIds.push(...conversations.map(c => c.id));

      // Clear stored conversation
      await secureStorage.removeItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID);

      const result = await getCurrentOrCreateConversation(testSession.userId);

      expect(result.conversationId).toBeDefined();
      // Should be one of the conversations we created
      expect(conversations.map(c => c.id)).toContain(result.conversationId);
    });

    test('should use stored active conversation when available', async () => {
      const { data: conversation } = await supabase
        .from('conversations')
        .insert({
          user_id: testSession.userId,
          token_ca: GLOBAL_TOKEN_ID,
          title: 'Test: Stored Conversation',
        })
        .select()
        .single();

      testConversationIds.push(conversation!.id);

      // Store as active
      await secureStorage.setItem(
        SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID,
        conversation!.id
      );

      const result = await getCurrentOrCreateConversation(testSession.userId);

      expect(result.conversationId).toBe(conversation!.id);
      expect(result.shouldGreet).toBe(false);
    });

    test('should create new conversation when no history exists', async () => {
      // Clear storage
      await secureStorage.removeItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID);

      // Delete all existing conversations for this user
      await supabase
        .from('conversations')
        .delete()
        .eq('user_id', testSession.userId)
        .eq('token_ca', GLOBAL_TOKEN_ID);

      const result = await getCurrentOrCreateConversation(testSession.userId);

      expect(result.conversationId).toBeDefined();
      expect(result.shouldGreet).toBe(true);

      // Verify conversation was created
      const { data } = await supabase
        .from('conversations')
        .select()
        .eq('id', result.conversationId)
        .single();

      expect(data).not.toBeNull();
      expect(data!.user_id).toBe(testSession.userId);

      testConversationIds.push(result.conversationId);
    });
  });

  describe('Edge Cases', () => {
    test('should handle loading history for non-existent conversation', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const messages = await loadMessagesFromSupabase(nonExistentId);

      expect(messages).toEqual([]);
    });

    test('should handle messages with missing metadata', async () => {
      const { data: conversation } = await supabase
        .from('conversations')
        .insert({
          user_id: testSession.userId,
          token_ca: GLOBAL_TOKEN_ID,
          title: 'Test: Missing Metadata',
        })
        .select()
        .single();

      testConversationIds.push(conversation!.id);

      // Insert message without metadata
      await supabase.from('messages').insert({
        conversation_id: conversation!.id,
        role: 'user',
        content: 'Message without metadata',
        metadata: null,
        created_at: new Date().toISOString(),
      });

      const loadedMessages = await loadMessagesFromSupabase(conversation!.id);

      expect(loadedMessages.length).toBe(1);
      expect((loadedMessages[0] as any).content).toBe('Message without metadata');
      // Should reconstruct parts from content
      expect(loadedMessages[0].parts.length).toBeGreaterThan(0);
    });

    test('should handle very long conversation history', async () => {
      const { data: conversation } = await supabase
        .from('conversations')
        .insert({
          user_id: testSession.userId,
          token_ca: GLOBAL_TOKEN_ID,
          title: 'Test: Long History',
        })
        .select()
        .single();

      testConversationIds.push(conversation!.id);

      // Insert 100 messages
      const messages = Array.from({ length: 100 }, (_, i) => ({
        conversation_id: conversation!.id,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
        metadata: { parts: [{ type: 'text', text: `Message ${i}` }] },
        created_at: new Date(2024, 0, 1, 0, i).toISOString(),
      }));

      await supabase.from('messages').insert(messages);

      const loadedMessages = await loadMessagesFromSupabase(conversation!.id);

      expect(loadedMessages.length).toBe(100);
      expect((loadedMessages[0] as any).content).toBe('Message 0');
      expect((loadedMessages[99] as any).content).toBe('Message 99');
    });

    test('should handle concurrent loads for same conversation', async () => {
      const { data: conversation } = await supabase
        .from('conversations')
        .insert({
          user_id: testSession.userId,
          token_ca: GLOBAL_TOKEN_ID,
          title: 'Test: Concurrent Loads',
        })
        .select()
        .single();

      testConversationIds.push(conversation!.id);

      // Insert a message
      await supabase.from('messages').insert({
        conversation_id: conversation!.id,
        role: 'user',
        content: 'Test message',
        metadata: { parts: [{ type: 'text', text: 'Test message' }] },
        created_at: new Date().toISOString(),
      });

      // Load concurrently
      const [messages1, messages2, messages3] = await Promise.all([
        loadMessagesFromSupabase(conversation!.id),
        loadMessagesFromSupabase(conversation!.id),
        loadMessagesFromSupabase(conversation!.id),
      ]);

      expect(messages1.length).toBe(1);
      expect(messages2.length).toBe(1);
      expect(messages3.length).toBe(1);
      expect(messages1[0].id).toBe(messages2[0].id);
      expect(messages2[0].id).toBe(messages3[0].id);
    });

    test('should handle messages with special characters and emojis', async () => {
      const { data: conversation } = await supabase
        .from('conversations')
        .insert({
          user_id: testSession.userId,
          token_ca: GLOBAL_TOKEN_ID,
          title: 'Test: Special Characters',
        })
        .select()
        .single();

      testConversationIds.push(conversation!.id);

      const specialContent = 'Test 🚀 with emoji & symbols @#$% and unicode 中文';
      
      await supabase.from('messages').insert({
        conversation_id: conversation!.id,
        role: 'user',
        content: specialContent,
        metadata: { parts: [{ type: 'text', text: specialContent }] },
        created_at: new Date().toISOString(),
      });

      const loadedMessages = await loadMessagesFromSupabase(conversation!.id);

      expect(loadedMessages.length).toBe(1);
      expect((loadedMessages[0] as any).content).toBe(specialContent);
    });
  });

  describe('Real-time Updates', () => {
    test('should load new messages added after initial load', async () => {
      const { data: conversation } = await supabase
        .from('conversations')
        .insert({
          user_id: testSession.userId,
          token_ca: GLOBAL_TOKEN_ID,
          title: 'Test: Real-time Updates',
        })
        .select()
        .single();

      testConversationIds.push(conversation!.id);

      // Initial load
      const initialMessages = await loadMessagesFromSupabase(conversation!.id);
      expect(initialMessages.length).toBe(0);

      // Add a message
      await supabase.from('messages').insert({
        conversation_id: conversation!.id,
        role: 'user',
        content: 'New message',
        metadata: { parts: [{ type: 'text', text: 'New message' }] },
        created_at: new Date().toISOString(),
      });

      // Reload
      const updatedMessages = await loadMessagesFromSupabase(conversation!.id);
      expect(updatedMessages.length).toBe(1);
      expect((updatedMessages[0] as any).content).toBe('New message');
    });
  });
});
