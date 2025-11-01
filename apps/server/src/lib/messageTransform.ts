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
            parts: toolResults,
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
          parts: toolResults,
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
      if (part.type === 'tool-call') {
        console.log(`    - 🔧 tool-call: ${part.toolName} (id: ${part.toolCallId})`);
      } else if (part.type === 'tool-result') {
        console.log(`    - ✅ tool-result: ${part.toolName} (id: ${part.toolCallId})`);
      } else if (part.type === 'text') {
        const preview = part.text?.substring(0, 50) || '';
        console.log(`    - 💬 text: "${preview}${preview.length >= 50 ? '...' : ''}"`);
      } else if (part.type === 'reasoning') {
        const preview = part.text?.substring(0, 50) || '';
        console.log(`    - 🧠 reasoning: "${preview}${preview.length >= 50 ? '...' : ''}"`);
      } else {
        console.log(`    - ${part.type}`);
      }
    }
  }
  
  console.log('\n' + '═'.repeat(80) + '\n');
}
