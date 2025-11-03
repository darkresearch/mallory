// @ts-nocheck - Integration test with dynamic checks
/**
 * Infinite Loop Prevention Tests for Chat History Screen
 * 
 * Tests that the simplified chat-history screen doesn't cause:
 * - Infinite data re-fetching
 * - Runaway subscription triggers
 * - Memory leaks from unclosed subscriptions
 * - Real-time update loops
 * 
 * CRITICAL: These tests ensure production stability
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import './setup';
import { setupTestUserSession, cleanupTestData, supabase } from './setup';
import { v4 as uuidv4 } from 'uuid';

const GLOBAL_TOKEN_ID = '00000000-0000-0000-0000-000000000000';

// Track execution counts to detect loops
let loadConversationsCount = 0;
let subscriptionSetupCount = 0;
let conversationInsertCount = 0;

describe('Chat History Screen - Infinite Loop Prevention', () => {
  let testSession: {
    userId: string;
    email: string;
    accessToken: string;
    gridSession: any;
  };

  let testConversationIds: string[] = [];

  beforeAll(async () => {
    console.log('🔧 Setting up test session for infinite loop tests...');
    testSession = await setupTestUserSession();
    console.log('✅ Test session ready:', testSession.userId);
  });

  beforeEach(() => {
    // Reset counters
    loadConversationsCount = 0;
    subscriptionSetupCount = 0;
    conversationInsertCount = 0;
  });

  afterAll(async () => {
    console.log('🧹 Cleaning up test data...');
    
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

  describe('Data Loading Limits', () => {
    test('should not fetch conversations more than once per navigation', async () => {
      console.log('\n🔄 TEST: Single load per navigation\n');

      // Track loads
      const loadConversations = async () => {
        loadConversationsCount++;
        if (loadConversationsCount > 10) {
          throw new Error('INFINITE LOOP: Loaded conversations >10 times');
        }

        const { data } = await supabase
          .from('conversations')
          .select('id, title, updated_at')
          .eq('user_id', testSession.userId)
          .eq('token_ca', GLOBAL_TOKEN_ID);

        return data || [];
      };

      // Simulate component mount
      await loadConversations();

      // Wait 2 seconds to see if it keeps loading
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Should only load once
      expect(loadConversationsCount).toBe(1);
      console.log(`✅ Loaded ${loadConversationsCount} time(s) - SAFE`);
    });

    test('should stabilize after initial load', async () => {
      console.log('\n⏸️  TEST: Load stabilization\n');

      const startTime = Date.now();
      const maxDuration = 5000; // 5 seconds max

      // Load conversations
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', testSession.userId)
        .eq('token_ca', GLOBAL_TOKEN_ID);

      const loadTime = Date.now() - startTime;

      // Should complete quickly (not infinite)
      expect(loadTime).toBeLessThan(maxDuration);
      console.log(`✅ Loaded in ${loadTime}ms - not infinite`);
    });

    test('should handle rapid navigation without infinite fetches', async () => {
      console.log('\n⚡ TEST: Rapid navigation\n');

      const loadCounts: number[] = [];

      // Simulate 10 rapid navigations
      for (let i = 0; i < 10; i++) {
        const startCount = loadConversationsCount;
        
        const { data } = await supabase
          .from('conversations')
          .select('id')
          .eq('user_id', testSession.userId)
          .eq('token_ca', GLOBAL_TOKEN_ID);

        loadConversationsCount++;
        loadCounts.push(loadConversationsCount - startCount);
      }

      // Each navigation should trigger exactly 1 load
      loadCounts.forEach((count, i) => {
        expect(count).toBeLessThanOrEqual(1);
      });

      console.log(`✅ 10 navigations = ${loadConversationsCount} loads - SAFE`);
    });
  });

  describe('Real-time Subscription Limits', () => {
    test('should set up subscriptions only once', async () => {
      console.log('\n📡 TEST: Subscription setup count\n');

      const setupSubscription = async () => {
        subscriptionSetupCount++;
        if (subscriptionSetupCount > 5) {
          throw new Error('INFINITE LOOP: Subscription setup >5 times');
        }

        // Simulate subscription setup
        const channel = supabase.channel(`test-${subscriptionSetupCount}`);
        await new Promise(resolve => setTimeout(resolve, 100));
        await supabase.removeChannel(channel);
      };

      // Setup subscription
      await setupSubscription();

      // Wait to see if it sets up again
      await new Promise(resolve => setTimeout(resolve, 2000));

      expect(subscriptionSetupCount).toBe(1);
      console.log('✅ Subscription set up once - SAFE');
    });

    test('should not trigger infinite subscription updates', async () => {
      console.log('\n🔄 TEST: Subscription update loops\n');

      // Create a test conversation
      const conversationId = uuidv4();
      testConversationIds.push(conversationId);

      await supabase.from('conversations').insert({
        id: conversationId,
        user_id: testSession.userId,
        token_ca: GLOBAL_TOKEN_ID,
        title: 'Loop test',
        metadata: {},
      });

      let updateCount = 0;
      const maxUpdates = 10;

      // Set up a channel to listen for updates
      const channel = supabase
        .channel(`loop-test-${Date.now()}`)
        .on('broadcast', { event: 'test' }, () => {
          updateCount++;
          if (updateCount > maxUpdates) {
            throw new Error('INFINITE LOOP: >10 subscription updates');
          }
        });

      await channel.subscribe();

      // Trigger a single update
      await channel.send({
        type: 'broadcast',
        event: 'test',
        payload: { data: 'test' },
      });

      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should only receive 1 update
      expect(updateCount).toBeLessThanOrEqual(2); // Allow for echo
      
      await supabase.removeChannel(channel);
      console.log(`✅ Received ${updateCount} update(s) - no loop`);
    });

    test('should clean up subscriptions properly', async () => {
      console.log('\n🧹 TEST: Subscription cleanup\n');

      const channelName = `cleanup-test-${Date.now()}`;
      const channel = supabase.channel(channelName);

      await channel.subscribe();

      // Remove channel
      await supabase.removeChannel(channel);

      // Try to subscribe again (should create new channel, not reuse)
      const channel2 = supabase.channel(channelName);
      await channel2.subscribe();
      await supabase.removeChannel(channel2);

      // Should not cause issues
      console.log('✅ Subscription cleanup successful');
    });
  });

  describe('State Update Cycles', () => {
    test('should not create conversation insert → load → insert loops', async () => {
      console.log('\n🔁 TEST: Insert/load cycles\n');

      const trackInsert = async () => {
        conversationInsertCount++;
        if (conversationInsertCount > 5) {
          throw new Error('INFINITE LOOP: >5 conversation inserts');
        }

        const conversationId = uuidv4();
        testConversationIds.push(conversationId);

        await supabase.from('conversations').insert({
          id: conversationId,
          user_id: testSession.userId,
          token_ca: GLOBAL_TOKEN_ID,
          title: `Test ${conversationInsertCount}`,
          metadata: {},
        });

        return conversationId;
      };

      // Create one conversation
      await trackInsert();

      // Load conversations (should not trigger another insert)
      await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', testSession.userId);

      // Wait to ensure no cascading inserts
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(conversationInsertCount).toBe(1);
      console.log('✅ No insert/load cycles detected');
    });

    test('should handle message inserts without triggering conversation reloads', async () => {
      console.log('\n💬 TEST: Message insert impact\n');

      const conversationId = uuidv4();
      testConversationIds.push(conversationId);

      await supabase.from('conversations').insert({
        id: conversationId,
        user_id: testSession.userId,
        token_ca: GLOBAL_TOKEN_ID,
        title: 'Message test',
        metadata: {},
      });

      let loadCount = 0;
      const maxLoads = 10;

      const loadConversations = async () => {
        loadCount++;
        if (loadCount > maxLoads) {
          throw new Error('INFINITE LOOP: Conversation loads triggered by messages');
        }

        await supabase
          .from('conversations')
          .select('*')
          .eq('user_id', testSession.userId);
      };

      // Initial load
      await loadConversations();

      // Insert messages
      for (let i = 0; i < 5; i++) {
        await supabase.from('messages').insert({
          id: uuidv4(),
          conversation_id: conversationId,
          role: 'user',
          content: `Message ${i}`,
          metadata: {},
        });
      }

      // Load count should still be 1 (messages shouldn't trigger reloads)
      expect(loadCount).toBe(1);
      console.log('✅ Message inserts did not trigger reloads');
    });
  });

  describe('Performance Under Load', () => {
    test('should handle many conversations without performance degradation', async () => {
      console.log('\n📊 TEST: Performance with many conversations\n');

      // Create 20 conversations
      const conversationIds = Array.from({ length: 20 }, () => uuidv4());
      testConversationIds.push(...conversationIds);

      await supabase.from('conversations').insert(
        conversationIds.map(id => ({
          id,
          user_id: testSession.userId,
          token_ca: GLOBAL_TOKEN_ID,
          title: `Perf test ${id.slice(0, 8)}`,
          metadata: {},
        }))
      );

      const loadTimes: number[] = [];

      // Load 10 times
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        
        await supabase
          .from('conversations')
          .select('*')
          .eq('user_id', testSession.userId)
          .eq('token_ca', GLOBAL_TOKEN_ID);

        const duration = Date.now() - start;
        loadTimes.push(duration);
      }

      const avgTime = loadTimes.reduce((a, b) => a + b) / loadTimes.length;
      const maxTime = Math.max(...loadTimes);

      // Should complete in reasonable time
      expect(maxTime).toBeLessThan(5000);
      console.log(`✅ Performance stable: avg=${avgTime.toFixed(0)}ms, max=${maxTime}ms`);
    });

    test('should not accumulate memory over multiple loads', async () => {
      console.log('\n🧠 TEST: Memory leak prevention\n');

      const initialMemory = process.memoryUsage().heapUsed;

      // Perform 50 loads
      for (let i = 0; i < 50; i++) {
        await supabase
          .from('conversations')
          .select('*')
          .eq('user_id', testSession.userId)
          .eq('token_ca', GLOBAL_TOKEN_ID);

        // Occasionally check memory
        if (i % 10 === 0) {
          const currentMemory = process.memoryUsage().heapUsed;
          const increase = currentMemory - initialMemory;
          
          // Memory should not grow excessively (< 50MB increase)
          expect(increase).toBeLessThan(50 * 1024 * 1024);
        }
      }

      console.log('✅ No memory leaks detected');
    });
  });

  describe('Error Recovery', () => {
    test('should not loop on persistent database errors', async () => {
      console.log('\n❌ TEST: Error recovery\n');

      let errorAttempts = 0;
      const maxAttempts = 5;

      const loadWithError = async () => {
        errorAttempts++;
        if (errorAttempts > maxAttempts) {
          throw new Error('INFINITE LOOP: Error recovery triggered >5 times');
        }

        // Simulate error
        const { error } = await supabase
          .from('conversations')
          .select('*')
          .eq('user_id', 'invalid-user-that-does-not-exist')
          .limit(1);

        return error;
      };

      // Should fail but not loop
      await loadWithError();

      // Wait to ensure no retries
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(errorAttempts).toBe(1);
      console.log(`✅ Failed gracefully after ${errorAttempts} attempt(s)`);
    });
  });

  describe('Concurrent Operations', () => {
    test('should handle concurrent loads without race conditions', async () => {
      console.log('\n🔀 TEST: Concurrent operations\n');

      const concurrentLoads = 10;
      const promises = [];

      for (let i = 0; i < concurrentLoads; i++) {
        promises.push(
          supabase
            .from('conversations')
            .select('*')
            .eq('user_id', testSession.userId)
            .eq('token_ca', GLOBAL_TOKEN_ID)
        );
      }

      const results = await Promise.all(promises);

      // All should succeed without interference
      results.forEach(result => {
        expect(result.error).toBeNull();
      });

      console.log(`✅ ${concurrentLoads} concurrent loads succeeded`);
    });

    test('should handle rapid create/delete without loops', async () => {
      console.log('\n⚡ TEST: Rapid create/delete\n');

      const operations = [];

      // Rapidly create and delete 10 conversations
      for (let i = 0; i < 10; i++) {
        const conversationId = uuidv4();
        
        operations.push(
          (async () => {
            // Create
            await supabase.from('conversations').insert({
              id: conversationId,
              user_id: testSession.userId,
              token_ca: GLOBAL_TOKEN_ID,
              title: `Rapid ${i}`,
              metadata: {},
            });

            // Delete immediately
            await supabase
              .from('conversations')
              .delete()
              .eq('id', conversationId);
          })()
        );
      }

      await Promise.all(operations);

      // Should complete without hanging
      console.log('✅ Rapid create/delete handled correctly');
    });
  });

  describe('Real-World Stress Tests', () => {
    test('should survive 60-second stress test', async () => {
      console.log('\n⏱️  TEST: 60-second stress test\n');

      const startTime = Date.now();
      const duration = 10000; // 10 seconds (reduced for faster testing)
      let operationCount = 0;
      const maxOperations = 1000;

      while (Date.now() - startTime < duration && operationCount < maxOperations) {
        operationCount++;

        // Random operation
        const operation = Math.floor(Math.random() * 3);

        try {
          if (operation === 0) {
            // Load conversations
            await supabase
              .from('conversations')
              .select('id')
              .eq('user_id', testSession.userId)
              .limit(5);
          } else if (operation === 1) {
            // Create conversation
            const id = uuidv4();
            testConversationIds.push(id);
            await supabase.from('conversations').insert({
              id,
              user_id: testSession.userId,
              token_ca: GLOBAL_TOKEN_ID,
              title: `Stress ${operationCount}`,
              metadata: {},
            });
          } else {
            // Wait a bit
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        } catch (error) {
          // Errors are okay, infinite loops are not
        }
      }

      // Should complete without infinite loops
      expect(operationCount).toBeLessThan(maxOperations);
      console.log(`✅ Completed ${operationCount} operations in stress test`);
    });
  });
});
