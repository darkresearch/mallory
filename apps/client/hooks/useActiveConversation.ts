import { useState, useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { secureStorage, SECURE_STORAGE_KEYS } from '../lib';
import { getCurrentOrCreateConversation } from '../features/chat';

interface UseActiveConversationProps {
  userId?: string;
}

/**
 * Simplified hook for chat screen - loads active conversation ID
 * Simple approach: re-loads whenever userId or conversationId param changes
 */
export function useActiveConversation({ userId }: UseActiveConversationProps) {
  const params = useLocalSearchParams();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadActiveConversation = async () => {
      if (!userId) {
        setConversationId(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        // Check URL param first (explicit navigation)
        const conversationIdParam = params.conversationId as string;
        
        if (conversationIdParam) {
          console.log('📱 Opening conversation from URL:', conversationIdParam);
          setConversationId(conversationIdParam);
          
          // Update active conversation in storage
          await secureStorage.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversationIdParam);
          setIsLoading(false);
          return;
        }

        // Load active conversation from storage
        const activeConversationId = await secureStorage.getItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID);
        
        if (activeConversationId) {
          console.log('📱 Found active conversation in storage:', activeConversationId);
          setConversationId(activeConversationId);
          setIsLoading(false);
          return;
        }

        // No active conversation - get/create one
        const conversationData = await getCurrentOrCreateConversation(userId);
        console.log('📱 Created/loaded conversation:', conversationData.conversationId);
        
        setConversationId(conversationData.conversationId);
        setIsLoading(false);
        
      } catch (error) {
        console.error('Error loading active conversation:', error);
        setConversationId(null);
        setIsLoading(false);
      }
    };

    loadActiveConversation();
  }, [userId, params.conversationId]);

  return {
    conversationId,
    isLoading,
    conversationParam: params.conversationId as string,
  };
}
