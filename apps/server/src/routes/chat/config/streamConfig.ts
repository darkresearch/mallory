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
 * CRITICAL FIX: Remove thinking blocks WITHOUT valid signatures from request messages
 * 
 * Thinking blocks can ONLY come FROM Claude (they include cryptographic signatures).
 * When we load historical messages from the database that include thinking blocks WITHOUT
 * valid signatures, we must STRIP them before sending to Anthropic.
 * 
 * Key insight: We must strip thinking blocks that lack signatures (from old conversations),
 * but KEEP thinking blocks that have signatures (from Claude's recent responses).
 * 
 * This allows extended thinking to stay enabled for NEW responses while handling
 * historical messages correctly.
 */
function removeInvalidThinkingBlocks(modelMessages: any[]): any[] {
  return modelMessages.map(msg => {
    if (msg.role !== 'assistant' || !Array.isArray(msg.content)) {
      return msg;
    }
    
    // Remove thinking/redacted_thinking blocks that lack valid signatures
    const contentFiltered = msg.content.filter((block: any) => {
      const isThinkingBlock = block.type === 'thinking' || block.type === 'redacted_thinking';
      if (!isThinkingBlock) {
        return true; // Keep non-thinking blocks
      }
      
      // For thinking blocks, only keep if they have a valid signature
      const hasValidSignature = block.signature && typeof block.signature === 'string' && block.signature.length > 0;
      if (!hasValidSignature) {
        console.log('🔧 [Model Message] Removing thinking block without valid signature');
        return false; // Strip invalid thinking blocks
      }
      
      return true; // Keep thinking blocks with valid signatures
    });
    
    if (contentFiltered.length !== msg.content.length) {
      return {
        ...msg,
        content: contentFiltered
      };
    }
    
    return msg;
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
  
  // 🔍 CRITICAL FIX: Remove thinking blocks WITHOUT valid signatures
  // Thinking blocks can ONLY come FROM Claude (they need cryptographic signatures).
  // We strip invalid thinking blocks but KEEP valid ones (from Claude's recent responses).
  // This allows extended thinking to work for NEW messages while handling old history.
  const modelMessagesFiltered = strategy.useExtendedThinking 
    ? removeInvalidThinkingBlocks(modelMessages)
    : modelMessages;
  
  // 🔍 CRITICAL DIAGNOSTIC: Log messages AFTER convertToModelMessages
  console.log('\n🔍 ========== POST-CONVERSION MESSAGE STRUCTURE (TO ANTHROPIC) ==========');
  console.log('Message count:', modelMessagesFiltered.length);
  modelMessagesFiltered.forEach((msg: any, i: number) => {
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
    messages: modelMessagesWithoutThinking,
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
