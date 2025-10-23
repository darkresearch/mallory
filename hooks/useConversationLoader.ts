import { useState, useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useConversations } from '@/contexts/ConversationsContext';
import { getCurrentOrCreateConversation } from '../features/chat';
import { secureStorage } from '../lib';

const CURRENT_CONVERSATION_KEY = 'current_conversation_id';

interface UseConversationLoaderProps {
  userId?: string;
}

export function useConversationLoader({ userId }: UseConversationLoaderProps) {
  const params = useLocalSearchParams();
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  
  // Get conversations context for optimization
  const { conversations, isInitialized } = useConversations();

  // Handle conversation loading
  useEffect(() => {
    const loadConversation = async () => {
      if (!userId) return;
      
      try {
        const conversationIdParam = params.conversationId as string;
        
        if (conversationIdParam) {
          // Opening a specific conversation from history or new chat
          console.log('📱 Opening specific conversation:', conversationIdParam);
          setCurrentConversationId(conversationIdParam);
          
          // Update the current conversation in storage so future messages go to this conversation
          await secureStorage.setItem(CURRENT_CONVERSATION_KEY, conversationIdParam);
        } else {
          // Normal flow - get existing current conversation or create if none exists
          // Pass existing conversations data to avoid duplicate queries
          const existingConversations = isInitialized ? conversations.map(c => ({ id: c.id, updated_at: c.updated_at })) : undefined;
          const conversationData = await getCurrentOrCreateConversation(userId, existingConversations);
          console.log('📱 Using conversation:', conversationData.conversationId);
          setCurrentConversationId(conversationData.conversationId);
        }
      } catch (error) {
        console.error('Error loading conversation:', error);
        // Fallback to a new conversation
        const fallbackId = 'fallback-' + Date.now();
        setCurrentConversationId(fallbackId);
      }
    };

    loadConversation();
  }, [params.conversationId, isInitialized, conversations, userId]);

  return {
    currentConversationId,
    conversationParam: params.conversationId as string,
  };
}
