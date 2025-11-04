import { useState, useEffect, useRef } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { getCurrentOrCreateConversation } from '../features/chat';
import { storage, SECURE_STORAGE_KEYS } from '../lib';

interface UseConversationLoaderProps {
  userId?: string;
}

export function useConversationLoader({ userId }: UseConversationLoaderProps) {
  const params = useLocalSearchParams();
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  
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
          await storage.persistent.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversationIdParam);
        } else {
          // FIRST: Try to load active conversation from secure storage immediately
          // This allows instant loading without waiting for context
          // Only check storage once to prevent race conditions
          if (!hasLoadedFromStorageRef.current) {
            const activeConversationId = await storage.persistent.getItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID);
            
            if (activeConversationId) {
              console.log('📱 Found active conversation in storage:', activeConversationId);
              setCurrentConversationId(activeConversationId);
              hasLoadedFromStorageRef.current = true;
              return; // Use stored active conversation immediately
            }
            
            hasLoadedFromStorageRef.current = true; // Mark as checked even if not found
          }
          
          // No active conversation in storage - get/create one
          // Only call getCurrentOrCreateConversation if we don't have a conversationId yet
          // This prevents unnecessary re-runs
          if (!currentConversationId) {
            const conversationData = await getCurrentOrCreateConversation(userId);
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
  }, [params.conversationId, userId]);

  return {
    currentConversationId,
    conversationParam: params.conversationId as string,
  };
}
