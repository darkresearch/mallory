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
  
  return {
    model,
    processedMessages: messages, // Send EVERYTHING - no truncation!
    strategy: {
      useExtendedThinking: true,
      useSupermemoryProxy: true,
      estimatedTokens,
      reason: 'Supermemory Memory Router handles all context management'
    }
  };
}
