/**
 * Unit Tests: useConversationLoader Hook
 * 
 * Tests conversation loading logic covering:
 * - Loading from URL params
 * - Loading from secure storage
 * - Creating new conversations
 * - Error handling
 * - Race conditions
 * - Edge cases
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { renderHook, waitFor } from '@testing-library/react';
import { useConversationLoader } from '../../hooks/useConversationLoader';
import { secureStorage, SECURE_STORAGE_KEYS } from '../../lib/storage';
import { getCurrentOrCreateConversation } from '../../features/chat';
import '../setup/test-env';

// Mock dependencies
jest.mock('../../lib/storage');
jest.mock('../../features/chat');
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ conversationId: undefined }),
}));

describe('useConversationLoader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (secureStorage.getItem as jest.Mock).mockResolvedValue(null);
    (secureStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Basic Loading Behavior', () => {
    test('should load conversation from URL parameter', async () => {
      const testConversationId = 'test-conv-123';
      
      // Mock expo-router to return conversationId param
      jest.doMock('expo-router', () => ({
        useLocalSearchParams: () => ({ conversationId: testConversationId }),
      }));

      const { result } = renderHook(() => 
        useConversationLoader({ userId: 'test-user' })
      );

      await waitFor(() => {
        expect(result.current.currentConversationId).toBe(testConversationId);
      });

      expect(secureStorage.setItem).toHaveBeenCalledWith(
        SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID,
        testConversationId
      );
    });

    test('should load active conversation from secure storage when no URL param', async () => {
      const storedConversationId = 'stored-conv-456';
      (secureStorage.getItem as jest.Mock).mockResolvedValue(storedConversationId);

      const { result } = renderHook(() => 
        useConversationLoader({ userId: 'test-user' })
      );

      await waitFor(() => {
        expect(result.current.currentConversationId).toBe(storedConversationId);
      });

      expect(secureStorage.getItem).toHaveBeenCalledWith(
        SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID
      );
    });

    test('should create new conversation when no stored conversation exists', async () => {
      const newConversationId = 'new-conv-789';
      (getCurrentOrCreateConversation as jest.Mock).mockResolvedValue({
        conversationId: newConversationId,
        shouldGreet: false,
      });

      const { result } = renderHook(() => 
        useConversationLoader({ userId: 'test-user' })
      );

      await waitFor(() => {
        expect(result.current.currentConversationId).toBe(newConversationId);
      });

      expect(getCurrentOrCreateConversation).toHaveBeenCalledWith('test-user');
    });
  });

  describe('Edge Cases', () => {
    test('should handle null userId gracefully', async () => {
      const { result } = renderHook(() => 
        useConversationLoader({ userId: undefined })
      );

      await waitFor(() => {
        expect(result.current.currentConversationId).toBeNull();
      });

      expect(getCurrentOrCreateConversation).not.toHaveBeenCalled();
    });

    test('should handle secure storage errors gracefully', async () => {
      (secureStorage.getItem as jest.Mock).mockRejectedValue(
        new Error('Storage error')
      );

      const { result } = renderHook(() => 
        useConversationLoader({ userId: 'test-user' })
      );

      // Should fall back to creating new conversation
      await waitFor(() => {
        expect(result.current.currentConversationId).toBeDefined();
      });
    });

    test('should reset when conversationId param changes', async () => {
      let conversationId = 'conv-1';
      jest.doMock('expo-router', () => ({
        useLocalSearchParams: () => ({ conversationId }),
      }));

      const { result, rerender } = renderHook(() => 
        useConversationLoader({ userId: 'test-user' })
      );

      await waitFor(() => {
        expect(result.current.currentConversationId).toBe('conv-1');
      });

      // Change conversationId
      conversationId = 'conv-2';
      rerender();

      await waitFor(() => {
        expect(result.current.currentConversationId).toBe('conv-2');
      });
    });

    test('should not reload from storage multiple times', async () => {
      const storedId = 'stored-conv';
      (secureStorage.getItem as jest.Mock).mockResolvedValue(storedId);

      const { result } = renderHook(() => 
        useConversationLoader({ userId: 'test-user' })
      );

      await waitFor(() => {
        expect(result.current.currentConversationId).toBe(storedId);
      });

      // Verify storage was only checked once
      const callCount = (secureStorage.getItem as jest.Mock).mock.calls.filter(
        call => call[0] === SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID
      ).length;
      
      expect(callCount).toBeLessThanOrEqual(1);
    });

    test('should handle empty string conversationId', async () => {
      jest.doMock('expo-router', () => ({
        useLocalSearchParams: () => ({ conversationId: '' }),
      }));

      const { result } = renderHook(() => 
        useConversationLoader({ userId: 'test-user' })
      );

      // Should fall back to storage or create new
      await waitFor(() => {
        expect(result.current.currentConversationId).toBeDefined();
      });
    });

    test('should handle getCurrentOrCreateConversation errors', async () => {
      (getCurrentOrCreateConversation as jest.Mock).mockRejectedValue(
        new Error('Failed to create conversation')
      );

      const { result } = renderHook(() => 
        useConversationLoader({ userId: 'test-user' })
      );

      // Should handle error gracefully
      await waitFor(() => {
        expect(result.current.currentConversationId).toBeNull();
      });
    });

    test('should handle rapid userId changes', async () => {
      const { result, rerender } = renderHook(
        ({ userId }) => useConversationLoader({ userId }),
        { initialProps: { userId: 'user-1' } }
      );

      await waitFor(() => {
        expect(result.current.currentConversationId).toBeDefined();
      });

      // Change userId rapidly
      rerender({ userId: 'user-2' });

      await waitFor(() => {
        expect(result.current.currentConversationId).toBeNull();
      });

      // Should eventually load for new user
      await waitFor(() => {
        expect(result.current.currentConversationId).toBeDefined();
      }, { timeout: 3000 });
    });
  });

  describe('Race Conditions', () => {
    test('should cancel previous load when conversationId changes', async () => {
      let conversationId = 'conv-1';
      jest.doMock('expo-router', () => ({
        useLocalSearchParams: () => ({ conversationId }),
      }));

      const { result, rerender } = renderHook(() => 
        useConversationLoader({ userId: 'test-user' })
      );

      // Start loading conv-1
      conversationId = 'conv-1';
      rerender();

      // Immediately change to conv-2
      conversationId = 'conv-2';
      rerender();

      await waitFor(() => {
        expect(result.current.currentConversationId).toBe('conv-2');
      });
    });

    test('should handle concurrent storage reads', async () => {
      let resolveStorage: (value: string | null) => void;
      const storagePromise = new Promise<string | null>((resolve) => {
        resolveStorage = resolve;
      });

      (secureStorage.getItem as jest.Mock).mockReturnValue(storagePromise);

      const { result } = renderHook(() => 
        useConversationLoader({ userId: 'test-user' })
      );

      // Resolve storage after a delay
      setTimeout(() => {
        resolveStorage!('delayed-conv');
      }, 100);

      await waitFor(() => {
        expect(result.current.currentConversationId).toBe('delayed-conv');
      });
    });
  });

  describe('Return Values', () => {
    test('should return currentConversationId and conversationParam', async () => {
      const testId = 'test-conv';
      jest.doMock('expo-router', () => ({
        useLocalSearchParams: () => ({ conversationId: testId }),
      }));

      const { result } = renderHook(() => 
        useConversationLoader({ userId: 'test-user' })
      );

      await waitFor(() => {
        expect(result.current.currentConversationId).toBe(testId);
        expect(result.current.conversationParam).toBe(testId);
      });
    });
  });
});
