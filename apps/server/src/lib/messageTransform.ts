/**
 * Message transformation utilities for Anthropic API compatibility
 * 
 * The Anthropic API requires that tool_use blocks and tool_result blocks
 * are in separate, consecutive messages:
 * 1. Assistant message with tool_use blocks
 * 2. User message with tool_result blocks immediately after
 * 
 * However, the AI SDK's UIMessage format stores all parts in a single message.
 * This module ensures messages are properly structured before being sent to the API.
 * 
 * NOTE ON TYPE SAFETY:
 * The AI SDK's type definitions don't include all runtime part types (e.g., 'reasoning', 'thinking').
 * These types exist at runtime during streaming but aren't in the official type definitions.
 * We use `as any` type assertions where necessary to handle these runtime types safely.
 */

import { UIMessage } from 'ai';
import { v4 as uuidv4 } from 'uuid';

interface ToolCallPart {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: any;
}

interface ToolResultPart {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  result: any;
}

interface TextPart {
  type: 'text';
  text: string;
}

interface ReasoningPart {
  type: 'reasoning';
  text: string;
}

type MessagePart = ToolCallPart | ToolResultPart | TextPart | ReasoningPart | any;

/**
 * Convert reasoning parts to thinking parts for Anthropic API compatibility
 * The AI SDK uses 'reasoning' internally, but Anthropic's extended thinking API expects 'thinking'
 */
export function convertReasoningToThinking(messages: UIMessage[]): UIMessage[] {
  return messages.map(message => {
    if (!message.parts || !Array.isArray(message.parts)) {
      return message;
    }

    const convertedParts = message.parts.map(part => {
      const partType = (part as any).type;
      
      // Convert reasoning parts to thinking parts
      // Note: 'reasoning' and 'reasoning-delta' are runtime types from streaming,
      // not part of the official AI SDK types, so we use 'as any' for type safety
      if (partType === 'reasoning' || partType === 'reasoning-delta') {
        return {
          ...part,
          type: 'thinking'
        } as any;
      }
      return part;
    });

    // Only create a new message object if we actually changed something
    if (convertedParts.some((p, i) => (p as any).type !== (message.parts![i] as any).type)) {
      return {
        ...message,
        parts: convertedParts
      } as UIMessage;
    }

    return message;
  });
}

/**
 * Check if a message has tool-call parts that need tool-result responses
 */
