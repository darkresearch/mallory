/**
 * StreamText configuration builder
 * Assembles all options for the AI streaming call
 */

import { convertToModelMessages, UIMessage, stepCountIs } from 'ai';
import { AnthropicProviderOptions } from '@ai-sdk/anthropic';
import { getToolDisplayName, formatToolResultsForLog } from '../../../lib/toolDisplayNames';

interface StreamConfigOptions {
  model: any;
  processedMessages: UIMessage[];
  systemPrompt: string;
  tools: any;
  strategy: {
    useExtendedThinking: boolean;
    useSupermemoryProxy: boolean;
  };
}

/**
 * Ensure assistant messages in Anthropic format have thinking blocks first
 * This must be done AFTER convertToModelMessages because that function doesn't preserve
 * manually-added thinking blocks in UIMessage parts.
 */
function ensureThinkingBlocksInModelMessages(modelMessages: any[]): any[] {
  return modelMessages.map(msg => {
    // Only process assistant messages
    if (msg.role !== 'assistant' || !Array.isArray(msg.content)) {
      return msg;
    }
    
    // Check if this message has tool_use blocks
    const hasToolUse = msg.content.some((block: any) => block.type === 'tool_use');
    
    if (!hasToolUse) {
      // No tool use - no special handling needed
      return msg;
    }
    
    // Message has tool_use - ensure thinking block is first
    const hasThinkingAtStart = msg.content.length > 0 && 
      (msg.content[0].type === 'thinking' || msg.content[0].type === 'redacted_thinking');
    
    if (hasThinkingAtStart) {
      // Already compliant
      return msg;
    }
    
    // Check if there are any thinking blocks elsewhere
    const thinkingBlocks = msg.content.filter((b: any) => 
      b.type === 'thinking' || b.type === 'redacted_thinking'
    );
    const nonThinkingBlocks = msg.content.filter((b: any) => 
      b.type !== 'thinking' && b.type !== 'redacted_thinking'
    );
    
    if (thinkingBlocks.length > 0) {
      // Reorder: thinking blocks first
      console.log('🔧 [Model Message] Reordering thinking blocks to start');
      return {
        ...msg,
        content: [...thinkingBlocks, ...nonThinkingBlocks]
      };
    } else {
      // No thinking blocks - add placeholder
      console.warn('⚠️ [Model Message] Adding placeholder thinking block for extended thinking compliance');
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

/**
 * Build complete configuration for streamText
 */
export function buildStreamConfig(options: StreamConfigOptions) {
  const { model, processedMessages, systemPrompt, tools, strategy } = options;
  
  // 🔍 CRITICAL DIAGNOSTIC: Log messages BEFORE convertToModelMessages
  console.log('\n🔍 ========== PRE-CONVERSION MESSAGE STRUCTURE ==========');
  processedMessages.forEach((msg, i) => {
    console.log(`\n[${i}] ${msg.role.toUpperCase()} (id: ${msg.id})`);
    console.log(`    Parts count: ${msg.parts?.length || 0}`);
    msg.parts?.forEach((part, j) => {
      const partType = (part as any).type;
      if (partType === 'thinking' || partType === 'reasoning') {
        console.log(`    [${j}] ${partType}: "${(part as any).text?.substring(0, 50)}..."`);
      } else if (partType === 'tool-call') {
        console.log(`    [${j}] tool-call: ${(part as any).toolName}`);
      } else if (partType === 'text') {
        console.log(`    [${j}] text: "${(part as any).text?.substring(0, 50)}..."`);
      } else {
        console.log(`    [${j}] ${partType}`);
      }
    });
  });
  console.log('\n🔍 ===================================================\n');
  
  // Convert UIMessages to model messages
  const modelMessages = convertToModelMessages(processedMessages);
  
  // 🔍 CRITICAL FIX: Ensure thinking blocks are present in model messages
  // This must be done AFTER convertToModelMessages because that function doesn't
  // properly preserve manually-added thinking blocks from UIMessage parts
  const modelMessagesWithThinking = strategy.useExtendedThinking 
    ? ensureThinkingBlocksInModelMessages(modelMessages)
    : modelMessages;
  
  // 🔍 CRITICAL DIAGNOSTIC: Log messages AFTER convertToModelMessages
  console.log('\n🔍 ========== POST-CONVERSION MESSAGE STRUCTURE (TO ANTHROPIC) ==========');
  console.log('Message count:', modelMessagesWithThinking.length);
  modelMessagesWithThinking.forEach((msg: any, i: number) => {
    console.log(`\n[${i}] ${msg.role.toUpperCase()}`);
    if (Array.isArray(msg.content)) {
      console.log(`    Content blocks: ${msg.content.length}`);
      msg.content.forEach((block: any, j: number) => {
        if (block.type === 'thinking') {
          console.log(`    [${j}] THINKING: "${block.text?.substring(0, 50)}..."`);
        } else if (block.type === 'text') {
          console.log(`    [${j}] TEXT: "${block.text?.substring(0, 50)}..."`);
        } else if (block.type === 'tool_use') {
          console.log(`    [${j}] TOOL_USE: ${block.name} (id: ${block.id})`);
        } else if (block.type === 'tool_result') {
          console.log(`    [${j}] TOOL_RESULT: (id: ${block.tool_use_id})`);
        } else {
          console.log(`    [${j}] ${block.type}`);
        }
      });
    } else if (typeof msg.content === 'string') {
      console.log(`    Content (string): "${msg.content.substring(0, 50)}..."`);
    } else {
      console.log(`    Content: ${typeof msg.content}`);
    }
  });
  console.log('\n🔍 ===================================================\n');
  
  return {
    model,
    messages: modelMessagesWithThinking,
    system: systemPrompt,
    temperature: 0.7,
    
    tools,
    
    // Multi-step reasoning
    stopWhen: stepCountIs(10),
    
    // Agent lifecycle hooks for monitoring
    onStepFinish: ({ text, toolCalls, toolResults, finishReason, ...step }: any) => {
      const stepNumber = (step as any).stepNumber || 'unknown';
      console.log(`🤖 AGENT STEP ${stepNumber} COMPLETED:`);
      console.log('- Text generated:', !!text);
      console.log('- Tool calls:', toolCalls.length, toolCalls.length > 0 ? `(${toolCalls.map((tc: any) => getToolDisplayName(tc.toolName)).join(', ')})` : '');
      console.log('- Tool results:', toolResults.length);
      console.log('- Finish reason:', finishReason);
      console.log('- Step text preview:', text?.substring(0, 100) + '...');
      
      // Debug: Why is the agent stopping?
      if (finishReason === 'tool-calls' && toolResults.length > 0) {
        console.log('🚨 AGENT ISSUE: Finished after tool calls without generating response!');
        console.log('- Tool results available:', formatToolResultsForLog(toolResults));
        console.log('- Expected: AI should continue to generate response using these results');
        console.log('- Full tool results:', JSON.stringify(toolResults, null, 2));
      }
    },
    
    // Enable extended thinking based on smart strategy decision
    ...(strategy.useExtendedThinking ? {
      headers: {
        'anthropic-beta': 'interleaved-thinking-2025-05-14',
      },
      providerOptions: {
        anthropic: {
          thinking: { type: 'enabled', budgetTokens: 15000 },
          sendReasoning: true,
        } satisfies AnthropicProviderOptions,
      },
    } : {}),
    
    onError: (error: any) => {
      console.error('❌ AI streaming error:', error);
    }
  };
}
