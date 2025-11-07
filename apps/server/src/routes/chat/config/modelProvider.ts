/**
 * Model provider setup with smart context strategy
 * Decides between Extended Thinking vs Supermemory based on conversation state
 */

import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { UIMessage } from 'ai';
import { withSupermemory } from '@supermemory/tools/ai-sdk';
import { decideContextStrategy, windowMessages, estimateTotalTokens, enforceTokenBudget } from '../../../lib/contextWindow';

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
 * Setup the appropriate model provider based on conversation context
 * 
 * @param messages - Full conversation history
 * @param conversationId - Conversation ID for Supermemory scoping
 * @param userId - User ID for Supermemory scoping
 * @param claudeModel - Claude model to use
 * @returns Model instance and processed messages
 */
export function setupModelProvider(
  messages: UIMessage[],
  conversationId: string,
  userId: string,
  claudeModel: string
): ModelProviderResult {
  const supermemoryApiKey = process.env.SUPERMEMORY_API_KEY;
  const estimatedTokens = estimateTotalTokens(messages);
  
  // Log conversation size metrics
  console.log('📊 Conversation Metrics:', {
    totalMessages: messages.length,
    estimatedTokens,
    conversationId,
    userId
  });
  
  // Setup model and process messages based on whether Supermemory is available
  let model;
  let processedMessages = messages;
  let strategy: {
    useExtendedThinking: boolean;
    useSupermemoryProxy: boolean;
    estimatedTokens: number;
    reason: string;
  };
  
  if (supermemoryApiKey) {
    // ALWAYS use Supermemory Infinite Chat Router when available
    // It intelligently handles context optimization:
    // - Short convos: passes through efficiently
    // - Long convos: compresses/optimizes via RAG
    // - No need for arbitrary thresholds!
    console.log('🧠 Using Supermemory Infinite Chat Router (always-on, context-aware)');
    const infiniteChatProvider = createAnthropic({
      baseURL: 'https://api.supermemory.ai/v3/https://api.anthropic.com/v1',
      apiKey: process.env.ANTHROPIC_API_KEY,
      headers: {
        'x-supermemory-api-key': supermemoryApiKey,
        'x-sm-conversation-id': conversationId,
        'x-sm-user-id': userId,
      },
    });
    model = infiniteChatProvider(claudeModel);
    
    // Wrap model with Supermemory User Profiles (full mode = profile + query-based search)
    console.log('🧠 Wrapping model with Supermemory User Profiles (mode: full)');
    model = withSupermemory(model, userId, { mode: 'full' });
    
    strategy = {
      useExtendedThinking: true,
      useSupermemoryProxy: true,
      estimatedTokens,
      reason: 'Using Supermemory Infinite Chat Router for intelligent context optimization'
    };
    
    // Send ALL messages - let Supermemory handle compression intelligently
    processedMessages = messages;
  } else {
    // Fallback: No Supermemory available - use our intelligent truncation
    console.log('⚠️  SUPERMEMORY_API_KEY not set - using fallback token budget enforcement');
    
    const budgetResult = enforceTokenBudget(messages);
    processedMessages = budgetResult.messages;
    
    if (budgetResult.truncatedToolResults || budgetResult.windowedMessages) {
      console.log('🛡️  Token budget protection applied:', {
        originalTokens: budgetResult.originalTokens,
        finalTokens: budgetResult.tokensEstimate,
        saved: budgetResult.originalTokens - budgetResult.tokensEstimate,
        truncatedToolResults: budgetResult.truncatedToolResults,
        windowedMessages: budgetResult.windowedMessages
      });
    }
    
    model = anthropic(claudeModel);
    
    strategy = {
      useExtendedThinking: true,
      useSupermemoryProxy: false,
      estimatedTokens: budgetResult.tokensEstimate,
      reason: 'No Supermemory - using local token budget enforcement'
    };
  }
  
  console.log('🎯 Context Strategy:', {
    useExtendedThinking: strategy.useExtendedThinking,
    useSupermemoryProxy: strategy.useSupermemoryProxy,
    estimatedTokens: strategy.estimatedTokens,
    reason: strategy.reason,
    messageCount: processedMessages.length
  });
  
  // Log what's actually being sent
  const finalTokenEstimate = estimateTotalTokens(processedMessages);
  console.log('📤 Context Being Sent:', {
    messageCount: processedMessages.length,
    estimatedTokens: finalTokenEstimate,
    droppedMessages: messages.length - processedMessages.length,
    usingSupermemory: !!supermemoryApiKey
  });
  
  return {
    model,
    processedMessages,
    strategy
  };
}
