import { useState, useEffect, useRef } from 'react';
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
  
  // Track if we've already loaded from storage to prevent re-runs
  const hasLoadedFromStorageRef = useRef(false);

  // Handle conversation loading
  useEffect(() => {
    const loadConversation = async () => {
      if (!userId) {
        // Reset if no user
        setCurrentConversationId(null);
        hasLoadedFromStorageRef.current = false;
        return;
      }
      
      try {
        const conversationIdParam = params.conversationId as string;
        
        if (conversationIdParam) {
          // Opening a specific conversation from history or new chat
          console.log('📱 Opening specific conversation:', conversationIdParam);
          setCurrentConversationId(conversationIdParam);
          hasLoadedFromStorageRef.current = false; // Reset when explicitly navigating
          
          // Update the active conversation in storage (persists across sessions)
          await secureStorage.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversationIdParam);
        } else {
          // FIRST: Try to load active conversation from secure storage immediately
          // This allows instant loading without waiting for ConversationsContext
          // Only check storage once to prevent race conditions
          if (!hasLoadedFromStorageRef.current) {
            const activeConversationId = await secureStorage.getItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID);
            
            if (activeConversationId) {
              console.log('📱 Found active conversation in storage:', activeConversationId);
              setCurrentConversationId(activeConversationId);
              hasLoadedFromStorageRef.current = true;
              return; // Use stored active conversation immediately
            }
            
            hasLoadedFromStorageRef.current = true; // Mark as checked even if not found
          }
          
          // No active conversation in storage - get/create one
          // Only use conversations data if context is initialized AND we don't already have a conversationId
          // This prevents re-running when conversations array changes after we've already loaded
          if (!currentConversationId && isInitialized && conversations.length > 0) {
            const mostRecentConversation = conversations[0]; // Already sorted by updated_at DESC
            console.log('📱 Found conversations in context, using most recent:', mostRecentConversation.id);
            
            setCurrentConversationId(mostRecentConversation.id);
            await secureStorage.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, mostRecentConversation.id);
            return;
          }
          
          // Only call getCurrentOrCreateConversation if we don't have a conversationId yet
          // This prevents unnecessary re-runs when conversations array updates
          if (!currentConversationId) {
            const existingConversations = isInitialized && conversations.length > 0 
              ? conversations.map(c => ({ id: c.id, updated_at: c.updated_at })) 
              : undefined;
            
            const conversationData = await getCurrentOrCreateConversation(userId, existingConversations);
            console.log('📱 Using conversation:', conversationData.conversationId);
            setCurrentConversationId(conversationData.conversationId);
          }
        }
      } catch (error) {
        console.error('Error loading conversation:', error);
        // On error, reset to null so user can retry or create new conversation
        setCurrentConversationId(null);
        hasLoadedFromStorageRef.current = false;
      }
    };

    loadConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.conversationId, userId, isInitialized, conversations.length]);

  return {
    currentConversationId,
    conversationParam: params.conversationId as string,
  };
}
