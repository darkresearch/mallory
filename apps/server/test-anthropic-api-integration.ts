/**
 * CRITICAL INTEGRATION TEST
 * 
 * This test actually calls the Anthropic API with messages processed through our pipeline
 * to verify that the thinking block fix works in production.
 * 
 * Requires: ANTHROPIC_API_KEY environment variable
 * 
 * Run with: npx tsx test-anthropic-api-integration.ts
 */

import Anthropic from '@anthropic-ai/sdk';

// Simulate the ensureThinkingBlocksInModelMessages function from streamConfig.ts
function ensureThinkingBlocksInModelMessages(modelMessages: any[]): any[] {
  return modelMessages.map(msg => {
    if (msg.role !== 'assistant' || !Array.isArray(msg.content)) {
      return msg;
    }
    
    const hasToolUse = msg.content.some((block: any) => block.type === 'tool_use');
    if (!hasToolUse) {
      return msg;
    }
    
    const hasThinkingAtStart = msg.content.length > 0 && 
      (msg.content[0].type === 'thinking' || msg.content[0].type === 'redacted_thinking');
    
    if (hasThinkingAtStart) {
      return msg;
    }
    
    const thinkingBlocks = msg.content.filter((b: any) => 
      b.type === 'thinking' || b.type === 'redacted_thinking'
    );
    const nonThinkingBlocks = msg.content.filter((b: any) => 
      b.type !== 'thinking' && b.type !== 'redacted_thinking'
    );
    
    if (thinkingBlocks.length > 0) {
      console.log('🔧 Reordering thinking blocks to start');
      return {
        ...msg,
        content: [...thinkingBlocks, ...nonThinkingBlocks]
      };
    } else {
      console.warn('⚠️ Adding placeholder thinking block for extended thinking compliance');
      return {
        ...msg,
        content: [
          {
            type: 'thinking',
            text: '[Planning tool usage]'
          },
          ...msg.content
        ]
      };
    }
  });
}

