/**
 * Stream response builder
 * Configures the UI message stream response with metadata and callbacks
 */

import { UIMessage } from 'ai';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../../lib/supabase.js';
import { saveAssistantMessage } from '../persistence.js';

/**
 * Build UI message stream response configuration
 * 
 * @param result - StreamText result object
 * @param originalMessages - Original messages (for preservation)
 * @param conversationId - Conversation ID for logging
 * @param onboardingContext - Optional context for onboarding completion
 * @returns Configured stream response
 */
export function buildStreamResponse(
  result: any,
  originalMessages: UIMessage[],
  conversationId: string,
  onboardingContext?: {
    userId: string;
    isOnboarding: boolean;
  },
  assistantMessageId?: string // Optional: pre-generated message ID for consistency
) {
  // Track stream progress
  let partCount = 0;
  let textParts = 0;
  let lastTextDelta = '';
  
  const streamResponse = result.toUIMessageStreamResponse({
    sendReasoning: true, // Enable reasoning content in stream
    generateMessageId: () => {
      // Use pre-generated ID if provided (for consistency with incremental saves)
      // Otherwise generate a new one
      const id = assistantMessageId || uuidv4();
      console.log('🆔 Generated message ID:', id);
      return id;
    },
    
    // Preserve original messages (including user metadata) in the response
    originalMessages: originalMessages.map((msg: any) => {
      // If this is a user message with metadata, preserve it
      if (msg.role === 'user' && msg.metadata?.created_at) {
        console.log(`📅 Preserving user metadata timestamp:`, msg.metadata.created_at);
        return {
          ...msg,
          metadata: {
            ...msg.metadata,
            preserved_from_client: true
          }
        };
      }
      return msg;
    }),
    
    // Add timestamp metadata to messages when they're created
    messageMetadata: ({ part }: any) => {
      partCount++;
      console.log(`📊 [${partCount}] messageMetadata called with part type:`, part.type);
      
      // Track text parts specifically
      if (part.type === 'text-delta') {
        textParts++;
        lastTextDelta = (part as any).text || '';
        console.log(`💬 [${textParts}] TEXT DELTA:`, lastTextDelta);
      }
      
      // Log ALL part properties to see what we're getting (but less verbose)
      if ((part as any).text !== undefined) {
        console.log('📊 Part text content:', JSON.stringify((part as any).text));
      }
      
      // Log the actual content for reasoning and text parts
      if (part.type === 'reasoning-delta' && (part as any).text) {
        console.log('🧠 REASONING DELTA:', (part as any).text);
      } else if (part.type === 'reasoning-start') {
        console.log('🧠 REASONING START');
      } else if (part.type === 'reasoning-end') {
        console.log('🧠 REASONING END');
      } else if (part.type === 'text-delta' && (part as any).text) {
        console.log('💬 TEXT DELTA:', (part as any).text);
      } else if (part.type === 'text-start') {
        console.log('💬 TEXT START');
      } else if (part.type === 'text-end') {
        console.log('💬 TEXT END - Response generation completed');
      } else if (part.type === 'finish-step') {
        console.log('🏁 FINISH STEP - Step completed');
      } else if (part.type === 'finish') {
        console.log('🏁 FINISH - Stream completed');
      } else if ((part as any).text) {
        console.log(`📝 ${part.type.toUpperCase()} CONTENT:`, (part as any).text);
      }
      
      // Only set timestamp for assistant messages when they start responding
      if (part.type === 'text-start') {
        const timestamp = new Date().toISOString();
        console.log(`📅 Setting assistant timestamp for "${part.type}":`, timestamp);
        return {
          created_at: timestamp,
          initial_part_type: part.type
        };
      }
      
      // For other part types, don't return any metadata (don't overwrite existing timestamps)
      console.log(`📊 No metadata set for part type: ${part.type}`);
      return undefined;
    },

    // Final save when stream completes
    // Note: Incremental saving during streaming is handled via onStepFinish callback in streamConfig
    // This callback saves the final complete message state
    onFinish: async ({ messages: allMessages, isAborted }: any) => {
      console.log('🏁 onFinish callback triggered:', { 
        messageCount: allMessages.length, 
        isAborted,
        conversationId,
        totalParts: partCount,
        textParts: textParts,
        lastTextDelta: lastTextDelta.substring(0, 50) + '...',
        isOnboarding: onboardingContext?.isOnboarding
      });
      
      // Save final assistant message state (complete)
      // This ensures the message is marked as complete even if incremental saves failed
      if (!isAborted && allMessages.length > 0) {
        const assistantMessage = allMessages.find((msg: UIMessage) => msg.role === 'assistant');
        if (assistantMessage) {
          console.log('💾 Saving final assistant message (complete):', assistantMessage.id);
          await saveAssistantMessage(conversationId, assistantMessage, true);
        }
      }
      
      // Mark onboarding complete if this was an onboarding conversation
      if (onboardingContext?.isOnboarding && !isAborted && onboardingContext?.userId) {
        console.log('🎉 Marking onboarding complete for user:', onboardingContext.userId);
        try {
          const { error } = await supabase
            .from('users')
            .update({ has_completed_onboarding: true })
            .eq('id', onboardingContext.userId);
          
          if (error) {
            console.error('❌ Error marking onboarding complete:', error);
          } else {
            console.log('✅ Onboarding marked complete successfully!');
          }
        } catch (error) {
          console.error('❌ Exception marking onboarding complete:', error);
        }
      }
    },
    
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'none',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
  
  return { streamResponse, stats: { partCount, textParts, lastTextDelta } };
}
