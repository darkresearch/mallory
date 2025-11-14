import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { useTransactionGuard } from './useTransactionGuard';
import { getChatCache, subscribeToChatCache, isCacheForConversation } from '../lib/chat-cache';
import type { StreamState } from '../lib/chat-cache';

interface UseChatStateProps {
  currentConversationId: string | null;
  isLoadingConversation?: boolean; // Whether the conversation ID is still being loaded
  userId: string | undefined; // Required for Supermemory
  walletBalance?: {
    sol?: number;
    usdc?: number;
    totalUsd?: number;
  };
  userHasCompletedOnboarding?: boolean; // To check if user has already received intro message
}

/**
 * useChatState - Read chat state from module-level cache
 * Cache is managed by ChatManager component (always-mounted)
 * This hook provides a view of the cache for the current conversation
 */
export function useChatState({ currentConversationId, isLoadingConversation = false }: UseChatStateProps) {
  // Transaction guard for Grid session validation
  const { ensureGridSession } = useTransactionGuard();
  
  // Read from cache and sync to local state for rendering
  const cache = getChatCache();
  const isCacheRelevant = isCacheForConversation(currentConversationId);
  
  const [streamState, setStreamState] = useState<StreamState>(
    isCacheRelevant ? cache.streamState : { status: 'idle' }
  );
  const [liveReasoningText, setLiveReasoningText] = useState(
    isCacheRelevant ? cache.liveReasoningText : ''
  );
  const [aiMessages, setAiMessages] = useState(
    isCacheRelevant ? cache.messages : []
  );
  const [aiStatus, setAiStatus] = useState(
    isCacheRelevant ? cache.aiStatus : 'ready' as const
  );
  const [aiError, setAiError] = useState(
    isCacheRelevant ? cache.aiError : null
  );
  const [isLoadingHistory, setIsLoadingHistory] = useState(
    isCacheRelevant ? cache.isLoadingHistory : isLoadingConversation
  );
  
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  // Subscribe to cache updates
  useEffect(() => {
    const unsubscribe = subscribeToChatCache((newCache) => {
      // Only update if cache is for current conversation
      if (isCacheForConversation(currentConversationId)) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📦 [useChatState] CACHE UPDATE RECEIVED');
        console.log('   currentConversationId:', currentConversationId);
        console.log('   newCache.conversationId:', newCache.conversationId);
        console.log('   newCache.messages.length:', newCache.messages.length);
        console.log('   Updating local state with new cache data');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        setStreamState(newCache.streamState);
        setLiveReasoningText(newCache.liveReasoningText);
        setAiMessages(newCache.messages);
        setAiStatus(newCache.aiStatus);
        setAiError(newCache.aiError);
        setIsLoadingHistory(newCache.isLoadingHistory);
      } else {
        console.log('⏭️  [useChatState] Cache update ignored - not for current conversation');
        console.log('   currentConversationId:', currentConversationId);
        console.log('   newCache.conversationId:', newCache.conversationId);
      }
    });
    
    return unsubscribe;
  }, [currentConversationId]);

  // When conversation changes, sync with cache immediately
  useEffect(() => {
    const cache = getChatCache();
    const isCacheRelevant = isCacheForConversation(currentConversationId);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔄 [useChatState] CONVERSATION CHANGE - SYNCING WITH CACHE');
    console.log('   currentConversationId:', currentConversationId);
    console.log('   cache.conversationId:', cache.conversationId);
    console.log('   isCacheRelevant:', isCacheRelevant);
    console.log('   cache.messages.length:', cache.messages.length);
    
    if (isCacheRelevant) {
      console.log('✅ [useChatState] Cache is relevant, syncing state');
      console.log('   Setting aiMessages to', cache.messages.length, 'messages');
      setStreamState(cache.streamState);
      setLiveReasoningText(cache.liveReasoningText);
      setAiMessages(cache.messages);
      setAiStatus(cache.aiStatus);
      setAiError(cache.aiError);
      setIsLoadingHistory(cache.isLoadingHistory);
    } else {
      console.log('🧹 [useChatState] Cache not relevant, resetting to empty state');
      setStreamState({ status: 'idle' });
      setLiveReasoningText('');
      setAiMessages([]);
      setAiStatus('ready');
      setAiError(null);
      setIsLoadingHistory(isLoadingConversation);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }, [currentConversationId, isLoadingConversation]);

  // Handle sending messages - delegate to storage for ChatManager to pick up
  const handleSendMessage = async (message: string) => {
    if (!currentConversationId || currentConversationId === 'temp-loading') return;
    
    console.log('📤 [useChatState] Sending message to AI:', message);
    
    // Check Grid session before sending
    const canProceed = await ensureGridSession(
      'send message',
      '/(main)/chat',
      '#FFEFE3',
      '#000000'
    );
    
    if (!canProceed) {
      console.log('💬 [useChatState] Grid session required, saving pending message');
      setPendingMessage(message);
      return;
    }
    
    // Trigger message send
    // On web: use window events (ChatManager listens)
    // On React Native: call sendMessage directly from cache
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
      const event = new CustomEvent('chat:sendMessage', { 
        detail: { conversationId: currentConversationId, message } 
      });
      window.dispatchEvent(event);
    } else {
      // React Native: use cache functions
      const cache = getChatCache();
      if (cache.chatFunctions?.sendMessage) {
        console.log('📨 [useChatState] Sending message via cache (React Native):', message);
        cache.chatFunctions.sendMessage({ text: message });
      } else {
        console.warn('⚠️ [useChatState] ChatManager sendMessage not available in cache');
      }
    }
    
    // Optimistically set waiting state
    setStreamState({ status: 'waiting', startTime: Date.now() });
    setLiveReasoningText('');
  };

  // Handle stop streaming
  const stopStreaming = () => {
    if (!currentConversationId || currentConversationId === 'temp-loading') return;
    
    console.log('🛑 [useChatState] Stopping stream');
    // On web: use window events, on React Native: use cache functions
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
      const event = new CustomEvent('chat:stop', { 
        detail: { conversationId: currentConversationId } 
      });
      window.dispatchEvent(event);
    } else {
      const cache = getChatCache();
      if (cache.chatFunctions?.stop) {
        cache.chatFunctions.stop();
      }
    }
  };

  // Handle regenerate
  const regenerateMessage = () => {
    if (!currentConversationId || currentConversationId === 'temp-loading') return;
    
    console.log('🔄 [useChatState] Regenerating message');
    // On web: use window events, on React Native: use cache functions
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
      const event = new CustomEvent('chat:regenerate', { 
        detail: { conversationId: currentConversationId } 
      });
      window.dispatchEvent(event);
    } else {
      const cache = getChatCache();
      if (cache.chatFunctions?.regenerate) {
        cache.chatFunctions.regenerate();
      }
    }
  };

  return {
    // State machine - single source of truth
    streamState,
    
    // Supporting state
    liveReasoningText,
    isLoadingHistory,
    pendingMessage,
    
    // AI Chat results
    aiMessages,
    aiError,
    aiStatus,
    regenerateMessage,
    
    // Actions
    handleSendMessage,
    stopStreaming,
    clearPendingMessage: () => setPendingMessage(null),
  };
}
