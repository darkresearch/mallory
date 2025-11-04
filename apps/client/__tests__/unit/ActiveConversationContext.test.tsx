/**
 * Unit Tests for ActiveConversationProvider Context
 * 
 * Tests the global conversation context that replaces polling
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import '../setup/test-env';

// Mock storage BEFORE any imports
const mockStorage = {
  getItem: mock(async (key: string) => null),
  setItem: mock(async (key: string, value: string) => {}),
  removeItem: mock(async (key: string) => {}),
};

mock.module('@/lib/storage', () => ({
  storage: {
    persistent: mockStorage,
    session: mockStorage,
  },
  SECURE_STORAGE_KEYS: {
    CURRENT_CONVERSATION_ID: 'mallory_current_conversation_id',
  },
}));

// Import after mocking - use require for better compatibility
const ActiveConversationModule = require('@/contexts/ActiveConversationContext');
const { ActiveConversationProvider, useActiveConversationContext } = ActiveConversationModule;

describe('ActiveConversationProvider Context', () => {
  beforeEach(() => {
    // Reset mocks
    mockStorage.getItem.mockReset();
    mockStorage.setItem.mockReset();
    
    // Default implementations
    mockStorage.getItem.mockImplementation(async () => null);
    mockStorage.setItem.mockImplementation(async () => {});
  });

  describe('Initialization', () => {
    test('should initialize with null conversationId', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ActiveConversationProvider>{children}</ActiveConversationProvider>
      );

      const { result } = renderHook(() => useActiveConversationContext(), { wrapper });

      expect(result.current.conversationId).toBeNull();
      expect(result.current.setConversationId).toBeDefined();
      
      console.log('✅ Initializes with null conversationId');
    });

    test('should load conversationId from storage on mount', async () => {
      mockStorage.getItem.mockImplementation(async (key) => {
        if (key === 'mallory_current_conversation_id') {
          return 'stored-conversation-id';
        }
        return null;
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ActiveConversationProvider>{children}</ActiveConversationProvider>
      );

      const { result } = renderHook(() => useActiveConversationContext(), { wrapper });

      // Wait for storage load
      await waitFor(() => {
        expect(result.current.conversationId).toBe('stored-conversation-id');
      });

      expect(mockStorage.getItem).toHaveBeenCalledWith('mallory_current_conversation_id');
      
      console.log('✅ Loads from storage on mount');
    });

    test('should handle storage errors gracefully', async () => {
      mockStorage.getItem.mockRejectedValue(new Error('Storage error'));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ActiveConversationProvider>{children}</ActiveConversationProvider>
      );

      const { result } = renderHook(() => useActiveConversationContext(), { wrapper });

      // Should remain null on error
      expect(result.current.conversationId).toBeNull();
      
      console.log('✅ Handles storage errors gracefully');
    });
  });

  describe('Setting ConversationId', () => {
    test('should update conversationId via setConversationId', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ActiveConversationProvider>{children}</ActiveConversationProvider>
      );

      const { result } = renderHook(() => useActiveConversationContext(), { wrapper });

      act(() => {
        result.current.setConversationId('new-conversation-id');
      });

      expect(result.current.conversationId).toBe('new-conversation-id');
      
      console.log('✅ Updates conversationId via setter');
    });

    test('should save to storage when conversationId changes', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ActiveConversationProvider>{children}</ActiveConversationProvider>
      );

      const { result } = renderHook(() => useActiveConversationContext(), { wrapper });

      act(() => {
        result.current.setConversationId('conversation-to-save');
      });

      // Wait for effect to run
      await waitFor(() => {
        expect(mockStorage.setItem).toHaveBeenCalledWith(
          'mallory_current_conversation_id',
          'conversation-to-save'
        );
      });
      
      console.log('✅ Saves to storage when conversationId changes');
    });

    test('should handle null conversationId', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ActiveConversationProvider>{children}</ActiveConversationProvider>
      );

      const { result } = renderHook(() => useActiveConversationContext(), { wrapper });

      act(() => {
        result.current.setConversationId('some-id');
      });

      act(() => {
        result.current.setConversationId(null);
      });

      expect(result.current.conversationId).toBeNull();
      
      console.log('✅ Handles null conversationId');
    });
  });

  describe('Multiple Consumers', () => {
    test('should provide same value to multiple consumers', async () => {
      // Create a single wrapper instance
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ActiveConversationProvider>{children}</ActiveConversationProvider>
      );

      // Render both hooks within the same provider using a custom setup
      const { result } = renderHook(() => ({
        hook1: useActiveConversationContext(),
        hook2: useActiveConversationContext(),
      }), { wrapper });

      // Wait for initial storage load to complete
      await waitFor(() => {
        expect(result.current.hook1.conversationId).toBe(null);
      });

      await act(async () => {
        result.current.hook1.setConversationId('shared-conversation-id');
      });

      // Wait for state to update
      await waitFor(() => {
        expect(result.current.hook1.conversationId).toBe('shared-conversation-id');
      });

      // Both consumers should see the same value
      expect(result.current.hook1.conversationId).toBe('shared-conversation-id');
      expect(result.current.hook2.conversationId).toBe('shared-conversation-id');
      
      console.log('✅ Provides same value to multiple consumers');
    });

    test('should update all consumers when value changes', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ActiveConversationProvider>{children}</ActiveConversationProvider>
      );

      const { result } = renderHook(() => ({
        hook1: useActiveConversationContext(),
        hook2: useActiveConversationContext(),
      }), { wrapper });

      // Wait for initial storage load
      await waitFor(() => {
        expect(result.current.hook1.conversationId).toBe(null);
      });

      await act(async () => {
        result.current.hook1.setConversationId('conversation-1');
      });

      await waitFor(() => {
        expect(result.current.hook1.conversationId).toBe('conversation-1');
      });

      expect(result.current.hook1.conversationId).toBe('conversation-1');
      expect(result.current.hook2.conversationId).toBe('conversation-1');

      await act(async () => {
        result.current.hook2.setConversationId('conversation-2');
      });

      await waitFor(() => {
        expect(result.current.hook2.conversationId).toBe('conversation-2');
      });

      // Both should have the new value
      expect(result.current.hook1.conversationId).toBe('conversation-2');
      expect(result.current.hook2.conversationId).toBe('conversation-2');
      
      console.log('✅ Updates all consumers when value changes');
    });
  });

  describe('Context Without Provider', () => {
    test('should throw error when used without provider', () => {
      expect(() => {
        renderHook(() => useActiveConversationContext());
      }).toThrow('useActiveConversationContext must be used within ActiveConversationProvider');
      
      console.log('✅ Throws error when used without provider');
    });
  });

  describe('No Polling Behavior', () => {
    test('should not poll storage after initialization', async () => {
      mockStorage.getItem.mockImplementation(async () => 'initial-id');

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ActiveConversationProvider>{children}</ActiveConversationProvider>
      );

      const { result } = renderHook(() => useActiveConversationContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.conversationId).toBe('initial-id');
      });

      const initialCallCount = mockStorage.getItem.mock.calls.length;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 600));

      // Should not have called getItem again (no polling!)
      expect(mockStorage.getItem.mock.calls.length).toBe(initialCallCount);
      
      console.log('✅ Does not poll storage (reactive updates only)');
    });
  });
});

