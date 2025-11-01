/**
 * Tests for tool_use/tool_result validation
 * 
 * Tests that ensure tool_use blocks are properly paired with tool_result blocks
 * to prevent API errors from Anthropic
 */

import { describe, test, expect } from 'bun:test';
import { UIMessage } from 'ai';
import { 
  validateToolUsePairs, 
  fixToolUsePairs, 
  validateAndFixMessages,
  extractToolUseIds,
  extractToolResultIds
} from '../../../server/src/routes/chat/config/validateMessages';

describe('Tool Use/Result Validation', () => {
  describe('extractToolUseIds', () => {
    test('should extract tool_use IDs from assistant message with parts array', () => {
      const message: UIMessage = {
        id: 'msg-1',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'Hello' },
          { type: 'tool-call', toolCallId: 'toolu_123', toolName: 'searchWeb' },
          { type: 'tool-call', toolCallId: 'toolu_456', toolName: 'getWeather' }
        ]
      };

      const ids = extractToolUseIds(message);
      expect(ids).toEqual(['toolu_123', 'toolu_456']);
    });

    test('should extract tool_use IDs from Anthropic format (content array)', () => {
      const message: any = {
        id: 'msg-1',
        role: 'assistant',
        content: [
          { type: 'text', text: 'Hello' },
          { type: 'tool_use', id: 'toolu_789', name: 'searchWeb' }
        ]
      };

      const ids = extractToolUseIds(message);
      expect(ids).toEqual(['toolu_789']);
    });

    test('should return empty array for non-assistant messages', () => {
      const message: UIMessage = {
        id: 'msg-1',
        role: 'user',
        parts: [
          { type: 'text', text: 'Hello' }
        ]
      };

      const ids = extractToolUseIds(message);
      expect(ids).toEqual([]);
    });
  });

  describe('extractToolResultIds', () => {
    test('should extract tool_result IDs from user message with parts array', () => {
      const message: UIMessage = {
        id: 'msg-2',
        role: 'user',
        parts: [
          { type: 'tool-result', toolCallId: 'toolu_123', result: 'Result 1' },
          { type: 'tool-result', toolCallId: 'toolu_456', result: 'Result 2' }
        ]
      };

      const ids = extractToolResultIds(message);
      expect(ids).toEqual(['toolu_123', 'toolu_456']);
    });

    test('should extract tool_result IDs from Anthropic format', () => {
      const message: any = {
        id: 'msg-2',
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'toolu_789', content: 'Result' }
        ]
      };

      const ids = extractToolResultIds(message);
      expect(ids).toEqual(['toolu_789']);
    });

    test('should return empty array for non-user messages', () => {
      const message: UIMessage = {
        id: 'msg-2',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'Hello' }
        ]
      };

      const ids = extractToolResultIds(message);
      expect(ids).toEqual([]);
    });
  });

  describe('validateToolUsePairs', () => {
    test('should validate correct tool_use/tool_result pairs', () => {
      const messages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            { type: 'text', text: 'I will search for you' },
            { type: 'tool-call', toolCallId: 'toolu_123', toolName: 'searchWeb' }
          ]
        },
        {
          id: 'msg-2',
          role: 'user',
          parts: [
            { type: 'tool-result', toolCallId: 'toolu_123', result: 'Search results here' }
          ]
        }
      ];

      const result = validateToolUsePairs(messages);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect missing tool_result blocks', () => {
      const messages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            { type: 'text', text: 'I will search' },
            { type: 'tool-call', toolCallId: 'toolu_123', toolName: 'searchWeb' }
          ]
        },
        {
          id: 'msg-2',
          role: 'user',
          parts: [
            { type: 'text', text: 'What did you find?' }
          ]
        }
      ];

      const result = validateToolUsePairs(messages);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].toolUseId).toBe('toolu_123');
      expect(result.errors[0].error).toContain('not found in tool_result blocks');
    });

    test('should detect orphaned tool_use at end of conversation', () => {
      const messages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            { type: 'text', text: 'I will search' },
            { type: 'tool-call', toolCallId: 'toolu_123', toolName: 'searchWeb' }
          ]
        }
      ];

      const result = validateToolUsePairs(messages);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('without a following message');
    });

    test('should detect incorrect message role after tool_use', () => {
      const messages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            { type: 'text', text: 'I will search' },
            { type: 'tool-call', toolCallId: 'toolu_123', toolName: 'searchWeb' }
          ]
        },
        {
          id: 'msg-2',
          role: 'assistant',
          parts: [
            { type: 'text', text: 'Here are the results' }
          ]
        }
      ];

      const result = validateToolUsePairs(messages);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('next message is assistant');
    });

    test('should detect multiple tool_use blocks missing results', () => {
      const messages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            { type: 'tool-call', toolCallId: 'toolu_123', toolName: 'searchWeb' },
            { type: 'tool-call', toolCallId: 'toolu_456', toolName: 'getWeather' }
          ]
        },
        {
          id: 'msg-2',
          role: 'user',
          parts: [
            { type: 'tool-result', toolCallId: 'toolu_123', result: 'Result 1' }
            // Missing tool_result for toolu_456
          ]
        }
      ];

      const result = validateToolUsePairs(messages);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].toolUseId).toBe('toolu_456');
    });

    test('should warn about extra tool_result blocks', () => {
      const messages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            { type: 'tool-call', toolCallId: 'toolu_123', toolName: 'searchWeb' }
          ]
        },
        {
          id: 'msg-2',
          role: 'user',
          parts: [
            { type: 'tool-result', toolCallId: 'toolu_123', result: 'Result 1' },
            { type: 'tool-result', toolCallId: 'toolu_999', result: 'Extra result' }
          ]
        }
      ];

      const result = validateToolUsePairs(messages);
      expect(result.isValid).toBe(true); // Not an error, just a warning
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].warning).toContain('toolu_999');
    });
  });

  describe('fixToolUsePairs', () => {
    test('should remove orphaned tool_use blocks', () => {
      const messages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            { type: 'text', text: 'I will search' },
            { type: 'tool-call', toolCallId: 'toolu_123', toolName: 'searchWeb' }
          ]
        },
        {
          id: 'msg-2',
          role: 'user',
          parts: [
            { type: 'text', text: 'What did you find?' }
          ]
        }
      ];

      const result = fixToolUsePairs(messages);
      expect(result.fixesApplied).toHaveLength(1);
      expect(result.fixesApplied[0].toolUseId).toBe('toolu_123');
      
      // Check that tool_use part was removed
      const fixedMsg = result.fixedMessages[0];
      const toolCallParts = fixedMsg.parts?.filter((p: any) => p.type === 'tool-call') || [];
      expect(toolCallParts).toHaveLength(0);
    });

    test('should preserve valid tool_use/tool_result pairs', () => {
      const messages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            { type: 'text', text: 'I will search' },
            { type: 'tool-call', toolCallId: 'toolu_123', toolName: 'searchWeb' }
          ]
        },
        {
          id: 'msg-2',
          role: 'user',
          parts: [
            { type: 'tool-result', toolCallId: 'toolu_123', result: 'Search results' }
          ]
        }
      ];

      const result = fixToolUsePairs(messages);
      expect(result.fixesApplied).toHaveLength(0);
      
      // Check that tool_use part was preserved
      const fixedMsg = result.fixedMessages[0];
      const toolCallParts = fixedMsg.parts?.filter((p: any) => p.type === 'tool-call') || [];
      expect(toolCallParts).toHaveLength(1);
    });

    test('should handle messages without parts array', () => {
      const messages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: 'Hello'
        } as any,
        {
          id: 'msg-2',
          role: 'user',
          content: 'Hi'
        } as any
      ];

      const result = fixToolUsePairs(messages);
      expect(result.fixesApplied).toHaveLength(0);
      expect(result.fixedMessages).toHaveLength(2);
    });
  });

  describe('validateAndFixMessages', () => {
    test('should validate and fix messages with errors', () => {
      const messages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            { type: 'text', text: 'I will search' },
            { type: 'tool-call', toolCallId: 'toolu_123', toolName: 'searchWeb' }
          ]
        },
        {
          id: 'msg-2',
          role: 'user',
          parts: [
            { type: 'text', text: 'What did you find?' }
          ]
        }
      ];

      const result = validateAndFixMessages(messages, { fixErrors: true, logErrors: false });
      
      expect(result.validation.isValid).toBe(false);
      expect(result.fixesApplied).toHaveLength(1);
      
      // After fixing, messages should be valid
      const revalidation = validateToolUsePairs(result.messages);
      expect(revalidation.isValid).toBe(true);
    });

    test('should not fix errors when fixErrors is false', () => {
      const messages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            { type: 'tool-call', toolCallId: 'toolu_123', toolName: 'searchWeb' }
          ]
        }
      ];

      const result = validateAndFixMessages(messages, { fixErrors: false, logErrors: false });
      
      expect(result.validation.isValid).toBe(false);
      expect(result.fixesApplied).toHaveLength(0);
      
      // Messages should remain unchanged
      expect(result.messages[0].parts?.length).toBe(1);
    });
  });

  describe('Real-world scenarios', () => {
    test('should handle conversation with multiple tool calls', () => {
      const messages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Search for TypeScript and get weather' }]
        },
        {
          id: 'msg-2',
          role: 'assistant',
          parts: [
            { type: 'text', text: 'I will search and get weather' },
            { type: 'tool-call', toolCallId: 'toolu_123', toolName: 'searchWeb' },
            { type: 'tool-call', toolCallId: 'toolu_456', toolName: 'getWeather' }
          ]
        },
        {
          id: 'msg-3',
          role: 'user',
          parts: [
            { type: 'tool-result', toolCallId: 'toolu_123', result: 'TypeScript results' },
            { type: 'tool-result', toolCallId: 'toolu_456', result: 'Weather data' }
          ]
        },
        {
          id: 'msg-4',
          role: 'assistant',
          parts: [
            { type: 'text', text: 'Here is what I found...' }
          ]
        }
      ];

      const result = validateToolUsePairs(messages);
      expect(result.isValid).toBe(true);
    });

    test('should handle conversation where tool result is missing', () => {
      const messages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Search for something' }]
        },
        {
          id: 'msg-2',
          role: 'assistant',
          parts: [
            { type: 'tool-call', toolCallId: 'toolu_123', toolName: 'searchWeb' }
          ]
        },
        {
          id: 'msg-3',
          role: 'user',
          parts: [
            { type: 'text', text: 'Thanks!' }
          ]
        }
      ];

      const result = validateAndFixMessages(messages, { fixErrors: true, logErrors: false });
      
      // Should detect the error
      expect(result.validation.isValid).toBe(false);
      
      // Should fix it by removing the orphaned tool_use
      expect(result.fixesApplied.length).toBeGreaterThan(0);
      
      // After fix, should be valid
      const revalidation = validateToolUsePairs(result.messages);
      expect(revalidation.isValid).toBe(true);
    });
  });
});
