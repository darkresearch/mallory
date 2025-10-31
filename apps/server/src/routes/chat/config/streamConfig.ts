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
  
  return {
    model,
    messages: convertToModelMessages(processedMessages),
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
