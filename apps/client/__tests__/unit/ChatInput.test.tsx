/**
 * Unit Tests for ChatInput Component
 * 
 * Tests ChatInput UI behavior, draft persistence integration, and user interactions
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import '../setup/test-env';
import { ChatInput } from '@/components/chat/ChatInput';
import * as draftStorage from '@/lib/storage/draftMessages';

// Mock storage functions
const mockGetDraftMessage = mock(() => Promise.resolve(null));
const mockSaveDraftMessage = mock(() => Promise.resolve());
const mockClearDraftMessage = mock(() => Promise.resolve());

describe('ChatInput Component', () => {
  beforeEach(() => {
    // Reset mocks
    mockGetDraftMessage.mockClear();
    mockSaveDraftMessage.mockClear();
    mockClearDraftMessage.mockClear();
  });

  describe('Basic Rendering', () => {
    test('should render text input', () => {
      const { getByTestId } = render(<ChatInput />);
      
      // Note: We need to add testID to TextInput in the component
      // This test will guide that change
    });

    test('should render send button', () => {
      const { UNSAFE_getByType } = render(<ChatInput />);
      
      // Find TouchableOpacity with send button
      const buttons = UNSAFE_getAllByType(TouchableOpacity);
      expect(buttons.length).toBeGreaterThan(0);
    });

    test('should show stop button when streaming', () => {
      const { UNSAFE_getAllByType } = render(<ChatInput isStreaming={true} />);
      
      // Should show stop button instead of send
      const buttons = UNSAFE_getAllByType(TouchableOpacity);
      expect(buttons.length).toBeGreaterThan(0);
    });

    test('should disable input when disabled prop is true', () => {
      const { UNSAFE_getByType } = render(<ChatInput disabled={true} />);
      
      const textInput = UNSAFE_getByType(TextInput);
      expect(textInput.props.editable).toBe(false);
    });
  });

  describe('User Input Handling', () => {
    test('should update text on change', () => {
      const { UNSAFE_getByType } = render(<ChatInput />);
      const textInput = UNSAFE_getByType(TextInput);

      fireEvent.changeText(textInput, 'Hello');
      
      expect(textInput.props.value).toBe('Hello');
    });

    test('should enable send button when text is entered', () => {
      const { UNSAFE_getByType, UNSAFE_getAllByType } = render(<ChatInput />);
      const textInput = UNSAFE_getByType(TextInput);

      fireEvent.changeText(textInput, 'Hello');

      // Send button should be enabled (opacity 1)
      const buttons = UNSAFE_getAllByType(TouchableOpacity);
      const sendButton = buttons[buttons.length - 1]; // Last button is send
      
      expect(sendButton.props.style.opacity).toBe(1);
    });

    test('should disable send button when text is empty', () => {
      const { UNSAFE_getByType, UNSAFE_getAllByType } = render(<ChatInput />);
      const textInput = UNSAFE_getByType(TextInput);

      fireEvent.changeText(textInput, '');

      const buttons = UNSAFE_getAllByType(TouchableOpacity);
      const sendButton = buttons[buttons.length - 1];
      
      expect(sendButton.props.style.opacity).toBe(0.5);
    });

    test('should handle multiline input', () => {
      const { UNSAFE_getByType } = render(<ChatInput />);
      const textInput = UNSAFE_getByType(TextInput);

      fireEvent.changeText(textInput, 'Line 1\nLine 2\nLine 3');
      
      expect(textInput.props.value).toBe('Line 1\nLine 2\nLine 3');
    });
  });

  describe('Send Message', () => {
    test('should call onSend with message text', async () => {
      const onSend = mock(() => Promise.resolve());
      const { UNSAFE_getByType, UNSAFE_getAllByType } = render(<ChatInput onSend={onSend} />);
      
      const textInput = UNSAFE_getByType(TextInput);
      fireEvent.changeText(textInput, 'Test message');

      const buttons = UNSAFE_getAllByType(TouchableOpacity);
      const sendButton = buttons[buttons.length - 1];
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(onSend).toHaveBeenCalledWith('Test message');
      });
    });

    test('should clear input after sending', async () => {
      const onSend = mock(() => Promise.resolve());
      const { UNSAFE_getByType, UNSAFE_getAllByType } = render(<ChatInput onSend={onSend} />);
      
      const textInput = UNSAFE_getByType(TextInput);
      fireEvent.changeText(textInput, 'Test message');

      const buttons = UNSAFE_getAllByType(TouchableOpacity);
      const sendButton = buttons[buttons.length - 1];
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(textInput.props.value).toBe('');
      });
    });

    test('should not send empty message', async () => {
      const onSend = mock(() => Promise.resolve());
      const { UNSAFE_getAllByType } = render(<ChatInput onSend={onSend} />);

      const buttons = UNSAFE_getAllByType(TouchableOpacity);
      const sendButton = buttons[buttons.length - 1];
      fireEvent.press(sendButton);

      expect(onSend).not.toHaveBeenCalled();
    });

    test('should trim whitespace before sending', async () => {
      const onSend = mock(() => Promise.resolve());
      const { UNSAFE_getByType, UNSAFE_getAllByType } = render(<ChatInput onSend={onSend} />);
      
      const textInput = UNSAFE_getByType(TextInput);
      fireEvent.changeText(textInput, '  Test message  ');

      const buttons = UNSAFE_getAllByType(TouchableOpacity);
      const sendButton = buttons[buttons.length - 1];
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(onSend).toHaveBeenCalledWith('Test message');
      });
    });
  });

  describe('Stop Streaming', () => {
    test('should call onStop when stop button pressed', () => {
      const onStop = mock(() => {});
      const { UNSAFE_getAllByType } = render(<ChatInput isStreaming={true} onStop={onStop} />);

      const buttons = UNSAFE_getAllByType(TouchableOpacity);
      const stopButton = buttons[buttons.length - 1];
      fireEvent.press(stopButton);

      expect(onStop).toHaveBeenCalled();
    });
  });

  describe('Draft Message Persistence', () => {
    test('should load draft message when conversation opens', async () => {
      const conversationId = 'test-conv-1';
      const draftText = 'Saved draft';
      
      // Mock draft loading
      mockGetDraftMessage.mockResolvedValueOnce(draftText);
      
      const { UNSAFE_getByType } = render(
        <ChatInput conversationId={conversationId} />
      );

      await waitFor(() => {
        const textInput = UNSAFE_getByType(TextInput);
        expect(textInput.props.value).toBe(draftText);
      });
    });

    test('should save draft when typing (debounced)', async () => {
      const conversationId = 'test-conv-1';
      
      const { UNSAFE_getByType } = render(
        <ChatInput conversationId={conversationId} />
      );

      const textInput = UNSAFE_getByType(TextInput);
      fireEvent.changeText(textInput, 'Draft in progress');

      // Wait for debounce (500ms)
      await new Promise(resolve => setTimeout(resolve, 600));

      expect(mockSaveDraftMessage).toHaveBeenCalledWith(conversationId, 'Draft in progress');
    });

    test('should clear draft when message is sent', async () => {
      const conversationId = 'test-conv-1';
      const onSend = mock(() => Promise.resolve());
      
      const { UNSAFE_getByType, UNSAFE_getAllByType } = render(
        <ChatInput conversationId={conversationId} onSend={onSend} />
      );

      const textInput = UNSAFE_getByType(TextInput);
      fireEvent.changeText(textInput, 'Message to send');

      const buttons = UNSAFE_getAllByType(TouchableOpacity);
      const sendButton = buttons[buttons.length - 1];
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(mockClearDraftMessage).toHaveBeenCalledWith(conversationId);
      });
    });

    test('should clear draft when input is cleared by user', async () => {
      const conversationId = 'test-conv-1';
      
      const { UNSAFE_getByType } = render(
        <ChatInput conversationId={conversationId} />
      );

      const textInput = UNSAFE_getByType(TextInput);
      
      // Type then clear
      fireEvent.changeText(textInput, 'Some text');
      fireEvent.changeText(textInput, '');

      expect(mockClearDraftMessage).toHaveBeenCalledWith(conversationId);
    });

    test('should not save draft when conversation ID is null', async () => {
      const { UNSAFE_getByType } = render(<ChatInput conversationId={null} />);

      const textInput = UNSAFE_getByType(TextInput);
      fireEvent.changeText(textInput, 'Should not save');

      await new Promise(resolve => setTimeout(resolve, 600));

      expect(mockSaveDraftMessage).not.toHaveBeenCalled();
    });
  });

  describe('Pending Message Restoration', () => {
    test('should restore pending message from OTP flow', () => {
      const pendingMessage = 'Message before OTP';
      const onPendingMessageCleared = mock(() => {});
      
      const { UNSAFE_getByType } = render(
        <ChatInput 
          pendingMessage={pendingMessage}
          onPendingMessageCleared={onPendingMessageCleared}
        />
      );

      const textInput = UNSAFE_getByType(TextInput);
      expect(textInput.props.value).toBe(pendingMessage);
      expect(onPendingMessageCleared).toHaveBeenCalled();
    });
  });

  describe('Keyboard Handling', () => {
    test('should handle Enter key on web (send message)', async () => {
      const onSend = mock(() => Promise.resolve());
      const { UNSAFE_getByType } = render(<ChatInput onSend={onSend} />);

      const textInput = UNSAFE_getByType(TextInput);
      fireEvent.changeText(textInput, 'Test message');

      // Simulate Enter key press
      fireEvent(textInput, 'keyPress', {
        nativeEvent: { key: 'Enter', shiftKey: false },
      });

      await waitFor(() => {
        expect(onSend).toHaveBeenCalledWith('Test message');
      });
    });

    test('should handle Shift+Enter (new line, no send)', async () => {
      const onSend = mock(() => Promise.resolve());
      const { UNSAFE_getByType } = render(<ChatInput onSend={onSend} />);

      const textInput = UNSAFE_getByType(TextInput);
      fireEvent.changeText(textInput, 'Test message');

      // Simulate Shift+Enter key press
      fireEvent(textInput, 'keyPress', {
        nativeEvent: { key: 'Enter', shiftKey: true },
      });

      // Should not send
      expect(onSend).not.toHaveBeenCalled();
    });
  });

  describe('Auto-resize Behavior', () => {
    test('should adjust height based on content', () => {
      const { UNSAFE_getByType } = render(<ChatInput />);
      const textInput = UNSAFE_getByType(TextInput);

      // Simulate content size change (multiline)
      fireEvent(textInput, 'contentSizeChange', {
        nativeEvent: {
          contentSize: { height: 80 },
        },
      });

      // Container should adjust height
      // Note: Exact assertion depends on component implementation
    });

    test('should reset height when input is cleared', () => {
      const { UNSAFE_getByType } = render(<ChatInput />);
      const textInput = UNSAFE_getByType(TextInput);

      fireEvent.changeText(textInput, 'Multi\nLine\nText');
      fireEvent.changeText(textInput, '');

      // Height should reset to minimum (44px)
    });
  });

  describe('Edge Cases', () => {
    test('should handle very long messages', async () => {
      const onSend = mock(() => Promise.resolve());
      const longMessage = 'A'.repeat(5000);
      
      const { UNSAFE_getByType, UNSAFE_getAllByType } = render(<ChatInput onSend={onSend} />);
      
      const textInput = UNSAFE_getByType(TextInput);
      fireEvent.changeText(textInput, longMessage);

      const buttons = UNSAFE_getAllByType(TouchableOpacity);
      const sendButton = buttons[buttons.length - 1];
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(onSend).toHaveBeenCalledWith(longMessage);
      });
    });

    test('should handle special characters', async () => {
      const onSend = mock(() => Promise.resolve());
      const specialMessage = 'Message with emoji 🚀 and symbols @#$';
      
      const { UNSAFE_getByType, UNSAFE_getAllByType } = render(<ChatInput onSend={onSend} />);
      
      const textInput = UNSAFE_getByType(TextInput);
      fireEvent.changeText(textInput, specialMessage);

      const buttons = UNSAFE_getAllByType(TouchableOpacity);
      const sendButton = buttons[buttons.length - 1];
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(onSend).toHaveBeenCalledWith(specialMessage);
      });
    });

    test('should handle rapid typing and sending', async () => {
      const onSend = mock(() => Promise.resolve());
      const { UNSAFE_getByType, UNSAFE_getAllByType } = render(<ChatInput onSend={onSend} />);
      
      const textInput = UNSAFE_getByType(TextInput);
      
      // Rapid typing
      fireEvent.changeText(textInput, 'H');
      fireEvent.changeText(textInput, 'He');
      fireEvent.changeText(textInput, 'Hel');
      fireEvent.changeText(textInput, 'Hell');
      fireEvent.changeText(textInput, 'Hello');

      const buttons = UNSAFE_getAllByType(TouchableOpacity);
      const sendButton = buttons[buttons.length - 1];
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(onSend).toHaveBeenCalledWith('Hello');
      });
    });
  });
});
