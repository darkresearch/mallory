/**
 * Server-side message persistence utilities
 * Handles saving messages to Supabase (user messages immediately, AI messages when streaming completes)
 */

import { UIMessage } from 'ai';
import { supabase } from '../../lib/supabase.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Ensure message ID is a valid UUID
 */
function ensureUUID(existingId?: string): string {
  if (!existingId) {
    return uuidv4();
  }
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(existingId)) {
    return existingId;
  }
  
  return uuidv4();
}

/**
 * Extract text content from message parts
 */
function extractTextContent(parts: any[]): string {
  if (!parts || !Array.isArray(parts)) return '';
  
  const textParts = parts.filter(p => p.type === 'text' && p.text);
  return textParts.map(p => p.text).join('\n').trim();
}

/**
 * Build Chain of Thought metadata from message parts
 */
function buildChainOfThoughtMetadata(parts: any[]) {
  if (!parts || !Array.isArray(parts)) {
    return {
      hasReasoning: false,
      reasoningSteps: 0,
      toolCalls: [],
      totalDuration: undefined
    };
  }

  const reasoningParts = parts.filter(p => p.type === 'reasoning' || p.type === 'reasoning-delta');
  const toolCallParts = parts.filter(p => p.type?.startsWith('tool-'));

  return {
    hasReasoning: reasoningParts.length > 0,
    reasoningSteps: reasoningParts.length,
    toolCalls: toolCallParts.map(p => p.toolName || p.type).filter(Boolean),
    totalDuration: undefined
  };
}

/**
 * Save a user message immediately to database
 * Called when user sends a message (before AI streaming starts)
 */
export async function saveUserMessage(
  conversationId: string,
  message: UIMessage
): Promise<boolean> {
  try {
    if (message.role !== 'user') {
      console.error('saveUserMessage called with non-user message');
      return false;
    }

    const textContent = extractTextContent(message.parts || []);
    const chainOfThought = buildChainOfThoughtMetadata(message.parts || []);

    const messageData = {
      id: ensureUUID(message.id),
      conversation_id: conversationId,
      role: 'user' as const,
      content: textContent,
      metadata: {
        parts: message.parts,
        chainOfThought,
        source: 'user_input',
        timestamp: new Date().toISOString(),
        ...(message.metadata || {})
      },
      created_at: (message as any).createdAt 
        ? new Date((message as any).createdAt).toISOString()
        : new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('messages')
      .insert(messageData);

    if (error) {
      console.error('💾 Failed to save user message:', error);
      return false;
    }

    // Update conversation updated_at timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    console.log('✅ User message saved:', messageData.id);
    return true;

  } catch (error) {
    console.error('💾 Error saving user message:', error);
    return false;
  }
}

/**
 * Save an AI assistant message to database
 * Called when streaming completes to persist the full message
 */
export async function saveAssistantMessage(
  conversationId: string,
  message: UIMessage,
  isComplete: boolean = true
): Promise<boolean> {
  try {
    if (message.role !== 'assistant') {
      console.error('saveAssistantMessage called with non-assistant message');
      return false;
    }

    const textContent = extractTextContent(message.parts || []);
    const chainOfThought = buildChainOfThoughtMetadata(message.parts || []);

    const messageData = {
      id: ensureUUID(message.id),
      conversation_id: conversationId,
      role: 'assistant' as const,
      content: textContent,
      metadata: {
        parts: message.parts,
        chainOfThought,
        source: 'claude_stream',
        isComplete,
        timestamp: new Date().toISOString(),
        ...(message.metadata || {})
      },
      created_at: (message as any).createdAt || (message as any).metadata?.created_at
        ? new Date((message as any).createdAt || (message as any).metadata?.created_at).toISOString()
        : new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Use upsert to handle message updates (same message ID)
    const { error } = await supabase
      .from('messages')
      .upsert(messageData, {
        onConflict: 'id',
        ignoreDuplicates: false // Update existing messages
      });

    if (error) {
      console.error('💾 Failed to save assistant message:', error);
      return false;
    }

    // Update conversation updated_at timestamp when message is complete
    if (isComplete) {
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);
    }

    console.log(`✅ Assistant message ${isComplete ? 'saved' : 'updated'}:`, messageData.id);
    return true;

  } catch (error) {
    console.error('💾 Error saving assistant message:', error);
    return false;
  }
}

/**
 * Save multiple messages (for batch operations or final save)
 */
export async function saveMessages(
  conversationId: string,
  messages: UIMessage[]
): Promise<boolean> {
  try {
    if (!messages || messages.length === 0) {
      return true;
    }

    const conversationMessages = messages.filter(msg => msg.role !== 'system');

    if (conversationMessages.length === 0) {
      return true;
    }

    const messagesToInsert = conversationMessages.map(msg => {
      const textContent = extractTextContent(msg.parts || []);
      const chainOfThought = buildChainOfThoughtMetadata(msg.parts || []);

      return {
        id: ensureUUID(msg.id),
        conversation_id: conversationId,
        role: msg.role,
        content: textContent,
        metadata: {
          parts: msg.parts,
          chainOfThought,
          source: msg.role === 'user' ? 'user_input' : 'claude_stream',
          timestamp: new Date().toISOString(),
          ...(msg.metadata || {})
        },
        created_at: (msg as any).createdAt 
          ? new Date((msg as any).createdAt).toISOString()
          : new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    });

    const { error } = await supabase
      .from('messages')
      .upsert(messagesToInsert, {
        onConflict: 'id',
        ignoreDuplicates: false
      });

    if (error) {
      console.error('💾 Failed to save messages:', error);
      return false;
    }

    // Update conversation updated_at
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    console.log('✅ Messages saved:', messagesToInsert.length);
    return true;

  } catch (error) {
    console.error('💾 Error saving messages:', error);
    return false;
  }
}
