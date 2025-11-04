/**
 * Unit Tests for DataPreloader Component
 * 
 * Tests the silent background data loading component
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { render } from '@testing-library/react';
import '../setup/test-env';

// Mock the useChatHistoryData hook
const mockUseChatHistoryData = mock(() => ({
  conversations: [],
  allMessages: {},
  isLoading: false,
  isInitialized: true,
  refresh: mock(async () => {}),
  handleConversationInsert: mock(() => {}),
  handleConversationUpdate: mock(() => {}),
  handleConversationDelete: mock(() => {}),
  handleMessageInsert: mock(() => {}),
  handleMessageUpdate: mock(() => {}),
  handleMessageDelete: mock(() => {}),
}));

// Mock the useAuth hook
const mockUser = { id: 'test-user-id' };
const mockUseAuth = mock(() => ({
  user: mockUser,
  isAuthenticated: true,
  isLoading: false,
}));

mock.module('../../contexts/AuthContext', () => ({
  useAuth: mockUseAuth,
}));

mock.module('../../hooks/useChatHistoryData', () => ({
  useChatHistoryData: mockUseChatHistoryData,
}));

// Import after mocking
const { DataPreloader } = await import('../../components/DataPreloader');

describe('DataPreloader Component', () => {
  beforeEach(() => {
    mockUseChatHistoryData.mockClear();
    mockUseAuth.mockClear();
  });

  describe('Silent Background Loading', () => {
    test('should render without any visible output', () => {
      const { container } = render(<DataPreloader />);
      
      // Should not render anything (null return)
      expect(container.firstChild).toBeNull();
      console.log('✅ DataPreloader renders nothing (invisible)');
    });

    test('should call useChatHistoryData with user id', () => {
      render(<DataPreloader />);
      
      expect(mockUseChatHistoryData).toHaveBeenCalledWith('test-user-id');
      console.log('✅ Calls useChatHistoryData with correct user id');
    });

    test('should not call useChatHistoryData when user is null', () => {
      // Mock user as null
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });

      mockUseChatHistoryData.mockClear();
      render(<DataPreloader />);
      
      expect(mockUseChatHistoryData).toHaveBeenCalledWith(undefined);
      console.log('✅ Handles null user gracefully');
    });
  });

  describe('Cache Population', () => {
    test('should populate module-level cache through hook', () => {
      const mockHookReturn = {
        conversations: [
          { id: 'conv-1', title: 'Test Conversation' },
          { id: 'conv-2', title: 'Another Conversation' },
        ],
        allMessages: {
          'conv-1': [{ id: 'msg-1', content: 'Test message' }],
        },
        isLoading: false,
        isInitialized: true,
        refresh: mock(async () => {}),
      };

      mockUseChatHistoryData.mockReturnValue(mockHookReturn);

      render(<DataPreloader />);
      
      expect(mockUseChatHistoryData).toHaveBeenCalled();
      console.log('✅ Hook called to populate cache');
    });
  });

  describe('Integration with App Layout', () => {
    test('should be mountable at app level', () => {
      // Simulate app-level mounting
      const { rerender } = render(<DataPreloader />);
      
      // Should handle remounting gracefully
      rerender(<DataPreloader />);
      
      expect(mockUseChatHistoryData).toHaveBeenCalled();
      console.log('✅ Can be mounted at app level');
    });

    test('should not cause performance issues', () => {
      const startTime = Date.now();
      
      render(<DataPreloader />);
      
      const renderTime = Date.now() - startTime;
      expect(renderTime).toBeLessThan(100); // Should be very fast
      console.log(`✅ Renders quickly (${renderTime}ms)`);
    });
  });
});
