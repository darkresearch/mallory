import { useState, useEffect, useRef } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { secureStorage, SECURE_STORAGE_KEYS } from '../lib';
import { getCurrentOrCreateConversation } from '../features/chat';

interface UseActiveConversationProps {
  userId?: string;
}

/**
 * Simplified hook for chat screen - only loads active conversation ID
 * Does NOT depend on ConversationsContext - loads conversation ID independently
 */
export function useActiveConversation({ userId }: UseActiveConversationProps) {
  const params = useLocalSearchParams();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    const loadActiveConversation = async () => {
      if (!userId) {
        setConversationId(null);
        setIsLoading(false);
        hasLoadedRef.current = false;
        return;
      }

      // Prevent multiple loads
      if (hasLoadedRef.current) return;

      try {
        setIsLoading(true);
        
        // Check URL param first (explicit navigation)
        const conversationIdParam = params.conversationId as string;
        
        if (conversationIdParam) {
          console.log('📱 Opening conversation from URL:', conversationIdParam);
          setConversationId(conversationIdParam);
          
          // Update active conversation in storage
          await secureStorage.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversationIdParam);
          hasLoadedRef.current = true;
          setIsLoading(false);
          return;
        }

        // Load active conversation from storage
        const activeConversationId = await secureStorage.getItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID);
        
        if (activeConversationId) {
          console.log('📱 Found active conversation in storage:', activeConversationId);
          setConversationId(activeConversationId);
          hasLoadedRef.current = true;
          setIsLoading(false);
          return;
        }

        // No active conversation - get/create one
        // This queries DB but only for the most recent conversation ID
        const conversationData = await getCurrentOrCreateConversation(userId);
        console.log('📱 Created/loaded conversation:', conversationData.conversationId);
        
        setConversationId(conversationData.conversationId);
        hasLoadedRef.current = true;
        setIsLoading(false);
        
      } catch (error) {
        console.error('Error loading active conversation:', error);
        setConversationId(null);
        setIsLoading(false);
        hasLoadedRef.current = false;
      }
    };

    loadActiveConversation();
  }, [userId, params.conversationId]);

  // Reset loading flag when userId or conversationId param changes
  useEffect(() => {
    hasLoadedRef.current = false;
  }, [userId, params.conversationId]);

  return {
    conversationId,
    isLoading,
    conversationParam: params.conversationId as string,
  };
}
