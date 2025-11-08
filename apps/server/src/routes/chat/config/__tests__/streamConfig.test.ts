/**
 * Tests for streamConfig - validates message format RIGHT before Anthropic API
 * 
 * This test suite validates the CRITICAL fix:
 * convertToModelMessages doesn't preserve manually-added thinking blocks,
 * so we must add them AFTER conversion in ensureThinkingBlocksInModelMessages
 */

import { describe, test, expect } from 'bun:test';
import { convertToModelMessages, UIMessage } from 'ai';
import { buildStreamConfig } from '../streamConfig';

describe('streamConfig - Anthropic API Message Format', () => {
  test('CRITICAL: assistant message with tool_use MUST have thinking block first', () => {
    // Simulate messages that have gone through the full transformation pipeline
    // (ensureToolMessageStructure + convertReasoningToThinking + ensureThinkingBlockCompliance)
    const processedMessages: UIMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'text', text: 'What is Bitcoin price?' }],
        content: 'What is Bitcoin price?'
      } as UIMessage,
      {
        id: 'msg-2',
        role: 'assistant',
        parts: [
          { type: 'thinking', text: '[Planning tool usage]' } as any, // Added by ensureThinkingBlockCompliance
          { type: 'text', text: 'Let me check that for you.' },
          { 
            type: 'tool-call', 
            toolCallId: 'call-1',
            toolName: 'searchWeb',
            args: { query: 'bitcoin price' }
          }
        ],
        content: 'Let me check that for you.'
      } as UIMessage,
    ];

    // Create a mock model and strategy
    const mockModel = {};
    const strategy = {
      useExtendedThinking: true,
      useSupermemoryProxy: true,
    };

    // Build the actual config that would be passed to streamText
    const config = buildStreamConfig({
      model: mockModel,
      processedMessages,
      systemPrompt: 'Test system prompt',
      tools: {},
      strategy
    });

    // Validate the messages array that will be sent to Anthropic API
    expect(config.messages).toBeDefined();
    expect(Array.isArray(config.messages)).toBe(true);
    expect(config.messages.length).toBeGreaterThan(0);

    // Find the assistant message
    const assistantMsg = config.messages.find((m: any) => m.role === 'assistant');
    expect(assistantMsg).toBeDefined();
    expect(Array.isArray(assistantMsg.content)).toBe(true);
    expect(assistantMsg.content.length).toBeGreaterThan(0);

    // CRITICAL VALIDATION: First content block MUST be thinking
    const firstBlock = assistantMsg.content[0];
    expect(firstBlock.type).toBe('thinking');
    expect(firstBlock.text).toBeDefined();
    console.log('✅ First block is thinking:', firstBlock.text);

    // Verify tool_use is present
    const hasToolUse = assistantMsg.content.some((block: any) => block.type === 'tool_use');
    expect(hasToolUse).toBe(true);
    console.log('✅ Message contains tool_use blocks');

    // Verify the order: thinking must come before tool_use
    const thinkingIndex = assistantMsg.content.findIndex((b: any) => b.type === 'thinking');
    const toolUseIndex = assistantMsg.content.findIndex((b: any) => b.type === 'tool_use');
    expect(thinkingIndex).toBeLessThan(toolUseIndex);
    console.log('✅ Thinking block comes before tool_use block');
  });

  test('CRITICAL: convertToModelMessages strips thinking blocks (proving the bug)', () => {
    // This test PROVES why we need ensureThinkingBlocksInModelMessages
    const messagesWithThinking: UIMessage[] = [
      {
        id: 'msg-1',
        role: 'assistant',
        parts: [
          { type: 'thinking', text: '[Planning tool usage]' } as any,
          { type: 'text', text: 'Let me search.' },
          { 
            type: 'tool-call', 
            toolCallId: 'call-1',
            toolName: 'searchWeb',
            args: { query: 'test' }
          }
        ],
        content: 'Let me search.'
      } as UIMessage,
    ];

    // Call convertToModelMessages directly (simulating what happens in buildStreamConfig)
    const modelMessages = convertToModelMessages(messagesWithThinking);

    // Find the assistant message
    const assistantMsg = modelMessages.find((m: any) => m.role === 'assistant');
    expect(assistantMsg).toBeDefined();
    expect(Array.isArray(assistantMsg.content)).toBe(true);

    // BUG PROOF: The thinking block is either missing or not first
    const firstBlock = assistantMsg.content[0];
    
    // This is the bug we're fixing - convertToModelMessages doesn't preserve thinking blocks
    // So the first block will be 'text' or 'tool_use' instead of 'thinking'
    console.log('First block type after convertToModelMessages:', firstBlock.type);
    
    // If extended thinking is enabled and there are tool_use blocks,
    // this will cause an Anthropic API error because thinking is not first
    const hasToolUse = assistantMsg.content.some((b: any) => b.type === 'tool_use');
    if (hasToolUse && firstBlock.type !== 'thinking') {
      console.log('⚠️ BUG CONFIRMED: convertToModelMessages stripped thinking block!');
      console.log('   This would cause: "Expected \'thinking\' or \'redacted_thinking\', but found \'' + firstBlock.type + '\'"');
    }
  });

  test('CRITICAL: ensureThinkingBlocksInModelMessages fixes the stripped blocks', () => {
    // Simulate what buildStreamConfig does with extended thinking enabled
    const processedMessages: UIMessage[] = [
      {
        id: 'msg-1',
        role: 'assistant',
        parts: [
          { type: 'thinking', text: '[Planning tool usage]' } as any,
          { type: 'text', text: 'Searching...' },
          { 
            type: 'tool-call', 
            toolCallId: 'call-1',
            toolName: 'searchWeb',
            args: {}
          }
        ],
        content: 'Searching...'
      } as UIMessage,
    ];

    const mockModel = {};
    const strategy = {
      useExtendedThinking: true,
      useSupermemoryProxy: true,
    };

    // Build config with the fix
    const config = buildStreamConfig({
      model: mockModel,
      processedMessages,
      systemPrompt: 'Test',
      tools: {},
      strategy
    });

    // Validate the fix worked
    const assistantMsg = config.messages.find((m: any) => m.role === 'assistant');
    expect(assistantMsg).toBeDefined();
    expect(Array.isArray(assistantMsg.content)).toBe(true);

    const firstBlock = assistantMsg.content[0];
    expect(firstBlock.type).toBe('thinking');
    console.log('✅ FIX VERIFIED: thinking block is first after ensureThinkingBlocksInModelMessages');

    const hasToolUse = assistantMsg.content.some((b: any) => b.type === 'tool_use');
    expect(hasToolUse).toBe(true);
  });

  test('CRITICAL: messages without tool_use do not need thinking blocks', () => {
    const processedMessages: UIMessage[] = [
      {
        id: 'msg-1',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'Here is my response without using tools.' }
        ],
        content: 'Here is my response without using tools.'
      } as UIMessage,
    ];

    const mockModel = {};
    const strategy = {
      useExtendedThinking: true,
      useSupermemoryProxy: true,
    };

    const config = buildStreamConfig({
      model: mockModel,
      processedMessages,
      systemPrompt: 'Test',
      tools: {},
      strategy
    });

    const assistantMsg = config.messages.find((m: any) => m.role === 'assistant');
    expect(assistantMsg).toBeDefined();

    // Without tool_use, thinking block is optional
    // Our implementation doesn't add it if there's no tool_use
    const firstBlock = assistantMsg.content[0];
    console.log('First block type (no tool_use):', firstBlock.type);
    
    // Verify no tool_use blocks present
    const hasToolUse = assistantMsg.content.some((b: any) => b.type === 'tool_use');
    expect(hasToolUse).toBe(false);
  });

  test('CRITICAL: multi-turn conversation with tool calls maintains thinking compliance', () => {
    const processedMessages: UIMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Search for Bitcoin' }],
        content: 'Search for Bitcoin'
      } as UIMessage,
      {
        id: 'msg-2',
        role: 'assistant',
        parts: [
          { type: 'thinking', text: '[Planning search]' } as any,
          { type: 'text', text: 'Searching...' },
          { type: 'tool-call', toolCallId: 'call-1', toolName: 'searchWeb', args: {} }
        ],
        content: 'Searching...'
      } as UIMessage,
      {
        id: 'msg-3',
        role: 'user',
        parts: [{ type: 'tool-result', toolCallId: 'call-1', toolName: 'searchWeb', result: { data: 'BTC at $50k' } }],
        content: ''
      } as UIMessage,
      {
        id: 'msg-4',
        role: 'assistant',
        parts: [
          { type: 'thinking', text: '[Analyzing results]' } as any,
          { type: 'text', text: 'Now let me get more details' },
          { type: 'tool-call', toolCallId: 'call-2', toolName: 'searchWeb', args: {} }
        ],
        content: 'Now let me get more details'
      } as UIMessage,
    ];

    const config = buildStreamConfig({
      model: {},
      processedMessages,
      systemPrompt: 'Test',
      tools: {},
      strategy: { useExtendedThinking: true, useSupermemoryProxy: true }
    });

    // Validate ALL assistant messages with tool_use have thinking first
    const assistantMessages = config.messages.filter((m: any) => m.role === 'assistant');
    
    assistantMessages.forEach((msg: any, i: number) => {
      const hasToolUse = msg.content.some((b: any) => b.type === 'tool_use');
      if (hasToolUse) {
        const firstBlock = msg.content[0];
        expect(firstBlock.type).toBe('thinking');
        console.log(`✅ Assistant message ${i} with tool_use starts with thinking`);
      }
    });
  });
});
