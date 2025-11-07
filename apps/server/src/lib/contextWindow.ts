import { UIMessage } from 'ai';

/**
 * Context window utilities for Supermemory integration
 * 
 * With Supermemory Infinite Chat, we don't need manual context management!
 * These utilities are kept for monitoring/logging purposes only.
 * 
 * See: https://supermemory.ai/docs/ai-sdk/infinite-chat
 */

/**
 * Estimate tokens for a UI message
 * Uses the standard ~4 characters per token heuristic
 * Includes tool calls and tool results for accurate estimation
 * 
 * NOTE: This is for logging/monitoring only. Supermemory handles actual context management.
 */
export function estimateMessageTokens(message: UIMessage): number {
  let charCount = 0;
  
  // Sum up all text content from message parts
  if (message.parts && Array.isArray(message.parts)) {
    for (const part of message.parts) {
      if (part.type === 'text' && part.text) {
        charCount += part.text.length;
      }
      // Account for tool calls and tool results
      else if (part.type === 'tool-call') {
        const toolCallPart = part as any;
        const argsStr = JSON.stringify(toolCallPart.args || {});
        charCount += (toolCallPart.toolName?.length || 20) + argsStr.length + 50;
      }
      else if (part.type === 'tool-result') {
        const toolResultPart = part as any;
        const resultStr = JSON.stringify(toolResultPart.result || {});
        charCount += resultStr.length;
      }
    }
  }
  
  // Fallback to content if no parts
  if (charCount === 0 && typeof (message as any).content === 'string') {
    charCount = (message as any).content.length;
  }
  
  // ~4 characters per token + 15% overhead for JSON structure
  return Math.ceil((charCount / 4) * 1.15);
}

/**
 * Estimate total tokens for an array of messages
 * 
 * NOTE: This is for logging/monitoring only. Supermemory handles actual context management.
 */
export function estimateTotalTokens(messages: UIMessage[]): number {
  return messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);
}