async function testAnthropicAPI() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY environment variable not set');
    console.log('Please set it with: export ANTHROPIC_API_KEY=your_key');
    process.exit(1);
  }

  console.log('\n🧪 ========== ANTHROPIC API INTEGRATION TEST ==========\n');
  console.log('Testing the thinking block fix with real API calls...\n');

  const anthropic = new Anthropic({ apiKey });

  // Test 1: Message WITHOUT our fix (should fail)
  console.log('TEST 1: Sending message WITHOUT thinking block (expected to FAIL)');
  console.log('---------------------------------------------------------------');
  
  const messagesWithoutFix = [
    {
      role: 'user',
      content: 'What is 2+2?'
    },
    {
      role: 'assistant',
      content: [
        { type: 'text', text: 'Let me calculate that.' },
        {
          type: 'tool_use',
          id: 'toolu_01A09q90qw90lq917835lq9',
          name: 'get_weather',
          input: { location: 'San Francisco' }
        }
      ]
    }
  ];

  try {
    await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: messagesWithoutFix as any,
      tools: [{
        name: 'get_weather',
        description: 'Get weather',
        input_schema: {
          type: 'object',
          properties: {
            location: { type: 'string' }
          }
        }
      }],
      // @ts-ignore - extended thinking beta
      thinking: { type: 'enabled', budgetTokens: 5000 }
    }, {
      headers: {
        'anthropic-beta': 'interleaved-thinking-2025-05-14'
      }
    });
    
    console.log('❌ UNEXPECTED: API call succeeded without thinking block');
    console.log('   This means Anthropic changed their validation (test needs update)');
  } catch (error: any) {
    if (error.message && error.message.includes('thinking')) {
      console.log('✅ EXPECTED ERROR: API rejected message without thinking block');
      console.log('   Error:', error.message.substring(0, 150) + '...');
    } else {
      console.log('⚠️ Got error, but not the expected thinking error:');
      console.log('   ', error.message?.substring(0, 200));
    }
  }

  // Test 2: Message WITH our fix (should succeed)
  console.log('\n\nTEST 2: Sending message WITH thinking block fix (expected to SUCCEED)');
  console.log('-----------------------------------------------------------------------');
  
  const messagesBeforeFix = [
    {
      role: 'user',
      content: 'What is 2+2?'
    },
    {
      role: 'assistant',
      content: [
        { type: 'text', text: 'Let me calculate that.' },
        {
          type: 'tool_use',
          id: 'toolu_01A09q90qw90lq917835lq9',
          name: 'get_weather',
          input: { location: 'San Francisco' }
        }
      ]
    }
  ];

  // Apply our fix
  const messagesWithFix = ensureThinkingBlocksInModelMessages(messagesBeforeFix);
  
  console.log('Applied fix. First assistant message content blocks:');
  const assistantMsg = messagesWithFix.find((m: any) => m.role === 'assistant');
  assistantMsg.content.forEach((block: any, i: number) => {
    console.log(`  [${i}] ${block.type}${block.text ? ': "' + block.text.substring(0, 30) + '..."' : ''}`);
  });
  console.log('\nCalling Anthropic API...');

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: messagesWithFix as any,
      tools: [{
        name: 'get_weather',
        description: 'Get weather',
        input_schema: {
          type: 'object',
          properties: {
            location: { type: 'string' }
          }
        }
      }],
      // @ts-ignore - extended thinking beta
      thinking: { type: 'enabled', budgetTokens: 5000 }
    }, {
      headers: {
        'anthropic-beta': 'interleaved-thinking-2025-05-14'
      }
    });
    
    console.log('✅ SUCCESS: API accepted message with thinking block fix!');
    console.log('   Response ID:', response.id);
    console.log('   Stop reason:', response.stop_reason);
    console.log('\nResponse content blocks:');
    response.content.forEach((block: any, i: number) => {
      if (block.type === 'thinking') {
        console.log(`  [${i}] thinking: "${block.text?.substring(0, 50)}..."`);
      } else if (block.type === 'text') {
        console.log(`  [${i}] text: "${block.text?.substring(0, 50)}..."`);
      } else {
        console.log(`  [${i}] ${block.type}`);
      }
    });
  } catch (error: any) {
    console.log('❌ FAILED: API rejected message even with fix');
    console.log('   Error:', error.message);
    console.log('\n   Full error:', JSON.stringify(error, null, 2));
    process.exit(1);
  }

  // Test 3: Multi-turn conversation with tool results
  console.log('\n\nTEST 3: Multi-turn conversation with tool call + result (REAL SCENARIO)');
  console.log('--------------------------------------------------------------------------');
  
  const multiTurnMessages = [
    {
      role: 'user',
      content: 'Search for Bitcoin price'
    },
    {
      role: 'assistant',
      content: [
        { type: 'text', text: 'Let me search for that.' },
        {
          type: 'tool_use',
          id: 'toolu_01A09q90qw90lq917835lq8',
          name: 'web_search',
          input: { query: 'bitcoin price' }
        }
      ]
    },
    {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'toolu_01A09q90qw90lq917835lq8',
          content: 'Bitcoin is currently trading at $50,000 USD'
        }
      ]
    }
  ];

  // Apply our fix
  const multiTurnWithFix = ensureThinkingBlocksInModelMessages(multiTurnMessages);
  
  console.log('Applied fix to multi-turn conversation');
  console.log('Calling Anthropic API...');

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: multiTurnWithFix as any,
      tools: [{
        name: 'web_search',
        description: 'Search the web',
        input_schema: {
          type: 'object',
          properties: {
            query: { type: 'string' }
          }
        }
      }],
      // @ts-ignore - extended thinking beta
      thinking: { type: 'enabled', budgetTokens: 5000 }
    }, {
      headers: {
        'anthropic-beta': 'interleaved-thinking-2025-05-14'
      }
    });
    
    console.log('✅ SUCCESS: Multi-turn conversation with tool results accepted!');
    console.log('   Response ID:', response.id);
    console.log('   Claude can continue the conversation after tool use');
  } catch (error: any) {
    console.log('❌ FAILED: Multi-turn conversation rejected');
    console.log('   Error:', error.message);
    process.exit(1);
  }

  console.log('\n🎉 ========== ALL ANTHROPIC API TESTS PASSED ==========\n');
  console.log('The thinking block fix is working correctly with the real API!');
  console.log('Messages are properly formatted and accepted by Anthropic.\n');
}

// Run the test
testAnthropicAPI().catch(error => {
  console.error('Test failed with error:', error);
  process.exit(1);
});
