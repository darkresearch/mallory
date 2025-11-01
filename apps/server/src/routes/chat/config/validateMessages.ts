/**
 * Message validation utilities
 * Ensures tool_use blocks have corresponding tool_result blocks
 * 
 * Anthropic API requirement: Each tool_use block MUST be immediately followed
 * by a tool_result block in the next message (user role).
 */

import { UIMessage } from 'ai';

/**
 * Extract tool_use IDs from an assistant message
 */
function extractToolUseIds(message: UIMessage): string[] {
  if (message.role !== 'assistant') {
    return [];
  }

  const toolUseIds: string[] = [];
  
  // Check parts array for tool-use parts
  if (message.parts && Array.isArray(message.parts)) {
    for (const part of message.parts) {
      // Tool use parts can be in different formats:
      // 1. { type: 'tool-call', toolCallId: '...' }
      // 2. { type: 'tool-use', id: '...' } (Anthropic format)
      // 3. In content array: { type: 'tool_use', id: '...' }
      
      if (part.type === 'tool-call' && (part as any).toolCallId) {
        toolUseIds.push((part as any).toolCallId);
      } else if (part.type === 'tool-use' && (part as any).id) {
        toolUseIds.push((part as any).id);
      } else if ((part as any).type === 'tool_use' && (part as any).id) {
        toolUseIds.push((part as any).id);
      }
    }
  }

  // Also check content array if it exists (Anthropic format)
  if ((message as any).content && Array.isArray((message as any).content)) {
    for (const item of (message as any).content) {
      if (item.type === 'tool_use' && item.id) {
        toolUseIds.push(item.id);
      }
    }
  }

  return toolUseIds;
}

/**
 * Extract tool_result IDs from a user message
 */
function extractToolResultIds(message: UIMessage): string[] {
  if (message.role !== 'user') {
    return [];
  }

  const toolResultIds: string[] = [];
  
  // Check parts array for tool-result parts
  if (message.parts && Array.isArray(message.parts)) {
    for (const part of message.parts) {
      // Tool result parts can be in different formats:
      // 1. { type: 'tool-result', toolCallId: '...' }
      // 2. { type: 'tool-result', id: '...' } (Anthropic format)
      // 3. In content array: { type: 'tool_result', id: '...' }
      
      if (part.type === 'tool-result' && (part as any).toolCallId) {
        toolResultIds.push((part as any).toolCallId);
      } else if (part.type === 'tool-result' && (part as any).id) {
        toolResultIds.push((part as any).id);
      } else if ((part as any).type === 'tool_result' && (part as any).id) {
        toolResultIds.push((part as any).id);
      }
    }
  }

  // Also check content array if it exists (Anthropic format)
  if ((message as any).content && Array.isArray((message as any).content)) {
    for (const item of (message as any).content) {
      if (item.type === 'tool_result' && item.tool_use_id) {
        toolResultIds.push(item.tool_use_id);
      } else if (item.type === 'tool_result' && item.id) {
        toolResultIds.push(item.id);
      }
    }
  }

  return toolResultIds;
}

/**
 * Validate that tool_use blocks have corresponding tool_result blocks
 * Returns validation result with details
 */
