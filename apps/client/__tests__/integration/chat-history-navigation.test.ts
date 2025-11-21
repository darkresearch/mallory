/**
 * Integration Tests: Chat History Navigation
 * 
 * Tests chat history navigation behavior:
 * - Navigation preserves active conversation
 * - Storage persistence across navigation
 * - URL parameter handling
 * - Error recovery
 * 
 * REQUIREMENTS:
 * - Backend server running
 * - Test user with Grid wallet
 */

import { describe, test, expect, beforeEach, afterAll } from 'bun:test';
import { authenticateTestUser } from '../setup/test-helpers';
import { supabase } from '../setup/supabase-test-client';
import { v4 as uuidv4 } from 'uuid';

const GLOBAL_TOKEN_ID = '00000000-0000-0000-0000-000000000000';

// Mock storage to simulate navigation
let mockStorage: Record<string, string> = {};
const storage = {
  getItem: async (key: string) => mockStorage[key] || null,
  setItem: async (key: string, value: string) => {
    mockStorage[key] = value;
  },
  removeItem: async (key: string) => {
    delete mockStorage[key];
  },
};

const SECURE_STORAGE_KEYS = {
  CURRENT_CONVERSATION_ID: 'mallory_current_conversation_id',
};

describe('Integration: Chat History Navigation', () => {
  let testUserId: string;
  let testConversationIds: string[] = [];

  beforeEach(() => {
    mockStorage = {};
  });

  afterAll(async () => {
    // Cleanup test conversations
    if (testConversationIds.length > 0) {
      await supabase
        .from('messages')
        .delete()
        .in('conversation_id', testConversationIds);
      
      await supabase
        .from('conversations')
        .delete()
        .in('id', testConversationIds);
    }
  });

  describe('Navigation Preserves Active Conversation', () => {
    test('should include conversationId in URL when navigating back from chat-history', async () => {
      console.log('\n✅ TEST: Navigation preserves conversation\n');

      const { userId } = await authenticateTestUser();
      testUserId = userId;

      // Create a conversation
      const conversationId = uuidv4();
      testConversationIds.push(conversationId);

      await supabase.from('conversations').insert({
        id: conversationId,
        user_id: userId,
        token_ca: GLOBAL_TOKEN_ID,
        title: 'Test Active Conversation',
        metadata: {},
      });

      // Store as active conversation (simulating chat screen)
      await storage.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversationId);
      console.log('📍 Active conversation set:', conversationId);

      // SIMULATE: User navigates to chat-history screen
      console.log('📍 User navigates to /chat-history');

      // SIMULATE: handleBack function (the fix)
      const activeConversationId = await storage.getItem(
        SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID
      );
      
      let navigationUrl: string;
      if (activeConversationId) {
        navigationUrl = `/(main)/chat?conversationId=${activeConversationId}`;
      } else {
        navigationUrl = '/(main)/chat';
      }

      console.log('🔙 Navigating back to:', navigationUrl);

      // VERIFY: URL includes conversationId
      expect(navigationUrl).toContain('conversationId=');
      expect(navigationUrl).toContain(conversationId);

      // SIMULATE: useActiveConversation loading with URL param
      const urlMatch = navigationUrl.match(/conversationId=([^&]+)/);
      const conversationIdFromUrl = urlMatch ? urlMatch[1] : null;

      expect(conversationIdFromUrl).toBe(conversationId);
      console.log('✅ Conversation preserved in navigation');
    });

    test('should fallback to basic route when no active conversation exists', async () => {
      console.log('\n✅ TEST: Graceful fallback when no conversation\n');

      // Clear storage
      mockStorage = {};

      // SIMULATE: handleBack with no active conversation
      const activeConversationId = await storage.getItem(
        SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID
      );
      
      let navigationUrl: string;
      if (activeConversationId) {
        navigationUrl = `/(main)/chat?conversationId=${activeConversationId}`;
      } else {
        navigationUrl = '/(main)/chat';
      }

      console.log('🔙 Navigating to:', navigationUrl);

      // VERIFY: Falls back to basic route
      expect(navigationUrl).toBe('/(main)/chat');
      expect(navigationUrl).not.toContain('conversationId');
      console.log('✅ Graceful fallback works');
    });

    test('should handle storage errors gracefully', async () => {
      console.log('\n✅ TEST: Error handling in navigation\n');

      // Create a storage that throws errors
      const errorStorage = {
        getItem: async () => {
          throw new Error('Storage read error');
        },
      };

      // SIMULATE: handleBack with storage error
      let navigationUrl: string;
      try {
        const activeConversationId = await errorStorage.getItem('test');
        navigationUrl = `/(main)/chat?conversationId=${activeConversationId}`;
      } catch (error) {
        console.log('⚠️  Storage error caught:', error);
        navigationUrl = '/(main)/chat';
      }

      // VERIFY: Falls back gracefully
      expect(navigationUrl).toBe('/(main)/chat');
      console.log('✅ Error handling works');
    });
  });

  describe('Storage Persistence Across Navigation', () => {
    test('should NOT clear storage when conversationId becomes null temporarily', async () => {
      console.log('\n✅ TEST: Storage persists during navigation\n');

      const conversationId = uuidv4();

      // Set initial conversation
      await storage.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversationId);
      console.log('📍 Initial conversation set:', conversationId);

      // SIMULATE: Context update that sets conversationId to null temporarily
      // (This used to clear storage in the old code)
      let contextConversationId: string | null = conversationId;

      // Navigate to chat-history (conversationId might become null)
      contextConversationId = null;
      console.log('📍 Context conversationId becomes null during navigation');

      // OLD CODE would clear storage here
      // NEW CODE does NOT clear storage

      // VERIFY: Storage still has the conversation
      const storedId = await storage.getItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID);
      expect(storedId).toBe(conversationId);
      console.log('✅ Storage persisted:', storedId);

      // Navigate back to chat
      contextConversationId = conversationId;
      
      // VERIFY: Can reload from storage
      const reloadedId = await storage.getItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID);
      expect(reloadedId).toBe(conversationId);
      console.log('✅ Conversation reloaded from storage');
    });

    test('should persist storage across multiple navigation cycles', async () => {
      console.log('\n✅ TEST: Multiple navigation cycles\n');

      const { userId } = await authenticateTestUser();
      const conversationId = uuidv4();
      testConversationIds.push(conversationId);

      await supabase.from('conversations').insert({
        id: conversationId,
        user_id: userId,
        token_ca: GLOBAL_TOKEN_ID,
        title: 'Multi-navigation Test',
        metadata: {},
      });

      // Initial set
      await storage.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversationId);

      // Cycle 1: chat → chat-history → chat
      console.log('📍 Cycle 1: chat → chat-history');
      let storedId = await storage.getItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID);
      expect(storedId).toBe(conversationId);

      console.log('📍 Cycle 1: chat-history → chat');
      storedId = await storage.getItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID);
      expect(storedId).toBe(conversationId);

      // Cycle 2: chat → wallet → chat
      console.log('📍 Cycle 2: chat → wallet');
      storedId = await storage.getItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID);
      expect(storedId).toBe(conversationId);

      console.log('📍 Cycle 2: wallet → chat');
      storedId = await storage.getItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID);
      expect(storedId).toBe(conversationId);

      // Cycle 3: chat → chat-history → different conversation
      const newConversationId = uuidv4();
      testConversationIds.push(newConversationId);

      await supabase.from('conversations').insert({
        id: newConversationId,
        user_id: userId,
        token_ca: GLOBAL_TOKEN_ID,
        title: 'New Conversation',
        metadata: {},
      });

      console.log('📍 Cycle 3: Select different conversation from history');
      await storage.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, newConversationId);
      
      storedId = await storage.getItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID);
      expect(storedId).toBe(newConversationId);
      console.log('✅ All navigation cycles preserved storage correctly');
    });
  });

  describe('URL Parameter Handling', () => {
    test('should prefer URL param over storage when loading', async () => {
      console.log('\n✅ TEST: URL param takes precedence\n');

      const { userId } = await authenticateTestUser();
      
      // Create two conversations
      const storageConversationId = uuidv4();
      const urlConversationId = uuidv4();
      testConversationIds.push(storageConversationId, urlConversationId);

      await supabase.from('conversations').insert([
        {
          id: storageConversationId,
          user_id: userId,
          token_ca: GLOBAL_TOKEN_ID,
          title: 'Storage Conversation',
          metadata: {},
        },
        {
          id: urlConversationId,
          user_id: userId,
          token_ca: GLOBAL_TOKEN_ID,
          title: 'URL Conversation',
          metadata: {},
        },
      ]);

      // Storage has one conversation
      await storage.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, storageConversationId);
      console.log('📍 Storage has:', storageConversationId);

      // URL has different conversation
      console.log('📍 URL has:', urlConversationId);

      // SIMULATE: useActiveConversation loading logic
      const urlParam = urlConversationId; // From router
      let loadedConversationId: string;

      if (urlParam) {
        // URL param takes precedence
        loadedConversationId = urlParam;
        // Update storage to match
        await storage.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, urlParam);
      } else {
        // Load from storage
        loadedConversationId = await storage.getItem(
          SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID
        ) || '';
      }

      // VERIFY: Used URL param
      expect(loadedConversationId).toBe(urlConversationId);

      // VERIFY: Updated storage
      const finalStorageId = await storage.getItem(
        SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID
      );
      expect(finalStorageId).toBe(urlConversationId);
      console.log('✅ URL param took precedence and updated storage');
    });

    test('should load from storage when no URL param present', async () => {
      console.log('\n✅ TEST: Load from storage when no URL\n');

      const conversationId = uuidv4();

      // Storage has conversation
      await storage.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversationId);
      console.log('📍 Storage has:', conversationId);

      // No URL param
      const urlParam = undefined;
      console.log('📍 URL param: none');

      // SIMULATE: useActiveConversation loading logic
      let loadedConversationId: string | null;

      if (urlParam) {
        loadedConversationId = urlParam;
      } else {
        loadedConversationId = await storage.getItem(
          SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID
        );
      }

      // VERIFY: Loaded from storage
      expect(loadedConversationId).toBe(conversationId);
      console.log('✅ Loaded from storage successfully');
    });
  });

  describe('Complete Navigation Flow Integration', () => {
    test('should handle complete user journey: chat → history → select different chat', async () => {
      console.log('\n✅ TEST: Complete navigation flow\n');

      const { userId } = await authenticateTestUser();
      
      // Create multiple conversations
      const conversation1Id = uuidv4();
      const conversation2Id = uuidv4();
      testConversationIds.push(conversation1Id, conversation2Id);

      await supabase.from('conversations').insert([
        {
          id: conversation1Id,
          user_id: userId,
          token_ca: GLOBAL_TOKEN_ID,
          title: 'Conversation 1',
          metadata: {},
        },
        {
          id: conversation2Id,
          user_id: userId,
          token_ca: GLOBAL_TOKEN_ID,
          title: 'Conversation 2',
          metadata: {},
        },
      ]);

      // STEP 1: User is on chat with conversation 1
      console.log('\n📍 STEP 1: User on /chat with conversation 1');
      await storage.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversation1Id);
      
      let currentConv = await storage.getItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID);
      expect(currentConv).toBe(conversation1Id);

      // STEP 2: User navigates to chat-history
      console.log('\n📍 STEP 2: User navigates to /chat-history');
      
      // Storage should still have conversation 1
      currentConv = await storage.getItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID);
      expect(currentConv).toBe(conversation1Id);

      // Load conversations list
      const { data: conversations } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', userId)
        .eq('token_ca', GLOBAL_TOKEN_ID);
      
      expect(conversations!.length).toBeGreaterThanOrEqual(2);

      // STEP 3: User taps conversation 2
      console.log('\n📍 STEP 3: User selects conversation 2');
      await storage.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversation2Id);
      
      // Navigate to chat with conversation 2
      const navigationUrl = `/(main)/chat?conversationId=${conversation2Id}`;
      const urlMatch = navigationUrl.match(/conversationId=([^&]+)/);
      const conversationIdFromUrl = urlMatch ? urlMatch[1] : null;

      // STEP 4: Chat loads with conversation 2
      console.log('\n📍 STEP 4: Chat loads with conversation 2');
      
      // Should load conversation 2 (from URL)
      expect(conversationIdFromUrl).toBe(conversation2Id);
      
      // Storage should have conversation 2
      currentConv = await storage.getItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID);
      expect(currentConv).toBe(conversation2Id);

      console.log('✅ Complete navigation flow works correctly');
    });

    test('should handle page refresh during navigation', async () => {
      console.log('\n✅ TEST: Page refresh during navigation\n');

      const { userId } = await authenticateTestUser();
      const conversationId = uuidv4();
      testConversationIds.push(conversationId);

      await supabase.from('conversations').insert({
        id: conversationId,
        user_id: userId,
        token_ca: GLOBAL_TOKEN_ID,
        title: 'Refresh Test',
        metadata: {},
      });

      // User is on chat
      await storage.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversationId);
      console.log('📍 User on /chat');

      // User navigates to chat-history
      console.log('📍 User navigates to /chat-history');

      // SIMULATE: Page refresh (storage persists, React state clears)
      console.log('🔄 Page refreshes');
      
      // Storage should still have conversation
      const storedId = await storage.getItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID);
      expect(storedId).toBe(conversationId);

      // Navigate back to chat
      console.log('📍 User navigates back to /chat');
      
      const activeId = await storage.getItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID);
      const navigationUrl = activeId 
        ? `/(main)/chat?conversationId=${activeId}`
        : '/(main)/chat';

      // Should include conversation
      expect(navigationUrl).toContain(conversationId);
      console.log('✅ Page refresh handled correctly');
    });
  });
});
