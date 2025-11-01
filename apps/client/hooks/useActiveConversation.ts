import { useState, useEffect, useRef } from 'react';
import { useLocalSearchParams, usePathname } from 'expo-router';
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
  const pathname = usePathname();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const previousPathnameRef = useRef<string | null>(null);
  const loadInProgressRef = useRef(false);

  useEffect(() => {
    const loadActiveConversation = async () => {
      if (!userId) {
        setConversationId(null);
        setIsLoading(false);
        hasLoadedRef.current = false;
        loadInProgressRef.current = false;
        return;
      }

      // Reset loading flag if we navigated to chat screen (page refresh or navigation)
      // This ensures conversations load both on refresh AND when navigating between screens
      const isOnChatScreen = pathname.includes('/chat');
      const pathnameChanged = previousPathnameRef.current !== pathname;
      const isInitialMount = previousPathnameRef.current === null;
      
      // Reset loading state if:
      // 1. Initial mount on chat screen (page refresh)
      // 2. Navigated to chat screen from another screen
      if (isOnChatScreen && (isInitialMount || pathnameChanged)) {
        console.log('📱 On chat screen - resetting loading state', { isInitialMount, pathnameChanged, pathname });
        hasLoadedRef.current = false;
        previousPathnameRef.current = pathname;
      }

      // Only load if we're on the chat screen
      if (!isOnChatScreen) {
        return;
      }

      // Prevent multiple concurrent loads (but allow new loads when navigating)
      if (hasLoadedRef.current || loadInProgressRef.current) {
        return;
      }

      try {
        loadInProgressRef.current = true;
        setIsLoading(true);
        
        // Check URL param first (explicit navigation)
        const conversationIdParam = params.conversationId as string;
        
        if (conversationIdParam) {
          console.log('📱 Opening conversation from URL:', conversationIdParam);
          setConversationId(conversationIdParam);
          
          // Update active conversation in storage
          await secureStorage.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversationIdParam);
          hasLoadedRef.current = true;
          loadInProgressRef.current = false;
          setIsLoading(false);
          return;
        }

        // Load active conversation from storage
        const activeConversationId = await secureStorage.getItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID);
        
        if (activeConversationId) {
          console.log('📱 Found active conversation in storage:', activeConversationId);
          setConversationId(activeConversationId);
          hasLoadedRef.current = true;
          loadInProgressRef.current = false;
          setIsLoading(false);
          return;
        }

        // No active conversation - get/create one
        // This queries DB but only for the most recent conversation ID
        const conversationData = await getCurrentOrCreateConversation(userId);
        console.log('📱 Created/loaded conversation:', conversationData.conversationId);
        
        setConversationId(conversationData.conversationId);
        hasLoadedRef.current = true;
        loadInProgressRef.current = false;
        setIsLoading(false);
        
      } catch (error) {
        console.error('Error loading active conversation:', error);
        setConversationId(null);
        setIsLoading(false);
        hasLoadedRef.current = false;
        loadInProgressRef.current = false;
      }
    };

    loadActiveConversation();
    
    // Cleanup: reset in-progress flag if component unmounts or dependencies change
    return () => {
      loadInProgressRef.current = false;
    };
  }, [userId, params.conversationId, pathname]);

  return {
    conversationId,
    isLoading,
    conversationParam: params.conversationId as string,
  };
}