function hasUnmatchedToolCalls(message: UIMessage): boolean {
  if (!message.parts || !Array.isArray(message.parts)) {
    return false;
  }

  const toolCallIds = new Set<string>();
  const toolResultIds = new Set<string>();

  for (const part of message.parts) {
    if (part.type === 'tool-call' && part.toolCallId) {
      toolCallIds.add(part.toolCallId);
    }
    if (part.type === 'tool-result' && part.toolCallId) {
      toolResultIds.add(part.toolCallId);
    }
  }

  // Check if any tool calls don't have matching results
  for (const callId of toolCallIds) {
    if (!toolResultIds.has(callId)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a message part is a thinking/reasoning block
 * Note: 'thinking' and 'reasoning' are runtime types that may not be in the AI SDK type definitions
 */
function isThinkingPart(part: MessagePart): boolean {
  const partType = (part as any).type;
  return partType === 'reasoning' || partType === 'thinking' || partType === 'redacted_thinking';
}

/**
 * Extract tool calls from a message's parts
 */
function extractToolCalls(parts: MessagePart[]): ToolCallPart[] {
  return parts.filter((p): p is ToolCallPart => p.type === 'tool-call' && !!p.toolCallId);
}

/**
 * Extract tool results from a message's parts
 */
function extractToolResults(parts: MessagePart[]): ToolResultPart[] {
  return parts.filter((p): p is ToolResultPart => p.type === 'tool-result' && !!p.toolCallId);
}

/**
 * Remove tool-related parts from a parts array
 */
function removeToolParts(parts: MessagePart[]): MessagePart[] {
  return parts.filter(p => p.type !== 'tool-call' && p.type !== 'tool-result');
}

/**
 * Ensure assistant messages comply with thinking block requirements
 * When extended thinking is enabled, assistant messages with tool calls must start with a thinking block
 * before any tool_use blocks.
 * 
 * Per Anthropic's extended thinking API requirements:
 * "When `thinking` is enabled, a final `assistant` message must start with a thinking block
 * (preceeding the lastmost set of `tool_use` and `tool_result` blocks)."
 * 
 * This function ensures all assistant messages with tool calls have thinking blocks properly positioned.
 * 
 * NOTE: This should be called SEPARATELY from ensureToolMessageStructure() to ensure it always runs,
 * even when tool structure validation passes.
 */
export function ensureThinkingBlockCompliance(messages: UIMessage[]): UIMessage[] {
  if (messages.length === 0) return messages;

  const result: UIMessage[] = [];
  
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    
    // Only process assistant messages
    if (message.role !== 'assistant' || !message.parts || !Array.isArray(message.parts)) {
      result.push(message);
      continue;
    }

    // Check if this message has tool calls
    const hasToolCalls = message.parts.some(p => p.type === 'tool-call');
    
    if (!hasToolCalls) {
      // No tool calls, no special handling needed
      result.push(message);
      continue;
    }
    
    // Message has tool calls - ensure thinking block is first
    const hasThinkingAtStart = message.parts.length > 0 && isThinkingPart(message.parts[0]);
    
    if (hasThinkingAtStart) {
      // Already compliant
      result.push(message);
      continue;
    }
    
    // Need to fix: either reorder or add a placeholder thinking block
    const thinkingBlocks = message.parts.filter(isThinkingPart);
    const nonThinkingParts = message.parts.filter(p => !isThinkingPart(p));
    
    if (thinkingBlocks.length > 0) {
      // Reorder: thinking blocks first, then everything else
      console.log(`🔧 [Message ${i}] Reordering thinking blocks to start of message for extended thinking compliance`);
      const reorderedMessage = {
        ...message,
        parts: [...thinkingBlocks, ...nonThinkingParts]
      };
      result.push(reorderedMessage);
    } else {
      // No thinking blocks found, but tool calls present
      // This MUST be fixed for extended thinking API compliance
      console.warn(`⚠️ [Message ${i}] Assistant message has tool calls but no thinking block - adding placeholder thinking block for API compliance`);
      
      // Add a minimal placeholder thinking block at the start
      // This is required by Anthropic's extended thinking API
      const placeholderThinking = {
        type: 'thinking',
        text: '[Planning tool usage]'
      } as any;
      
      const fixedMessage = {
        ...message,
        parts: [placeholderThinking, ...nonThinkingParts]
      };
      result.push(fixedMessage);
    }
  }

  return result;
}

/**
 * Split messages with interleaved tool calls and results into separate messages
 * to match Anthropic's expected format.
 * 
 * Example:
 * Before: [
 *   { role: 'assistant', parts: [text, tool-call, tool-result, text] }
 * ]
 * 
 * After: [
 *   { role: 'assistant', parts: [text, tool-call] },
 *   { role: 'user', parts: [tool-result] },
 *   { role: 'assistant', parts: [text] }
 * ]
 */
export function ensureToolMessageStructure(messages: UIMessage[]): UIMessage[] {
  const result: UIMessage[] = [];

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    
    // Skip if no parts or not an array
    if (!message.parts || !Array.isArray(message.parts)) {
      result.push(message);
      continue;
    }

    // Check if this is an assistant message with both tool calls and results
    if (message.role === 'assistant') {
      const toolCalls = extractToolCalls(message.parts);
      const toolResults = extractToolResults(message.parts);

      // If there are both tool calls and results, we need to split them
      if (toolCalls.length > 0 && toolResults.length > 0) {
        console.log('🔧 Splitting message with interleaved tool calls and results:', {
          messageId: message.id,
          toolCalls: toolCalls.length,
          toolResults: toolResults.length
        });

        // 1. Assistant message with text + tool calls
        const partsBeforeTool: MessagePart[] = [];
        const toolCallParts: MessagePart[] = [];
        const partsAfterTool: MessagePart[] = [];
        
        let seenToolCall = false;
        let seenToolResult = false;

        for (const part of message.parts) {
          if (part.type === 'tool-call') {
            seenToolCall = true;
            toolCallParts.push(part);
          } else if (part.type === 'tool-result') {
            seenToolResult = true;
            // Tool results will go in separate message
          } else if (!seenToolCall) {
            partsBeforeTool.push(part);
          } else if (seenToolResult) {
            partsAfterTool.push(part);
          } else {
            // Between tool call and result - keep with tool call message
            toolCallParts.push(part);
          }
        }

        // Add assistant message with tool call (if there's content or tool calls)
        if (partsBeforeTool.length > 0 || toolCallParts.length > 0) {
          result.push({
            ...message,
            id: message.id,
            parts: [...partsBeforeTool, ...toolCallParts]
          });
        }

        // Add user message with tool results
        if (toolResults.length > 0) {
          result.push({
            id: uuidv4(),
            role: 'user' as const,
            parts: toolResults as any, // Runtime tool result data
            content: '', // Tool results don't have text content
          } as UIMessage);
        }

        // Add assistant message with remaining content (if any)
        if (partsAfterTool.length > 0) {
          result.push({
            ...message,
            id: uuidv4(),
            parts: partsAfterTool
          });
        }

        continue;
      }
      
      // If assistant message has only tool calls (no results), check if results are in next message
      if (toolCalls.length > 0 && toolResults.length === 0) {
        // This is correct - tool results should be in the next user message
        result.push(message);
        continue;
      }

      // If assistant message has only tool results (no calls), this is an error state
      // Results should be in user messages
      if (toolResults.length > 0 && toolCalls.length === 0) {
        console.warn('⚠️ Found tool results in assistant message without tool calls:', {
          messageId: message.id,
          toolResults: toolResults.length
        });
        
        // Move tool results to a separate user message before this assistant message
        const userMessageWithResults: UIMessage = {
          id: uuidv4(),
          role: 'user' as const,
          parts: toolResults as any, // Runtime tool result data
          content: '',
        } as UIMessage;
        
        result.push(userMessageWithResults);
        
        // Add assistant message without tool results
        const partsWithoutToolResults = removeToolParts(message.parts);
        if (partsWithoutToolResults.length > 0) {
          result.push({
            ...message,
            parts: partsWithoutToolResults
          });
        }
        continue;
      }
    }

    // Check if this is a user message followed by an assistant message
    // where the assistant message has unmatched tool calls
    if (i < messages.length - 1) {
      const nextMessage = messages[i + 1];
      if (nextMessage.role === 'assistant' && hasUnmatchedToolCalls(nextMessage)) {
        console.warn('⚠️ Found assistant message with unmatched tool calls after user message:', {
          currentMessageId: message.id,
          nextMessageId: nextMessage.id
        });
      }
    }

    // Default: keep message as-is
    result.push(message);
  }

  // Note: ensureThinkingBlockCompliance() should be called separately after this function
  // to ensure it runs even when validation passes
  return result;
}

/**
 * Validate that tool calls and results are properly paired and ordered
 */
export function validateToolMessageStructure(messages: UIMessage[]): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    
    if (!message.parts || !Array.isArray(message.parts)) {
      continue;
    }

    // Check for tool calls in assistant messages
    if (message.role === 'assistant') {
      const toolCalls = extractToolCalls(message.parts);
      const toolResults = extractToolResults(message.parts);

      // Assistant messages shouldn't have both tool calls and results
      if (toolCalls.length > 0 && toolResults.length > 0) {
        errors.push(
          `Message ${i} (${message.id}): Assistant message has both tool calls and results. ` +
          `Tool calls and results must be in separate messages.`
        );
      }

      // If there are tool calls, the next message should be a user message with results
      if (toolCalls.length > 0 && i < messages.length - 1) {
        const nextMessage = messages[i + 1];
        if (nextMessage.role !== 'user') {
          errors.push(
            `Message ${i} (${message.id}): Assistant message has tool calls but next message is not a user message.`
          );
        } else {
          const nextToolResults = extractToolResults(nextMessage.parts || []);
          if (nextToolResults.length === 0) {
            errors.push(
              `Message ${i} (${message.id}): Assistant message has tool calls but next user message has no tool results.`
            );
          }
        }
      }

      // Assistant messages shouldn't have tool results (they should be in user messages)
      if (toolResults.length > 0 && toolCalls.length === 0) {
        errors.push(
          `Message ${i} (${message.id}): Assistant message has tool results without tool calls. ` +
          `Tool results should be in user messages.`
        );
      }
    }

    // Check for tool results in user messages
    if (message.role === 'user') {
      const toolResults = extractToolResults(message.parts);
      
      // If user message has tool results, previous message should be assistant with tool calls
      if (toolResults.length > 0 && i > 0) {
        const prevMessage = messages[i - 1];
        if (prevMessage.role !== 'assistant') {
          errors.push(
            `Message ${i} (${message.id}): User message has tool results but previous message is not an assistant message.`
          );
        } else {
          const prevToolCalls = extractToolCalls(prevMessage.parts || []);
          if (prevToolCalls.length === 0) {
            errors.push(
              `Message ${i} (${message.id}): User message has tool results but previous assistant message has no tool calls.`
            );
          }
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Log the structure of messages for debugging
 */
export function logMessageStructure(messages: UIMessage[], label: string = 'Messages') {
  console.log(`\n📋 ${label} Structure (${messages.length} messages):`);
  console.log('═'.repeat(80));
  
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const parts = message.parts || [];
    
    console.log(`\n[${i}] ${message.role.toUpperCase()} (id: ${message.id})`);
    console.log(`    Parts: ${parts.length}`);
    
    for (const part of parts) {
      const partAny = part as any; // Type assertion for accessing runtime properties
      const partType = partAny.type;
      
      if (partType === 'tool-call') {
        console.log(`    - 🔧 tool-call: ${partAny.toolName || 'unknown'} (id: ${partAny.toolCallId})`);
      } else if (partType === 'tool-result') {
        console.log(`    - ✅ tool-result: ${partAny.toolName || 'unknown'} (id: ${partAny.toolCallId})`);
      } else if (partType === 'text') {
        const preview = partAny.text?.substring(0, 50) || '';
        console.log(`    - 💬 text: "${preview}${preview.length >= 50 ? '...' : ''}"`);
      } else if (partType === 'reasoning') {
        const preview = partAny.text?.substring(0, 50) || '';
        console.log(`    - 🧠 reasoning: "${preview}${preview.length >= 50 ? '...' : ''}"`);
      } else {
        console.log(`    - ${partType}`);
      }
    }
  }
  
  console.log('\n' + '═'.repeat(80) + '\n');
}
