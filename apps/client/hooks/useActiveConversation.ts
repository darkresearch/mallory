import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
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

  // Load active conversation - wrapped in useCallback to use in both effects
  const loadActiveConversation = useCallback(async () => {
    if (!userId) {
      setConversationId(null);
      setIsLoading(false);
      hasLoadedRef.current = false;
      return;
    }

    // Prevent multiple simultaneous loads
    if (hasLoadedRef.current) {
      console.log('📱 Active conversation already loaded, skipping reload');
      return;
    }

    try {
      setIsLoading(true);
      console.log('📱 Loading active conversation...');
      
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
  }, [userId, params.conversationId]);

  // Reset and reload when dependencies change
  useEffect(() => {
    console.log('📱 Dependencies changed, resetting and reloading conversation');
    hasLoadedRef.current = false;
    loadActiveConversation();
  }, [loadActiveConversation]);

  // CRITICAL: Reload conversation when screen comes into focus
  // This ensures chat always shows the active conversation when navigating back to it
  useFocusEffect(
    useCallback(() => {
      console.log('📱 Chat screen focused, reloading conversation');
      hasLoadedRef.current = false;
      loadActiveConversation();
    }, [loadActiveConversation])
  );

  return {
    conversationId,
    isLoading,
    conversationParam: params.conversationId as string,
  };
}
