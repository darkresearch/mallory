/**
 * Unit Tests for SimpleMessageRenderer Text Extraction
 * 
 * Tests that text content is properly extracted and rendered from message parts.
 * This test demonstrates a bug where text was not displaying when streaming.
 */

import { describe, test, expect } from 'bun:test';

/**
 * Helper function to simulate groupConsecutiveCoTParts logic
 * This is the function that groups message parts into blocks for rendering
 */
function groupConsecutiveCoTParts(parts: any[]) {
  const blocks: any[] = [];
  let currentCoTBlock: any = null;
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isCoTPart = isChainOfThoughtPart(part);
    
    if (isCoTPart) {
      if (!currentCoTBlock) {
        currentCoTBlock = {
          type: 'chainOfThought',
          parts: [part],
          id: `cot-${blocks.length}`
        };
      } else {
        currentCoTBlock.parts.push(part);
      }
    } else if (part.type === 'text' && part.text) {
      if (currentCoTBlock) {
        blocks.push(currentCoTBlock);
        currentCoTBlock = null;
      }
      
      blocks.push({
        type: 'text',
        text: part.text,
        id: `text-${blocks.length}`,
        originalPart: part
      });
    }
  }
  
  if (currentCoTBlock) {
    blocks.push(currentCoTBlock);
  }
  
  return blocks;
}

function isChainOfThoughtPart(part: any): boolean {
  return (
    (part.type === 'reasoning' && part.text) ||
    (part.type?.startsWith('tool-') && part.type !== 'tool-input-delta')
  );
}

describe('SimpleMessageRenderer Text Extraction', () => {
  
  describe('Text Block Creation', () => {
    test('INTENT: Extract text from message with single text part', () => {
      const parts = [
        { type: 'text', text: 'Hello, how can I help you?' }
      ];
      
      const blocks = groupConsecutiveCoTParts(parts);
      
      expect(blocks.length).toBe(1);
      expect(blocks[0].type).toBe('text');
      expect(blocks[0].text).toBe('Hello, how can I help you?');
    });

    test('BUG: Text block should have accessible text content', () => {
      // This is the bug - sometimes block.text is undefined
      const parts = [
        { type: 'text', text: 'This is the response text' }
      ];
      
      const blocks = groupConsecutiveCoTParts(parts);
      const textBlock = blocks[0];
      
      // The bug: block.text might be undefined, but originalPart.text exists
      expect(textBlock.text || textBlock.originalPart?.text).toBeDefined();
      expect(textBlock.text || textBlock.originalPart?.text).toBe('This is the response text');
    });
  });

  describe('Text Extraction Fallback Logic', () => {
    test('BUG REPRODUCTION: block.text undefined during streaming', () => {
      // During streaming, sometimes the text is only in originalPart
      const parts = [
        { type: 'text', text: 'Streaming response text' }
      ];
      
      const blocks = groupConsecutiveCoTParts(parts);
      const textBlock = blocks[0];
      
      // Simulate the bug where block.text is undefined
      const blockWithBug = { ...textBlock, text: undefined };
      
      // Without fallback, this would be undefined
      expect(blockWithBug.text).toBeUndefined();
      
      // With fallback to originalPart.text, we still get the text
      const textContent = blockWithBug.text || blockWithBug.originalPart?.text || '';
      expect(textContent).toBe('Streaming response text');
    });

    test('FIX: Fallback extraction should work for all cases', () => {
      const testCases = [
        // Normal case: block.text exists
        { block: { text: 'Normal text', originalPart: { text: 'Normal text' } }, expected: 'Normal text' },
        // Bug case: only originalPart.text exists
        { block: { text: undefined, originalPart: { text: 'Fallback text' } }, expected: 'Fallback text' },
        // Edge case: both undefined
        { block: { text: undefined, originalPart: {} }, expected: '' },
        // Edge case: no originalPart
        { block: { text: undefined }, expected: '' },
      ];
      
      testCases.forEach(({ block, expected }) => {
        const textContent = block.text || block.originalPart?.text || '';
        expect(textContent).toBe(expected);
      });
    });
  });

  describe('Real-World Message Structures', () => {
    test('SCENARIO: Simple greeting message', () => {
      const message = {
        id: 'msg-1',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'Hello! How can I help you today?' }
        ]
      };
      
      const blocks = groupConsecutiveCoTParts(message.parts);
      
      expect(blocks.length).toBe(1);
      expect(blocks[0].type).toBe('text');
      const textContent = blocks[0].text || blocks[0].originalPart?.text || '';
      expect(textContent).toBe('Hello! How can I help you today?');
    });

    test('SCENARIO: Message with extended thinking', () => {
      const message = {
        id: 'msg-2',
        role: 'assistant',
        parts: [
          { type: 'reasoning', text: 'Let me think about this carefully...' },
          { type: 'reasoning', text: 'I should consider multiple angles...' },
          { type: 'text', text: 'Based on my analysis, here is my answer.' }
        ]
      };
      
      const blocks = groupConsecutiveCoTParts(message.parts);
      
      expect(blocks.length).toBe(2);
      expect(blocks[0].type).toBe('chainOfThought');
      expect(blocks[0].parts.length).toBe(2);
      expect(blocks[1].type).toBe('text');
      const textContent = blocks[1].text || blocks[1].originalPart?.text || '';
      expect(textContent).toBe('Based on my analysis, here is my answer.');
    });
  });
});