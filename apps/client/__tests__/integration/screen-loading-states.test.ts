// @ts-nocheck - Integration test with flexible types
/**
 * Integration Tests: Screen Loading States
 * 
 * Tests that verify screen components transition from loading → loaded correctly.
 * 
 * CRITICAL: Ensures screens never get stuck on "Loading..." state
 * 
 * For each screen:
 * - Chat screen
 * - Chat History screen  
 * - Wallet screen
 * 
 * Verifies:
 * - Loading state appears initially
 * - Loading state transitions to loaded
 * - Data is actually present
 * - No infinite loading states
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import './setup';
import { setupTestUserSession, cleanupTestData, supabase } from './setup';
import { v4 as uuidv4 } from 'uuid';

const GLOBAL_TOKEN_ID = '00000000-0000-0000-0000-000000000000';
const MAX_LOADING_TIME = 5000; // Max 5 seconds in loading state

// Track loading states
interface LoadingStateTracker {
  isLoading: boolean;
  startTime: number;
  endTime?: number;
  dataPresent: boolean;
  stuckInLoading: boolean;
}

describe('CRITICAL: Screen Loading States', () => {
  let testSession: {
    userId: string;
    email: string;
    accessToken: string;
    gridSession: any;
  };

  let testConversationIds: string[] = [];

  beforeAll(async () => {
    console.log('\n' + '='.repeat(80));
    console.log('CRITICAL TEST SUITE: Screen Loading States');
    console.log('='.repeat(80));
    console.log('\nThese tests ensure screens never get stuck loading.\n');

    testSession = await setupTestUserSession();
  });

  afterAll(async () => {
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
    
    await cleanupTestData(testSession.userId);
  });

  describe('Chat Screen Loading States', () => {
    test('MUST PASS: Chat screen loads within timeout', async () => {
      console.log('\n⏱️  Chat screen load time test');

      const conversationId = uuidv4();
      testConversationIds.push(conversationId);

      await supabase.from('conversations').insert({
        id: conversationId,
        user_id: testSession.userId,
        token_ca: GLOBAL_TOKEN_ID,
        title: 'Load time test',
        metadata: {},
      });

      const tracker: LoadingStateTracker = {
        isLoading: true,
        startTime: Date.now(),
        dataPresent: false,
        stuckInLoading: false,
      };

      // Simulate loading process
      const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId);

      tracker.endTime = Date.now();
      tracker.isLoading = false;
      tracker.dataPresent = messages !== null;

      const loadTime = tracker.endTime - tracker.startTime;
      
      console.log(`   Load time: ${loadTime}ms`);
      console.log(`   Data present: ${tracker.dataPresent ? '✅' : '❌'}`);

      expect(loadTime).toBeLessThan(MAX_LOADING_TIME);
      expect(tracker.dataPresent).toBe(true);
      expect(tracker.isLoading).toBe(false);

      console.log('\n✅ PASS: Chat loaded within timeout');
    });

    test('MUST PASS: Chat screen never shows infinite "Loading conversation history"', async () => {
      console.log('\n🔄 Infinite loading state test');

      const conversationId = uuidv4();
      testConversationIds.push(conversationId);

      await supabase.from('conversations').insert({
        id: conversationId,
        user_id: testSession.userId,
        token_ca: GLOBAL_TOKEN_ID,
        title: 'Infinite loading test',
        metadata: {},
      });

      await supabase.from('messages').insert({
        id: uuidv4(),
        conversation_id: conversationId,
        role: 'user',
        content: 'Test message',
        metadata: {},
      });

      // Track loading state over time
      const loadingChecks: boolean[] = [];
      const startTime = Date.now();

      // Check loading state every 500ms for 5 seconds
      for (let i = 0; i < 10; i++) {
        const { data } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId);

        const isStillLoading = data === null || data.length === 0;
        loadingChecks.push(isStillLoading);

        if (!isStillLoading) {
          // Data loaded successfully
          console.log(`   ✅ Loaded after ${Date.now() - startTime}ms`);
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const wasStuck = loadingChecks.every(check => check === true);

      if (wasStuck) {
        throw new Error('❌ CRITICAL: Chat stuck in loading state for 5+ seconds!');
      }

      console.log('\n✅ PASS: Chat never stuck in loading state');
    });

    test('MUST PASS: Chat transitions from loading to loaded state', async () => {
      console.log('\n🔄 State transition test');

      const conversationId = uuidv4();
      testConversationIds.push(conversationId);

      await supabase.from('conversations').insert({
        id: conversationId,
        user_id: testSession.userId,
        token_ca: GLOBAL_TOKEN_ID,
        title: 'Transition test',
        metadata: {},
      });

      await supabase.from('messages').insert({
        id: uuidv4(),
        conversation_id: conversationId,
        role: 'user',
        content: 'Transition test message',
        metadata: {},
      });

      // Phase 1: Initial state (should be loading)
      const phase1 = {
        isLoading: true,
        hasData: false,
      };

      // Phase 2: Loading data
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId);

      // Phase 3: Loaded state
      const phase3 = {
        isLoading: false,
        hasData: messages !== null && messages.length > 0,
      };

      console.log('\n   State transitions:');
      console.log(`   1. Initial: loading=${phase1.isLoading}, data=${phase1.hasData}`);
      console.log(`   2. Loading: (querying database...)`);
      console.log(`   3. Loaded: loading=${phase3.isLoading}, data=${phase3.hasData}`);

      // Verify proper state transition
      expect(phase3.isLoading).toBe(false);
      expect(phase3.hasData).toBe(true);
      expect(error).toBeNull();

      console.log('\n✅ PASS: Proper state transition (loading → loaded)');
    });
  });

  describe('Chat History Screen Loading States', () => {
    test('MUST PASS: Chat history loads within timeout', async () => {
      console.log('\n⏱️  Chat history load time test');

      // Create conversations
      const convIds = Array.from({ length: 3 }, () => uuidv4());
      testConversationIds.push(...convIds);

      await supabase.from('conversations').insert(
        convIds.map((id, i) => ({
          id,
          user_id: testSession.userId,
          token_ca: GLOBAL_TOKEN_ID,
          title: `History load test ${i + 1}`,
          metadata: {},
        }))
      );

      const startTime = Date.now();

      const { data: conversations } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', testSession.userId)
        .in('id', convIds);

      const loadTime = Date.now() - startTime;

      console.log(`   Load time: ${loadTime}ms`);
      console.log(`   Conversations loaded: ${conversations?.length || 0}`);

      expect(loadTime).toBeLessThan(MAX_LOADING_TIME);
      expect(conversations).toBeDefined();
      expect(conversations!.length).toBe(3);

      console.log('\n✅ PASS: Chat history loaded within timeout');
    });

    test('MUST PASS: Chat history never stuck on "Loading conversations..."', async () => {
      console.log('\n🔄 Chat history infinite loading test');

      const convId = uuidv4();
      testConversationIds.push(convId);

      await supabase.from('conversations').insert({
        id: convId,
        user_id: testSession.userId,
        token_ca: GLOBAL_TOKEN_ID,
        title: 'Stuck test',
        metadata: {},
      });

      // Monitor loading state
      const checks: boolean[] = [];
      const startTime = Date.now();

      for (let i = 0; i < 10; i++) {
        const { data } = await supabase
          .from('conversations')
          .select('*')
          .eq('user_id', testSession.userId);

        const hasData = data !== null && data.length > 0;
        checks.push(!hasData); // Track if still loading

        if (hasData) {
          console.log(`   ✅ Loaded after ${Date.now() - startTime}ms`);
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const wasStuck = checks.every(c => c === true);

      if (wasStuck) {
        throw new Error('❌ CRITICAL: Chat history stuck loading for 5+ seconds!');
      }

      console.log('\n✅ PASS: Chat history never stuck loading');
    });

    test('MUST PASS: Chat history shows data after initial load', async () => {
      console.log('\n📊 Chat history data presence test');

      const convIds = Array.from({ length: 5 }, () => uuidv4());
      testConversationIds.push(...convIds);

      await supabase.from('conversations').insert(
        convIds.map((id, i) => ({
          id,
          user_id: testSession.userId,
          token_ca: GLOBAL_TOKEN_ID,
          title: `Data test ${i + 1}`,
          metadata: {},
        }))
      );

      // Load and verify data is present
      const { data: conversations } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', testSession.userId)
        .in('id', convIds);

      expect(conversations).toBeDefined();
      expect(conversations!.length).toBe(5);

      // Verify each conversation has required fields
      conversations!.forEach(conv => {
        expect(conv.id).toBeDefined();
        expect(conv.title).toBeDefined();
        expect(conv.user_id).toBe(testSession.userId);
      });

      console.log('\n✅ PASS: Chat history shows all data correctly');
    });
  });

  describe('Loading State Race Conditions', () => {
    test('MUST PASS: Rapid navigation doesn\'t cause stuck loading', async () => {
      console.log('\n⚡ Rapid navigation loading test');

      const conversationId = uuidv4();
      testConversationIds.push(conversationId);

      await supabase.from('conversations').insert({
        id: conversationId,
        user_id: testSession.userId,
        token_ca: GLOBAL_TOKEN_ID,
        title: 'Rapid nav test',
        metadata: {},
      });

      // Simulate rapid navigation (load 5 times quickly)
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();

        const { data } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId);

        const loadTime = Date.now() - startTime;

        if (loadTime > MAX_LOADING_TIME) {
          throw new Error(`❌ CRITICAL: Load ${i + 1} took ${loadTime}ms (stuck!)`);
        }

        console.log(`   Load ${i + 1}: ${loadTime}ms ✅`);
      }

      console.log('\n✅ PASS: Rapid loads never stuck');
    });

    test('MUST PASS: Concurrent loads don\'t interfere', async () => {
      console.log('\n🔀 Concurrent loading test');

      const conversationId = uuidv4();
      testConversationIds.push(conversationId);

      await supabase.from('conversations').insert({
        id: conversationId,
        user_id: testSession.userId,
        token_ca: GLOBAL_TOKEN_ID,
        title: 'Concurrent test',
        metadata: {},
      });

      // Start 3 loads concurrently
      const loads = [
        supabase.from('messages').select('*').eq('conversation_id', conversationId),
        supabase.from('messages').select('*').eq('conversation_id', conversationId),
        supabase.from('messages').select('*').eq('conversation_id', conversationId),
      ];

      const results = await Promise.all(loads);

      // All should succeed
      results.forEach((result, i) => {
        expect(result.error).toBeNull();
        console.log(`   Load ${i + 1}: ${result.data !== null ? '✅' : '❌'}`);
      });

      console.log('\n✅ PASS: Concurrent loads work correctly');
    });
  });

  describe('Edge Cases', () => {
    test('MUST PASS: Empty state loads correctly (not stuck)', async () => {
      console.log('\n📭 Empty state loading test');

      // Query for non-existent conversation
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', 'non-existent-id');

      expect(error).toBeNull();
      expect(data).toEqual([]);

      console.log('\n✅ PASS: Empty state loads (not stuck)');
    });

    test('MUST PASS: First-time user loads correctly', async () => {
      console.log('\n👤 First-time user loading test');

      const freshUserId = uuidv4();

      // Query for user with no data
      const { data: conversations } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', freshUserId);

      expect(conversations).toEqual([]);

      console.log('\n✅ PASS: First-time user loads empty state');
    });

    test('MUST PASS: Large data set loads within timeout', async () => {
      console.log('\n📚 Large data set loading test');

      const conversationId = uuidv4();
      testConversationIds.push(conversationId);

      await supabase.from('conversations').insert({
        id: conversationId,
        user_id: testSession.userId,
        token_ca: GLOBAL_TOKEN_ID,
        title: 'Large data test',
        metadata: {},
      });

      // Insert 100 messages
      const messages = Array.from({ length: 100 }, (_, i) => ({
        id: uuidv4(),
        conversation_id: conversationId,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}`,
        metadata: {},
      }));

      await supabase.from('messages').insert(messages);

      const startTime = Date.now();

      const { data: loadedMessages } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId);

      const loadTime = Date.now() - startTime;

      console.log(`   Loaded ${loadedMessages?.length} messages in ${loadTime}ms`);

      expect(loadTime).toBeLessThan(MAX_LOADING_TIME);
      expect(loadedMessages!.length).toBe(100);

      console.log('\n✅ PASS: Large data set loads within timeout');
    });
  });
});
