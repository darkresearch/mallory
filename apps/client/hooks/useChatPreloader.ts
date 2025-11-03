import { useEffect, useRef, useState } from 'react';
import { secureStorage, SECURE_STORAGE_KEYS } from '../lib';
import { getCurrentOrCreateConversation, loadMessagesFromSupabase } from '../features/chat';

interface UseChatPreloaderProps {
  userId?: string;
  enabled?: boolean; // Allow conditional enabling
}

/**
 * Hook to preload chat data in the background
 * This loads the active conversation and its messages so that when the user
 * navigates to the chat screen, everything is already loaded and ready
 */
export function useChatPreloader({ userId, enabled = true }: UseChatPreloaderProps) {
  const [isPreloading, setIsPreloading] = useState(false);
  const [isPreloaded, setIsPreloaded] = useState(false);
  const hasPreloadedRef = useRef(false);

  useEffect(() => {
    // Only preload once per session
    if (!enabled || !userId || hasPreloadedRef.current || isPreloading) {
      return;
    }

    const preloadChatData = async () => {
      try {
        setIsPreloading(true);
        console.log('🔄 [ChatPreloader] Starting background preload of chat data');

        // Step 1: Load or create the active conversation
        console.log('🔄 [ChatPreloader] Loading active conversation...');
        const conversationData = await getCurrentOrCreateConversation(userId);
        console.log('🔄 [ChatPreloader] Active conversation:', conversationData.conversationId);

        // Step 2: Preload messages for this conversation
        console.log('🔄 [ChatPreloader] Preloading messages...');
        const messages = await loadMessagesFromSupabase(conversationData.conversationId);
        console.log('🔄 [ChatPreloader] Preloaded', messages.length, 'messages');

        // Mark as preloaded
        hasPreloadedRef.current = true;
        setIsPreloaded(true);
        console.log('✅ [ChatPreloader] Chat data preloaded successfully');
      } catch (error) {
        console.error('❌ [ChatPreloader] Error preloading chat data:', error);
        // Don't set isPreloaded on error, but mark as attempted
        hasPreloadedRef.current = true;
      } finally {
        setIsPreloading(false);
      }
    };

    preloadChatData();
  }, [userId, enabled, isPreloading]);

  return {
    isPreloading,
    isPreloaded,
  };
}
