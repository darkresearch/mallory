/**
 * Unit Tests for chat-cache Module
 * 
 * Tests the module-level chat cache that survives navigation
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import '../setup/test-env';

// Import the cache functions
import {
  getChatCache,
  updateChatCache,
  subscribeToChatCache,
  clearChatCache,
  isCacheForConversation,
  type ActiveChatCache,
} from '../../lib/chat-cache';

describe('Chat Cache Module', () => {
  beforeEach(() => {
    // Clear cache before each test
    clearChatCache();
  });

  describe('Basic Cache Operations', () => {
    test('should initialize with default values', () => {
      const cache = getChatCache();
      
      expect(cache.conversationId).toBeNull();
      expect(cache.messages).toEqual([]);
      expect(cache.streamState.status).toBe('idle');
      expect(cache.liveReasoningText).toBe('');
      expect(cache.aiStatus).toBe('ready');
      expect(cache.aiError).toBeNull();
      expect(cache.isLoadingHistory).toBe(false);
      
      console.log('✅ Initializes with default values');
    });

    test('should update cache values', () => {
      updateChatCache({
        conversationId: 'test-conv-id',
        messages: [{ id: '1', content: 'Test message', role: 'user' }],
      });
      
      const cache = getChatCache();
      expect(cache.conversationId).toBe('test-conv-id');
      expect(cache.messages.length).toBe(1);
      
      console.log('✅ Updates cache values');
    });

    test('should merge updates with existing cache', () => {
      updateChatCache({ conversationId: 'conv-1' });
      updateChatCache({ messages: [{ id: '1', content: 'Hi', role: 'user' }] });
      
      const cache = getChatCache();
      expect(cache.conversationId).toBe('conv-1');
      expect(cache.messages.length).toBe(1);
      
      console.log('✅ Merges updates with existing cache');
    });

    test('should clear all cache values', () => {
      updateChatCache({
        conversationId: 'test-conv',
        messages: [{ id: '1', content: 'Test', role: 'user' }],
        streamState: { status: 'responding', startTime: Date.now() },
      });
      
      clearChatCache();
      
      const cache = getChatCache();
      expect(cache.conversationId).toBeNull();
      expect(cache.messages).toEqual([]);
      expect(cache.streamState.status).toBe('idle');
      
      console.log('✅ Clears all cache values');
    });
  });

  describe('Stream State Management', () => {
    test('should handle idle state', () => {
      updateChatCache({
        streamState: { status: 'idle' },
      });
      
      const cache = getChatCache();
      expect(cache.streamState.status).toBe('idle');
      expect('startTime' in cache.streamState).toBe(false);
      
      console.log('✅ Handles idle state (no startTime)');
    });

    test('should handle waiting state with startTime', () => {
      const startTime = Date.now();
      updateChatCache({
        streamState: { status: 'waiting', startTime },
      });
      
      const cache = getChatCache();
      expect(cache.streamState.status).toBe('waiting');
      if (cache.streamState.status !== 'idle') {
        expect(cache.streamState.startTime).toBe(startTime);
      }
      
      console.log('✅ Handles waiting state with startTime');
    });

    test('should handle reasoning state', () => {
      const startTime = Date.now();
      updateChatCache({
        streamState: { status: 'reasoning', startTime },
        liveReasoningText: 'Thinking about the problem...',
      });
      
      const cache = getChatCache();
      expect(cache.streamState.status).toBe('reasoning');
      expect(cache.liveReasoningText).toBe('Thinking about the problem...');
      
      console.log('✅ Handles reasoning state with text');
    });

    test('should handle responding state', () => {
      const startTime = Date.now();
      updateChatCache({
        streamState: { status: 'responding', startTime },
      });
      
      const cache = getChatCache();
      expect(cache.streamState.status).toBe('responding');
      
      console.log('✅ Handles responding state');
    });

    test('should transition between states', () => {
      // Start idle
      updateChatCache({ streamState: { status: 'idle' } });
      expect(getChatCache().streamState.status).toBe('idle');
      
      // Move to waiting
      const startTime = Date.now();
      updateChatCache({ streamState: { status: 'waiting', startTime } });
      expect(getChatCache().streamState.status).toBe('waiting');
      
      // Move to reasoning
      updateChatCache({ streamState: { status: 'reasoning', startTime } });
      expect(getChatCache().streamState.status).toBe('reasoning');
      
      // Move to responding
      updateChatCache({ streamState: { status: 'responding', startTime } });
      expect(getChatCache().streamState.status).toBe('responding');
      
      // Back to idle
      updateChatCache({ streamState: { status: 'idle' } });
      expect(getChatCache().streamState.status).toBe('idle');
      
      console.log('✅ Transitions between states correctly');
    });
  });

  describe('Subscription System', () => {
    test('should notify subscribers on cache update', () => {
      let notificationCount = 0;
      let lastCache: ActiveChatCache | null = null;
      
      const unsubscribe = subscribeToChatCache((cache) => {
        notificationCount++;
        lastCache = cache;
      });
      
      updateChatCache({ conversationId: 'test-conv' });
      
      expect(notificationCount).toBe(1);
      expect(lastCache?.conversationId).toBe('test-conv');
      
      unsubscribe();
      console.log('✅ Notifies subscribers on update');
    });

    test('should support multiple subscribers', () => {
      let count1 = 0;
      let count2 = 0;
      
      const unsub1 = subscribeToChatCache(() => { count1++; });
      const unsub2 = subscribeToChatCache(() => { count2++; });
      
      updateChatCache({ conversationId: 'test' });
      
      expect(count1).toBe(1);
      expect(count2).toBe(1);
      
      unsub1();
      unsub2();
      console.log('✅ Supports multiple subscribers');
    });

    test('should stop notifying after unsubscribe', () => {
      let count = 0;
      
      const unsubscribe = subscribeToChatCache(() => { count++; });
      
      updateChatCache({ conversationId: 'test-1' });
      expect(count).toBe(1);
      
      unsubscribe();
      
      updateChatCache({ conversationId: 'test-2' });
      expect(count).toBe(1); // Should not increment
      
      console.log('✅ Stops notifying after unsubscribe');
    });

    test('should notify on clearChatCache', () => {
      let notificationCount = 0;
      
      const unsubscribe = subscribeToChatCache((cache) => {
        notificationCount++;
      });
      
      updateChatCache({ conversationId: 'test' });
      expect(notificationCount).toBe(1);
      
      clearChatCache();
      expect(notificationCount).toBe(2);
      
      unsubscribe();
      console.log('✅ Notifies on clearChatCache');
    });
  });

  describe('Conversation Matching', () => {
    test('should check if cache is for specific conversation', () => {
      updateChatCache({ conversationId: 'conv-123' });
      
      expect(isCacheForConversation('conv-123')).toBe(true);
      expect(isCacheForConversation('conv-456')).toBe(false);
      expect(isCacheForConversation(null)).toBe(false);
      
      console.log('✅ Checks conversation matching correctly');
    });

    test('should handle null conversation ID', () => {
      clearChatCache();
      
      expect(isCacheForConversation(null)).toBe(true); // Both null
      expect(isCacheForConversation('conv-123')).toBe(false);
      
      console.log('✅ Handles null conversation ID');
    });
  });

  describe('Module-Level Persistence', () => {
    test('should persist across function calls', () => {
      updateChatCache({ conversationId: 'persistent-conv' });
      
      const cache1 = getChatCache();
      const cache2 = getChatCache();
      
      expect(cache1.conversationId).toBe('persistent-conv');
      expect(cache2.conversationId).toBe('persistent-conv');
      
      console.log('✅ Persists across function calls');
    });

    test('should survive multiple updates', () => {
      for (let i = 0; i < 100; i++) {
        updateChatCache({
          messages: [{ id: `msg-${i}`, content: `Message ${i}`, role: 'user' }],
        });
      }
      
      const cache = getChatCache();
      expect(cache.messages.length).toBe(1);
      expect(cache.messages[0].id).toBe('msg-99');
      
      console.log('✅ Survives many updates');
    });
  });

  describe('AI Status Management', () => {
    test('should track AI status', () => {
      updateChatCache({ aiStatus: 'streaming' });
      expect(getChatCache().aiStatus).toBe('streaming');
      
      updateChatCache({ aiStatus: 'ready' });
      expect(getChatCache().aiStatus).toBe('ready');
      
      updateChatCache({ aiStatus: 'error' });
      expect(getChatCache().aiStatus).toBe('error');
      
      console.log('✅ Tracks AI status');
    });

    test('should track AI errors', () => {
      const testError = new Error('Test AI error');
      
      updateChatCache({ aiError: testError });
      
      const cache = getChatCache();
      expect(cache.aiError).toBe(testError);
      expect(cache.aiError?.message).toBe('Test AI error');
      
      console.log('✅ Tracks AI errors');
    });
  });

  describe('History Loading State', () => {
    test('should track history loading state', () => {
      updateChatCache({ isLoadingHistory: true });
      expect(getChatCache().isLoadingHistory).toBe(true);
      
      updateChatCache({ isLoadingHistory: false });
      expect(getChatCache().isLoadingHistory).toBe(false);
      
      console.log('✅ Tracks history loading state');
    });
  });
});
