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
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🔍 [useActiveConversation] Effect triggered');
      console.log('   userId:', userId || 'UNDEFINED');
      console.log('   params.conversationId:', params.conversationId || 'UNDEFINED');
      console.log('═══════════════════════════════════════════════════════════');
      
      if (!userId) {
        console.log('⚠️  [useActiveConversation] NO USER ID - Cannot load conversation');
        console.log('   This is likely an AUTH TIMING ISSUE');
        console.log('   The screen mounted before user auth completed');
        setConversationId(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        console.log('🔄 [useActiveConversation] Starting load with userId:', userId);
        
        // Check URL param first (explicit navigation)
        const conversationIdParam = params.conversationId as string;
        
        if (conversationIdParam) {
          console.log('📱 [useActiveConversation] Opening conversation from URL:', conversationIdParam);
          setConversationId(conversationIdParam);
          
          // Update active conversation in storage
          await secureStorage.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversationIdParam);
          setIsLoading(false);
          console.log('✅ [useActiveConversation] Loaded from URL parameter');
          return;
        }

        // Load active conversation from storage
        console.log('🔄 [useActiveConversation] Checking secure storage for active conversation...');
        let activeConversationId: string | null = null;
        try {
          activeConversationId = await secureStorage.getItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID);
          console.log('📦 [useActiveConversation] Storage result:', activeConversationId || 'NOT FOUND');
        } catch (error) {
          console.error('❌ [useActiveConversation] Storage read error:', error);
          console.warn('Could not read from secure storage, will create new conversation');
        }
        
        if (activeConversationId) {
          console.log('✅ [useActiveConversation] Found active conversation in storage:', activeConversationId);
          setConversationId(activeConversationId);
          setIsLoading(false);
          return;
        }

        // No active conversation - get/create one
        console.log('🔄 [useActiveConversation] No stored conversation, calling getCurrentOrCreateConversation...');
        console.log('   This will query Supabase - auth MUST be working');
        const conversationData = await getCurrentOrCreateConversation(userId);
        console.log('✅ [useActiveConversation] Created/loaded conversation:', conversationData.conversationId);
        
        setConversationId(conversationData.conversationId);
        setIsLoading(false);
        console.log('✅ [useActiveConversation] Load complete');
        
      } catch (error) {
        console.error('═══════════════════════════════════════════════════════════');
        console.error('❌ [useActiveConversation] CRITICAL ERROR');
        console.error('   Error:', error);
        console.error('   This usually means Supabase auth is not ready');
        console.error('   or the session is invalid/expired');
        console.error('═══════════════════════════════════════════════════════════');
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
