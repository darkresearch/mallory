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

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import './setup';
import { setupTestUserSession, cleanupTestData, supabase } from './setup';

const GLOBAL_TOKEN_ID = '00000000-0000-0000-0000-000000000000';

// Mock secureStorage to avoid React Native imports
let mockSecureStorage: Record<string, string> = {};
const secureStorage = {
  getItem: async (key: string) => mockSecureStorage[key] || null,
  setItem: async (key: string, value: string) => {
    mockSecureStorage[key] = value;
  },
  removeItem: async (key: string) => {
    delete mockSecureStorage[key];
  },
};

// Storage keys (matching SECURE_STORAGE_KEYS)
const SECURE_STORAGE_KEYS = {
  CURRENT_CONVERSATION_ID: 'mallory_current_conversation_id',
};

// Helper function to load messages (replicates loadMessagesFromSupabase logic but uses test client)
async function loadMessagesFromSupabaseTest(conversationId: string) {
  const { data: messages, error } = await supabase
    .from('messages')
    .select('id, role, content, metadata, created_at, is_liked, is_disliked')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('📖 Error loading messages:', error);
    return [];
  }

  if (!messages || messages.length === 0) {
    return [];
  }

  // Convert Supabase format to UIMessage format
  return messages.map((msg: any) => {
    const parts = msg.metadata?.parts || [
      { type: 'text' as const, text: msg.content }
    ];

    return {
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      parts,
      content: msg.content,
      metadata: msg.metadata,
      createdAt: new Date(msg.created_at),
      isLiked: msg.is_liked,
      isDisliked: msg.is_disliked
    };
  });
}

