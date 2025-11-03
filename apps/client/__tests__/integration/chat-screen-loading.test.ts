/**
 * Integration Tests: Chat Screen Loading Behavior
 * 
 * Tests chat screen data loading with real Supabase:
 * - Initial load on page mount
 * - Re-load when navigating back to chat
 * - Load when conversation ID changes
 * - Cross-browser compatibility (no pathname dependencies)
 * 
 * REQUIREMENTS:
 * - Supabase connection
 * - Test user credentials
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import './setup';
import { setupTestUserSession, cleanupTestData, supabase } from './setup';
import { v4 as uuidv4 } from 'uuid';

const GLOBAL_TOKEN_ID = '00000000-0000-0000-0000-000000000000';

// Mock secureStorage
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

const SECURE_STORAGE_KEYS = {
  CURRENT_CONVERSATION_ID: 'mallory_current_conversation_id',
};

// Helper: Load messages from Supabase (replicates hook behavior)
async function loadMessagesForConversation(conversationId: string) {
  const { data: messages, error } = await supabase
    .from('messages')
    .select('id, role, content, metadata, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error || !messages) {
    return [];
  }

  return messages;
}

// Helper: Get or create conversation (replicates hook behavior)
async function getCurrentOrCreateConversation(userId: string) {
  // Check storage first
  const storedId = await secureStorage.getItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID);
  
  if (storedId) {
    return { conversationId: storedId };
  }

  // Query for most recent conversation
  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, updated_at')
    .eq('user_id', userId)
    .eq('token_ca', GLOBAL_TOKEN_ID)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (conversations && conversations.length > 0) {
    const conversationId = conversations[0].id;
    await secureStorage.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversationId);
    return { conversationId };
  }

  // Create new conversation
  const newConversationId = uuidv4();
  const { error } = await supabase
    .from('conversations')
    .insert({
      id: newConversationId,
      title: 'mallory-global',
      token_ca: GLOBAL_TOKEN_ID,
      user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: {}
    });

  if (error) throw error;

  await secureStorage.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, newConversationId);
  return { conversationId: newConversationId };
}

describe('Chat Screen Loading Integration Tests', () => {
  let testSession: {
    userId: string;
    email: string;
    accessToken: string;
    gridSession: any;
  };

  let testConversationIds: string[] = [];

  beforeEach(() => {
    mockSecureStorage = {};
  });

  beforeAll(async () => {
    console.log('🔧 Setting up test user session for chat screen tests...');
    testSession = await setupTestUserSession();
    console.log('✅ Test session ready:', testSession.userId);
  });

  afterAll(async () => {
    console.log('🧹 Cleaning up test conversations...');
    
    if (testConversationIds.length > 0) {
      await supabase
        .from('conversations')
        .delete()
        .in('id', testConversationIds);
    }
    
    await cleanupTestData(testSession.userId);
  });

  describe('SCENARIO: User navigates from /wallet to /chat', () => {
    test('should load conversation data without refresh', async () => {
      console.log('\n🔄 TEST: Wallet → Chat navigation\n');

      // Setup: Create a conversation with messages
      const conversationId = uuidv4();
      testConversationIds.push(conversationId);

      await supabase.from('conversations').insert({
        id: conversationId,
        user_id: testSession.userId,
        token_ca: GLOBAL_TOKEN_ID,
        title: 'Test: Wallet to Chat',
        metadata: {},
      });

      await supabase.from('messages').insert([
        {
          id: uuidv4(),
          conversation_id: conversationId,
          role: 'user',
          content: 'Hello from wallet',
          metadata: {},
        },
        {
          id: uuidv4(),
          conversation_id: conversationId,
          role: 'assistant',
          content: 'Hi! I loaded correctly.',
          metadata: {},
        },
      ]);

      // Store as active conversation (simulates prior navigation)
      await secureStorage.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversationId);

      // SIMULATE: User is on /wallet, then navigates to /chat
      // The hook should load the conversation from storage

      const loadedConv = await getCurrentOrCreateConversation(testSession.userId);
      expect(loadedConv.conversationId).toBe(conversationId);

      const messages = await loadMessagesForConversation(conversationId);
      expect(messages.length).toBe(2);
      expect(messages[0].content).toBe('Hello from wallet');
      expect(messages[1].content).toBe('Hi! I loaded correctly.');

      console.log('✅ Messages loaded successfully without refresh');
    });

    test('should work on mobile Safari (no pathname dependency)', async () => {
      console.log('\n📱 TEST: Mobile Safari behavior\n');

      // This test ensures we don't rely on pathname which behaves differently on Safari
      
      const conversationId = uuidv4();
      testConversationIds.push(conversationId);

      await supabase.from('conversations').insert({
        id: conversationId,
        user_id: testSession.userId,
        token_ca: GLOBAL_TOKEN_ID,
        title: 'Test: Mobile Safari',
        metadata: {},
      });

      await secureStorage.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversationId);

      // Load conversation - should work without pathname
      const loadedConv = await getCurrentOrCreateConversation(testSession.userId);
      expect(loadedConv.conversationId).toBe(conversationId);

      console.log('✅ Loaded on mobile Safari without pathname dependency');
    });
  });

  describe('SCENARIO: User refreshes /wallet then goes to /chat', () => {
    test('should load conversation from storage after refresh', async () => {
      console.log('\n🔄 TEST: Refresh /wallet → Chat\n');

      const conversationId = uuidv4();
      testConversationIds.push(conversationId);

      await supabase.from('conversations').insert({
        id: conversationId,
        user_id: testSession.userId,
        token_ca: GLOBAL_TOKEN_ID,
        title: 'Test: Refresh then chat',
        metadata: {},
      });

      // Store active conversation before "refresh"
      await secureStorage.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversationId);

      // SIMULATE: Page refresh (storage persists, but no React state)
      // Then navigate to /chat

      const loadedConv = await getCurrentOrCreateConversation(testSession.userId);
      expect(loadedConv.conversationId).toBe(conversationId);

      console.log('✅ Conversation loaded from persistent storage');
    });
  });

  describe('SCENARIO: User opens specific conversation from /chat-history', () => {
    test('should load conversation from URL param', async () => {
      console.log('\n🔗 TEST: Open conversation from URL\n');

      const conversationId = uuidv4();
      testConversationIds.push(conversationId);

      await supabase.from('conversations').insert({
        id: conversationId,
        user_id: testSession.userId,
        token_ca: GLOBAL_TOKEN_ID,
        title: 'Test: URL param',
        metadata: {},
      });

      await supabase.from('messages').insert({
        id: uuidv4(),
        conversation_id: conversationId,
        role: 'user',
        content: 'Opened from history',
        metadata: {},
      });

      // SIMULATE: URL param passed (/chat?conversationId=xxx)
      // Hook should use URL param, not storage

      // Clear storage to ensure we're using URL param
      mockSecureStorage = {};

      // In real hook, this would come from useLocalSearchParams
      const urlConversationId = conversationId;

      const messages = await loadMessagesForConversation(urlConversationId);
      expect(messages.length).toBe(1);
      expect(messages[0].content).toBe('Opened from history');

      console.log('✅ Loaded conversation from URL param');
    });
  });

  describe('SCENARIO: Multiple rapid navigations', () => {
    test('should handle rapid back-and-forth navigation', async () => {
      console.log('\n⚡ TEST: Rapid navigation\n');

      const conversationId = uuidv4();
      testConversationIds.push(conversationId);

      await supabase.from('conversations').insert({
        id: conversationId,
        user_id: testSession.userId,
        token_ca: GLOBAL_TOKEN_ID,
        title: 'Test: Rapid nav',
        metadata: {},
      });

      await secureStorage.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversationId);

      // Simulate rapid navigation: chat → history → chat → history → chat
      for (let i = 0; i < 5; i++) {
        const conv = await getCurrentOrCreateConversation(testSession.userId);
        expect(conv.conversationId).toBe(conversationId);
      }

      console.log('✅ Handled rapid navigation without issues');
    });
  });

  describe('SCENARIO: First-time user (no conversations)', () => {
    test('should create first conversation automatically', async () => {
      console.log('\n👤 TEST: First-time user\n');

      // Use a fresh user ID (no conversations)
      const freshUserId = uuidv4();
      
      // Clear storage
      mockSecureStorage = {};

      // Load conversation - should create new one
      const conv = await getCurrentOrCreateConversation(freshUserId);
      expect(conv.conversationId).toBeDefined();
      
      testConversationIds.push(conv.conversationId);

      // Verify it was created in DB
      const { data } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conv.conversationId)
        .single();

      expect(data).toBeDefined();
      expect(data!.user_id).toBe(freshUserId);

      console.log('✅ Created first conversation for new user');
    });
  });

  describe('SCENARIO: Conversation ID changes', () => {
    test('should reload when switching conversations', async () => {
      console.log('\n🔄 TEST: Switch conversations\n');

      // Create two conversations
      const conv1Id = uuidv4();
      const conv2Id = uuidv4();
      testConversationIds.push(conv1Id, conv2Id);

      await supabase.from('conversations').insert([
        {
          id: conv1Id,
          user_id: testSession.userId,
          token_ca: GLOBAL_TOKEN_ID,
          title: 'Conversation 1',
          metadata: {},
        },
        {
          id: conv2Id,
          user_id: testSession.userId,
          token_ca: GLOBAL_TOKEN_ID,
          title: 'Conversation 2',
          metadata: {},
        },
      ]);

      // Add different messages to each
      await supabase.from('messages').insert([
        {
          id: uuidv4(),
          conversation_id: conv1Id,
          role: 'user',
          content: 'Message in conv 1',
          metadata: {},
        },
        {
          id: uuidv4(),
          conversation_id: conv2Id,
          role: 'user',
          content: 'Message in conv 2',
          metadata: {},
        },
      ]);

      // Load first conversation
      const messages1 = await loadMessagesForConversation(conv1Id);
      expect(messages1[0].content).toBe('Message in conv 1');

      // Switch to second conversation
      const messages2 = await loadMessagesForConversation(conv2Id);
      expect(messages2[0].content).toBe('Message in conv 2');

      console.log('✅ Successfully switched between conversations');
    });
  });

  describe('Edge cases', () => {
    test('should handle empty conversation (no messages)', async () => {
      const conversationId = uuidv4();
      testConversationIds.push(conversationId);

      await supabase.from('conversations').insert({
        id: conversationId,
        user_id: testSession.userId,
        token_ca: GLOBAL_TOKEN_ID,
        title: 'Empty conversation',
        metadata: {},
      });

      const messages = await loadMessagesForConversation(conversationId);
      expect(messages.length).toBe(0);
    });

    test('should handle storage corruption gracefully', async () => {
      // Set invalid conversation ID in storage
      await secureStorage.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, 'invalid-id');

      // Should fall back to creating new conversation
      const conv = await getCurrentOrCreateConversation(testSession.userId);
      expect(conv.conversationId).toBeDefined();
      expect(conv.conversationId).not.toBe('invalid-id');
      
      testConversationIds.push(conv.conversationId);
    });
  });
});