export function validateToolUsePairs(messages: UIMessage[]): {
  isValid: boolean;
  errors: Array<{
    messageIndex: number;
    messageId: string;
    toolUseId: string;
    error: string;
  }>;
  warnings: Array<{
    messageIndex: number;
    messageId: string;
    warning: string;
  }>;
} {
  const errors: Array<{
    messageIndex: number;
    messageId: string;
    toolUseId: string;
    error: string;
  }> = [];
  const warnings: Array<{
    messageIndex: number;
    messageId: string;
    warning: string;
  }> = [];

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    
    // Only check assistant messages for tool_use
    if (message.role === 'assistant') {
      const toolUseIds = extractToolUseIds(message);
      
      if (toolUseIds.length > 0) {
        // Check if next message is user with tool_result blocks
        const nextMessage = messages[i + 1];
        
        if (!nextMessage) {
          // Assistant message with tool_use but no next message
          for (const toolUseId of toolUseIds) {
            errors.push({
              messageIndex: i,
              messageId: message.id || `message-${i}`,
              toolUseId,
              error: 'tool_use block found without a following message containing tool_result'
            });
          }
        } else if (nextMessage.role !== 'user') {
          // Next message is not user role
          for (const toolUseId of toolUseIds) {
            errors.push({
              messageIndex: i,
              messageId: message.id || `message-${i}`,
              toolUseId,
              error: `tool_use block found but next message is ${nextMessage.role} (expected user with tool_result)`
            });
          }
        } else {
          // Next message is user - check for tool_result blocks
          const toolResultIds = extractToolResultIds(nextMessage);
          
          // Check if all tool_use IDs have corresponding tool_result IDs
          for (const toolUseId of toolUseIds) {
            if (!toolResultIds.includes(toolUseId)) {
              errors.push({
                messageIndex: i,
                messageId: message.id || `message-${i}`,
                toolUseId,
                error: `tool_use id "${toolUseId}" not found in tool_result blocks of next message`
              });
            }
          }
          
          // Warn about extra tool_result IDs (not an error, but might indicate issues)
          for (const toolResultId of toolResultIds) {
            if (!toolUseIds.includes(toolResultId)) {
              warnings.push({
                messageIndex: i + 1,
                messageId: nextMessage.id || `message-${i + 1}`,
                warning: `tool_result id "${toolResultId}" found without corresponding tool_use in previous message`
              });
            }
          }
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Fix messages by removing orphaned tool_use blocks
 * This is a safety measure - ideally messages should be fixed upstream
 * 
 * Strategy: If an assistant message has tool_use blocks without corresponding
 * tool_result blocks, we remove those tool_use parts to prevent API errors
 */
export function fixToolUsePairs(messages: UIMessage[]): {
  fixedMessages: UIMessage[];
  fixesApplied: Array<{
    messageIndex: number;
    messageId: string;
    toolUseId: string;
    fix: string;
  }>;
} {
  const fixesApplied: Array<{
    messageIndex: number;
    messageId: string;
    toolUseId: string;
    fix: string;
  }> = [];
  
  const fixedMessages = messages.map((message, index) => {
    // Only fix assistant messages
    if (message.role !== 'assistant') {
      return message;
    }

    const toolUseIds = extractToolUseIds(message);
    
    if (toolUseIds.length === 0) {
      return message;
    }

    // Check if next message has corresponding tool_result blocks
    const nextMessage = messages[index + 1];
    const hasValidNextMessage = nextMessage && 
                                nextMessage.role === 'user' &&
                                extractToolResultIds(nextMessage).length > 0;

    if (!hasValidNextMessage) {
      // No valid next message with tool_result - remove tool_use parts
      console.warn(`⚠️ Removing orphaned tool_use blocks from message ${message.id || index}:`, {
        toolUseIds,
        reason: 'No corresponding tool_result blocks found in next message'
      });

      // Filter out tool-related parts
      const filteredParts = (message.parts || []).filter((part: any) => {
        const isToolUse = part.type === 'tool-call' || 
                         part.type === 'tool-use' ||
                         part.type === 'tool_use';
        
        if (isToolUse) {
          const toolId = part.toolCallId || part.id;
          if (toolUseIds.includes(toolId)) {
            fixesApplied.push({
              messageIndex: index,
              messageId: message.id || `message-${index}`,
              toolUseId: toolId,
              fix: 'Removed orphaned tool_use part'
            });
            return false; // Remove this part
          }
        }
        return true; // Keep this part
      });

      return {
        ...message,
        parts: filteredParts
      };
    }

    // Message has valid tool_result blocks - keep as is
    return message;
  });

  return {
    fixedMessages,
    fixesApplied
  };
}

/**
 * Validate and optionally fix messages before sending to API
 */
export function validateAndFixMessages(
  messages: UIMessage[],
  options: {
    fixErrors?: boolean;
    logErrors?: boolean;
  } = {}
): {
  messages: UIMessage[];
  validation: ReturnType<typeof validateToolUsePairs>;
  fixesApplied: ReturnType<typeof fixToolUsePairs>['fixesApplied'];
} {
  const { fixErrors = true, logErrors = true } = options;

  // Validate messages
  const validation = validateToolUsePairs(messages);

  // Log errors if requested
  if (logErrors && (!validation.isValid || validation.warnings.length > 0)) {
    console.error('🚨 Message validation issues found:');
    
    if (validation.errors.length > 0) {
      console.error(`   Errors: ${validation.errors.length}`);
      validation.errors.forEach((error, i) => {
        console.error(`   ${i + 1}. Message ${error.messageIndex} (${error.messageId}):`);
        console.error(`      tool_use id: ${error.toolUseId}`);
        console.error(`      Error: ${error.error}`);
      });
    }
    
    if (validation.warnings.length > 0) {
      console.warn(`   Warnings: ${validation.warnings.length}`);
      validation.warnings.forEach((warning, i) => {
        console.warn(`   ${i + 1}. Message ${warning.messageIndex} (${warning.messageId}):`);
        console.warn(`      Warning: ${warning.warning}`);
      });
    }
  }

  // Fix errors if requested
  let fixedMessages = messages;
  let fixesApplied: ReturnType<typeof fixToolUsePairs>['fixesApplied'] = [];

  if (fixErrors && !validation.isValid) {
    const fixResult = fixToolUsePairs(messages);
    fixedMessages = fixResult.fixedMessages;
    fixesApplied = fixResult.fixesApplied;

    if (fixesApplied.length > 0) {
      console.log(`✅ Applied ${fixesApplied.length} fixes to messages`);
    }

    // Re-validate after fixes
    const revalidation = validateToolUsePairs(fixedMessages);
    if (!revalidation.isValid) {
      console.error('⚠️ Some validation errors remain after fixes:', revalidation.errors);
    }
  }

  return {
    messages: fixedMessages,
    validation,
    fixesApplied
  };
}
