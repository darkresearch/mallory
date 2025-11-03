import { describe, test, expect, beforeEach, jest } from 'bun:test';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useChatPreloader } from '../../hooks/useChatPreloader';

// Mock dependencies
const mockGetCurrentOrCreateConversation = jest.fn();
const mockLoadMessagesFromSupabase = jest.fn();

jest.mock('../../features/chat', () => ({
  getCurrentOrCreateConversation: mockGetCurrentOrCreateConversation,
  loadMessagesFromSupabase: mockLoadMessagesFromSupabase,
}));

describe('useChatPreloader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should not preload when enabled is false', async () => {
    renderHook(() => useChatPreloader({ userId: 'test-user', enabled: false }));
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(mockGetCurrentOrCreateConversation).not.toHaveBeenCalled();
    expect(mockLoadMessagesFromSupabase).not.toHaveBeenCalled();
  });

  test('should not preload when userId is missing', async () => {
    renderHook(() => useChatPreloader({ userId: undefined, enabled: true }));
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(mockGetCurrentOrCreateConversation).not.toHaveBeenCalled();
    expect(mockLoadMessagesFromSupabase).not.toHaveBeenCalled();
  });

  test('should preload conversation and messages when enabled', async () => {
    const mockConversationId = 'test-conversation-id';
    const mockMessages = [{ id: '1', role: 'user', content: 'Hello' }];
    
    mockGetCurrentOrCreateConversation.mockResolvedValue({
      conversationId: mockConversationId,
      shouldGreet: false,
    });
    
    mockLoadMessagesFromSupabase.mockResolvedValue(mockMessages);
    
    const { result } = renderHook(() => 
      useChatPreloader({ userId: 'test-user', enabled: true })
    );
    
    expect(result.current.isPreloading).toBe(true);
    expect(result.current.isPreloaded).toBe(false);
    
    await waitFor(() => {
      expect(result.current.isPreloading).toBe(false);
      expect(result.current.isPreloaded).toBe(true);
    });
    
    expect(mockGetCurrentOrCreateConversation).toHaveBeenCalledWith('test-user');
    expect(mockLoadMessagesFromSupabase).toHaveBeenCalledWith(mockConversationId);
  });

  test('should only preload once per session', async () => {
    const mockConversationId = 'test-conversation-id';
    
    mockGetCurrentOrCreateConversation.mockResolvedValue({
      conversationId: mockConversationId,
      shouldGreet: false,
    });
    
    mockLoadMessagesFromSupabase.mockResolvedValue([]);
    
    const { rerender } = renderHook(() => 
      useChatPreloader({ userId: 'test-user', enabled: true })
    );
    
    await waitFor(() => {
      expect(mockGetCurrentOrCreateConversation).toHaveBeenCalledTimes(1);
    });
    
    // Rerender should not trigger another preload
    rerender();
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(mockGetCurrentOrCreateConversation).toHaveBeenCalledTimes(1);
    expect(mockLoadMessagesFromSupabase).toHaveBeenCalledTimes(1);
  });

  test('should handle errors gracefully', async () => {
    mockGetCurrentOrCreateConversation.mockRejectedValue(new Error('Test error'));
    
    const { result } = renderHook(() => 
      useChatPreloader({ userId: 'test-user', enabled: true })
    );
    
    await waitFor(() => {
      expect(result.current.isPreloading).toBe(false);
      expect(result.current.isPreloaded).toBe(false);
    });
    
    expect(mockGetCurrentOrCreateConversation).toHaveBeenCalled();
    expect(mockLoadMessagesFromSupabase).not.toHaveBeenCalled();
  });
});