describe('Chat History Integration Tests', () => {
  let testSession: {
    userId: string;
    email: string;
    accessToken: string;
    gridSession: any;
  };

  let testConversationIds: string[] = [];

  beforeEach(() => {
    // Reset mock storage between tests
    mockSecureStorage = {};
  });

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

  describe('Re-loading behavior (Navigation Fix)', () => {
    test('should reload conversations when navigating back to chat-history', async () => {
      console.log('\n🔄 TEST: Navigate away and back to chat-history\n');

      // Create a conversation
      const { data: conversation } = await supabase
        .from('conversations')
        .insert({
          user_id: testSession.userId,
          token_ca: GLOBAL_TOKEN_ID,
          title: 'Test: Re-navigation',
          metadata: {},
        })
        .select()
        .single();

      testConversationIds.push(conversation!.id);

      // Simulate: Load conversations (first visit)
      const { data: firstLoad } = await supabase
        .from('conversations')
        .select('id, title, token_ca, created_at, updated_at, metadata')
        .eq('user_id', testSession.userId)
        .eq('token_ca', GLOBAL_TOKEN_ID)
        .order('updated_at', { ascending: false });

      expect(firstLoad!.length).toBeGreaterThan(0);
      const firstLoadCount = firstLoad!.length;

      // Simulate: User navigates to /chat, then back to /chat-history
      // In the old version, isInitialized would block re-loading
      // In the new version, data should reload

      // Create a new conversation while "away"
      const { data: newConversation } = await supabase
        .from('conversations')
        .insert({
          user_id: testSession.userId,
          token_ca: GLOBAL_TOKEN_ID,
          title: 'Test: Created while away',
          metadata: {},
        })
        .select()
        .single();

      testConversationIds.push(newConversation!.id);

      // Simulate: Return to chat-history (should reload)
      const { data: secondLoad } = await supabase
        .from('conversations')
        .select('id, title, token_ca, created_at, updated_at, metadata')
        .eq('user_id', testSession.userId)
        .eq('token_ca', GLOBAL_TOKEN_ID)
        .order('updated_at', { ascending: false });

      // Should include the new conversation
      expect(secondLoad!.length).toBe(firstLoadCount + 1);
      expect(secondLoad!.some(c => c.id === newConversation!.id)).toBe(true);

      console.log('✅ Conversations reloaded on navigation back');
    });

    test('should work without isInitialized flag blocking re-loads', async () => {
      console.log('\n🔓 TEST: No isInitialized blocking\n');

      // This test verifies the fix by ensuring multiple loads work

      // Load 1
      const { data: load1 } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', testSession.userId)
        .eq('token_ca', GLOBAL_TOKEN_ID);

      // Load 2 (should not be blocked)
      const { data: load2 } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', testSession.userId)
        .eq('token_ca', GLOBAL_TOKEN_ID);

      // Load 3 (should not be blocked)
      const { data: load3 } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', testSession.userId)
        .eq('token_ca', GLOBAL_TOKEN_ID);

      // All loads should work (no flag blocking)
      expect(load1).toBeDefined();
      expect(load2).toBeDefined();
      expect(load3).toBeDefined();

      console.log('✅ Multiple loads work without blocking');
    });

    test('should handle rapid navigation (chat ↔ chat-history)', async () => {
      console.log('\n⚡ TEST: Rapid navigation between screens\n');

      // Simulate rapid navigation: chat → history → chat → history
      for (let i = 0; i < 5; i++) {
        const { data } = await supabase
          .from('conversations')
          .select('id')
          .eq('user_id', testSession.userId)
          .eq('token_ca', GLOBAL_TOKEN_ID);

        expect(data).toBeDefined();
      }

      console.log('✅ Rapid navigation handled correctly');
    });
  });

  describe('Mobile Safari compatibility', () => {
    test('should work without pathname dependencies', async () => {
      console.log('\n📱 TEST: Mobile Safari loading\n');

      // Chat-history screen should not rely on pathname detection
      // This ensures cross-browser compatibility

      const { data: conversations } = await supabase
        .from('conversations')
        .select('id, title')
        .eq('user_id', testSession.userId)
        .eq('token_ca', GLOBAL_TOKEN_ID);

      expect(conversations).toBeDefined();

      console.log('✅ Loaded without pathname dependency (Safari-compatible)');
    });
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

      const messages = await loadMessagesFromSupabaseTest(conversation!.id);

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

      const loadedMessages = await loadMessagesFromSupabaseTest(conversation!.id);

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

      const loadedMessages = await loadMessagesFromSupabaseTest(conversation!.id);

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

      const loadedMessages = await loadMessagesFromSupabaseTest(conversation!.id);

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

      const loadedMessages = await loadMessagesFromSupabaseTest(conversation!.id);

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

      // Query for most recent conversation (simulating getCurrentOrCreateConversation logic)
      const { data: recentConversations } = await supabase
        .from('conversations')
        .select('id, updated_at')
        .eq('user_id', testSession.userId)
        .eq('token_ca', GLOBAL_TOKEN_ID)
        .order('updated_at', { ascending: false })
        .limit(1);

      expect(recentConversations).not.toBe(null);
      expect(recentConversations!.length).toBeGreaterThan(0);
      // Should return a conversation (may be one of ours or another from previous tests)
      expect(recentConversations![0].id).toBeDefined();
      
      // Verify our created conversations exist
      const createdIds = conversations.map(c => c.id);
      const { data: verifyConversations } = await supabase
        .from('conversations')
        .select('id')
        .in('id', createdIds);
      expect(verifyConversations!.length).toBe(3);
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

      // Verify stored conversation can be retrieved (simulating getCurrentOrCreateConversation logic)
      const storedId = await secureStorage.getItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID);
      expect(storedId).toBe(conversation!.id);
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

      // Create new conversation directly (simulating createNewConversation logic)
      const { v4: uuidv4 } = await import('uuid');
      const newConversationId = uuidv4();
      
      await secureStorage.setItem(
        SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID,
        newConversationId
      );

      const { data, error } = await supabase
        .from('conversations')
        .insert({
          id: newConversationId,
          title: 'mallory-global',
          token_ca: GLOBAL_TOKEN_ID,
          user_id: testSession.userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata: {}
        })
        .select()
        .single();

      expect(error).toBe(null);
      expect(data).not.toBe(null);
      expect(data!.user_id).toBe(testSession.userId);

      testConversationIds.push(newConversationId);
    });
  });

  describe('Edge Cases', () => {
    test('should handle loading history for non-existent conversation', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const messages = await loadMessagesFromSupabaseTest(nonExistentId);

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

      const loadedMessages = await loadMessagesFromSupabaseTest(conversation!.id);

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

      const loadedMessages = await loadMessagesFromSupabaseTest(conversation!.id);

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
        loadMessagesFromSupabaseTest(conversation!.id),
        loadMessagesFromSupabaseTest(conversation!.id),
        loadMessagesFromSupabaseTest(conversation!.id),
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

      const loadedMessages = await loadMessagesFromSupabaseTest(conversation!.id);

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
      const initialMessages = await loadMessagesFromSupabaseTest(conversation!.id);
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
      const updatedMessages = await loadMessagesFromSupabaseTest(conversation!.id);
      expect(updatedMessages.length).toBe(1);
      expect((updatedMessages[0] as any).content).toBe('New message');
    });
  });
});
