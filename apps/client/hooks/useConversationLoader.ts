import { useState, useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useConversations } from '@/contexts/ConversationsContext';
import { getCurrentOrCreateConversation } from '../features/chat';
import { secureStorage, SECURE_STORAGE_KEYS } from '../lib';

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
          await secureStorage.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversationIdParam);
        } else {
          // FIRST: Try to load active conversation from secure storage immediately (don't wait for ConversationsContext)
          const activeConversationId = await secureStorage.getItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID);
          
          if (activeConversationId) {
            console.log('📱 Found active conversation in storage:', activeConversationId);
            setCurrentConversationId(activeConversationId);
            return; // Use the stored active conversation immediately
          }
          
          // No active conversation in storage - get/create one
          // Pass existing conversations data if available to avoid duplicate queries
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
