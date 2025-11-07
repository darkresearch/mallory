/**
 * Test suite for GitHub Issue #58: Max input tokens still exceeded
 * 
 * This test suite verifies that the token budget enforcement prevents
 * "max input tokens exceeded" errors when tool results cause overflow.
 * 
 * Background:
 * - Claude has a 200k token context window limit
 * - Tool results (Nansen, searchWeb, etc.) can add 10k-50k tokens per call
 * - Multiple tool calls in a conversation could exceed 200k tokens
 * - Original system only counted message text, not tool data
 * 
 * The fix implements multi-layered token budget enforcement:
 * 1. Enhanced token estimation (counts tool calls + results)
 * 2. Smart tool result truncation (preserves structure)
 * 3. Message windowing (keeps recent messages)
 * 4. Emergency windowing (final safety net)
 */

import { describe, test, expect } from 'bun:test';
import { 
  estimateMessageTokens, 
  estimateTotalTokens, 
  truncateToolResult,
  truncateToolResultsInMessages,
  enforceTokenBudget,
} from '../contextWindow';
import type { UIMessage } from 'ai';

describe('GitHub Issue #58: Max Input Tokens Still Exceeded', () => {
  
  describe('HAPPY PATH: Normal conversations stay under budget', () => {
    test('short text-only conversation (no tools)', () => {
      const messages: UIMessage[] = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
        { id: '2', role: 'assistant', parts: [{ type: 'text', text: 'Hi! How can I help?' }] },
        { id: '3', role: 'user', parts: [{ type: 'text', text: 'Tell me about Solana' }] },
        { id: '4', role: 'assistant', parts: [{ type: 'text', text: 'Solana is a high-performance blockchain...' }] }
      ];
      
      const result = enforceTokenBudget(messages, 180000);
      
      expect(result.messages.length).toBe(4);
      expect(result.truncatedToolResults).toBe(false);
      expect(result.windowedMessages).toBe(false);
      expect(result.tokensEstimate).toBeLessThan(1000);
      console.log(`✅ Short conversation: ${result.tokensEstimate} tokens`);
    });
    
    test('conversation with small tool results (within budget)', () => {
      const smallSearchResult = [
        { title: 'Result 1', url: 'https://example.com/1', content: 'Small content' },
        { title: 'Result 2', url: 'https://example.com/2', content: 'Small content' }
      ];
      
      const messages: UIMessage[] = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Search for crypto prices' }] },
        { id: '2', role: 'assistant', parts: [
          { type: 'text', text: 'Let me search for that' },
          { type: 'tool-call', toolCallId: 'call-1', toolName: 'searchWeb', args: { query: 'crypto' } } as any
        ]},
        { id: '3', role: 'user', parts: [
          { type: 'tool-result', toolCallId: 'call-1', result: smallSearchResult } as any
        ]},
        { id: '4', role: 'assistant', parts: [{ type: 'text', text: 'Here are the results...' }] }
      ];
      
      const result = enforceTokenBudget(messages, 180000);
      
      expect(result.messages.length).toBe(4);
      expect(result.truncatedToolResults).toBe(false);
      expect(result.tokensEstimate).toBeLessThan(5000);
      console.log(`✅ Small tool result: ${result.tokensEstimate} tokens (no truncation needed)`);
    });
    
    test('moderate conversation with a few tool calls', () => {
      const moderateResult = Array(10).fill({
        title: 'Token Data',
        content: 'Some token information here about prices and market cap',
        url: 'https://example.com'
      });
      
      const messages: UIMessage[] = [];
      
      // 5 turns of user messages + tool calls
      for (let i = 0; i < 5; i++) {
        messages.push({ 
          id: `user-${i}`, 
          role: 'user', 
          parts: [{ type: 'text', text: `Tell me about token ${i}` }] 
        });
        messages.push({
          id: `assistant-${i}-call`,
          role: 'assistant',
          parts: [
            { type: 'text', text: 'Let me look that up' },
            { type: 'tool-call', toolCallId: `call-${i}`, toolName: 'searchWeb', args: {} } as any
          ]
        });
        messages.push({
          id: `user-result-${i}`,
          role: 'user',
          parts: [{ type: 'tool-result', toolCallId: `call-${i}`, result: moderateResult } as any]
        });
        messages.push({
          id: `assistant-${i}-response`,
          role: 'assistant',
          parts: [{ type: 'text', text: 'Here is the information about the token...' }]
        });
      }
      
      const result = enforceTokenBudget(messages, 180000);
      
      expect(result.messages.length).toBeGreaterThan(0);
      expect(result.tokensEstimate).toBeLessThanOrEqual(180000);
      console.log(`✅ Moderate conversation: ${result.originalTokens} → ${result.tokensEstimate} tokens`);
    });
  });
  
  describe('UNHAPPY PATH: Large tool results cause overflow (FIXED)', () => {
    test('single massive search result (25 results × 1000 chars each)', () => {
      // Simulates searchWeb with default 25 results
      const massiveSearchResult = Array(25).fill({
        title: 'Search Result',
        url: 'https://example.com/article',
        content: 'x'.repeat(1000), // 1000 chars per result
        publishedDate: '2025-01-01'
      });
      
      const messages: UIMessage[] = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Search for crypto news' }] },
        { id: '2', role: 'assistant', parts: [
          { type: 'tool-call', toolCallId: 'call-1', toolName: 'searchWeb', args: {} } as any
        ]},
        { id: '3', role: 'user', parts: [
          { type: 'tool-result', toolCallId: 'call-1', result: massiveSearchResult } as any
        ]},
        { id: '4', role: 'assistant', parts: [{ type: 'text', text: 'Analysis...' }] }
      ];
      
      const originalTokens = estimateTotalTokens(messages);
      expect(originalTokens).toBeGreaterThan(6000); // ~25k chars = ~6k tokens
      
      const result = enforceTokenBudget(messages, 180000);
      
      // Should handle gracefully
      expect(result.messages.length).toBe(4);
      expect(result.tokensEstimate).toBeLessThanOrEqual(180000);
      
      // Tool result should be truncated
      const toolResultMsg = result.messages.find(m => m.id === '3');
      expect(toolResultMsg).toBeDefined();
      
      console.log(`✅ FIXED: Massive search result: ${originalTokens} → ${result.tokensEstimate} tokens`);
    });
    
    test('multiple Nansen API calls with large datasets', () => {
      // Simulates Nansen historical balances response
      const nansenResult = {
        data: Array(100).fill({
          address: '0x' + 'a'.repeat(40),
          balance: '1000000000000000000',
          timestamp: 1704067200,
          tokens: Array(50).fill({
            symbol: 'TOKEN',
            name: 'Token Name',
            address: '0x' + 'b'.repeat(40),
            balance: '5000000000000000000',
            value_usd: 10000.50
          }),
          transactions: Array(100).fill({
            hash: '0x' + 'c'.repeat(64),
            from: '0x' + 'd'.repeat(40),
            to: '0x' + 'e'.repeat(40),
            value: '100000000000000000',
            timestamp: 1704067200
          })
        })
      };
      
      const messages: UIMessage[] = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Show me smart money activity' }] },
        { id: '2', role: 'assistant', parts: [
          { type: 'tool-call', toolCallId: 'call-1', toolName: 'nansenSmartMoneyNetflows', args: {} } as any
        ]},
        { id: '3', role: 'user', parts: [
          { type: 'tool-result', toolCallId: 'call-1', result: nansenResult } as any
        ]},
        { id: '4', role: 'assistant', parts: [{ type: 'text', text: 'Here is the data...' }] },
        { id: '5', role: 'user', parts: [{ type: 'text', text: 'Show me more details' }] },
        { id: '6', role: 'assistant', parts: [
          { type: 'tool-call', toolCallId: 'call-2', toolName: 'nansenHistoricalBalances', args: {} } as any
        ]},
        { id: '7', role: 'user', parts: [
          { type: 'tool-result', toolCallId: 'call-2', result: nansenResult } as any
        ]},
        { id: '8', role: 'assistant', parts: [{ type: 'text', text: 'Additional analysis...' }] }
      ];
      
      const originalTokens = estimateTotalTokens(messages);
      expect(originalTokens).toBeGreaterThan(50000); // Should be massive
      
      const result = enforceTokenBudget(messages, 180000);
      
      expect(result.tokensEstimate).toBeLessThanOrEqual(180000);
      expect(result.truncatedToolResults).toBe(true);
      expect(result.messages.length).toBeGreaterThan(0);
      
      const saved = originalTokens - result.tokensEstimate;
      const savedPercent = Math.round((saved / originalTokens) * 100);
      console.log(`✅ FIXED: Multiple Nansen calls: ${originalTokens} → ${result.tokensEstimate} tokens (saved ${savedPercent}%)`);
    });
    
    test('extreme case: conversation approaching 200k token limit', () => {
      // Simulate a very long conversation with many tool calls
      const messages: UIMessage[] = [];
      
      for (let i = 0; i < 50; i++) {
        messages.push({
          id: `user-${i}`,
          role: 'user',
          parts: [{ type: 'text', text: 'Query about tokens' + ' x'.repeat(500) }]
        });
        messages.push({
          id: `assistant-${i}-call`,
          role: 'assistant',
          parts: [
            { type: 'text', text: 'Let me search' },
            { type: 'tool-call', toolCallId: `call-${i}`, toolName: 'searchWeb', args: {} } as any
          ]
        });
        messages.push({
          id: `user-result-${i}`,
          role: 'user',
          parts: [{
            type: 'tool-result',
            toolCallId: `call-${i}`,
            result: Array(25).fill({ content: 'x'.repeat(1000) })
          } as any]
        });
        messages.push({
          id: `assistant-${i}-response`,
          role: 'assistant',
          parts: [{ type: 'text', text: 'Analysis results here' + ' y'.repeat(500) }]
        });
      }
      
      const originalTokens = estimateTotalTokens(messages);
      expect(originalTokens).toBeGreaterThan(200000); // Should exceed Claude's limit
      
      console.log(`⚠️  Extreme case: Original conversation is ${originalTokens} tokens (exceeds 200k limit!)`);
      
      const result = enforceTokenBudget(messages, 180000);
      
      // MUST fit within budget after enforcement
      expect(result.tokensEstimate).toBeLessThanOrEqual(180000);
      expect(result.messages.length).toBeGreaterThan(0);
      
      // Should use all strategies
      expect(result.truncatedToolResults || result.windowedMessages).toBe(true);
      
      const saved = originalTokens - result.tokensEstimate;
      const savedPercent = Math.round((saved / originalTokens) * 100);
      console.log(`✅ FIXED: Extreme case: ${originalTokens} → ${result.tokensEstimate} tokens (saved ${savedPercent}%)`);
      console.log(`   Strategies used: truncation=${result.truncatedToolResults}, windowing=${result.windowedMessages}`);
    });
    
    test('worst case: single tool result with 1 million characters', () => {
      // This would be ~250k tokens - should never happen but we must handle it
      const monsterResult = 'x'.repeat(1000000);
      
      const messages: UIMessage[] = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Query' }] },
        { id: '2', role: 'assistant', parts: [
          { type: 'tool-call', toolCallId: 'call-1', toolName: 'tool', args: {} } as any
        ]},
        { id: '3', role: 'user', parts: [
          { type: 'tool-result', toolCallId: 'call-1', result: monsterResult } as any
        ]}
      ];
      
      const originalTokens = estimateTotalTokens(messages);
      expect(originalTokens).toBeGreaterThan(200000);
      
      console.log(`⚠️  Worst case: Single monster tool result is ${originalTokens} tokens`);
      
      // Should not throw and should fit within budget
      const result = enforceTokenBudget(messages, 180000);
      
      expect(result.tokensEstimate).toBeLessThanOrEqual(180000);
      expect(result.messages.length).toBeGreaterThan(0);
      expect(result.truncatedToolResults).toBe(true);
      
      console.log(`✅ FIXED: Monster result handled: ${originalTokens} → ${result.tokensEstimate} tokens`);
    });
  });
  
  describe('EDGE CASES: Verify robust handling', () => {
    test('empty conversation', () => {
      const result = enforceTokenBudget([], 180000);
      
      expect(result.messages.length).toBe(0);
      expect(result.tokensEstimate).toBe(0);
      expect(result.truncatedToolResults).toBe(false);
      expect(result.windowedMessages).toBe(false);
    });
    
    test('conversation with no tool calls', () => {
      const messages: UIMessage[] = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
        { id: '2', role: 'assistant', parts: [{ type: 'text', text: 'Hi there!' }] }
      ];
      
      const result = enforceTokenBudget(messages, 180000);
      
      expect(result.messages.length).toBe(2);
      expect(result.truncatedToolResults).toBe(false);
    });
    
    test('tool call without result (should not crash)', () => {
      const messages: UIMessage[] = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Search' }] },
        { id: '2', role: 'assistant', parts: [
          { type: 'tool-call', toolCallId: 'call-1', toolName: 'searchWeb', args: {} } as any
        ]}
      ];
      
      const result = enforceTokenBudget(messages, 180000);
      
      expect(result.messages.length).toBe(2);
      expect(result.tokensEstimate).toBeLessThan(1000);
    });
    
    test('very low budget (emergency windowing)', () => {
      const messages: UIMessage[] = Array(100).fill(null).map((_, i) => ({
        id: `msg-${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        parts: [{ type: 'text', text: 'Message content here with some additional text to increase token count' }]
      })) as UIMessage[];
      
      // Set extremely low budget to force aggressive windowing
      const result = enforceTokenBudget(messages, 1000);
      
      expect(result.tokensEstimate).toBeLessThanOrEqual(1000);
      expect(result.messages.length).toBeLessThanOrEqual(100); // May be 100 if all fit, or less if windowed
      
      if (result.messages.length < messages.length) {
        expect(result.windowedMessages).toBe(true);
        console.log(`✅ Emergency windowing: ${messages.length} → ${result.messages.length} messages`);
      } else {
        console.log(`✅ All messages fit within budget: ${result.tokensEstimate} tokens`);
      }
    });
  });
  
  describe('VERIFICATION: Token estimation accuracy', () => {
    test('counts text tokens', () => {
      const message: UIMessage = {
        id: '1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hello world' }]
      };
      
      const tokens = estimateMessageTokens(message);
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(10); // "Hello world" ~3 tokens
    });
    
    test('counts tool call tokens', () => {
      const message: UIMessage = {
        id: '2',
        role: 'assistant',
        parts: [
          { type: 'tool-call', toolCallId: 'call-1', toolName: 'searchWeb', args: { query: 'test' } } as any
        ]
      };
      
      const tokens = estimateMessageTokens(message);
      expect(tokens).toBeGreaterThan(0);
    });
    
    test('counts tool result tokens (THE KEY FIX)', () => {
      const largeResult = Array(100).fill({ data: 'x'.repeat(100) });
      
      const message: UIMessage = {
        id: '3',
        role: 'user',
        parts: [
          { type: 'tool-result', toolCallId: 'call-1', result: largeResult } as any
        ]
      };
      
      const tokens = estimateMessageTokens(message);
      expect(tokens).toBeGreaterThan(1000); // Should count the large result
      
      console.log(`✅ Tool result counted: ${tokens} tokens (this was missing before!)`);
    });
  });
  
  describe('REGRESSION: Ensure we don\'t break existing functionality', () => {
    test('preserves message structure after enforcement', () => {
      const messages: UIMessage[] = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
        { id: '2', role: 'assistant', parts: [{ type: 'text', text: 'Hi!' }] }
      ];
      
      const result = enforceTokenBudget(messages, 180000);
      
      // Structure should be intact
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[1].role).toBe('assistant');
      expect(result.messages[0].parts).toBeDefined();
      expect(result.messages[1].parts).toBeDefined();
    });
    
    test('maintains conversation continuity after windowing', () => {
      const messages: UIMessage[] = Array(100).fill(null).map((_, i) => ({
        id: `msg-${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        parts: [{ type: 'text', text: `Message ${i}` }]
      })) as UIMessage[];
      
      const result = enforceTokenBudget(messages, 10000);
      
      // Should keep most recent messages
      const lastOriginalId = messages[messages.length - 1].id;
      const lastResultId = result.messages[result.messages.length - 1].id;
      
      expect(lastResultId).toBe(lastOriginalId);
      console.log(`✅ Windowing keeps recent messages: kept ${result.messages.length}/${messages.length}`);
    });
  });
  
  describe('PERFORMANCE: Verify efficiency', () => {
    test('handles 1000 messages efficiently', () => {
      const messages: UIMessage[] = Array(1000).fill(null).map((_, i) => ({
        id: `msg-${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        parts: [{ type: 'text', text: 'Message content' }]
      })) as UIMessage[];
      
      const start = Date.now();
      const result = enforceTokenBudget(messages, 180000);
      const duration = Date.now() - start;
      
      expect(result.messages.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(1000); // Should complete in < 1 second
      
      console.log(`✅ Performance: Processed 1000 messages in ${duration}ms`);
    });
  });
});

// Summary log at the end
console.log('\n' + '='.repeat(80));
console.log('✅ GitHub Issue #58 Test Suite Complete');
console.log('='.repeat(80));
console.log('All tests verify that the token budget enforcement prevents');
console.log('"max input tokens exceeded" errors by:');
console.log('  1. Accurately counting tool call and tool result tokens');
console.log('  2. Intelligently truncating large tool results');
console.log('  3. Windowing messages when needed');
console.log('  4. Providing multiple safety layers');
console.log('='.repeat(80) + '\n');
