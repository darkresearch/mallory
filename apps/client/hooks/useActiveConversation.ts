import { useState, useEffect, useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Platform } from 'react-native';
import { storage, SECURE_STORAGE_KEYS } from '@/lib';
import { getCurrentOrCreateConversation } from '../features/chat';
import { useActiveConversationContext } from '../contexts/ActiveConversationContext';

interface UseActiveConversationProps {
  userId?: string;
}

export function useActiveConversation({ userId }: UseActiveConversationProps) {
  const params = useLocalSearchParams();
  const router = useRouter();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasUpdatedUrlRef = useRef(false);
  
  const { setConversationId: setGlobalConversationId } = useActiveConversationContext();

  useEffect(() => {
    const loadActiveConversation = async () => {
      if (!userId) {
        setConversationId(null);
        setGlobalConversationId(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        const conversationIdParam = params.conversationId as string;
        
        if (conversationIdParam) {
          hasUpdatedUrlRef.current = false;
          setConversationId(conversationIdParam);
          setGlobalConversationId(conversationIdParam);
          await storage.persistent.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversationIdParam);
          setIsLoading(false);
          return;
        }

        let activeConversationId: string | null = null;
        try {
          activeConversationId = await storage.persistent.getItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID);
        } catch (error) {
          console.warn('Could not read from secure storage:', error);
        }
        
        if (activeConversationId) {
          if (Platform.OS === 'web' && !params.conversationId && !hasUpdatedUrlRef.current) {
            hasUpdatedUrlRef.current = true;
            router.replace(`/(main)/chat?conversationId=${activeConversationId}`);
          }
          setConversationId(activeConversationId);
          setGlobalConversationId(activeConversationId);
          setIsLoading(false);
          return;
        }

        const conversationData = await getCurrentOrCreateConversation(userId);
        setConversationId(conversationData.conversationId);
        setGlobalConversationId(conversationData.conversationId);
        setIsLoading(false);
        
      } catch (error) {
        console.error('Error loading active conversation:', error);
        setConversationId(null);
        setGlobalConversationId(null);
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
