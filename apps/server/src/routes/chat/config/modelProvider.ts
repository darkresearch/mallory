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
  
  // First, enforce token budget to prevent "max input tokens exceeded" errors
  // This is critical - tool results can cause massive token overflow
  const budgetResult = enforceTokenBudget(messages);
  const { messages: budgetedMessages, tokensEstimate, truncatedToolResults, windowedMessages: wasWindowed, originalTokens } = budgetResult;
  
  if (truncatedToolResults || wasWindowed) {
    console.log('🛡️  Token budget protection applied:', {
      originalTokens,
      finalTokens: tokensEstimate,
      saved: originalTokens - tokensEstimate,
      truncatedToolResults,
      windowedMessages: wasWindowed
    });
  }
  
  // Intelligent strategy decision (uses the budgeted messages for accurate token count)
  const strategy = decideContextStrategy(budgetedMessages);
  
  // Log conversation size metrics
  console.log('📊 Conversation Metrics:', {
    totalMessages: messages.length,
    budgetedMessages: budgetedMessages.length,
    estimatedTokens: tokensEstimate,
    conversationId,
    userId
  });
  
  console.log('🎯 Context Strategy Decision:', {
    useExtendedThinking: strategy.useExtendedThinking,
    useSupermemoryProxy: strategy.useSupermemoryProxy,
    estimatedTokens: strategy.estimatedTokens,
    reason: strategy.reason,
    messageCount: budgetedMessages.length
  });
  
  // Setup model and process messages based on strategy
  let model;
  let processedMessages = budgetedMessages; // Use the budgeted messages
  
  if (supermemoryApiKey && strategy.useSupermemoryProxy) {
    // Long conversation: Use Supermemory Infinite Chat Router
    // Extended thinking works through the router - no windowing needed
    console.log('🧠 Using Supermemory Infinite Chat Router (extended thinking enabled)');
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
    // Send all budgeted messages - Router handles context optimization via RAG
  } else if (supermemoryApiKey) {
    // Normal conversation: Direct to Anthropic with extended thinking
    console.log('💭 Direct to Anthropic (extended thinking enabled)');
    model = anthropic(claudeModel);
    // Messages already budgeted, no further windowing needed
  } else {
    // Fallback: No Supermemory available, must window manually
    console.log('⚠️  SUPERMEMORY_API_KEY not set, using windowing fallback');
    model = anthropic(claudeModel);
    // If we haven't already windowed, do it now
    if (!wasWindowed && tokensEstimate > 80000) {
      const windowed = windowMessages(processedMessages, 80000);
      processedMessages = windowed.messages;
      console.log('✂️  Windowed conversation:', windowed);
    }
  }
  
  // Wrap model with Supermemory User Profiles (full mode = profile + query-based search)
  if (supermemoryApiKey) {
    console.log('🧠 Wrapping model with Supermemory User Profiles (mode: full)');
    model = withSupermemory(model, userId, { mode: 'full' });
  }
  
  // Log what's actually being sent to the LLM
  const finalTokenEstimate = estimateTotalTokens(processedMessages);
  console.log('📤 Context Being Sent to LLM:', {
    messageCount: processedMessages.length,
    estimatedTokens: finalTokenEstimate,
    isWindowed: processedMessages.length < messages.length,
    droppedMessages: messages.length - processedMessages.length,
    usingProxy: strategy.useSupermemoryProxy,
    usingProfiles: !!supermemoryApiKey
  });
  
  // Warning if context is very large (should be rare after budget enforcement)
  if (finalTokenEstimate > 200000) {
    console.warn('⚠️  WARNING: Context size exceeds 200K tokens even after budget enforcement!', {
      estimatedTokens: finalTokenEstimate,
      messageCount: processedMessages.length,
      strategy: strategy.reason
    });
  } else if (finalTokenEstimate > 180000) {
    console.warn('⚠️  WARNING: Context size is approaching 200K token limit', {
      estimatedTokens: finalTokenEstimate,
      messageCount: processedMessages.length,
      headroom: 200000 - finalTokenEstimate
    });
  }
  
  return {
    model,
    processedMessages,
    strategy
  };
}
