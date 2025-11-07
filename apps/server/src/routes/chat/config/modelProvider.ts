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
import { withSupermemory } from '@supermemory/tools/ai-sdk';
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
  console.log('🧠 Using Supermemory Memory Router (drop-in replacement, zero config)');
  
  const infiniteChatProvider = createAnthropic({
    baseURL: 'https://api.supermemory.ai/v3/https://api.anthropic.com/v1',
    apiKey: process.env.ANTHROPIC_API_KEY,
    headers: {
      'x-supermemory-api-key': supermemoryApiKey,
      'x-sm-conversation-id': conversationId,
      'x-sm-user-id': userId,
    },
  });
  
  let model = infiniteChatProvider(claudeModel);
  
  // Wrap model with Supermemory User Profiles
  // Adds user profile + query-based memory search
  console.log('🧠 Wrapping model with Supermemory User Profiles (mode: full)');
  model = withSupermemory(model, userId, { mode: 'full' });
  
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
