/**
 * Model provider setup with Infinite Memory
 * 
 * Infinite Memory handles context retrieval:
 * - Semantic retrieval via OpenMemory
 * - Smart hybrid strategy (recent + relevant)
 * - Token-aware budget management
 * 
 * Storage happens explicitly after messages are saved to Supabase
 */

import { createInfiniteMemory } from 'infinite-memory';
import type { UIMessage } from 'ai';
import { estimateTotalTokens } from '../../../lib/contextWindow';
import { v4 as uuidv4 } from 'uuid';

interface ModelProviderResult {
  model: any;
  processedMessages: UIMessage[];
  strategy: {
    useExtendedThinking: boolean;
    useInfiniteMemory: boolean;
    estimatedTokens: number;
    reason: string;
  };
}

// Initialize Infinite Memory provider once at module level
let infiniteMemory: ReturnType<typeof createInfiniteMemory> | null = null;

export async function getInfiniteMemory(): Promise<ReturnType<typeof createInfiniteMemory>> {
  if (!infiniteMemory) {
    const openMemoryUrl = process.env.OPENMEMORY_URL || 'http://localhost:8765';
    const openMemoryApiKey = process.env.OPENMEMORY_API_KEY;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    if (!openMemoryApiKey) {
      throw new Error('OPENMEMORY_API_KEY is required but not configured');
    }

    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY is required but not configured');
    }

    infiniteMemory = createInfiniteMemory({
      openMemoryUrl,
      openMemoryApiKey,
      anthropicApiKey,
      openMemoryTimeout: 2000, // 2 second timeout for localhost
    });

    console.log('✨ [InfiniteMemory] Provider initialized');
  }

  return infiniteMemory;
}

/**
 * Setup model provider with Infinite Memory
 * 
 * Gets relevant context from OpenMemory and returns Anthropic model
 * 
 * @param messages - Full conversation history (from client)
 * @param conversationId - Conversation ID for memory scoping
 * @param userId - User ID for memory scoping
 * @param claudeModel - Claude model to use
 * @returns Model instance and context-enriched messages
 */
export async function setupModelProvider(
  messages: UIMessage[],
  conversationId: string,
  userId: string,
  claudeModel: string
): Promise<ModelProviderResult> {
  const estimatedTokens = estimateTotalTokens(messages);
  
  console.log(`🧠 [InfiniteMemory] Full conversation: ${messages.length} messages, ${estimatedTokens.toLocaleString()} tokens`);
  
  // Get or create the infinite memory provider
  const memory = await getInfiniteMemory();
  
  // Get relevant context from OpenMemory
  // This retrieves recent + semantically relevant messages
  const contextResult = await memory.getRelevantContext(
    conversationId,
    userId,
    messages as any,
    claudeModel
  );
  
  console.log(`📝 [InfiniteMemory] Context: ${contextResult.messages.length} messages${contextResult.historicalContext ? ' + historical context' : ''}`);
  console.log(`📊 [InfiniteMemory] Source: ${contextResult.metadata.usedOpenMemory ? 'OpenMemory' : 'Fallback (recent only)'}`);
  
  // Get the Anthropic model
  const model = memory.getModel(claudeModel);
  
  // Convert CoreMessages back to UIMessages (preserve parts structure)
  let uiMessages = contextResult.messages.map((msg: any) => {
    // If message already has parts array (from client), preserve it
    if (msg.parts) {
      return msg;
    }
    
    // Otherwise convert content to parts format
    const content = msg.content;
    if (typeof content === 'string') {
      return {
        role: msg.role,
        parts: [{ type: 'text', text: content }],
      };
    } else if (Array.isArray(content)) {
      // Content is already a parts array
      return {
        role: msg.role,
        parts: content,
      };
    }
    
    return msg;
  });

  // Inject historical context as a system message before the recent messages
  if (contextResult.historicalContext) {
    const contextMessage: UIMessage = {
      id: uuidv4(),
      role: 'user',
      parts: [{
        type: 'text',
        text: `[CONTEXT FROM PAST CONVERSATIONS]\n${contextResult.historicalContext}\n\n[END CONTEXT - Continue with current conversation]`,
      }],
    };
    
    // Insert context before the first recent message
    uiMessages = [contextMessage, ...uiMessages];
    
    console.log('📝 [InfiniteMemory] Injected historical context as system message');
  }

  return {
    model,
    processedMessages: uiMessages as UIMessage[],
    strategy: {
      useExtendedThinking: false,
      useInfiniteMemory: true,
      estimatedTokens: contextResult.metadata.estimatedTokens,
      reason: contextResult.metadata.usedOpenMemory 
        ? `Infinite Memory: ${contextResult.metadata.retrievedCount} memories + ${contextResult.metadata.recentCount} recent` 
        : 'Infinite Memory: fallback to recent messages'
    }
  };
}
