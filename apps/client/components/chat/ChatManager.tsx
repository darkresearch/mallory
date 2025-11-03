/**
 * ChatManager - Always-mounted component that manages active chat state
 * Similar to DataPreloader, this component stays mounted at app root
 * and keeps the useChat instance alive across navigation
 */

import React, { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { fetch as expoFetch } from 'expo/fetch';
import { useWindowDimensions } from 'react-native';
import { generateAPIUrl } from '../../lib';
import { loadMessagesFromSupabase, convertDatabaseMessageToUIMessage } from '../../features/chat';
import { storage, SECURE_STORAGE_KEYS } from '../../lib/storage';
import { getDeviceInfo } from '../../lib/device';
import { loadGridContextForX402, buildClientContext } from '@darkresearch/mallory-shared';
import { gridClientService } from '../../features/grid';
import { getCachedMessagesForConversation } from '../../hooks/useChatHistoryData';
import { updateChatCache, clearChatCache, isCacheForConversation } from '../../lib/chat-cache';
import { useAuth } from '../../contexts/AuthContext';
import { useWallet } from '../../contexts/WalletContext';

/**
 * ChatManager props
 */
interface ChatManagerProps {
  // Optional: could receive active conversation ID from parent
}

/**
 * ChatManager component - manages active chat state globally
 */
export function ChatManager({}: ChatManagerProps) {
  const { user } = useAuth();
  const { walletData } = useWallet();
  const { width: viewportWidth } = useWindowDimensions();
  
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const previousStatusRef = useRef<string>('ready');
  
  // Extract wallet balance
  const walletBalance = React.useMemo(() => {
    if (!walletData?.holdings) return undefined;
    
    const solHolding = walletData.holdings.find(h => h.tokenSymbol === 'SOL');
    const usdcHolding = walletData.holdings.find(h => h.tokenSymbol === 'USDC');
    
    return {
      sol: solHolding?.holdings,
      usdc: usdcHolding?.holdings,
      totalUsd: walletData.totalBalance
    };
  }, [walletData]);

  // Watch for active conversation ID changes from storage
  useEffect(() => {
    const checkActiveConversation = async () => {
      try {
        const activeId = await storage.persistent.getItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID);
        if (activeId !== currentConversationId) {
          console.log('🔄 [ChatManager] Active conversation changed:', { from: currentConversationId, to: activeId });
          
          // If switching conversations, stop previous stream and clear cache
          if (currentConversationId && currentConversationId !== activeId) {
            console.log('🛑 [ChatManager] Stopping previous conversation stream');
            stop();
            clearChatCache();
          }
          
          setCurrentConversationId(activeId);
        }
      } catch (error) {
        console.error('❌ [ChatManager] Error checking active conversation:', error);
      }
    };

    // Check immediately
    checkActiveConversation();
    
    // Poll for changes (simple approach, could use storage events)
    const interval = setInterval(checkActiveConversation, 500);
    
    return () => clearInterval(interval);
  }, [currentConversationId]);

  // Load historical messages when conversation ID changes
  useEffect(() => {
    if (!currentConversationId || currentConversationId === 'temp-loading') {
      console.log('🔍 [ChatManager] Skipping history load - invalid conversationId:', currentConversationId);
      setIsLoadingHistory(false);
      updateChatCache({ isLoadingHistory: false });
      return;
    }
    
    let isCancelled = false;
    
    const loadHistory = async () => {
      setIsLoadingHistory(true);
      updateChatCache({ isLoadingHistory: true, conversationId: currentConversationId });
      
      console.log('📖 [ChatManager] Loading historical messages for conversation:', currentConversationId);
      
      try {
        const startTime = Date.now();
        
        // Check cache first
        const cachedMessages = getCachedMessagesForConversation(currentConversationId);
        
        if (cachedMessages !== null) {
          console.log('📦 [ChatManager] Using cached messages:', cachedMessages.length, 'messages');
          
          const convertedMessages = cachedMessages.map(convertDatabaseMessageToUIMessage);
          const loadTime = Date.now() - startTime;
          
          if (!isCancelled) {
            console.log('✅ [ChatManager] Loaded cached messages:', {
              conversationId: currentConversationId,
              count: convertedMessages.length,
              loadTimeMs: loadTime,
            });
            setInitialMessages(convertedMessages);
            setIsLoadingHistory(false);
            updateChatCache({ isLoadingHistory: false });
          }
          return;
        }
        
        // Cache miss - load from database
        console.log('🔍 [ChatManager] Cache miss, loading from database');
        const historicalMessages = await loadMessagesFromSupabase(currentConversationId);
        const loadTime = Date.now() - startTime;
        
        if (!isCancelled) {
          console.log('✅ [ChatManager] Loaded historical messages:', {
            conversationId: currentConversationId,
            count: historicalMessages.length,
            loadTimeMs: loadTime,
          });
          setInitialMessages(historicalMessages);
          setIsLoadingHistory(false);
          updateChatCache({ isLoadingHistory: false });
        }
      } catch (error) {
        console.error('❌ [ChatManager] Error loading historical messages:', error);
        if (!isCancelled) {
          setInitialMessages([]);
          setIsLoadingHistory(false);
          updateChatCache({ isLoadingHistory: false });
        }
      }
    };

    loadHistory();
    
    return () => {
      isCancelled = true;
    };
  }, [currentConversationId]);
  
  // Initialize useChat for active conversation
  const { messages, error, sendMessage, regenerate, status, setMessages, stop } = useChat({
    transport: new DefaultChatTransport({
      fetch: async (url, options) => {
        const token = await storage.persistent.getItem(SECURE_STORAGE_KEYS.AUTH_TOKEN);
        
        const { gridSessionSecrets, gridSession } = await loadGridContextForX402({
          getGridAccount: async () => {
            const account = await gridClientService.getAccount();
            return account ? {
              authentication: account.authentication || account,
              address: account.address
            } : null;
          },
          getSessionSecrets: async () => {
            return await storage.persistent.getItem(SECURE_STORAGE_KEYS.GRID_SESSION_SECRETS);
          }
        });
        
        const existingBody = JSON.parse(options?.body as string || '{}');
        const enhancedBody = {
          ...existingBody,
          ...(gridSessionSecrets && gridSession ? { gridSessionSecrets, gridSession } : {})
        };
        
        const fetchOptions: any = {
          ...options,
          body: JSON.stringify(enhancedBody),
          headers: {
            ...options?.headers,
            'Authorization': `Bearer ${token}`,
          }
        };
        return expoFetch(url.toString(), fetchOptions) as unknown as Promise<Response>;
      },
      api: generateAPIUrl('/api/chat'),
      body: {
        conversationId: currentConversationId || 'temp-loading',
        clientContext: buildClientContext({
          viewportWidth: viewportWidth || undefined,
          getDeviceInfo: () => getDeviceInfo(viewportWidth),
          walletBalance: walletBalance
        })
      },
    }),
    id: currentConversationId || 'temp-loading',
    onError: error => console.error(error, 'AI Chat Error'),
    experimental_throttle: 100,
  });

  // Set initial messages after loading from database
  useEffect(() => {
    if (!isLoadingHistory && initialMessages.length > 0 && messages.length === 0) {
      console.log('📖 [ChatManager] Setting initial messages in useChat:', {
        initialCount: initialMessages.length,
        currentCount: messages.length
      });
      setMessages(initialMessages);
    }
  }, [isLoadingHistory, initialMessages.length, messages.length, setMessages]);

  // Update cache whenever messages or status changes
  useEffect(() => {
    if (!currentConversationId || currentConversationId === 'temp-loading') return;
    
    // Filter out system messages for display
    const displayMessages = messages.filter(msg => msg.role !== 'system');
    
    console.log('📝 [ChatManager] Updating cache with messages:', {
      conversationId: currentConversationId,
      messageCount: displayMessages.length,
      status,
    });
    
    updateChatCache({
      conversationId: currentConversationId,
      messages: displayMessages,
      aiStatus: status as any,
      aiError: error || null,
    });
  }, [messages, status, error, currentConversationId]);

  // Update stream state based on status and message content
  useEffect(() => {
    if (!currentConversationId || currentConversationId === 'temp-loading') return;
    
    const displayMessages = messages.filter(msg => msg.role !== 'system');
    
    if (status === 'streaming' && displayMessages.length > 0) {
      const lastMessage = displayMessages[displayMessages.length - 1];
      
      if (lastMessage.role === 'assistant') {
        const hasReasoningParts = lastMessage.parts?.some((p: any) => p.type === 'reasoning');
        const messageContent = (lastMessage as any).content;
        const hasTextContent = messageContent && typeof messageContent === 'string' && messageContent.trim().length > 0;
        
        // Extract reasoning text
        const reasoningParts = lastMessage.parts?.filter((p: any) => p.type === 'reasoning') || [];
        const liveReasoningText = reasoningParts.map((p: any) => p.text || '').join('\n\n');
        
        // Update cache with reasoning text
        updateChatCache({
          liveReasoningText,
        });
        
        // Determine stream state
        if (hasReasoningParts && !hasTextContent) {
          updateChatCache({
            streamState: { status: 'reasoning', startTime: Date.now() }
          });
        } else if (hasTextContent) {
          updateChatCache({
            streamState: { status: 'responding', startTime: Date.now() }
          });
        }
      }
    } else if (status === 'ready') {
      updateChatCache({
        streamState: { status: 'idle' },
        liveReasoningText: '',
      });
    }
  }, [status, messages, currentConversationId]);

  // Listen for custom events from useChatState
  useEffect(() => {
    const handleSendMessage = (event: Event) => {
      const { conversationId, message } = (event as CustomEvent).detail;
      
      // Only handle if it's for our current conversation
      if (conversationId === currentConversationId) {
        console.log('📨 [ChatManager] Received sendMessage event:', message);
        
        // Update cache to waiting state
        updateChatCache({
          streamState: { status: 'waiting', startTime: Date.now() },
          liveReasoningText: '',
        });
        
        // Send message via useChat
        sendMessage({ text: message });
      }
    };

    const handleStop = (event: Event) => {
      const { conversationId } = (event as CustomEvent).detail;
      
      if (conversationId === currentConversationId) {
        console.log('🛑 [ChatManager] Received stop event');
        stop();
      }
    };

    const handleRegenerate = (event: Event) => {
      const { conversationId } = (event as CustomEvent).detail;
      
      if (conversationId === currentConversationId) {
        console.log('🔄 [ChatManager] Received regenerate event');
        regenerate();
      }
    };

    window.addEventListener('chat:sendMessage', handleSendMessage);
    window.addEventListener('chat:stop', handleStop);
    window.addEventListener('chat:regenerate', handleRegenerate);

    return () => {
      window.removeEventListener('chat:sendMessage', handleSendMessage);
      window.removeEventListener('chat:stop', handleStop);
      window.removeEventListener('chat:regenerate', handleRegenerate);
    };
  }, [currentConversationId, sendMessage, stop, regenerate]);

  // This component renders nothing - it's just for state management
  return null;
}

