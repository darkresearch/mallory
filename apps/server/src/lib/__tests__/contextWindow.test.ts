/**
 * Test suite for context window management and token budget enforcement
 * Tests Issue #58: Max input tokens still exceeded
 */

import { describe, test, expect } from 'bun:test';
import { 
  estimateMessageTokens, 
  estimateTotalTokens, 
  truncateToolResult,
  truncateToolResultsInMessages,
  enforceTokenBudget,
  windowMessages
} from '../contextWindow';
import type { UIMessage } from 'ai';

describe('Context Window Management - Issue #58', () => {
  describe('estimateMessageTokens', () => {
    test('estimates text messages correctly', () => {
      const message: UIMessage = {
        id: '1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hello world' }]
      };
      
      const tokens = estimateMessageTokens(message);
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(10); // "Hello world" should be ~3 tokens
    });
    
    test('estimates tool call tokens', () => {
      const message: UIMessage = {
        id: '2',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'Let me search for that' },
          { 
            type: 'tool-call', 
            toolCallId: 'call-1',
            toolName: 'searchWeb',
            args: { query: 'test query', numResults: 25 }
          } as any
        ]
      };
      
      const tokens = estimateMessageTokens(message);
      expect(tokens).toBeGreaterThan(10);
    });
    
    test('estimates tool result tokens', () => {
      const largeResult = Array(100).fill({ title: 'Result', url: 'https://example.com', content: 'x'.repeat(1000) });
      
      const message: UIMessage = {
        id: '3',
        role: 'user',
        parts: [
          {
            type: 'tool-result',
            toolCallId: 'call-1',
            toolName: 'searchWeb',
            result: largeResult
          } as any
        ]
      };
      
      const tokens = estimateMessageTokens(message);
      expect(tokens).toBeGreaterThan(20000); // Should be ~25k+ tokens
    });
  });
  
  describe('truncateToolResult', () => {
    test('does not truncate small results', () => {
      const result = { data: 'small result' };
      const truncated = truncateToolResult(result, 4000);
      expect(truncated).toEqual(result);
    });
    
    test('truncates large arrays', () => {
      const largeArray = Array(100).fill({ data: 'x'.repeat(100) });
      const truncated = truncateToolResult(largeArray, 1000);
      
      expect(Array.isArray(truncated.data)).toBe(true);
      expect(truncated.data.length).toBeLessThan(100);
      expect(truncated._metadata).toBeDefined();
      expect(truncated._metadata.truncated).toBe(true);
      expect(truncated._metadata.originalCount).toBe(100);
    });
    
    test('truncates large objects', () => {
      const largeObj: any = {};
      for (let i = 0; i < 100; i++) {
        largeObj[`field${i}`] = 'x'.repeat(1000);
      }
      
      const truncated = truncateToolResult(largeObj, 1000);
      expect(Object.keys(truncated).length).toBeLessThan(100);
    });
    
    test('truncates long strings', () => {
      const longString = 'x'.repeat(100000);
      const truncated = truncateToolResult(longString, 1000);
      
      expect(typeof truncated).toBe('string');
      expect(truncated.length).toBeLessThan(longString.length);
      expect(truncated).toContain('truncated');
    });
  });
  
  describe('truncateToolResultsInMessages', () => {
    test('truncates tool results in conversation', () => {
      const largeResult = Array(100).fill({ title: 'Result', content: 'x'.repeat(1000) });
      
      const messages: UIMessage[] = [
        {
          id: '1',
          role: 'user',
          parts: [{ type: 'text', text: 'Search for crypto' }]
        },
        {
          id: '2',
          role: 'assistant',
          parts: [
            { type: 'text', text: 'Let me search' },
            { type: 'tool-call', toolCallId: 'call-1', toolName: 'searchWeb', args: {} } as any
          ]
        },
        {
          id: '3',
          role: 'user',
          parts: [
            { type: 'tool-result', toolCallId: 'call-1', toolName: 'searchWeb', result: largeResult } as any
          ]
        },
        {
          id: '4',
          role: 'assistant',
          parts: [{ type: 'text', text: 'Here are the results' }]
        }
      ];
      
      const truncated = truncateToolResultsInMessages(messages, 2000);
      
      // Check that tool result was truncated
      const toolResultMsg = truncated.find(m => m.id === '3');
      expect(toolResultMsg).toBeDefined();
      const toolResultPart = toolResultMsg!.parts.find(p => p.type === 'tool-result') as any;
      expect(toolResultPart.result).toBeDefined();
      
      // Result should be smaller
      const originalSize = JSON.stringify(largeResult).length;
      const truncatedSize = JSON.stringify(toolResultPart.result).length;
      expect(truncatedSize).toBeLessThan(originalSize);
    });
  });
  
  describe('enforceTokenBudget - The Fix for Issue #58', () => {
    test('allows conversations under budget', () => {
      const messages: UIMessage[] = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
        { id: '2', role: 'assistant', parts: [{ type: 'text', text: 'Hi there!' }] }
      ];
      
      const result = enforceTokenBudget(messages, 10000);
      
      expect(result.messages.length).toBe(2);
      expect(result.truncatedToolResults).toBe(false);
      expect(result.windowedMessages).toBe(false);
    });
    
    test('truncates tool results when over budget', () => {
      const hugeToolResult = Array(1000).fill({ content: 'x'.repeat(1000) });
      
      const messages: UIMessage[] = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Search' }] },
        { id: '2', role: 'assistant', parts: [
          { type: 'tool-call', toolCallId: 'call-1', toolName: 'searchWeb', args: {} } as any
        ]},
        { id: '3', role: 'user', parts: [
          { type: 'tool-result', toolCallId: 'call-1', result: hugeToolResult } as any
        ]},
        { id: '4', role: 'assistant', parts: [{ type: 'text', text: 'Results...' }] }
      ];
      
      const originalTokens = estimateTotalTokens(messages);
      expect(originalTokens).toBeGreaterThan(50000); // Should be way over budget
      
      const result = enforceTokenBudget(messages, 10000);
      
      expect(result.tokensEstimate).toBeLessThan(originalTokens);
      expect(result.tokensEstimate).toBeLessThanOrEqual(10000);
      expect(result.truncatedToolResults).toBe(true);
      expect(result.messages.length).toBeGreaterThan(0);
    });
    
    test('windows messages if tool truncation is not enough', () => {
      // Create many messages with tool results
      const messages: UIMessage[] = [];
      
      for (let i = 0; i < 100; i++) {
        messages.push({
          id: `user-${i}`,
          role: 'user',
          parts: [{ type: 'text', text: 'x'.repeat(1000) }]
        });
        messages.push({
          id: `assistant-${i}`,
          role: 'assistant',
          parts: [{ type: 'text', text: 'y'.repeat(1000) }]
        });
      }
      
      const originalTokens = estimateTotalTokens(messages);
      expect(originalTokens).toBeGreaterThan(50000);
      
      const result = enforceTokenBudget(messages, 20000);
      
      expect(result.tokensEstimate).toBeLessThanOrEqual(20000);
      expect(result.messages.length).toBeLessThan(messages.length);
      expect(result.windowedMessages).toBe(true);
    });
    
    test('handles extreme edge case: single massive tool result', () => {
      const massiveResult = 'x'.repeat(1000000); // 1M chars = ~250k tokens
      
      const messages: UIMessage[] = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Query' }] },
        { id: '2', role: 'assistant', parts: [
          { type: 'tool-call', toolCallId: 'call-1', toolName: 'tool', args: {} } as any
        ]},
        { id: '3', role: 'user', parts: [
          { type: 'tool-result', toolCallId: 'call-1', result: massiveResult } as any
        ]}
      ];
      
      const result = enforceTokenBudget(messages, 10000);
      
      // Should not throw and should return messages under budget
      expect(result.messages.length).toBeGreaterThan(0);
      expect(result.tokensEstimate).toBeLessThanOrEqual(10000);
    });
    
    test('preserves message structure after budget enforcement', () => {
      const messages: UIMessage[] = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
        { id: '2', role: 'assistant', parts: [{ type: 'text', text: 'Hi!' }] }
      ];
      
      const result = enforceTokenBudget(messages);
      
      // Should maintain message structure
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[1].role).toBe('assistant');
      expect(result.messages[0].parts).toBeDefined();
      expect(result.messages[1].parts).toBeDefined();
    });
  });
  
  describe('Integration: Realistic conversation with tools', () => {
    test('handles conversation with multiple Nansen tool calls', () => {
      // Simulate a realistic conversation with Nansen tools
      const nansenResult = {
        data: Array(50).fill({
          address: '0x' + 'a'.repeat(40),
          balance: '1000000',
          tokens: Array(20).fill({ symbol: 'TOKEN', amount: '100' }),
          transactions: Array(100).fill({ hash: '0x' + 'b'.repeat(64), value: '1000' })
        })
      };
      
      const messages: UIMessage[] = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Show me smart money activity' }] },
        { id: '2', role: 'assistant', parts: [
          { type: 'text', text: 'Let me fetch that data' },
          { type: 'tool-call', toolCallId: 'call-1', toolName: 'nansenSmartMoneyNetflows', args: {} } as any
        ]},
        { id: '3', role: 'user', parts: [
          { type: 'tool-result', toolCallId: 'call-1', result: nansenResult } as any
        ]},
        { id: '4', role: 'assistant', parts: [{ type: 'text', text: 'Here is the analysis...' + 'x'.repeat(5000) }] },
        { id: '5', role: 'user', parts: [{ type: 'text', text: 'Show me more details on specific wallets' }] },
        { id: '6', role: 'assistant', parts: [
          { type: 'tool-call', toolCallId: 'call-2', toolName: 'nansenHistoricalBalances', args: {} } as any
        ]},
        { id: '7', role: 'user', parts: [
          { type: 'tool-result', toolCallId: 'call-2', result: nansenResult } as any
        ]},
        { id: '8', role: 'assistant', parts: [{ type: 'text', text: 'Additional analysis...' + 'y'.repeat(5000) }] }
      ];
      
      const originalTokens = estimateTotalTokens(messages);
      console.log(`Original conversation: ${originalTokens} tokens`);
      
      // With a 180k budget (Claude's safe limit), this should be handled gracefully
      const result = enforceTokenBudget(messages, 180000);
      
      expect(result.tokensEstimate).toBeLessThanOrEqual(180000);
      expect(result.messages.length).toBeGreaterThan(0);
      
      console.log(`After enforcement: ${result.tokensEstimate} tokens (${result.messages.length} messages)`);
      console.log(`Savings: ${originalTokens - result.tokensEstimate} tokens (${Math.round((originalTokens - result.tokensEstimate)/originalTokens*100)}%)`);
    });
  });
});
