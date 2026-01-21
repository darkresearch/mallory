import { useState, useEffect, useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Platform } from 'react-native';
import { storage, SECURE_STORAGE_KEYS } from '../lib';
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
  const isLoadingRef = useRef(false); // Prevent concurrent loads
  
  const { conversationId: contextConversationId, setConversationId: setGlobalConversationId } = useActiveConversationContext();

  useEffect(() => {
    const loadActiveConversation = async () => {
      // Prevent concurrent loads
      if (isLoadingRef.current) {
        console.log('⏳ [useActiveConversation] Load already in progress, skipping...');
        return;
      }

      if (!userId) {
        setConversationId(null);
        setGlobalConversationId(null);
        setIsLoading(false);
        isLoadingRef.current = false;
        return;
      }

      try {
        isLoadingRef.current = true;
        setIsLoading(true);
        
        const conversationIdParam = params.conversationId as string;
        
        // Priority 1: URL param (most reliable)
        if (conversationIdParam) {
          hasUpdatedUrlRef.current = false;
          setConversationId(conversationIdParam);
          setGlobalConversationId(conversationIdParam);
          await storage.persistent.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversationIdParam);
          setIsLoading(false);
          isLoadingRef.current = false;
          return;
        }

        // Priority 2: Context (already loaded, fastest)
        if (contextConversationId) {
          console.log('✅ [useActiveConversation] Found conversationId in context:', contextConversationId);
          console.log('📍 [useActiveConversation] Using context - NOT creating new conversation');
          // Update URL for web to preserve it
          if (Platform.OS === 'web' && !params.conversationId && !hasUpdatedUrlRef.current) {
            hasUpdatedUrlRef.current = true;
            router.replace(`/(main)/chat?conversationId=${contextConversationId}`);
          }
          setConversationId(contextConversationId);
          setGlobalConversationId(contextConversationId);
          setIsLoading(false);
          isLoadingRef.current = false;
          return;
        } else {
          console.log('⚠️ [useActiveConversation] Context conversationId is null/undefined');
        }

        // Priority 3: Storage (wait for it properly)
        let activeConversationId: string | null = null;
        try {
          activeConversationId = await storage.persistent.getItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID);
        } catch (error) {
          console.warn('Could not read from secure storage:', error);
        }
        
        if (activeConversationId) {
          console.log('✅ [useActiveConversation] Found conversationId in storage:', activeConversationId);
          console.log('📍 [useActiveConversation] Using storage - NOT creating new conversation');
          // Update URL for web to preserve it
          if (Platform.OS === 'web' && !params.conversationId && !hasUpdatedUrlRef.current) {
            hasUpdatedUrlRef.current = true;
            router.replace(`/(main)/chat?conversationId=${activeConversationId}`);
          }
          setConversationId(activeConversationId);
          setGlobalConversationId(activeConversationId);
          setIsLoading(false);
          isLoadingRef.current = false;
          return;
        } else {
          console.log('⚠️ [useActiveConversation] Storage conversationId is null/undefined');
        }

        // Priority 4: Only create new if we truly don't have one
        // Add a small delay to allow any pending storage writes to complete
        console.log('⚠️ [useActiveConversation] No conversationId found, waiting before creating new...');
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Double-check storage after delay (in case write was in progress)
        const retryConversationId = await storage.persistent.getItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID);
        if (retryConversationId) {
          console.log('✅ [useActiveConversation] Found conversationId on retry:', retryConversationId);
          if (Platform.OS === 'web' && !params.conversationId && !hasUpdatedUrlRef.current) {
            hasUpdatedUrlRef.current = true;
            router.replace(`/(main)/chat?conversationId=${retryConversationId}`);
          }
          setConversationId(retryConversationId);
          setGlobalConversationId(retryConversationId);
          setIsLoading(false);
          isLoadingRef.current = false;
          return;
        }

        // Only now create new conversation if we really don't have one
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🆕 [useActiveConversation] ⚠️ CREATING NEW CONVERSATION ⚠️');
        console.log('   Reason: No conversationId found in URL, context, or storage');
        console.log('   URL param:', params.conversationId || 'none');
        console.log('   Context:', contextConversationId || 'none');
        console.log('   Storage:', activeConversationId || 'none');
        console.log('   Retry storage:', retryConversationId || 'none');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        const conversationData = await getCurrentOrCreateConversation(userId);
        console.log('✅ [useActiveConversation] New conversation created:', conversationData.conversationId);
        setConversationId(conversationData.conversationId);
        setGlobalConversationId(conversationData.conversationId);
        setIsLoading(false);
        isLoadingRef.current = false;
        
      } catch (error) {
        console.error('Error loading active conversation:', error);
        setConversationId(null);
        setGlobalConversationId(null);
        setIsLoading(false);
        isLoadingRef.current = false;
      }
    };

    loadActiveConversation();
  }, [userId, params.conversationId, contextConversationId]);

  return {
    conversationId,
    isLoading,
    conversationParam: params.conversationId as string,
  };
}
