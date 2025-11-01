/**
 * Integration test: Tool Use/Result validation in actual API calls
 * 
 * This test simulates the real-world scenario where messages with tool_use
 * blocks are loaded from the database and sent back to the API, ensuring
 * the validation prevents the API error.
 */

import { describe, test, expect } from 'bun:test';
import { UIMessage } from 'ai';
import { validateAndFixMessages } from '../../../server/src/routes/chat/config/validateMessages';

describe('Tool Use/Result Validation - Integration', () => {
  /**
   * Simulates the exact error scenario users are experiencing:
   * "messages.38: tool_use ids were found without tool_result blocks immediately after"
   */
  test('should prevent API error when tool_use blocks lack tool_result blocks', () => {
    // Simulate a conversation where an assistant message has tool_use blocks
    // but the next user message doesn't have corresponding tool_result blocks
    const messages: UIMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Search for information about TypeScript' }]
      },
      {
        id: 'msg-2',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'I will search for that' },
          { 
            type: 'tool-call', 
            toolCallId: 'toolu_013nnSt6ifVGAT6B7ENC5u3j', // Example ID from error
            toolName: 'searchWeb',
            args: { query: 'TypeScript' }
          }
        ]
      },
      // This is the problematic message - no tool_result blocks!
      {
        id: 'msg-3',
        role: 'user',
        parts: [
          { type: 'text', text: 'What did you find?' }
        ]
      }
    ];

    // Validate - should detect the error
    const result = validateAndFixMessages(messages, { 
      fixErrors: true, 
      logErrors: false 
    });

    expect(result.validation.isValid).toBe(false);
    expect(result.validation.errors.length).toBeGreaterThan(0);
    
    // Should find the specific tool_use ID
    const error = result.validation.errors.find(
      e => e.toolUseId === 'toolu_013nnSt6ifVGAT6B7ENC5u3j'
    );
    expect(error).toBeDefined();
    expect(error?.error).toContain('not found in tool_result blocks');

    // Should fix by removing the orphaned tool_use
    expect(result.fixesApplied.length).toBeGreaterThan(0);
    
    // After fixing, messages should be valid
    const fixedValidation = validateAndFixMessages(result.messages, {
      fixErrors: false,
      logErrors: false
    });
    expect(fixedValidation.validation.isValid).toBe(true);
  });

  test('should handle messages loaded from database correctly', () => {
    // Simulate messages as they would be loaded from Supabase
    // (with parts stored in metadata)
    const messagesFromDB: UIMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Get weather and search' }],
        metadata: {
          parts: [{ type: 'text', text: 'Get weather and search' }],
          source: 'user_input'
        }
      },
      {
        id: 'msg-2',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'I will do both' },
          { 
            type: 'tool-call', 
            toolCallId: 'toolu_weather',
            toolName: 'getWeather'
          },
          { 
            type: 'tool-call', 
            toolCallId: 'toolu_search',
            toolName: 'searchWeb'
          }
        ],
        metadata: {
          parts: [
            { type: 'text', text: 'I will do both' },
            { type: 'tool-call', toolCallId: 'toolu_weather', toolName: 'getWeather' },
            { type: 'tool-call', toolCallId: 'toolu_search', toolName: 'searchWeb' }
          ],
          source: 'claude_stream'
        }
      },
      {
        id: 'msg-3',
        role: 'user',
        parts: [
          { type: 'tool-result', toolCallId: 'toolu_weather', result: 'Sunny, 72°F' },
          { type: 'tool-result', toolCallId: 'toolu_search', result: 'Search results here' }
        ],
        metadata: {
          parts: [
            { type: 'tool-result', toolCallId: 'toolu_weather', result: 'Sunny, 72°F' },
            { type: 'tool-result', toolCallId: 'toolu_search', result: 'Search results here' }
          ],
          source: 'user_input'
        }
      }
    ];

    // These messages should be valid
    const result = validateAndFixMessages(messagesFromDB, {
      fixErrors: false,
      logErrors: false
    });

    expect(result.validation.isValid).toBe(true);
    expect(result.validation.errors).toHaveLength(0);
  });

  test('should handle partial tool_result blocks (missing one)', () => {
    const messages: UIMessage[] = [
      {
        id: 'msg-1',
        role: 'assistant',
        parts: [
          { type: 'tool-call', toolCallId: 'toolu_1', toolName: 'tool1' },
          { type: 'tool-call', toolCallId: 'toolu_2', toolName: 'tool2' }
        ]
      },
      {
        id: 'msg-2',
        role: 'user',
        parts: [
          // Only one tool_result, missing the other
          { type: 'tool-result', toolCallId: 'toolu_1', result: 'Result 1' }
        ]
      }
    ];

    const result = validateAndFixMessages(messages, {
      fixErrors: true,
      logErrors: false
    });

    expect(result.validation.isValid).toBe(false);
    expect(result.validation.errors.length).toBeGreaterThan(0);
    
    // Should find error for toolu_2
    const errorForTool2 = result.validation.errors.find(
      e => e.toolUseId === 'toolu_2'
    );
    expect(errorForTool2).toBeDefined();
  });

  test('should handle multiple assistant messages with tool_use', () => {
    const messages: UIMessage[] = [
      {
        id: 'msg-1',
        role: 'assistant',
        parts: [
          { type: 'tool-call', toolCallId: 'toolu_1', toolName: 'tool1' }
        ]
      },
      {
        id: 'msg-2',
        role: 'user',
        parts: [
          { type: 'tool-result', toolCallId: 'toolu_1', result: 'Result 1' }
        ]
      },
      {
        id: 'msg-3',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'Got it' },
          { type: 'tool-call', toolCallId: 'toolu_2', toolName: 'tool2' }
        ]
      },
      {
        id: 'msg-4',
        role: 'user',
        parts: [
          { type: 'tool-result', toolCallId: 'toolu_2', result: 'Result 2' }
        ]
      }
    ];

    const result = validateAndFixMessages(messages, {
      fixErrors: false,
      logErrors: false
    });

    expect(result.validation.isValid).toBe(true);
    expect(result.validation.errors).toHaveLength(0);
  });

  test('should handle empty parts array gracefully', () => {
    const messages: UIMessage[] = [
      {
        id: 'msg-1',
        role: 'assistant',
        parts: []
      },
      {
        id: 'msg-2',
        role: 'user',
        parts: []
      }
    ];

    const result = validateAndFixMessages(messages, {
      fixErrors: false,
      logErrors: false
    });

    expect(result.validation.isValid).toBe(true);
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

    const result = validateAndFixMessages(messages, {
      fixErrors: false,
      logErrors: false
    });

    expect(result.validation.isValid).toBe(true);
  });

  test('should handle edge case: tool_use at end of conversation', () => {
    // This simulates a conversation that was interrupted or incomplete
    const messages: UIMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Do something' }]
      },
      {
        id: 'msg-2',
        role: 'assistant',
        parts: [
          { type: 'tool-call', toolCallId: 'toolu_1', toolName: 'tool1' }
        ]
      }
      // No next message - conversation ended mid-tool-call
    ];

    const result = validateAndFixMessages(messages, {
      fixErrors: true,
      logErrors: false
    });

    expect(result.validation.isValid).toBe(false);
    expect(result.validation.errors.length).toBeGreaterThan(0);
    expect(result.validation.errors[0].error).toContain('without a following message');
    
    // Should fix by removing the orphaned tool_use
    expect(result.fixesApplied.length).toBeGreaterThan(0);
    
    // After fix, should be valid
    const revalidation = validateAndFixMessages(result.messages, {
      fixErrors: false,
      logErrors: false
    });
    expect(revalidation.validation.isValid).toBe(true);
  });
});
