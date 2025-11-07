import { UIMessage } from 'ai';

/**
 * Context window management utilities
 * Provides token estimation and message windowing for conversations
 */

/**
 * Estimate tokens for a UI message
 * Uses the standard ~4 characters per token heuristic
 * Now includes tool calls and tool results for accurate estimation
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
        // Tool call overhead: name + args (typically 50-200 tokens)
        const toolCallPart = part as any;
        const argsStr = JSON.stringify(toolCallPart.args || {});
        charCount += (toolCallPart.toolName?.length || 20) + argsStr.length + 50; // +50 for JSON structure
      }
      else if (part.type === 'tool-result') {
        // Tool result can be large - estimate from result data
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
  
  // ~4 characters per token + 15% overhead for JSON structure (increased from 10% for tool data)
  return Math.ceil((charCount / 4) * 1.15);
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
 * Truncate a tool result to fit within a token budget
 * @param result - The tool result to truncate
 * @param maxTokens - Maximum tokens for the result (default: 4000)
 * @returns Truncated result with metadata
 */
export function truncateToolResult(result: any, maxTokens: number = 4000): any {
  if (!result) return result;
  
  // If it's a simple value, return as-is
  if (typeof result !== 'object') {
    const str = String(result);
    const estimatedTokens = Math.ceil(str.length / 4);
    if (estimatedTokens <= maxTokens) {
      return result;
    }
    // Truncate string
    const maxChars = maxTokens * 4;
    return str.substring(0, maxChars) + `\n\n[... truncated ${str.length - maxChars} characters due to token limit]`;
  }
  
  // For objects/arrays, try to intelligently truncate
  const resultStr = JSON.stringify(result);
  const estimatedTokens = Math.ceil(resultStr.length / 4);
  
  if (estimatedTokens <= maxTokens) {
    return result; // Fits within budget
  }
  
  // Need to truncate
  console.log(`⚠️  Tool result too large (${estimatedTokens} tokens), truncating to ${maxTokens} tokens`);
  
  // For arrays, reduce the number of items
  if (Array.isArray(result)) {
    const itemTokens = Math.ceil(JSON.stringify(result[0] || {}).length / 4);
    const maxItems = Math.max(1, Math.floor((maxTokens * 0.9) / itemTokens)); // 90% of budget for items
    const truncated = result.slice(0, maxItems);
    return {
      data: truncated,
      _metadata: {
        truncated: true,
        originalCount: result.length,
        returnedCount: truncated.length,
        note: `Truncated from ${result.length} to ${truncated.length} items to fit token limit`
      }
    };
  }
  
  // For objects, try to keep structure but truncate string values
  try {
    const truncated: any = {};
    const maxChars = maxTokens * 4 * 0.8; // 80% of budget
    let currentChars = 0;
    
    for (const [key, value] of Object.entries(result)) {
      if (currentChars >= maxChars) {
        truncated._truncated = `... ${Object.keys(result).length - Object.keys(truncated).length} more fields omitted`;
        break;
      }
      
      if (typeof value === 'string' && value.length > 500) {
        truncated[key] = value.substring(0, 500) + '... [truncated]';
        currentChars += 500;
      } else {
        truncated[key] = value;
        currentChars += JSON.stringify(value).length;
      }
    }
    
    return truncated;
  } catch (e) {
    // Fallback: just truncate the JSON string
    const maxChars = maxTokens * 4;
    return resultStr.substring(0, maxChars) + '\n\n[... truncated due to token limit]';
  }
}

/**
 * Truncate tool results in messages to fit within token budget
 * @param messages - Messages to process
 * @param maxTokensPerResult - Max tokens per tool result (default: 4000)
 * @returns Messages with truncated tool results
 */
