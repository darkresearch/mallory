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
  
  // For Supermemory Infinite Chat, we should only send the LATEST user message
  // Supermemory uses x-sm-conversation-id to inject relevant historical context
  // See: https://supermemory.ai/docs/ai-sdk/infinite-chat
  const latestUserMessage = messages.filter(m => m.role === 'user').slice(-1);
  
  console.log('🧠 [Supermemory] Sending this latest user message:', JSON.stringify(latestUserMessage, null, 2));

  const messagesToSend = latestUserMessage.length > 0 ? latestUserMessage : messages;
  
  // Always use Supermemory Infinite Chat Router
  // It handles context intelligently:
  // - Short conversations: pass through efficiently
  // - Long conversations: compress via RAG/summarization
  // - Massive tool results: semantic extraction
  // User scoping via x-sm-user-id header enables user-specific memory access
  console.log('🧠 [Supermemory] Sending latest message (full history: ' + messages.length + ' messages, ' + estimatedTokens.toLocaleString() + ' tokens):', {
    messagesToSend: messagesToSend.length,
    estimatedTokensForSent: estimateTotalTokens(messagesToSend).toLocaleString(),
    conversationId
  });
  
  // Custom fetch wrapper to log Supermemory compression metrics
  // Reading headers doesn't affect the response body/stream at all
  const fetchWithSupermemoryLogging: typeof fetch = async (input, init) => {
    // Log the request body for debugging
    let requestBody: any = null;
    if (init?.body) {
      try {
        requestBody = JSON.parse(init.body as string);
        console.log('📤 [Supermemory] Request body:', {
          model: requestBody.model,
          messageCount: requestBody.messages?.length,
          firstMessage: requestBody.messages?.[0] ? {
            role: requestBody.messages[0].role,
            contentType: typeof requestBody.messages[0].content,
            contentPreview: JSON.stringify(requestBody.messages[0].content).substring(0, 200)
          } : null
        });
      } catch (e) {
        console.log('📤 [Supermemory] Could not parse request body');
      }
    }
    
    const response = await fetch(input, init);
    
    // If there's an error, log the full request AND response for debugging
    if (!response.ok) {
      console.error('❌ [Supermemory] Request failed with status:', response.status);
      
      // Try to read the error response body
      const responseClone = response.clone();
      try {
        const errorBody = await responseClone.text();
        console.error('📥 [Supermemory] Error response body:', errorBody);
        
        // Try to parse if it's JSON
        try {
          const errorJson = JSON.parse(errorBody);
          if (errorJson.error?.message) {
            console.error('💥 [Supermemory] Error message:', errorJson.error.message);
          }
        } catch (e) {
          // Not JSON, already logged as text
        }
      } catch (e) {
        console.error('📥 [Supermemory] Could not read error response body');
      }
      
      // Log what WE sent
      if (requestBody) {
        console.error('📤 [Supermemory] What we sent:', JSON.stringify(requestBody.messages, null, 2));
      }
      
      // Log all response headers to see what Supermemory is telling us
      const allHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        allHeaders[key] = value;
      });
      console.error('📋 [Supermemory] Response headers:', allHeaders);
    }
    
    // Check for Supermemory compression headers
    const originalTokens = response.headers.get('x-supermemory-original-tokens');
    const finalTokens = response.headers.get('x-supermemory-final-tokens');
    const tokensSaved = response.headers.get('x-supermemory-tokens-saved');
    
    // Log compression results
    if (originalTokens && finalTokens) {
      const saved = tokensSaved ? parseInt(tokensSaved) : 0;
      const ratio = saved > 0 
        ? `${((saved / parseInt(originalTokens)) * 100).toFixed(1)}%`
        : '0%';
      
      console.log(`🧠 [Supermemory] Compressed: ${parseInt(originalTokens).toLocaleString()} → ${parseInt(finalTokens).toLocaleString()} tokens (saved ${saved.toLocaleString()} / ${ratio})`);
    } else {
      // No Supermemory headers - likely pass-through mode
      const sentTokens = estimateTotalTokens(messagesToSend);
      console.log(`🧠 [Supermemory] Pass-through mode (sent ${sentTokens.toLocaleString()} tokens, no compression headers)`);
    }
    
    return response;
  };
  
  const infiniteChatProvider = createAnthropic({
    baseURL: 'https://api.supermemory.ai/v3/https://api.anthropic.com/v1',
    apiKey: process.env.ANTHROPIC_API_KEY,
    headers: {
      'x-supermemory-api-key': supermemoryApiKey,
      'x-sm-conversation-id': conversationId,
      'x-sm-user-id': userId,
    },
    fetch: fetchWithSupermemoryLogging,
  });
  
  const model = infiniteChatProvider(claudeModel);
  
  return {
    model,
    processedMessages: messagesToSend, // Send only latest message - Supermemory injects history!
    strategy: {
      useExtendedThinking: false, // TODO: Re-enable
      useSupermemoryProxy: true,
      estimatedTokens: estimateTotalTokens(messagesToSend),
      reason: 'Supermemory Infinite Chat: latest message only, history via conversation ID'
    }
  };
}
