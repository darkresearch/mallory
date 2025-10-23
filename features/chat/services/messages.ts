import { UIMessage } from 'ai';
import { supabase } from '../../../lib/supabase';
import { v4 as uuidv4 } from 'uuid';


/**
 * Ensure message ID is a valid UUID, converting if necessary
 */
function ensureUUID(existingId?: string): string {
  if (!existingId) {
    const newId = uuidv4();
    console.log('🆔 Generated UUID for message without ID:', newId);
    return newId;
  }
  
  // Check if it's already a valid UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(existingId)) {
    console.log('🆔 Preserving existing UUID:', existingId);
    return existingId;
  }
  
  // Not a UUID - generate new one  
  const newId = uuidv4();
  console.log('🆔 Converting non-UUID to UUID:', existingId, '→', newId);
  return newId;
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
    totalDuration: undefined // Could be computed from timestamps if needed
  };
}

/**
 * Save messages to Supabase with complete metadata preservation
 */
export async function saveMessagesToSupabase(
  conversationId: string, 
  messages: UIMessage[]
): Promise<boolean> {
  try {
    console.log('💾 Saving messages to Supabase:', {
      conversationId,
      messageCount: messages.length,
      messageIds: messages.map(m => m.id),
      messageRoles: messages.map(m => m.role)
    });

    if (!messages || messages.length === 0) {
      console.log('💾 No messages to save');
      return true;
    }

    // Filter out system messages - they're triggers, not conversation history
    // Database only allows 'user' and 'assistant' roles
    const conversationMessages = messages.filter(msg => msg.role !== 'system');
    
    if (conversationMessages.length === 0) {
      console.log('💾 No conversation messages to save (only system triggers)');
      return true;
    }
    
    console.log('💾 Filtered messages:', {
      original: messages.length,
      afterFiltering: conversationMessages.length,
      systemMessagesFiltered: messages.length - conversationMessages.length
    });

    const messagesToInsert = conversationMessages.map(msg => {
      const textContent = extractTextContent(msg.parts || []);
      const chainOfThought = buildChainOfThoughtMetadata(msg.parts || []);
      
      console.log('💾 Processing message:', {
        id: msg.id,
        role: msg.role,
        textContentLength: textContent.length,
        partsCount: msg.parts?.length || 0,
        hasReasoning: chainOfThought.hasReasoning,
        toolCallsCount: chainOfThought.toolCalls.length
      });

      return {
        id: ensureUUID(msg.id), // Ensure valid UUID format
        conversation_id: conversationId,
        role: msg.role,
        content: textContent, // Main text content for easy querying
        metadata: {
          parts: msg.parts, // Preserve complete parts array for rendering
          chainOfThought,
          source: 'claude_stream',
          timestamp: new Date().toISOString(),
          // Preserve any existing metadata
          ...(msg.metadata || {})
        },
        created_at: (msg as any).createdAt 
          ? new Date((msg as any).createdAt).toISOString()
          : new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    });

    console.log('💾 Upserting messages (duplicates will be skipped):', messagesToInsert.map(m => ({
      id: m.id,
      role: m.role,
      contentLength: m.content.length,
      hasMetadata: !!m.metadata,
      partsCount: m.metadata?.parts?.length || 0
    })));

    console.log('💾 About to call Supabase upsert with data:', {
      messageCount: messagesToInsert.length,
      sampleMessage: messagesToInsert[0],
      allMessageIds: messagesToInsert.map(m => m.id)
    });

    const { data, error } = await supabase
      .from('messages')
      .upsert(messagesToInsert, {
        onConflict: 'id', // On UUID conflict, skip duplicates
        ignoreDuplicates: true
      })
      .select();

    console.log('💾 Supabase upsert response:', {
      hasError: !!error,
      hasData: !!data,
      dataCount: data?.length || 0,
      error: error || 'none'
    });

    if (error) {
      console.error('💾 Failed to save messages - Supabase error:', error);
      console.error('💾 Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return false;
    }

    console.log('✅ Successfully upserted messages (new ones saved, duplicates skipped):', messages.map(m => m.id));
    console.log('✅ Upserted data:', data);
    
    // Note: Summary title generation is now handled by serverless edge function
    // triggered by database webhook on message INSERT
    
    return true;

  } catch (error) {
    console.error('💾 Error saving messages:', error);
    return false;
  }
}

/**
 * Save individual message to Supabase (for real-time updates)
 */
export async function saveMessageToSupabase(
  conversationId: string, 
  message: UIMessage
): Promise<boolean> {
  return saveMessagesToSupabase(conversationId, [message]);
}

/**
 * Load messages from Supabase and convert to UIMessage format
 */
export async function loadMessagesFromSupabase(
  conversationId: string
): Promise<UIMessage[]> {
  try {
    console.log('📖 Loading messages from Supabase:', conversationId);

    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, role, content, metadata, created_at, is_liked, is_disliked')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true }); // oldest first

    if (error) {
      console.error('📖 Error loading messages:', error);
      return [];
    }

    if (!messages || messages.length === 0) {
      console.log('📖 No messages found for conversation:', conversationId);
      return [];
    }

    // Convert Supabase format back to UIMessage format
    const convertedMessages = messages.map((msg: any) => {
      // Use stored parts if available, otherwise reconstruct from content
      const parts = msg.metadata?.parts || [
        { type: 'text' as const, text: msg.content }
      ];
      
      console.log('📖 Converting message:', {
        id: msg.id,
        role: msg.role,
        partsCount: parts.length,
        hasMetadata: !!msg.metadata,
        hasChainOfThought: !!msg.metadata?.chainOfThought
      });

      return {
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        parts,
        content: msg.content, // Keep for compatibility
        metadata: msg.metadata,
        createdAt: new Date(msg.created_at),
        isLiked: msg.is_liked,
        isDisliked: msg.is_disliked
      } as UIMessage & { isLiked?: boolean; isDisliked?: boolean };
    });
    
    console.log('✅ Loaded messages:', {
      conversationId,
      messageCount: convertedMessages.length,
      messageIds: convertedMessages.map(m => m.id)
    });
    
    return convertedMessages;
    
  } catch (error) {
    console.error('📖 Failed to load messages:', error);
    return [];
  }
}
