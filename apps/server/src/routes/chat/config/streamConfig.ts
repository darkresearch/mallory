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
 * Build complete configuration for streamText
 */
export function buildStreamConfig(options: StreamConfigOptions) {
  const { model, processedMessages, systemPrompt, tools, strategy } = options;
  
  // Convert UIMessages to model messages
  const modelMessages = convertToModelMessages(processedMessages);
  
  // CRITICAL DEBUG: Log what we're actually sending to Anthropic API
  console.log('\n🔍 ANTHROPIC API MESSAGE STRUCTURE DEBUG:');
  console.log('═'.repeat(80));
  console.log('Total messages being sent to API:', modelMessages.length);
  
  for (let i = 0; i < modelMessages.length; i++) {
    const msg = modelMessages[i];
    console.log(`\n[${i}] ${msg.role.toUpperCase()}:`);
    
    if (Array.isArray(msg.content)) {
      console.log(`  Content array with ${msg.content.length} items:`);
      for (let j = 0; j < msg.content.length; j++) {
        const contentItem = msg.content[j];
        console.log(`    [${j}] type: ${contentItem.type}`);
        if (contentItem.type === 'text') {
          console.log(`        text preview: "${contentItem.text?.substring(0, 50)}..."`);
        } else if (contentItem.type === 'thinking' || contentItem.type === 'redacted_thinking') {
          console.log(`        thinking preview: "${contentItem.thinking?.substring(0, 50)}..."`);
        } else if (contentItem.type === 'tool_use') {
          console.log(`        tool: ${contentItem.name}`);
        } else if (contentItem.type === 'tool_result') {
          console.log(`        tool_result for: ${contentItem.tool_use_id}`);
        }
      }
    } else if (typeof msg.content === 'string') {
      console.log(`  String content: "${msg.content.substring(0, 100)}..."`);
    }
  }
  console.log('\n' + '═'.repeat(80) + '\n');
  
  return {
    model,
    messages: modelMessages,
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
