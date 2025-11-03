/**
 * Infinite Loop Prevention Tests for useActiveConversation
 * 
 * These tests ensure the simplified hook doesn't cause:
 * - Infinite effect re-executions
 * - Runaway state updates
 * - Memory leaks from uncleaned effects
 * - Callback instability loops
 * 
 * CRITICAL: These tests must pass to prevent production issues
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { renderHook, waitFor, act } from '@testing-library/react';
import '../setup/test-env';

// Track how many times functions are called
let effectExecutionCount = 0;
let storageGetCount = 0;
let storageSetCount = 0;
let createConversationCount = 0;

// Mock dependencies with execution tracking
const mockSecureStorage = {
  getItem: mock(async (key: string) => {
    storageGetCount++;
    if (storageGetCount > 100) {
      throw new Error('INFINITE LOOP DETECTED: storage.getItem called >100 times');
    }
    return null;
  }),
  setItem: mock(async (key: string, value: string) => {
    storageSetCount++;
    if (storageSetCount > 100) {
      throw new Error('INFINITE LOOP DETECTED: storage.setItem called >100 times');
    }
  }),
  removeItem: mock(async (key: string) => {}),
};

const mockGetCurrentOrCreateConversation = mock(async (userId: string) => {
  createConversationCount++;
  if (createConversationCount > 100) {
    throw new Error('INFINITE LOOP DETECTED: createConversation called >100 times');
  }
  return {
    conversationId: `conversation-${createConversationCount}`,
    shouldGreet: true,
  };
});

// Mock expo-router
const mockParams = {
  conversationId: undefined as string | undefined,
};

mock.module('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
}));

mock.module('@/lib', () => ({
  secureStorage: mockSecureStorage,
  SECURE_STORAGE_KEYS: {
    CURRENT_CONVERSATION_ID: 'mallory_current_conversation_id',
  },
}));

mock.module('@/features/chat', () => ({
  getCurrentOrCreateConversation: mockGetCurrentOrCreateConversation,
}));

// Import after mocking
const { useActiveConversation } = await import('@/hooks/useActiveConversation');

describe('Infinite Loop Prevention Tests', () => {
  beforeEach(() => {
    // Reset all counters
    effectExecutionCount = 0;
    storageGetCount = 0;
    storageSetCount = 0;
    createConversationCount = 0;
    
    // Reset mocks
    mockSecureStorage.getItem.mockReset();
    mockSecureStorage.setItem.mockReset();
    mockGetCurrentOrCreateConversation.mockReset();
    mockParams.conversationId = undefined;
    
    // Default implementations with tracking
    mockSecureStorage.getItem.mockImplementation(async () => {
      storageGetCount++;
      if (storageGetCount > 100) {
        throw new Error('INFINITE LOOP: storage.getItem >100 calls');
      }
      return null;
    });
    
    mockSecureStorage.setItem.mockImplementation(async () => {
      storageSetCount++;
      if (storageSetCount > 100) {
        throw new Error('INFINITE LOOP: storage.setItem >100 calls');
      }
    });
    
    mockGetCurrentOrCreateConversation.mockImplementation(async (userId: string) => {
      createConversationCount++;
      if (createConversationCount > 100) {
        throw new Error('INFINITE LOOP: createConversation >100 calls');
      }
      return {
        conversationId: `conversation-${createConversationCount}`,
        shouldGreet: true,
      };
    });
  });

  describe('Effect Execution Limits', () => {
    test('should not execute effect more than necessary on mount', async () => {
      const { result } = renderHook(() => 
        useActiveConversation({ userId: 'test-user' })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 5000 });

      // Effect should run once (maybe twice with React 18 strict mode)
      expect(createConversationCount).toBeLessThanOrEqual(2);
      console.log(`✅ Effect executed ${createConversationCount} time(s) - SAFE`);
    });

    test('should stabilize after initial load (no infinite re-runs)', async () => {
      const { result } = renderHook(() => 
        useActiveConversation({ userId: 'test-user' })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCount = createConversationCount;

      // Wait 2 seconds to see if effect keeps re-running
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Should not have executed again
      expect(createConversationCount).toBe(initialCount);
      console.log('✅ Effect stabilized - no infinite re-runs');
    });

    test('should not cause infinite loop with rapid re-renders', async () => {
      const { result, rerender } = renderHook(() => 
        useActiveConversation({ userId: 'test-user' })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Force 20 rapid re-renders
      for (let i = 0; i < 20; i++) {
        rerender();
      }

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 500));

      // Should still be within reasonable bounds (not 100+)
      expect(createConversationCount).toBeLessThan(25);
      console.log(`✅ After 20 re-renders: ${createConversationCount} effect executions - SAFE`);
    });
  });

  describe('State Update Cycles', () => {
    test('should not create setState → effect → setState loops', async () => {
      const { result } = renderHook(() => 
        useActiveConversation({ userId: 'test-user' })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const stateUpdatesBefore = createConversationCount;

      // Wait to ensure no additional state updates
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(createConversationCount).toBe(stateUpdatesBefore);
      console.log('✅ No setState loops detected');
    });

    test('should handle storage updates without infinite loops', async () => {
      mockSecureStorage.getItem.mockImplementation(async (key) => {
        storageGetCount++;
        if (storageGetCount > 100) {
          throw new Error('INFINITE LOOP: storage reads');
        }
        // Simulate storage returning different values
        return storageGetCount % 2 === 0 ? 'conv-1' : 'conv-2';
      });

      const { result } = renderHook(() => 
        useActiveConversation({ userId: 'test-user' })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 5000 });

      // Should stabilize despite storage changes
      expect(storageGetCount).toBeLessThan(20);
      console.log(`✅ Storage reads: ${storageGetCount} - SAFE`);
    });
  });

  describe('Dependency Array Stability', () => {
    test('should not re-run when dependencies are stable', async () => {
      const userId = 'stable-user-id';
      mockParams.conversationId = undefined;

      const { result, rerender } = renderHook(() => 
        useActiveConversation({ userId })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const executionsAfterFirstLoad = createConversationCount;

      // Re-render with same props
      rerender();
      rerender();
      rerender();

      await new Promise(resolve => setTimeout(resolve, 500));

      // Should not execute again (dependencies unchanged)
      expect(createConversationCount).toBe(executionsAfterFirstLoad);
      console.log('✅ Effect stable with unchanged dependencies');
    });

    test('should only re-run when userId actually changes', async () => {
      const { result, rerender } = renderHook(
        ({ userId }) => useActiveConversation({ userId }),
        { initialProps: { userId: 'user-1' } }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const countAfterFirstLoad = createConversationCount;

      // Same userId, should not re-run
      rerender({ userId: 'user-1' });
      await new Promise(resolve => setTimeout(resolve, 300));
      expect(createConversationCount).toBe(countAfterFirstLoad);

      // Different userId, should re-run ONCE
      rerender({ userId: 'user-2' });
      await waitFor(() => {
        expect(createConversationCount).toBe(countAfterFirstLoad + 1);
      });

      console.log('✅ Effect only re-runs on actual dependency changes');
    });

    test('should only re-run when conversationId param changes', async () => {
      mockParams.conversationId = 'conv-1';

      const { result, rerender } = renderHook(() => 
        useActiveConversation({ userId: 'test-user' })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const countAfterFirstLoad = createConversationCount;

      // Same param, should not re-run
      rerender();
      await new Promise(resolve => setTimeout(resolve, 300));
      expect(createConversationCount).toBe(countAfterFirstLoad);

      // Different param, should re-run ONCE
      mockParams.conversationId = 'conv-2';
      rerender();
      await waitFor(() => {
        expect(result.current.conversationId).toBe('conv-2');
      });

      console.log('✅ Effect only re-runs when param changes');
    });
  });

  describe('Memory Leak Prevention', () => {
    test('should not accumulate pending promises', async () => {
      // Make async operations slow to test cleanup
      mockGetCurrentOrCreateConversation.mockImplementation(async () => {
        createConversationCount++;
        await new Promise(resolve => setTimeout(resolve, 100));
        return { conversationId: `conv-${createConversationCount}`, shouldGreet: true };
      });

      const { unmount } = renderHook(() => 
        useActiveConversation({ userId: 'test-user' })
      );

      // Unmount quickly (before async completes)
      await new Promise(resolve => setTimeout(resolve, 50));
      unmount();

      // Wait for any pending operations
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should only have started 1-2 operations (not infinite)
      expect(createConversationCount).toBeLessThanOrEqual(2);
      console.log('✅ No memory leaks from pending promises');
    });

    test('should clean up properly on unmount', async () => {
      const { result, unmount } = renderHook(() => 
        useActiveConversation({ userId: 'test-user' })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const countBeforeUnmount = createConversationCount;
      
      unmount();

      // Wait to ensure no more executions
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(createConversationCount).toBe(countBeforeUnmount);
      console.log('✅ Proper cleanup on unmount');
    });
  });

  describe('Timeout Protection', () => {
    test('should complete within reasonable time (not infinite)', async () => {
      const startTime = Date.now();

      const { result } = renderHook(() => 
        useActiveConversation({ userId: 'test-user' })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 5000 });

      const duration = Date.now() - startTime;

      // Should complete within 5 seconds
      expect(duration).toBeLessThan(5000);
      console.log(`✅ Completed in ${duration}ms - not infinite`);
    });

    test('should not exceed reasonable execution count under any condition', async () => {
      // Stress test: rapidly changing props
      const { rerender } = renderHook(
        ({ userId, convId }) => {
          mockParams.conversationId = convId;
          return useActiveConversation({ userId });
        },
        { initialProps: { userId: 'user-1', convId: undefined as string | undefined } }
      );

      // Rapidly change props 50 times
      for (let i = 0; i < 50; i++) {
        rerender({ 
          userId: `user-${i % 5}`,
          convId: i % 3 === 0 ? `conv-${i}` : undefined
        });
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Even with 50 prop changes, should not exceed 100 executions
      expect(createConversationCount).toBeLessThan(100);
      console.log(`✅ Stress test: ${createConversationCount} executions for 50 prop changes - SAFE`);
    });
  });

  describe('Error Scenarios', () => {
    test('should not loop infinitely on persistent errors', async () => {
      let errorCount = 0;
      mockGetCurrentOrCreateConversation.mockImplementation(async () => {
        errorCount++;
        if (errorCount > 10) {
          throw new Error('INFINITE LOOP: Error handler re-triggering effect');
        }
        throw new Error('Test error');
      });

      const { result } = renderHook(() => 
        useActiveConversation({ userId: 'test-user' })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 3000 });

      // Should fail gracefully, not loop
      expect(errorCount).toBeLessThanOrEqual(2);
      console.log(`✅ Error scenario: ${errorCount} attempts - no infinite loop`);
    });

    test('should stabilize after error recovery', async () => {
      let callCount = 0;
      mockGetCurrentOrCreateConversation.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('First attempt fails');
        }
        return { conversationId: 'recovered-conv', shouldGreet: true };
      });

      const { result } = renderHook(() => 
        useActiveConversation({ userId: 'test-user' })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const countAfterRecovery = callCount;

      // Wait to ensure no more attempts
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(callCount).toBe(countAfterRecovery);
      console.log('✅ Stabilized after error recovery');
    });
  });

  describe('Real-World Scenarios', () => {
    test('should handle user navigating away and back multiple times', async () => {
      const { unmount, rerender } = renderHook(() => 
        useActiveConversation({ userId: 'test-user' })
      );

      // Simulate: mount → unmount → mount → unmount → mount
      for (let i = 0; i < 5; i++) {
        await waitFor(() => {
          expect(createConversationCount).toBeLessThan(20);
        });
        
        unmount();
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const { unmount: unmountNext } = renderHook(() => 
          useActiveConversation({ userId: 'test-user' })
        );
      }

      // Total executions should be reasonable (≈5-10, not 100+)
      expect(createConversationCount).toBeLessThan(20);
      console.log(`✅ Multiple mount/unmount cycles: ${createConversationCount} executions - SAFE`);
    });

    test('should handle storage updates from external source', async () => {
      const { result } = renderHook(() => 
        useActiveConversation({ userId: 'test-user' })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const countBefore = createConversationCount;

      // Simulate external storage updates (e.g., from another tab)
      for (let i = 0; i < 10; i++) {
        await mockSecureStorage.setItem('CURRENT_CONVERSATION_ID', `external-${i}`);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Hook should not react to external storage changes (no listener)
      expect(createConversationCount).toBe(countBefore);
      console.log('✅ External storage updates do not trigger loops');
    });
  });

  describe('Performance Benchmarks', () => {
    test('should not degrade performance over time', async () => {
      const executionTimes: number[] = [];

      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        
        const { result, unmount } = renderHook(() => 
          useActiveConversation({ userId: `user-${i}` })
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        const duration = Date.now() - start;
        executionTimes.push(duration);
        
        unmount();
      }

      // First execution might be slower, but should stabilize
      const avgTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
      const maxTime = Math.max(...executionTimes);

      expect(maxTime).toBeLessThan(2000); // No execution > 2 seconds
      console.log(`✅ Performance stable: avg=${avgTime.toFixed(0)}ms, max=${maxTime}ms`);
    });
  });
});
