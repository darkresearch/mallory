import { useState, useEffect } from 'react';
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
        console.log('📦 [useChatState] Cache updated for conversation:', currentConversationId);
        setStreamState(newCache.streamState);
        setLiveReasoningText(newCache.liveReasoningText);
        setAiMessages(newCache.messages);
        setAiStatus(newCache.aiStatus);
        setAiError(newCache.aiError);
        setIsLoadingHistory(newCache.isLoadingHistory);
      }
    });
    
    return unsubscribe;
  }, [currentConversationId]);

  // When conversation changes, sync with cache immediately
  useEffect(() => {
    const cache = getChatCache();
    const isCacheRelevant = isCacheForConversation(currentConversationId);
    
    if (isCacheRelevant) {
      console.log('🔄 [useChatState] Syncing with cache for conversation:', currentConversationId);
      setStreamState(cache.streamState);
      setLiveReasoningText(cache.liveReasoningText);
      setAiMessages(cache.messages);
      setAiStatus(cache.aiStatus);
      setAiError(cache.aiError);
      setIsLoadingHistory(cache.isLoadingHistory);
    } else {
      console.log('🔄 [useChatState] Cache not relevant, resetting to empty state');
      setStreamState({ status: 'idle' });
      setLiveReasoningText('');
      setAiMessages([]);
      setAiStatus('ready');
      setAiError(null);
      setIsLoadingHistory(isLoadingConversation);
    }
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
    
    // Trigger message send via custom event (ChatManager listens)
    const event = new CustomEvent('chat:sendMessage', { 
      detail: { conversationId: currentConversationId, message } 
    });
    window.dispatchEvent(event);
    
    // Optimistically set waiting state
    setStreamState({ status: 'waiting', startTime: Date.now() });
    setLiveReasoningText('');
  };

  // Handle stop streaming
  const stopStreaming = () => {
    if (!currentConversationId || currentConversationId === 'temp-loading') return;
    
    console.log('🛑 [useChatState] Stopping stream');
    const event = new CustomEvent('chat:stop', { 
      detail: { conversationId: currentConversationId } 
    });
    window.dispatchEvent(event);
  };

  // Handle regenerate
  const regenerateMessage = () => {
    if (!currentConversationId || currentConversationId === 'temp-loading') return;
    
    console.log('🔄 [useChatState] Regenerating message');
    const event = new CustomEvent('chat:regenerate', { 
      detail: { conversationId: currentConversationId } 
    });
    window.dispatchEvent(event);
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
