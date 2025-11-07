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
 * Truncate a tool result to fit within a token budget.
 * 
 * NOTE: This is a low-level utility. The main intelligent prioritization logic
 * in enforceTokenBudget() dynamically calculates token limits based on priority
 * and available budget, rather than using fixed cutoffs.
 * 
 * @param result - The tool result to truncate
 * @param maxTokens - Maximum tokens for the result (determined dynamically by caller)
 * @returns Truncated result with metadata
 */
export function truncateToolResult(result: any, maxTokens: number): any {
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
 * Truncate tool results in messages to fit within token budget.
 * 
 * NOTE: This is a low-level utility for batch processing. The main intelligent
 * prioritization logic in enforceTokenBudget() calculates limits dynamically.
 * 
 * @param messages - Messages to process
 * @param maxTokensPerResult - Max tokens per tool result (determined by caller)
 * @returns Messages with truncated tool results
 */
export function truncateToolResultsInMessages(
  messages: UIMessage[], 
  maxTokensPerResult: number
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
 * Score a message for prioritization during budget enforcement
 * Higher scores = more important to keep
 * 
 * @param message - Message to score
 * @param index - Position in messages array
 * @param totalMessages - Total number of messages
 * @returns Priority score (higher = more important)
 */
function scoreMessagePriority(message: UIMessage, index: number, totalMessages: number): number {
  let score = 0;
  
  // 1. Recency is king - messages closer to end are more important
  // Last message: +1000, gradually decreases
  const recencyScore = ((index + 1) / totalMessages) * 1000;
  score += recencyScore;
  
  // 2. User messages are critical (they're the questions/context)
  if (message.role === 'user') {
    score += 500;
    
    // Recent user messages are extra important (the conversation thread)
    if (index >= totalMessages - 5) {
      score += 300;
    }
  }
  
  // 3. Assistant messages with text (actual responses) are important
  if (message.role === 'assistant') {
    const hasText = message.parts?.some(p => p.type === 'text' && (p as any).text);
    if (hasText) {
      score += 200;
    }
    
    // Recent assistant responses are more valuable
    if (index >= totalMessages - 5) {
      score += 200;
    }
  }
  
  // 4. Penalize messages with only tool results (they're useful but can be truncated)
  const hasOnlyToolResults = message.parts?.every(p => p.type === 'tool-result');
  if (hasOnlyToolResults) {
    score -= 100;
  }
  
  // 5. Tool calls (lightweight) should be preserved
  const hasToolCall = message.parts?.some(p => p.type === 'tool-call');
  if (hasToolCall) {
    score += 100;
  }
  
  return score;
}

/**
 * Intelligently reduce message context using prioritization
 * Applies progressive truncation from oldest to newest
 * 
 * Strategy:
 * 1. Score all messages by importance (recency, role, type)
 * 2. Keep recent conversation intact
 * 3. Truncate/remove old tool results first
 * 4. Only touch recent messages as last resort
 * 
 * @param messages - Full conversation history
 * @param maxTokens - Maximum tokens to include
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
  
  console.log('📉 Over budget - applying intelligent prioritization...');
  
  // Score all messages for prioritization
  const scoredMessages = messages.map((msg, idx) => ({
    message: msg,
    index: idx,
    score: scoreMessagePriority(msg, idx, messages.length),
    tokens: estimateMessageTokens(msg)
  }));
  
  // Always keep the most recent messages (critical conversation context)
  const KEEP_RECENT_COUNT = Math.min(5, messages.length);
  const recentMessages = scoredMessages.slice(-KEEP_RECENT_COUNT);
  const olderMessages = scoredMessages.slice(0, -KEEP_RECENT_COUNT);
  
  console.log(`📌 Protecting last ${KEEP_RECENT_COUNT} messages from aggressive truncation`);
  
  let processedMessages: UIMessage[] = [];
  let currentTokens = 0;
  let truncatedToolResults = false;
  let windowedMessages = false;
  
  // Calculate tokens for recent messages (always include these)
  const recentTokens = recentMessages.reduce((sum, sm) => sum + sm.tokens, 0);
  currentTokens = recentTokens;
  
  console.log(`   Recent messages: ${recentTokens} tokens (${KEEP_RECENT_COUNT} messages)`);
  
  // Strategy 1: Fit as many high-priority older messages as possible
  // Sort older messages by priority (highest priority first = keep first)
  const sortedOlderMessages = [...olderMessages].sort((a, b) => b.score - a.score);
  
  const remainingBudget = maxTokens - recentTokens;
  console.log(`   Remaining budget for older messages: ${remainingBudget} tokens`);
  
  const processedOlderMessages: UIMessage[] = [];
  let olderTokensAccumulated = 0;
  
  // First pass: fit complete messages without truncation (highest priority first)
  for (const scoredMsg of sortedOlderMessages) {
    const { message, tokens, score } = scoredMsg;
    
    if (olderTokensAccumulated + tokens <= remainingBudget) {
      // Fits completely - keep as-is
      processedOlderMessages.push(message);
      olderTokensAccumulated += tokens;
    } else {
      // Doesn't fit - we'll drop it (windowing)
      windowedMessages = true;
      console.log(`   Dropped message: ${tokens} tokens (score: ${Math.round(score)}) - doesn't fit`);
    }
  }
  
  // Strategy 2: If still over budget, we need to drop recent messages or truncate
  currentTokens = olderTokensAccumulated + recentTokens;
  
  if (currentTokens > maxTokens) {
    console.log(`⚠️  Still over budget (${currentTokens} tokens) - need to reduce recent context`);
    
    const overage = currentTokens - maxTokens;
    console.log(`   Need to save: ${overage} tokens`);
    
    // Calculate how much we need to truncate from recent tool results
    const recentMessagesWithToolResults = recentMessages.filter(sm => 
      sm.message.parts?.some(p => p.type === 'tool-result')
    );
    
    if (recentMessagesWithToolResults.length > 0) {
      // We have tool results to truncate - distribute the truncation across them
      const tokensToSavePerResult = Math.ceil(overage / recentMessagesWithToolResults.length);
      
      const processedRecentMessages: UIMessage[] = recentMessages.map(({ message, tokens }) => {
        const hasToolResults = message.parts?.some(p => p.type === 'tool-result');
        
        if (hasToolResults && currentTokens > maxTokens) {
          // Calculate target: current size minus what we need to save
          const targetTokens = Math.max(500, tokens - tokensToSavePerResult);
          const truncated = truncateToolResultsInMessage(message, targetTokens);
          const newTokens = estimateMessageTokens(truncated);
          const saved = tokens - newTokens;
          currentTokens -= saved;
          truncatedToolResults = true;
          console.log(`   Truncated recent tool result: ${tokens} → ${newTokens} tokens (saved ${saved})`);
          return truncated;
        }
        
        return message;
      });
      
      // Combine older and recent messages in correct order
      processedMessages = [
        ...processedOlderMessages.sort((a, b) => {
          const aIdx = messages.findIndex(m => m.id === a.id);
          const bIdx = messages.findIndex(m => m.id === b.id);
          return aIdx - bIdx;
        }),
        ...processedRecentMessages
      ];
    } else {
      // No tool results to truncate in recent messages - will need emergency windowing
      processedMessages = [
        ...processedOlderMessages.sort((a, b) => {
          const aIdx = messages.findIndex(m => m.id === a.id);
          const bIdx = messages.findIndex(m => m.id === b.id);
          return aIdx - bIdx;
        }),
        ...recentMessages.map(sm => sm.message)
      ];
    }
  } else {
    // Under budget - combine messages
    processedMessages = [
      ...processedOlderMessages.sort((a, b) => {
        const aIdx = messages.findIndex(m => m.id === a.id);
        const bIdx = messages.findIndex(m => m.id === b.id);
        return aIdx - bIdx;
      }),
      ...recentMessages.map(sm => sm.message)
    ];
  }
  
  // Final check - if still over, do emergency windowing (keep most recent only)
  currentTokens = estimateTotalTokens(processedMessages);
  
  if (currentTokens > maxTokens) {
    console.warn('⚠️  Emergency windowing - keeping only most recent messages');
    const windowed = windowMessages(processedMessages, maxTokens * 0.9);
    processedMessages = windowed.messages;
    currentTokens = windowed.estimatedTokens;
    windowedMessages = true;
  }
  
  const saved = originalTokens - currentTokens;
  const savedPercent = Math.round((saved / originalTokens) * 100);
  
  console.log(`✅ Token budget enforced: ${originalTokens} → ${currentTokens} tokens`);
  console.log(`   Saved: ${saved} tokens (${savedPercent}%)`);
  console.log(`   Kept: ${processedMessages.length}/${messages.length} messages`);
  console.log(`   Strategies: truncation=${truncatedToolResults}, windowing=${windowedMessages}`);
  
  return {
    messages: processedMessages,
    tokensEstimate: currentTokens,
    truncatedToolResults,
    windowedMessages,
    originalTokens
  };
}

/**
 * Truncate tool results within a single message
 * @param message - Message to process
 * @param maxTokensPerResult - Max tokens per tool result
 * @returns Message with truncated tool results
 */
function truncateToolResultsInMessage(
  message: UIMessage,
  maxTokensPerResult: number
): UIMessage {
  if (!message.parts || !Array.isArray(message.parts)) {
    return message;
  }
  
  const updatedParts = message.parts.map(part => {
    if (part.type === 'tool-result') {
      const toolResultPart = part as any;
      const truncatedResult = truncateToolResult(toolResultPart.result, maxTokensPerResult);
      
      return {
        ...part,
        result: truncatedResult
      };
    }
    return part;
  });
  
  return {
    ...message,
    parts: updatedParts
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
