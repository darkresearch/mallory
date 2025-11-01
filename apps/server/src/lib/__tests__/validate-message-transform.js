/**
 * Simple validation script to test message transformation logic
 * Can be run with: node validate-message-transform.js
 */

// Simplified versions of the transformation functions for testing
function extractToolCalls(parts) {
  return parts.filter(p => p.type === 'tool-call' && p.toolCallId);
}

function extractToolResults(parts) {
  return parts.filter(p => p.type === 'tool-result' && p.toolCallId);
}

function validateToolMessageStructure(messages) {
  const errors = [];
  
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    
    if (!message.parts || !Array.isArray(message.parts)) {
      continue;
    }

    if (message.role === 'assistant') {
      const toolCalls = extractToolCalls(message.parts);
      const toolResults = extractToolResults(message.parts);

      if (toolCalls.length > 0 && toolResults.length > 0) {
        errors.push(
          `Message ${i} (${message.id}): Assistant message has both tool calls and results. ` +
          `Tool calls and results must be in separate messages.`
        );
      }

      if (toolCalls.length > 0 && i < messages.length - 1) {
        const nextMessage = messages[i + 1];
        if (nextMessage.role !== 'user') {
          errors.push(
            `Message ${i} (${message.id}): Assistant message has tool calls but next message is not a user message.`
          );
        } else {
          const nextToolResults = extractToolResults(nextMessage.parts || []);
          if (nextToolResults.length === 0) {
            errors.push(
              `Message ${i} (${message.id}): Assistant message has tool calls but next user message has no tool results.`
            );
          }
        }
      }

      if (toolResults.length > 0 && toolCalls.length === 0) {
        errors.push(
          `Message ${i} (${message.id}): Assistant message has tool results without tool calls. ` +
          `Tool results should be in user messages.`
        );
      }
    }

    if (message.role === 'user') {
      const toolResults = extractToolResults(message.parts);
      
      if (toolResults.length > 0 && i > 0) {
        const prevMessage = messages[i - 1];
        if (prevMessage.role !== 'assistant') {
          errors.push(
            `Message ${i} (${message.id}): User message has tool results but previous message is not an assistant message.`
          );
        } else {
          const prevToolCalls = extractToolCalls(prevMessage.parts || []);
          if (prevToolCalls.length === 0) {
            errors.push(
              `Message ${i} (${message.id}): User message has tool results but previous assistant message has no tool calls.`
            );
          }
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Test cases
console.log('🧪 Testing Message Transformation Validation\n');

// Test 1: CORRECT structure
console.log('Test 1: Correct structure with tool call followed by tool result');
const correctMessages = [
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
      { type: 'tool-call', toolCallId: 'call-1', toolName: 'searchWeb', args: {} }
    ]
  },
  {
    id: '3',
    role: 'user',
    parts: [
      { type: 'tool-result', toolCallId: 'call-1', toolName: 'searchWeb', result: {} }
    ]
  },
  {
    id: '4',
    role: 'assistant',
    parts: [{ type: 'text', text: 'Here are the results' }]
  }
];

const result1 = validateToolMessageStructure(correctMessages);
console.log(`   Valid: ${result1.isValid}`);
console.log(`   Errors: ${result1.errors.length}`);
if (!result1.isValid) {
  console.log('   ❌ FAILED - should be valid');
  result1.errors.forEach(e => console.log(`      - ${e}`));
} else {
  console.log('   ✅ PASSED\n');
}

// Test 2: INCORRECT structure - both in same message
console.log('Test 2: Incorrect structure with tool call and result in same assistant message');
const incorrectMessages = [
  {
    id: '1',
    role: 'assistant',
    parts: [
      { type: 'text', text: 'Searching' },
      { type: 'tool-call', toolCallId: 'call-1', toolName: 'searchWeb', args: {} },
      { type: 'tool-result', toolCallId: 'call-1', toolName: 'searchWeb', result: {} },
      { type: 'text', text: 'Got results' }
    ]
  }
];

const result2 = validateToolMessageStructure(incorrectMessages);
console.log(`   Valid: ${result2.isValid}`);
console.log(`   Errors: ${result2.errors.length}`);
if (result2.isValid) {
  console.log('   ❌ FAILED - should be invalid');
} else {
  console.log('   ✅ PASSED');
  result2.errors.forEach(e => console.log(`      - ${e}`));
  console.log();
}

// Test 3: Missing tool result
console.log('Test 3: Tool call without following tool result');
const missingResultMessages = [
  {
    id: '1',
    role: 'assistant',
    parts: [
      { type: 'tool-call', toolCallId: 'call-1', toolName: 'searchWeb', args: {} }
    ]
  },
  {
    id: '2',
    role: 'assistant',
    parts: [{ type: 'text', text: 'More text' }]
  }
];

const result3 = validateToolMessageStructure(missingResultMessages);
console.log(`   Valid: ${result3.isValid}`);
console.log(`   Errors: ${result3.errors.length}`);
if (result3.isValid) {
  console.log('   ❌ FAILED - should be invalid');
} else {
  console.log('   ✅ PASSED');
  result3.errors.forEach(e => console.log(`      - ${e}`));
  console.log();
}

// Summary
console.log('━'.repeat(50));
const allPassed = !result1.isValid === false && 
                  !result2.isValid === true && 
                  !result3.isValid === true;

if (allPassed) {
  console.log('✅ All validation tests passed!');
} else {
  console.log('❌ Some validation tests failed');
  process.exit(1);
}
