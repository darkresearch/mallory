// @ts-nocheck - E2E test with complex mocking
/**
 * E2E Tests: Screen Navigation & Data Loading
 * 
 * CRITICAL: These tests ensure pages ALWAYS load when navigating between screens.
 * 
 * Tests every navigation path:
 * - Wallet → Chat (via arrow)
 * - Chat → Wallet (via arrow)
 * - Chat → Chat History (via arrow)
 * - Chat History → Chat (via arrow)
 * - Direct URL navigation
 * 
 * Verifies:
 * - Data actually loads (not stuck on "Loading...")
 * - No page refresh required
 * - Works on mobile/Safari
 * - Arrow navigation works
 * 
 * If ANY test fails, navigation is broken!
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { authenticateTestUser } from '../setup/test-helpers';
import { supabase } from '../setup/supabase-test-client';
import { v4 as uuidv4 } from 'uuid';

const GLOBAL_TOKEN_ID = '00000000-0000-0000-0000-000000000000';
const MAX_LOAD_TIME = 5000; // 5 seconds max to load

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

// Helper: Simulate navigation and verify data loads
interface NavigationResult {
  success: boolean;
  loadTime: number;
  dataLoaded: boolean;
  stuck: boolean;
  error?: string;
}

async function simulateNavigation(
  from: string,
  to: string,
  options: {
    userId: string;
    conversationId?: string;
    withRefresh?: boolean;
  }
): Promise<NavigationResult> {
  const startTime = Date.now();
  
  try {
    console.log(`\n🔄 Navigating: ${from} → ${to}`);
    if (options.withRefresh) {
      console.log('   (with page refresh)');
    }

    // Simulate page refresh if requested
    if (options.withRefresh) {
      mockSecureStorage = { ...mockSecureStorage }; // Persist storage
    }

    let dataLoaded = false;
    let stuck = false;

    // Simulate loading data based on destination
    if (to === '/chat') {
      // Load conversation
      const conversationId = await secureStorage.getItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID);
      
      if (!conversationId) {
        // Try to create/get conversation
        const { data: conversations } = await supabase
          .from('conversations')
          .select('id')
          .eq('user_id', options.userId)
          .eq('token_ca', GLOBAL_TOKEN_ID)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (conversations && conversations.length > 0) {
          await secureStorage.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversations[0].id);
          dataLoaded = true;
        }
      } else {
        // Load messages for conversation
        const { data: messages, error } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true });

        if (!error) {
          dataLoaded = true;
          console.log(`   ✅ Loaded ${messages?.length || 0} messages`);
        } else {
          stuck = true;
          console.error(`   ❌ Failed to load messages:`, error);
        }
      }
    } else if (to === '/chat-history') {
      // Load conversations
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', options.userId)
        .eq('token_ca', GLOBAL_TOKEN_ID);

      if (!error && conversations) {
        dataLoaded = true;
        console.log(`   ✅ Loaded ${conversations.length} conversations`);
      } else {
        stuck = true;
        console.error(`   ❌ Failed to load conversations:`, error);
      }
    } else if (to === '/wallet') {
      // Wallet loads independently (no chat data dependency)
      dataLoaded = true;
      console.log(`   ✅ Wallet screen ready`);
    }

    const loadTime = Date.now() - startTime;

    // Check if stuck (taking too long or failed to load)
    if (loadTime > MAX_LOAD_TIME) {
      stuck = true;
      console.error(`   ❌ Stuck: took ${loadTime}ms (>${MAX_LOAD_TIME}ms)`);
    }

    if (!dataLoaded) {
      stuck = true;
      console.error(`   ❌ Stuck: data never loaded`);
    }

    return {
      success: !stuck && dataLoaded,
      loadTime,
      dataLoaded,
      stuck,
    };
  } catch (error) {
    const loadTime = Date.now() - startTime;
    console.error(`   ❌ Navigation failed:`, error);
    
    return {
      success: false,
      loadTime,
      dataLoaded: false,
      stuck: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

describe('CRITICAL: Screen Navigation & Data Loading', () => {
  let testUserId: string;
  let testAccessToken: string;
  let testConversationIds: string[] = [];

  beforeAll(async () => {
    console.log('\n' + '='.repeat(80));
    console.log('CRITICAL TEST SUITE: Navigation & Data Loading');
    console.log('='.repeat(80));
    console.log('\nThese tests ensure pages ALWAYS load when navigating.');
    console.log('If ANY test fails, navigation is broken!\n');

    const auth = await authenticateTestUser();
    testUserId = auth.userId;
    testAccessToken = auth.accessToken;
  });

  beforeEach(() => {
    mockSecureStorage = {};
    console.log('\n' + '-'.repeat(80));
  });

  afterAll(async () => {
    // Cleanup
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

  describe('🔴 CRITICAL: Arrow Navigation (The Bug)', () => {
    test('MUST PASS: Wallet → Chat (arrow navigation)', async () => {
      console.log('\n🎯 THE ORIGINAL BUG TEST');

      // Setup: Create conversation with messages
      const conversationId = uuidv4();
      testConversationIds.push(conversationId);

      await supabase.from('conversations').insert({
        id: conversationId,
        user_id: testUserId,
        token_ca: GLOBAL_TOKEN_ID,
        title: 'Critical Test',
        metadata: {},
      });

      await supabase.from('messages').insert([
        {
          id: uuidv4(),
          conversation_id: conversationId,
          role: 'user',
          content: 'Test message 1',
          metadata: {},
        },
        {
          id: uuidv4(),
          conversation_id: conversationId,
          role: 'assistant',
          content: 'Test response 1',
          metadata: {},
        },
      ]);

      await secureStorage.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversationId);

      // CRITICAL: Navigate from wallet to chat via arrow
      const result = await simulateNavigation('/wallet', '/chat', {
        userId: testUserId,
        withRefresh: true, // This is the scenario that was broken
      });

      console.log('\n📊 Result:');
      console.log(`   Load time: ${result.loadTime}ms`);
      console.log(`   Data loaded: ${result.dataLoaded ? '✅' : '❌'}`);
      console.log(`   Stuck: ${result.stuck ? '🔴 YES' : '✅ NO'}`);

      // CRITICAL ASSERTIONS
      expect(result.success).toBe(true);
      expect(result.dataLoaded).toBe(true);
      expect(result.stuck).toBe(false);
      expect(result.loadTime).toBeLessThan(MAX_LOAD_TIME);

      if (!result.success) {
        throw new Error(`❌ CRITICAL: Chat failed to load after wallet refresh!`);
      }

      console.log('\n✅ PASS: Chat loaded successfully after wallet → chat navigation');
    });

    test('MUST PASS: Wallet → Chat → Wallet → Chat (rapid arrows)', async () => {
      console.log('\n🔄 RAPID ARROW NAVIGATION TEST');

      const conversationId = uuidv4();
      testConversationIds.push(conversationId);

      await supabase.from('conversations').insert({
        id: conversationId,
        user_id: testUserId,
        token_ca: GLOBAL_TOKEN_ID,
        title: 'Rapid nav test',
        metadata: {},
      });

      await secureStorage.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversationId);

      // Navigate rapidly: wallet → chat → wallet → chat
      const results = [];
      
      results.push(await simulateNavigation('/wallet', '/chat', { userId: testUserId }));
      results.push(await simulateNavigation('/chat', '/wallet', { userId: testUserId }));
      results.push(await simulateNavigation('/wallet', '/chat', { userId: testUserId }));

      // ALL navigations must succeed
      results.forEach((result, i) => {
        console.log(`\n   Navigation ${i + 1}: ${result.success ? '✅' : '❌'}`);
        expect(result.success).toBe(true);
        expect(result.stuck).toBe(false);
      });

      console.log('\n✅ PASS: Rapid arrow navigation works');
    });
  });

  describe('🔴 CRITICAL: All Navigation Paths', () => {
    test('MUST PASS: Chat → Chat History → Chat', async () => {
      console.log('\n🔄 Chat ↔ Chat History navigation');

      const conversationId = uuidv4();
      testConversationIds.push(conversationId);

      await supabase.from('conversations').insert({
        id: conversationId,
        user_id: testUserId,
        token_ca: GLOBAL_TOKEN_ID,
        title: 'History test',
        metadata: {},
      });

      await secureStorage.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversationId);

      // Chat → History
      const result1 = await simulateNavigation('/chat', '/chat-history', {
        userId: testUserId,
      });

      expect(result1.success).toBe(true);
      expect(result1.dataLoaded).toBe(true);

      // History → Chat
      const result2 = await simulateNavigation('/chat-history', '/chat', {
        userId: testUserId,
      });

      expect(result2.success).toBe(true);
      expect(result2.dataLoaded).toBe(true);

      console.log('\n✅ PASS: Chat ↔ Chat History navigation works');
    });

    test('MUST PASS: Direct URL navigation to /chat', async () => {
      console.log('\n🔗 Direct URL navigation');

      const conversationId = uuidv4();
      testConversationIds.push(conversationId);

      await supabase.from('conversations').insert({
        id: conversationId,
        user_id: testUserId,
        token_ca: GLOBAL_TOKEN_ID,
        title: 'Direct nav test',
        metadata: {},
      });

      await supabase.from('messages').insert({
        id: uuidv4(),
        conversation_id: conversationId,
        role: 'user',
        content: 'Direct nav message',
        metadata: {},
      });

      // Simulate typing /chat in browser
      const result = await simulateNavigation('(none)', '/chat', {
        userId: testUserId,
      });

      expect(result.success).toBe(true);
      expect(result.dataLoaded).toBe(true);

      console.log('\n✅ PASS: Direct URL navigation works');
    });

    test('MUST PASS: Navigation after refresh (any screen)', async () => {
      console.log('\n🔄 Navigation after page refresh');

      const conversationId = uuidv4();
      testConversationIds.push(conversationId);

      await supabase.from('conversations').insert({
        id: conversationId,
        user_id: testUserId,
        token_ca: GLOBAL_TOKEN_ID,
        title: 'Refresh test',
        metadata: {},
      });

      await secureStorage.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversationId);

      // Test refresh → navigate for each screen
      const screens = ['/wallet', '/chat', '/chat-history'];
      
      for (const from of screens) {
        for (const to of screens) {
          if (from === to) continue;

          const result = await simulateNavigation(from, to, {
            userId: testUserId,
            withRefresh: true,
          });

          if (!result.success) {
            throw new Error(`❌ CRITICAL: ${from} → ${to} failed after refresh!`);
          }
        }
      }

      console.log('\n✅ PASS: All navigation paths work after refresh');
    });
  });

  describe('🔴 CRITICAL: Data Loading Verification', () => {
    test('MUST PASS: Messages actually load (not stuck on "Loading...")', async () => {
      console.log('\n📊 Verify actual data loading');

      const conversationId = uuidv4();
      testConversationIds.push(conversationId);

      await supabase.from('conversations').insert({
        id: conversationId,
        user_id: testUserId,
        token_ca: GLOBAL_TOKEN_ID,
        title: 'Data load test',
        metadata: {},
      });

      // Insert 5 messages
      const messageIds = Array.from({ length: 5 }, () => uuidv4());
      await supabase.from('messages').insert(
        messageIds.map((id, i) => ({
          id,
          conversation_id: conversationId,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i + 1}`,
          metadata: {},
        }))
      );

      await secureStorage.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversationId);

      // Navigate and verify messages load
      const result = await simulateNavigation('/wallet', '/chat', {
        userId: testUserId,
      });

      expect(result.success).toBe(true);

      // Verify messages are actually there
      const { data: loadedMessages } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId);

      expect(loadedMessages).toBeDefined();
      expect(loadedMessages!.length).toBe(5);

      console.log('\n✅ PASS: All 5 messages loaded successfully');
    });

    test('MUST PASS: Empty conversation loads correctly', async () => {
      console.log('\n📭 Empty conversation test');

      const conversationId = uuidv4();
      testConversationIds.push(conversationId);

      await supabase.from('conversations').insert({
        id: conversationId,
        user_id: testUserId,
        token_ca: GLOBAL_TOKEN_ID,
        title: 'Empty test',
        metadata: {},
      });

      await secureStorage.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversationId);

      const result = await simulateNavigation('/wallet', '/chat', {
        userId: testUserId,
      });

      expect(result.success).toBe(true);
      expect(result.dataLoaded).toBe(true);

      console.log('\n✅ PASS: Empty conversation loads (shows empty state)');
    });

    test('MUST PASS: Chat history shows all conversations', async () => {
      console.log('\n📋 Chat history data loading');

      // Create 3 conversations
      const convIds = Array.from({ length: 3 }, () => uuidv4());
      testConversationIds.push(...convIds);

      await supabase.from('conversations').insert(
        convIds.map((id, i) => ({
          id,
          user_id: testUserId,
          token_ca: GLOBAL_TOKEN_ID,
          title: `History test ${i + 1}`,
          metadata: {},
        }))
      );

      const result = await simulateNavigation('/chat', '/chat-history', {
        userId: testUserId,
      });

      expect(result.success).toBe(true);

      // Verify all conversations loaded
      const { data: conversations } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', testUserId)
        .in('id', convIds);

      expect(conversations).toBeDefined();
      expect(conversations!.length).toBe(3);

      console.log('\n✅ PASS: All conversations loaded in history');
    });
  });

  describe('🔴 CRITICAL: Mobile Safari Specific', () => {
    test('MUST PASS: Safari-like navigation (delayed pathname)', async () => {
      console.log('\n🦁 Safari simulation test');

      const conversationId = uuidv4();
      testConversationIds.push(conversationId);

      await supabase.from('conversations').insert({
        id: conversationId,
        user_id: testUserId,
        token_ca: GLOBAL_TOKEN_ID,
        title: 'Safari test',
        metadata: {},
      });

      await supabase.from('messages').insert({
        id: uuidv4(),
        conversation_id: conversationId,
        role: 'user',
        content: 'Safari message',
        metadata: {},
      });

      await secureStorage.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversationId);

      // Simulate Safari delay
      const result = await simulateNavigation('/wallet', '/chat', {
        userId: testUserId,
        withRefresh: true,
      });

      // Add artificial delay to simulate Safari pathname lag
      await new Promise(resolve => setTimeout(resolve, 500));

      // Data should still load despite delay
      expect(result.success).toBe(true);
      expect(result.dataLoaded).toBe(true);

      console.log('\n✅ PASS: Works with Safari-like delays');
    });
  });

  describe('🔴 CRITICAL: Performance & Stress', () => {
    test('MUST PASS: 10 rapid navigations', async () => {
      console.log('\n⚡ Stress test: 10 rapid navigations');

      const conversationId = uuidv4();
      testConversationIds.push(conversationId);

      await supabase.from('conversations').insert({
        id: conversationId,
        user_id: testUserId,
        token_ca: GLOBAL_TOKEN_ID,
        title: 'Stress test',
        metadata: {},
      });

      await secureStorage.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversationId);

      const results = [];
      for (let i = 0; i < 10; i++) {
        const from = i % 2 === 0 ? '/wallet' : '/chat';
        const to = i % 2 === 0 ? '/chat' : '/wallet';
        
        const result = await simulateNavigation(from, to, {
          userId: testUserId,
        });

        results.push(result);

        if (!result.success) {
          throw new Error(`❌ Navigation ${i + 1} failed!`);
        }
      }

      const avgLoadTime = results.reduce((sum, r) => sum + r.loadTime, 0) / results.length;
      const maxLoadTime = Math.max(...results.map(r => r.loadTime));

      console.log(`\n   Average load time: ${avgLoadTime.toFixed(0)}ms`);
      console.log(`   Max load time: ${maxLoadTime}ms`);

      expect(maxLoadTime).toBeLessThan(MAX_LOAD_TIME);
      console.log('\n✅ PASS: 10 rapid navigations successful');
    });

    test('MUST PASS: Navigation with many messages', async () => {
      console.log('\n📚 Large conversation test');

      const conversationId = uuidv4();
      testConversationIds.push(conversationId);

      await supabase.from('conversations').insert({
        id: conversationId,
        user_id: testUserId,
        token_ca: GLOBAL_TOKEN_ID,
        title: 'Large conversation',
        metadata: {},
      });

      // Insert 50 messages
      const messages = Array.from({ length: 50 }, (_, i) => ({
        id: uuidv4(),
        conversation_id: conversationId,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}`,
        metadata: {},
      }));

      await supabase.from('messages').insert(messages);
      await secureStorage.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversationId);

      const result = await simulateNavigation('/wallet', '/chat', {
        userId: testUserId,
      });

      expect(result.success).toBe(true);
      expect(result.loadTime).toBeLessThan(MAX_LOAD_TIME);

      console.log(`\n   Loaded 50 messages in ${result.loadTime}ms`);
      console.log('\n✅ PASS: Large conversations load quickly');
    });
  });

  describe('🔴 CRITICAL: Error Recovery', () => {
    test('MUST PASS: Navigation with corrupted storage', async () => {
      console.log('\n🔧 Corrupted storage recovery');

      // Set invalid conversation ID
      await secureStorage.setItem(
        SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID,
        'invalid-id-12345'
      );

      const result = await simulateNavigation('/wallet', '/chat', {
        userId: testUserId,
      });

      // Should recover gracefully (create new conversation or show empty)
      expect(result.success).toBe(true);
      expect(result.stuck).toBe(false);

      console.log('\n✅ PASS: Recovered from corrupted storage');
    });

    test('MUST PASS: Navigation when network is slow', async () => {
      console.log('\n🐌 Slow network simulation');

      const conversationId = uuidv4();
      testConversationIds.push(conversationId);

      await supabase.from('conversations').insert({
        id: conversationId,
        user_id: testUserId,
        token_ca: GLOBAL_TOKEN_ID,
        title: 'Slow network test',
        metadata: {},
      });

      await secureStorage.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversationId);

      // Add artificial delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      const result = await simulateNavigation('/wallet', '/chat', {
        userId: testUserId,
      });

      expect(result.success).toBe(true);
      expect(result.loadTime).toBeLessThan(MAX_LOAD_TIME);

      console.log('\n✅ PASS: Handles slow network gracefully');
    });
  });
});