export function truncateToolResultsInMessages(
  messages: UIMessage[], 
  maxTokensPerResult: number = 4000
): UIMessage[] {
  return messages.map(message => {
    if (!message.parts || !Array.isArray(message.parts)) {
      return message;
    }
    
    const updatedParts = message.parts.map(part => {
      if (part.type === 'tool-result') {
        const toolResultPart = part as any;
        const truncatedResult = truncateToolResult(toolResultPart.result, maxTokensPerResult);
        
        // Only update if it was actually truncated
        if (truncatedResult !== toolResultPart.result) {
          console.log(`📉 Truncated tool result in message ${message.id} (${toolResultPart.toolName || 'unknown'})`);
          return {
            ...part,
            result: truncatedResult
          };
        }
      }
      return part;
    });
    
    return {
      ...message,
      parts: updatedParts
    };
  });
}

/**
 * Intelligently reduce message context to fit within token budget
 * Applies multiple strategies:
 * 1. Truncate tool results (most common cause of overflow)
 * 2. Window messages if still over budget
 * 3. Further reduce tool result size if needed
 * 
 * @param messages - Full conversation history
 * @param maxTokens - Maximum tokens to include (default: 180000 for Claude's 200k limit with buffer)
 * @returns Processed messages that fit within budget
 */
export function enforceTokenBudget(
  messages: UIMessage[],
  maxTokens: number = 180000 // Conservative limit with 20k token buffer for output + system prompt
): {
  messages: UIMessage[];
  tokensEstimate: number;
  truncatedToolResults: boolean;
  windowedMessages: boolean;
  originalTokens: number;
} {
  const originalTokens = estimateTotalTokens(messages);
  
  console.log(`🔍 Token budget enforcement: ${originalTokens} tokens (limit: ${maxTokens})`);
  
  // If we're under budget, return as-is
  if (originalTokens <= maxTokens) {
    console.log('✅ Within token budget, no truncation needed');
    return {
      messages,
      tokensEstimate: originalTokens,
      truncatedToolResults: false,
      windowedMessages: false,
      originalTokens
    };
  }
  
  // Strategy 1: Truncate tool results (most effective for tool-heavy conversations)
  console.log('📉 Step 1: Truncating tool results...');
  let processedMessages = truncateToolResultsInMessages(messages, 4000);
  let currentTokens = estimateTotalTokens(processedMessages);
  console.log(`   After tool truncation: ${currentTokens} tokens`);
  
  let windowedMessages = false;
  
  // Strategy 2: If still over budget, apply message windowing
  if (currentTokens > maxTokens) {
    console.log('📉 Step 2: Applying message windowing...');
    const windowed = windowMessages(processedMessages, maxTokens);
    processedMessages = windowed.messages;
    currentTokens = windowed.estimatedTokens;
    windowedMessages = true;
    console.log(`   After windowing: ${currentTokens} tokens (kept ${windowed.windowedCount}/${windowed.originalCount} messages)`);
  }
  
  // Strategy 3: If STILL over budget, be more aggressive with tool results
  if (currentTokens > maxTokens) {
    console.log('📉 Step 3: Aggressive tool result truncation...');
    processedMessages = truncateToolResultsInMessages(processedMessages, 1000); // Much more aggressive
    currentTokens = estimateTotalTokens(processedMessages);
    console.log(`   After aggressive truncation: ${currentTokens} tokens`);
  }
  
  // Final safety check - if still over, do emergency windowing
  if (currentTokens > maxTokens) {
    console.warn('⚠️  Emergency windowing - still over budget after all strategies');
    const emergencyWindowed = windowMessages(processedMessages, maxTokens * 0.8); // 80% of limit for safety
    processedMessages = emergencyWindowed.messages;
    currentTokens = emergencyWindowed.estimatedTokens;
    windowedMessages = true;
  }
  
  const saved = originalTokens - currentTokens;
  console.log(`✅ Token budget enforced: ${originalTokens} → ${currentTokens} tokens (saved ${saved} tokens, ${Math.round(saved/originalTokens*100)}%)`);
  
  return {
    messages: processedMessages,
    tokensEstimate: currentTokens,
    truncatedToolResults: true,
    windowedMessages,
    originalTokens
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
