import { useState, useEffect, useMemo, useRef } from 'react';
import { useAIChat } from './useAIChat';
import { supabase } from '../lib';

interface UseChatStateProps {
  currentConversationId: string | null;
  userId: string | undefined; // Required for Supermemory
}

export function useChatState({ currentConversationId, userId }: UseChatStateProps) {
  // State for immediate reasoning feedback
  const [showImmediateReasoning, setShowImmediateReasoning] = useState(false);
  const [liveReasoningText, setLiveReasoningText] = useState('');
  const [hasInitialReasoning, setHasInitialReasoning] = useState(false);

  // AI Chat using Vercel's useChat hook - with immediate feedback
  const aiChatResult = useAIChat({
    conversationId: currentConversationId || 'temp-loading',
    userId: userId || 'unknown', // Pass userId for Supermemory
    onImmediateReasoning: (text) => {
      console.log('⚡ IMMEDIATE reasoning callback triggered');
      setShowImmediateReasoning(true);
    },
    onImmediateToolCall: (toolName) => {
      console.log('⚡ IMMEDIATE tool call callback triggered');
    },
  });
  
  // Only use results when we have a real conversation ID
  const rawMessages = currentConversationId ? aiChatResult.messages : [];
  const sendAIMessage = currentConversationId ? aiChatResult.sendMessage : undefined;
  const regenerateMessage = currentConversationId ? aiChatResult.regenerate : undefined;
  const aiError = currentConversationId ? aiChatResult.error : null;
  const aiStatus = currentConversationId ? aiChatResult.status : 'ready';
  const isLoadingHistory = currentConversationId ? aiChatResult.isLoadingHistory : false;

  // Create enhanced messages with placeholder when reasoning starts
  // Filter out system messages (they're triggers, never displayed)
  const aiMessages = useMemo(() => {
    console.log('🔍 aiMessages useMemo triggered:', {
      hasInitialReasoning,
      rawMessagesLength: rawMessages.length,
      rawMessagesRoles: rawMessages.map(m => m.role),
      rawMessagesIds: rawMessages.map(m => m.id),
    });

    // Filter out system messages (triggers only, not for display)
    const displayMessages = rawMessages.filter(msg => msg.role !== 'system');
    console.log('🎭 Filtered out system messages:', {
      before: rawMessages.length,
      after: displayMessages.length,
      systemMessagesFiltered: rawMessages.length - displayMessages.length
    });

    if (!hasInitialReasoning) {
      console.log('📤 No initial reasoning yet - returning filtered messages');
      return displayMessages;
    }

    // We have reasoning - check if we need to create placeholder
    const hasAssistantMessage = displayMessages.some(msg => msg.role === 'assistant');
    console.log('🤖 Assistant message check:', { hasAssistantMessage });
    
    if (!hasAssistantMessage) {
      // Create placeholder assistant message when reasoning starts but no assistant message exists yet
      const placeholderMessage = {
        id: 'placeholder-reasoning',
        role: 'assistant' as const,
        parts: [], // Empty parts, will be filled by live reasoning
        content: '', // Required by useChat interface
        createdAt: new Date(),
      };
      
      console.log('🎯 Creating placeholder assistant message for early reasoning display');
      console.log('📋 Final aiMessages array will have:', displayMessages.length + 1, 'messages');
      return [...displayMessages, placeholderMessage];
    }
    
    console.log('✅ Assistant message exists - returning filtered messages as-is');
    return displayMessages;
  }, [rawMessages, hasInitialReasoning]);

  // Show immediate reasoning indicator as soon as streaming starts
  useEffect(() => {
    if (aiStatus === 'streaming') {
      console.log('⚡ Status changed to streaming - showing immediate indicator');
      setShowImmediateReasoning(true);
    } else if (aiStatus === 'ready') {
      console.log('✅ Status changed to ready - hiding immediate indicator');
      setShowImmediateReasoning(false);
    }
  }, [aiStatus]);

  // Extract live reasoning text from streaming messages
  useEffect(() => {
    if (aiStatus === 'streaming' && aiMessages.length > 0) {
      const lastMessage = aiMessages[aiMessages.length - 1];
      if (lastMessage.role === 'assistant') {
        // Extract reasoning parts as they arrive
        const reasoningParts = lastMessage.parts?.filter((p: any) => p.type === 'reasoning') || [];
        
        if (reasoningParts.length > 0) {
          const allReasoningText = reasoningParts.map((p: any) => p.text || '').join('\n\n');
          if (allReasoningText !== liveReasoningText) {
            console.log('🧠 Live reasoning update:', allReasoningText.length, 'chars');
            setLiveReasoningText(allReasoningText);
          }
        }
      }
    }
  }, [aiMessages, aiStatus, liveReasoningText]);

  // Track when we first get reasoning to show persistent block
  useEffect(() => {
    if (liveReasoningText && !hasInitialReasoning) {
      console.log('🎯 First reasoning detected - enabling persistent reasoning block');
      setHasInitialReasoning(true);
    }
  }, [liveReasoningText, hasInitialReasoning]);


  const handleSendMessage = (message: string) => {
    if (!sendAIMessage) return;
    
    console.log('📤 Sending message to AI:', message);
    // Clear all reasoning state for new message
    setShowImmediateReasoning(false);
    setLiveReasoningText('');
    setHasInitialReasoning(false); // Reset so placeholder gets created fresh
    // Server handles all storage and processing
    sendAIMessage({ text: message });
  };

  return {
    // State
    showImmediateReasoning,
    liveReasoningText,
    hasInitialReasoning,
    isLoadingHistory,
    
    // AI Chat results
    aiMessages,
    aiError,
    aiStatus,
    regenerateMessage,
    
    // Actions
    handleSendMessage,
  };
}
