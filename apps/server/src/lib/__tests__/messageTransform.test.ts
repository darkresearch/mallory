/**
 * Tests for message transformation utilities
 * Ensures tool_use and tool_result blocks are properly structured for Anthropic API
 */

import { describe, test, expect } from 'bun:test';
import { UIMessage } from 'ai';
import { 
  ensureToolMessageStructure, 
  validateToolMessageStructure,
} from '../messageTransform';

describe('messageTransform', () => {
  describe('validateToolMessageStructure', () => {
    test('validates correct structure with tool call followed by tool result', () => {
      const messages: UIMessage[] = [
        {
          id: '1',
          role: 'user',
          parts: [{ type: 'text', text: 'Search for crypto prices' }],
          content: 'Search for crypto prices'
        } as UIMessage,
        {
          id: '2',
          role: 'assistant',
          parts: [
            { type: 'text', text: 'Let me search for that' },
            { 
              type: 'tool-call', 
              toolCallId: 'call-1',
              toolName: 'searchWeb',
              args: { query: 'crypto prices' }
            }
          ],
          content: 'Let me search for that'
        } as UIMessage,
        {
          id: '3',
          role: 'user',
          parts: [
            { 
              type: 'tool-result', 
              toolCallId: 'call-1',
              toolName: 'searchWeb',
              result: { data: 'prices' }
            }
          ],
          content: ''
        } as UIMessage,
        {
          id: '4',
          role: 'assistant',
          parts: [{ type: 'text', text: 'Here are the prices...' }],
          content: 'Here are the prices...'
        } as UIMessage,
      ];

      const result = validateToolMessageStructure(messages);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('detects assistant message with both tool calls and results', () => {
      const messages: UIMessage[] = [
        {
          id: '1',
          role: 'assistant',
          parts: [
            { type: 'text', text: 'Let me search' },
            { 
              type: 'tool-call', 
              toolCallId: 'call-1',
              toolName: 'searchWeb',
              args: {}
            },
            { 
              type: 'tool-result', 
              toolCallId: 'call-1',
              toolName: 'searchWeb',
              result: {}
            },
            { type: 'text', text: 'Here is the result' }
          ],
          content: 'text'
        } as UIMessage,
      ];

      const result = validateToolMessageStructure(messages);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('both tool calls and results');
    });

    test('detects tool call without following user message', () => {
      const messages: UIMessage[] = [
        {
          id: '1',
          role: 'assistant',
          parts: [
            { 
              type: 'tool-call', 
              toolCallId: 'call-1',
              toolName: 'searchWeb',
              args: {}
            }
          ],
          content: ''
        } as UIMessage,
        {
          id: '2',
          role: 'assistant',
          parts: [{ type: 'text', text: 'More text' }],
          content: 'More text'
        } as UIMessage,
      ];

      const result = validateToolMessageStructure(messages);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('next message is not a user message');
    });

    test('detects tool result in user message without previous tool call', () => {
      const messages: UIMessage[] = [
        {
          id: '1',
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }],
          content: 'Hello'
        } as UIMessage,
        {
          id: '2',
          role: 'user',
          parts: [
            { 
              type: 'tool-result', 
              toolCallId: 'call-1',
              toolName: 'searchWeb',
              result: {}
            }
          ],
          content: ''
        } as UIMessage,
      ];

      const result = validateToolMessageStructure(messages);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('previous message is not an assistant message');
    });
  });

  describe('ensureToolMessageStructure', () => {
    test('splits assistant message with both tool calls and results', () => {
      const messages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Search for crypto' }],
          content: 'Search for crypto'
        } as UIMessage,
        {
          id: 'msg-2',
          role: 'assistant',
          parts: [
            { type: 'text', text: 'Let me search' },
            { 
              type: 'tool-call', 
              toolCallId: 'call-1',
              toolName: 'searchWeb',
              args: { query: 'crypto' }
            },
            { 
              type: 'tool-result', 
              toolCallId: 'call-1',
              toolName: 'searchWeb',
              result: { data: 'Bitcoin $50k' }
            },
            { type: 'text', text: 'Here are the results' }
          ],
          content: 'text'
        } as UIMessage,
      ];

      const result = ensureToolMessageStructure(messages);
      
      // Should split into 4 messages:
      // 1. user: "Search for crypto"
      // 2. assistant: "Let me search" + tool-call
      // 3. user: tool-result
      // 4. assistant: "Here are the results"
      expect(result.length).toBeGreaterThan(messages.length);
      
      // Find the assistant message with tool call
      const assistantWithCall = result.find(m => 
        m.role === 'assistant' && 
        m.parts?.some(p => p.type === 'tool-call')
      );
      expect(assistantWithCall).toBeDefined();
      
      // Find the user message with tool result
      const userWithResult = result.find(m => 
        m.role === 'user' && 
        m.parts?.some(p => p.type === 'tool-result')
      );
      expect(userWithResult).toBeDefined();
      
      // Verify tool result is in a separate user message
      const assistantMessages = result.filter(m => m.role === 'assistant');
      assistantMessages.forEach(msg => {
        const hasToolCall = msg.parts?.some(p => p.type === 'tool-call');
        const hasToolResult = msg.parts?.some(p => p.type === 'tool-result');
        // Assistant messages shouldn't have both
        if (hasToolCall && hasToolResult) {
          throw new Error('Assistant message still has both tool call and result');
        }
      });
    });

    test('preserves message order when splitting', () => {
      const messages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          parts: [{ type: 'text', text: 'First user message' }],
          content: 'First user message'
        } as UIMessage,
        {
          id: 'msg-2',
          role: 'assistant',
          parts: [
            { type: 'text', text: 'Assistant response' },
            { 
              type: 'tool-call', 
              toolCallId: 'call-1',
              toolName: 'tool1',
              args: {}
            },
            { 
              type: 'tool-result', 
              toolCallId: 'call-1',
              toolName: 'tool1',
              result: {}
            },
            { type: 'text', text: 'Final response' }
          ],
          content: 'text'
        } as UIMessage,
        {
          id: 'msg-3',
          role: 'user',
          parts: [{ type: 'text', text: 'Follow-up question' }],
          content: 'Follow-up question'
        } as UIMessage,
      ];

      const result = ensureToolMessageStructure(messages);
      
      // First message should still be the user message
      expect(result[0].id).toBe('msg-1');
      expect(result[0].role).toBe('user');
      
      // Last message should still be the follow-up
      expect(result[result.length - 1].id).toBe('msg-3');
      expect(result[result.length - 1].role).toBe('user');
    });

    test('handles messages without tool calls correctly', () => {
      const messages: UIMessage[] = [
        {
          id: '1',
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }],
          content: 'Hello'
        } as UIMessage,
        {
          id: '2',
          role: 'assistant',
          parts: [{ type: 'text', text: 'Hi there!' }],
          content: 'Hi there!'
        } as UIMessage,
      ];

      const result = ensureToolMessageStructure(messages);
      
      // Should not modify messages without tool calls
      expect(result).toEqual(messages);
    });

    test('handles correct structure without changes', () => {
      const messages: UIMessage[] = [
        {
          id: '1',
          role: 'assistant',
          parts: [
            { 
              type: 'tool-call', 
              toolCallId: 'call-1',
              toolName: 'searchWeb',
              args: {}
            }
          ],
          content: ''
        } as UIMessage,
        {
          id: '2',
          role: 'user',
          parts: [
            { 
              type: 'tool-result', 
              toolCallId: 'call-1',
              toolName: 'searchWeb',
              result: {}
            }
          ],
          content: ''
        } as UIMessage,
      ];

      const result = ensureToolMessageStructure(messages);
      
      // Should not modify already correct structure
      expect(result.length).toBe(messages.length);
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('2');
    });

    test('moves tool results from assistant to user message', () => {
      const messages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            { 
              type: 'tool-result', 
              toolCallId: 'call-1',
              toolName: 'searchWeb',
              result: { data: 'result' }
            },
            { type: 'text', text: 'Based on the results...' }
          ],
          content: 'text'
        } as UIMessage,
      ];

      const result = ensureToolMessageStructure(messages);
      
      // Should create a user message with the tool result
      const userMsg = result.find(m => m.role === 'user');
      expect(userMsg).toBeDefined();
      expect(userMsg?.parts?.some(p => p.type === 'tool-result')).toBe(true);
      
      // Assistant message should not have tool result anymore
      const assistantMsg = result.find(m => m.role === 'assistant');
      expect(assistantMsg?.parts?.some(p => p.type === 'tool-result')).toBe(false);
    });

    test('handles multiple tool calls and results', () => {
      const messages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            { type: 'text', text: 'Searching...' },
            { 
              type: 'tool-call', 
              toolCallId: 'call-1',
              toolName: 'tool1',
              args: {}
            },
            { 
              type: 'tool-call', 
              toolCallId: 'call-2',
              toolName: 'tool2',
              args: {}
            },
            { 
              type: 'tool-result', 
              toolCallId: 'call-1',
              toolName: 'tool1',
              result: {}
            },
            { 
              type: 'tool-result', 
              toolCallId: 'call-2',
              toolName: 'tool2',
              result: {}
            },
            { type: 'text', text: 'Results ready' }
          ],
          content: 'text'
        } as UIMessage,
      ];

      const result = ensureToolMessageStructure(messages);
      
      // Should have at least 3 messages (assistant with calls, user with results, assistant with text)
      expect(result.length).toBeGreaterThanOrEqual(3);
      
      // Verify all tool calls are in assistant message(s)
      const toolCallsInAssistant = result
        .filter(m => m.role === 'assistant')
        .flatMap(m => m.parts || [])
        .filter(p => p.type === 'tool-call');
      expect(toolCallsInAssistant.length).toBe(2);
      
      // Verify all tool results are in user message(s)
      const toolResultsInUser = result
        .filter(m => m.role === 'user')
        .flatMap(m => m.parts || [])
        .filter(p => p.type === 'tool-result');
      expect(toolResultsInUser.length).toBe(2);
    });

    test('preserves reasoning parts correctly', () => {
      const messages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            { type: 'reasoning', text: 'I need to search for this...' },
            { type: 'text', text: 'Let me check' },
            { 
              type: 'tool-call', 
              toolCallId: 'call-1',
              toolName: 'searchWeb',
              args: {}
            },
            { 
              type: 'tool-result', 
              toolCallId: 'call-1',
              toolName: 'searchWeb',
              result: {}
            },
            { type: 'reasoning', text: 'Now I can answer...' },
            { type: 'text', text: 'Here is the answer' }
          ],
          content: 'text'
        } as UIMessage,
      ];

      const result = ensureToolMessageStructure(messages);
      
      // Reasoning parts should be preserved in assistant messages
      const reasoningParts = result
        .filter(m => m.role === 'assistant')
        .flatMap(m => m.parts || [])
        .filter(p => p.type === 'reasoning');
      expect(reasoningParts.length).toBe(2);
    });
  });

  describe('integration test: complex conversation flow', () => {
    test('handles realistic multi-turn conversation with tools', () => {
      const messages: UIMessage[] = [
        // Turn 1: User asks question
        {
          id: '1',
          role: 'user',
          parts: [{ type: 'text', text: 'What is Bitcoin price?' }],
          content: 'What is Bitcoin price?'
        } as UIMessage,
        // Turn 2: Assistant with tool call (CORRECT - no result in same message)
        {
          id: '2',
          role: 'assistant',
          parts: [
            { type: 'reasoning', text: 'Need to search for current price' },
            { type: 'text', text: 'Let me check' },
            { 
              type: 'tool-call', 
              toolCallId: 'call-1',
              toolName: 'searchWeb',
              args: { query: 'bitcoin price' }
            }
          ],
          content: 'Let me check'
        } as UIMessage,
        // Turn 3: User with tool result (CORRECT)
        {
          id: '3',
          role: 'user',
          parts: [
            { 
              type: 'tool-result', 
              toolCallId: 'call-1',
              toolName: 'searchWeb',
              result: { price: '$50,000' }
            }
          ],
          content: ''
        } as UIMessage,
        // Turn 4: Assistant response
        {
          id: '4',
          role: 'assistant',
          parts: [
            { type: 'reasoning', text: 'The price is $50k' },
            { type: 'text', text: 'Bitcoin is currently trading at $50,000' }
          ],
          content: 'Bitcoin is currently trading at $50,000'
        } as UIMessage,
      ];

      const validation = validateToolMessageStructure(messages);
      expect(validation.isValid).toBe(true);
      
      const result = ensureToolMessageStructure(messages);
      // Should not modify already correct structure
      expect(result.length).toBe(messages.length);
    });

    test('fixes realistic conversation with incorrect tool structure', () => {
      const messages: UIMessage[] = [
        {
          id: '1',
          role: 'user',
          parts: [{ type: 'text', text: 'Search for Ethereum' }],
          content: 'Search for Ethereum'
        } as UIMessage,
        // INCORRECT: Both tool call and result in same assistant message
        {
          id: '2',
          role: 'assistant',
          parts: [
            { type: 'reasoning', text: 'I should search' },
            { type: 'text', text: 'Searching...' },
            { 
              type: 'tool-call', 
              toolCallId: 'call-1',
              toolName: 'searchWeb',
              args: { query: 'ethereum' }
            },
            { 
              type: 'tool-result', 
              toolCallId: 'call-1',
              toolName: 'searchWeb',
              result: { info: 'Ethereum data' }
            },
            { type: 'reasoning', text: 'Got the results' },
            { type: 'text', text: 'Here is information about Ethereum' }
          ],
          content: 'text'
        } as UIMessage,
      ];

      const validation = validateToolMessageStructure(messages);
      expect(validation.isValid).toBe(false);
      
      const result = ensureToolMessageStructure(messages);
      
      // Should have more messages after splitting
      expect(result.length).toBeGreaterThan(messages.length);
      
      // Validate the fixed structure
      const revalidation = validateToolMessageStructure(result);
      expect(revalidation.isValid).toBe(true);
      
      // Verify tool call is in assistant, result is in user
      const assistantWithCall = result.find(m => 
        m.role === 'assistant' && 
        m.parts?.some(p => p.type === 'tool-call')
      );
      expect(assistantWithCall).toBeDefined();
      
      const userWithResult = result.find(m => 
        m.role === 'user' && 
        m.parts?.some(p => p.type === 'tool-result')
      );
      expect(userWithResult).toBeDefined();
    });
  });
});
