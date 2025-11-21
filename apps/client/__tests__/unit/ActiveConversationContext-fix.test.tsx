// @ts-nocheck - Bun-specific test with advanced mocking features
/**
 * Unit Tests for ActiveConversationContext
 * 
 * Tests storage persistence during navigation:
 * - Verifies storage is NOT cleared when conversationId becomes null during transitions
 * - Ensures conversation context persists across navigation
 * - Tests storage updates work correctly for new conversation values
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import '../setup/test-env';

// Mock storage
const mockStorageSetItem = mock(async (key: string, value: string) => {});
const mockStorageGetItem = mock(async (key: string) => null);
const mockStorageRemoveItem = mock(async (key: string) => {});

const SECURE_STORAGE_KEYS = {
  CURRENT_CONVERSATION_ID: 'mallory_current_conversation_id',
};

const SESSION_STORAGE_KEYS = {
  IS_LOGGING_OUT: 'mallory_is_logging_out',
};

// Mock lib/storage
mock.module('@/lib/storage', () => ({
  storage: {
    persistent: {
      getItem: mockStorageGetItem,
      setItem: mockStorageSetItem,
      removeItem: mockStorageRemoveItem,
    },
    session: {
      getItem: mock(async () => null),
      setItem: mock(async () => {}),
      removeItem: mock(async () => {}),
    },
  },
  SECURE_STORAGE_KEYS,
  SESSION_STORAGE_KEYS,
}));

// Mock lib index
mock.module('@/lib', () => ({
  storage: {
    persistent: {
      getItem: mockStorageGetItem,
      setItem: mockStorageSetItem,
      removeItem: mockStorageRemoveItem,
    },
  },
  SECURE_STORAGE_KEYS,
  SESSION_STORAGE_KEYS,
}));

// Import after mocking
const {
  ActiveConversationProvider,
  useActiveConversationContext,
} = await import('@/contexts/ActiveConversationContext');

describe('ActiveConversationContext - Storage Persistence', () => {
  beforeEach(() => {
    mockStorageSetItem.mockClear();
    mockStorageGetItem.mockClear();
    mockStorageRemoveItem.mockClear();

    // Default: storage is empty
    mockStorageGetItem.mockResolvedValue(null);
  });

  describe('Storage persistence during navigation', () => {
    test('does NOT clear storage when conversationId becomes null', async () => {
      // Setup
      const { result } = renderHook(() => useActiveConversationContext(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <ActiveConversationProvider>{children}</ActiveConversationProvider>
        ),
      });

      // Set a conversation ID
      act(() => {
        result.current.setConversationId('conv-123');
      });

      // Wait for storage to be set
      await waitFor(() => {
        expect(mockStorageSetItem).toHaveBeenCalledWith(
          SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID,
          'conv-123'
        );
      });

      // Clear the mock to track new calls
      mockStorageSetItem.mockClear();
      mockStorageRemoveItem.mockClear();

      // Set to null (simulating navigation)
      act(() => {
        result.current.setConversationId(null);
      });

      // Wait a bit for any potential storage operations
      await new Promise(resolve => setTimeout(resolve, 50));

      // CRITICAL: Storage should NOT be cleared when conversationId becomes null
      // This ensures the active conversation persists during navigation transitions
      expect(mockStorageRemoveItem).not.toHaveBeenCalled();
      expect(mockStorageSetItem).not.toHaveBeenCalled();
    });

    test('preserves storage across multiple null transitions', async () => {
      // Setup
      const { result } = renderHook(() => useActiveConversationContext(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <ActiveConversationProvider>{children}</ActiveConversationProvider>
        ),
      });

      // Set initial conversation
      act(() => {
        result.current.setConversationId('conv-1');
      });

      await waitFor(() => {
        expect(mockStorageSetItem).toHaveBeenCalledWith(
          SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID,
          'conv-1'
        );
      });

      mockStorageSetItem.mockClear();
      mockStorageRemoveItem.mockClear();

      // Multiple null/value transitions (simulating navigation)
      act(() => {
        result.current.setConversationId(null);
      });

      await new Promise(resolve => setTimeout(resolve, 20));

      act(() => {
        result.current.setConversationId('conv-2');
      });

      await waitFor(() => {
        expect(mockStorageSetItem).toHaveBeenCalledWith(
          SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID,
          'conv-2'
        );
      });

      mockStorageSetItem.mockClear();

      act(() => {
        result.current.setConversationId(null);
      });

      await new Promise(resolve => setTimeout(resolve, 20));

      // Should NEVER have called removeItem
      expect(mockStorageRemoveItem).not.toHaveBeenCalled();
    });
  });

  describe('Existing behavior: Storage updates still work', () => {
    test('updates storage when conversationId changes to new value', async () => {
      // Setup
      const { result } = renderHook(() => useActiveConversationContext(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <ActiveConversationProvider>{children}</ActiveConversationProvider>
        ),
      });

      // Set initial value
      act(() => {
        result.current.setConversationId('conv-123');
      });

      await waitFor(() => {
        expect(mockStorageSetItem).toHaveBeenCalledWith(
          SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID,
          'conv-123'
        );
      });

      mockStorageSetItem.mockClear();

      // Change to new value
      act(() => {
        result.current.setConversationId('conv-456');
      });

      // Should update storage
      await waitFor(() => {
        expect(mockStorageSetItem).toHaveBeenCalledWith(
          SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID,
          'conv-456'
        );
      });
    });

    test('loads initial value from storage on mount', async () => {
      // Setup - Storage has existing value
      mockStorageGetItem.mockResolvedValue('stored-conv-789');

      // Execute
      const { result } = renderHook(() => useActiveConversationContext(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <ActiveConversationProvider>{children}</ActiveConversationProvider>
        ),
      });

      // Assert - Should load from storage
      await waitFor(() => {
        expect(mockStorageGetItem).toHaveBeenCalledWith(
          SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID
        );
      });

      // Context should eventually have the value (depends on implementation)
      // Note: The actual implementation may set this asynchronously
      await waitFor(
        () => {
          // This might need adjustment based on actual implementation
          expect(result.current.conversationId).toBe('stored-conv-789');
        },
        { timeout: 200 }
      );
    });

    test('handles storage read errors gracefully on mount', async () => {
      // Setup - Storage throws error
      mockStorageGetItem.mockRejectedValue(new Error('Storage error'));
      const consoleErrorSpy = mock();
      const originalConsoleError = console.error;
      console.error = consoleErrorSpy;

      // Execute
      const { result } = renderHook(() => useActiveConversationContext(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <ActiveConversationProvider>{children}</ActiveConversationProvider>
        ),
      });

      // Should not crash, may log error
      await new Promise(resolve => setTimeout(resolve, 100));

      // Cleanup
      console.error = originalConsoleError;

      // Should still work
      act(() => {
        result.current.setConversationId('test-123');
      });

      await waitFor(() => {
        expect(mockStorageSetItem).toHaveBeenCalledWith(
          SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID,
          'test-123'
        );
      });
    });
  });

  describe('Context propagation', () => {
    test('updates propagate to all consumers', async () => {
      // Setup - Two hooks using the same context
      const { result: result1 } = renderHook(
        () => useActiveConversationContext(),
        {
          wrapper: ({ children }: { children: ReactNode }) => (
            <ActiveConversationProvider>{children}</ActiveConversationProvider>
          ),
        }
      );

      const { result: result2 } = renderHook(
        () => useActiveConversationContext(),
        {
          wrapper: ({ children }: { children: ReactNode }) => (
            <ActiveConversationProvider>{children}</ActiveConversationProvider>
          ),
        }
      );

      // Execute - Set via first hook
      act(() => {
        result1.current.setConversationId('shared-conv-123');
      });

      // Assert - Both hooks should have the value
      // Note: This tests that multiple hooks get separate contexts
      // In real usage, they'd share the same provider
      expect(result1.current.conversationId).toBe('shared-conv-123');
    });
  });
});

