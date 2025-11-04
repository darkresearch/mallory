import { useState, useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { storage, SECURE_STORAGE_KEYS } from '../lib';
import { getCurrentOrCreateConversation } from '../features/chat';
import { useActiveConversationContext } from '../contexts/ActiveConversationContext';

interface UseActiveConversationProps {
  userId?: string;
}

/**
 * Simplified hook for chat screen - loads active conversation ID
 * Uses context to propagate changes to ChatManager
 */
export function useActiveConversation({ userId }: UseActiveConversationProps) {
  const params = useLocalSearchParams();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Get context setter to propagate changes globally
  const { setConversationId: setGlobalConversationId } = useActiveConversationContext();

  useEffect(() => {
    const loadActiveConversation = async () => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔍 [useActiveConversation] EFFECT TRIGGERED');
      console.log('   userId:', userId);
      console.log('   params.conversationId:', params.conversationId);
      console.log('   Current conversationId state:', conversationId);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      if (!userId) {
        console.log('🔍 [useActiveConversation] No userId, clearing conversation state');
        setConversationId(null);
        setGlobalConversationId(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        console.log('🔍 [useActiveConversation] Loading conversation for userId:', userId);
        
        // Check URL param first (explicit navigation)
        const conversationIdParam = params.conversationId as string;
        
        if (conversationIdParam) {
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('📱 [useActiveConversation] Opening conversation from URL param');
          console.log('   New conversationId:', conversationIdParam);
          console.log('   Calling setConversationId() AND setGlobalConversationId()');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          setConversationId(conversationIdParam);
          setGlobalConversationId(conversationIdParam); // Propagate to ChatManager instantly!
          
          // Update active conversation in storage
          await storage.persistent.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversationIdParam);
          console.log('✅ [useActiveConversation] Saved conversation ID to storage');
          setIsLoading(false);
          return;
        }

        // Load active conversation from storage
        console.log('🔍 [useActiveConversation] Checking storage for active conversation...');
        let activeConversationId: string | null = null;
        try {
          activeConversationId = await storage.persistent.getItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID);
          console.log('🔍 [useActiveConversation] Storage result:', activeConversationId ? `Found: ${activeConversationId}` : 'Not found (null)');
        } catch (error) {
          console.warn('⚠️ [useActiveConversation] Could not read from secure storage, will create new conversation:', error);
        }
        
        if (activeConversationId) {
          console.log('✅ [useActiveConversation] Using conversation from storage:', activeConversationId);
          setConversationId(activeConversationId);
          setGlobalConversationId(activeConversationId); // Propagate to ChatManager
          setIsLoading(false);
          return;
        }

        // No active conversation - get/create one
        console.log('🆕 [useActiveConversation] No active conversation found, creating/loading one...');
        const conversationData = await getCurrentOrCreateConversation(userId);
        console.log('✅ [useActiveConversation] Created/loaded conversation:', conversationData.conversationId);
        
        setConversationId(conversationData.conversationId);
        setGlobalConversationId(conversationData.conversationId); // Propagate to ChatManager
        setIsLoading(false);
        
      } catch (error) {
        console.error('❌ [useActiveConversation] Error loading active conversation:', error);
        setConversationId(null);
        setGlobalConversationId(null); // Clear global state too
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
