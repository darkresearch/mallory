/**
 * Model provider setup with Supermemory Memory Router
 * 
 * Supermemory handles ALL context management:
 * - Intelligent compression via RAG
 * - Semantic summarization of long conversations
 * - User profile integration
 * 
 * No manual truncation/windowing needed - just pass full context!
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { UIMessage } from 'ai';
import { estimateTotalTokens } from '../../../lib/contextWindow';

interface ModelProviderResult {
  model: any;
  processedMessages: UIMessage[];
  strategy: {
    useExtendedThinking: boolean;
    useSupermemoryProxy: boolean;
    estimatedTokens: number;
    reason: string;
  };
}

/**
 * Setup model provider with Supermemory Memory Router
 * 
 * @param messages - Full conversation history (no truncation needed!)
 * @param conversationId - Conversation ID for Supermemory scoping
 * @param userId - User ID for Supermemory scoping
 * @param claudeModel - Claude model to use
 * @returns Model instance and full messages
 */
export function setupModelProvider(
  messages: UIMessage[],
  conversationId: string,
  userId: string,
  claudeModel: string
): ModelProviderResult {
  const supermemoryApiKey = process.env.SUPERMEMORY_API_KEY;
  
  if (!supermemoryApiKey) {
    throw new Error('SUPERMEMORY_API_KEY is required but not configured');
  }
  
  const estimatedTokens = estimateTotalTokens(messages);
  
  // Log conversation metrics
  console.log('📊 Conversation Metrics:', {
    totalMessages: messages.length,
    estimatedTokens,
    conversationId,
    userId
  });
  
  // Always use Supermemory Infinite Chat Router
  // It handles context intelligently:
  // - Short conversations: pass through efficiently
  // - Long conversations: compress via RAG/summarization
  // - Massive tool results: semantic extraction
  // User scoping via x-sm-user-id header enables user-specific memory access
  console.log('🧠 Using Supermemory Infinite Chat Router');
  
  const infiniteChatProvider = createAnthropic({
    baseURL: 'https://api.supermemory.ai/v3/https://api.anthropic.com/v1',
    apiKey: process.env.ANTHROPIC_API_KEY,
    headers: {
      'x-supermemory-api-key': supermemoryApiKey,
      'x-sm-conversation-id': conversationId,
      'x-sm-user-id': userId,
    },
  });
  
  const model = infiniteChatProvider(claudeModel);
  
  console.log('📤 Sending FULL conversation to Supermemory:', {
    messageCount: messages.length,
    estimatedTokens,
    note: 'Supermemory handles all compression/optimization'
  });
  
  // CRITICAL: Check if we should disable extended thinking
  // Extended thinking requires that assistant messages with tool_use have valid thinking blocks
  // (with cryptographic signatures from Claude). Historical messages may not have these.
  const shouldDisableThinking = checkIfShouldDisableExtendedThinking(messages);
  const useExtendedThinking = !shouldDisableThinking;
  
  if (shouldDisableThinking) {
    console.warn('⚠️ Disabling extended thinking for this request');
    console.warn('   Reason: Found assistant messages with tool_use but no valid thinking signature');
    console.warn('   This prevents: "messages.X.content.0.type: Expected `thinking`..." errors');
  }
  
  return {
    model,
    processedMessages: messages, // Send EVERYTHING - no truncation!
    strategy: {
      useExtendedThinking,
      useSupermemoryProxy: true,
      estimatedTokens,
      reason: shouldDisableThinking 
        ? 'Extended thinking disabled - historical messages lack thinking signatures'
        : 'Supermemory Memory Router handles all context management'
    }
  };
}

/**
 * Check if we should disable extended thinking for this conversation
 * 
 * Extended thinking requires that assistant messages with tool_use have thinking blocks
 * with valid signatures. If we detect messages that would violate this, we must disable
 * extended thinking to avoid API errors.
 */
function checkIfShouldDisableExtendedThinking(messages: UIMessage[]): boolean {
  // Find the last assistant message (the one Claude will continue from)
  let lastAssistantIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      lastAssistantIndex = i;
      break;
    }
  }
  
  if (lastAssistantIndex === -1) {
    // No assistant messages, extended thinking is fine
    return false;
  }
  
  const lastAssistantMsg = messages[lastAssistantIndex];
  
  // Check if this message has tool-call parts
  const hasToolCalls = lastAssistantMsg.parts?.some((p: any) => p.type === 'tool-call');
  
  if (!hasToolCalls) {
    // No tool calls, extended thinking is fine
    return false;
  }
  
  // Has tool calls - check if it has a thinking part with valid signature
  const hasThinkingWithSignature = lastAssistantMsg.parts?.some((p: any) => {
    if (p.type !== 'thinking' && p.type !== 'redacted_thinking') {
      return false;
    }
    // Check if it has a signature field (indicates it came from Claude, not us)
    return (p as any).signature !== undefined;
  });
  
  if (!hasThinkingWithSignature) {
    // Tool calls but no valid thinking signature - must disable extended thinking
    console.log('🔍 Last assistant message has tool_use but no valid thinking signature');
    return true;
  }
  
  return false;
}
