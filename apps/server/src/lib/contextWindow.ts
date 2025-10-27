import { UIMessage } from 'ai';

/**
 * Context window management utilities
 * Provides token estimation and message windowing for conversations
 */

/**
 * Estimate tokens for a UI message
 * Uses the standard ~4 characters per token heuristic
 */
export function estimateMessageTokens(message: UIMessage): number {
  let charCount = 0;
  
  // Sum up all text content from message parts
  if (message.parts && Array.isArray(message.parts)) {
    for (const part of message.parts) {
      if (part.type === 'text' && part.text) {
        charCount += part.text.length;
      }
      // Could add other part types here (tool calls, etc.)
    }
  }
  
  // Fallback to content if no parts
  if (charCount === 0 && typeof (message as any).content === 'string') {
    charCount = (message as any).content.length;
  }
  
  // ~4 characters per token + 10% overhead for JSON structure
  return Math.ceil((charCount / 4) * 1.1);
}

/**
 * Estimate total tokens for an array of messages
 */
export function estimateTotalTokens(messages: UIMessage[]): number {
  return messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);
}

/**
 * Window messages to fit within a token budget
 * Keeps the most recent messages that fit within the budget
 * 
 * @param messages - Full conversation history
 * @param maxTokens - Maximum tokens to include (default: 80000)
 * @returns Windowed messages array
 */
export function windowMessages(
  messages: UIMessage[], 
  maxTokens: number = 80000
): {
  messages: UIMessage[];
  originalCount: number;
  windowedCount: number;
  estimatedTokens: number;
  droppedCount: number;
} {
  if (messages.length === 0) {
    return {
      messages: [],
      originalCount: 0,
      windowedCount: 0,
      estimatedTokens: 0,
      droppedCount: 0,
    };
  }
  
  const totalTokens = estimateTotalTokens(messages);
  
  // If we're under the limit, return everything
  if (totalTokens <= maxTokens) {
    return {
      messages,
      originalCount: messages.length,
      windowedCount: messages.length,
      estimatedTokens: totalTokens,
      droppedCount: 0,
    };
  }
  
  // Walk backwards through messages, accumulating tokens
  let accumulatedTokens = 0;
  const windowedMessages: UIMessage[] = [];
  
  for (let i = messages.length - 1; i >= 0; i--) {
    const msgTokens = estimateMessageTokens(messages[i]);
    
    // Stop if adding this message would exceed budget
    if (accumulatedTokens + msgTokens > maxTokens) {
      break;
    }
    
    windowedMessages.unshift(messages[i]); // Add to front (we're walking backwards)
    accumulatedTokens += msgTokens;
  }
  
  return {
    messages: windowedMessages,
    originalCount: messages.length,
    windowedCount: windowedMessages.length,
    estimatedTokens: accumulatedTokens,
    droppedCount: messages.length - windowedMessages.length,
  };
}

/**
 * Decide whether to use Supermemory Infinite Chat Router
 * Extended thinking is always enabled
 * 
 * @param messages - Full conversation history
 * @returns Decision object with strategy and reasoning
 */
export function decideContextStrategy(
  messages: UIMessage[]
): {
  useExtendedThinking: boolean; // Always true
  useSupermemoryProxy: boolean;
  estimatedTokens: number;
  reason: string;
} {
  const estimatedTokens = estimateTotalTokens(messages);
  
  // Decision logic
  const TOKEN_THRESHOLD = 80000; // Use router for conversations over 80k tokens
  
  if (estimatedTokens < TOKEN_THRESHOLD) {
    // Short conversation - direct to Anthropic (lower latency)
    return {
      useExtendedThinking: true,
      useSupermemoryProxy: false,
      estimatedTokens,
      reason: `Context within threshold (${estimatedTokens} < ${TOKEN_THRESHOLD} tokens), direct to Anthropic`
    };
  }
  
  // Long conversation - use Supermemory Router for context optimization
  // Extended thinking still works through the router
  return {
    useExtendedThinking: true,
    useSupermemoryProxy: true,
    estimatedTokens,
    reason: `Context exceeds threshold (${estimatedTokens} > ${TOKEN_THRESHOLD} tokens), using Infinite Chat Router`
  };
}
