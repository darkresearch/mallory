/**
 * ChatManager - Always-mounted component that manages active chat state
 * Similar to DataPreloader, this component stays mounted at app root
 * and keeps the useChat instance alive across navigation
 */

import React, { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { fetch as expoFetch } from 'expo/fetch';
import { useWindowDimensions, Alert } from 'react-native';
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
import { useActiveConversationContext } from '../../contexts/ActiveConversationContext';
import { useGasAbstraction } from '../../contexts/GasAbstractionContext';

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
  
  // Get conversationId from context instead of internal state
  const { conversationId: currentConversationId } = useActiveConversationContext();
  
  // Get gasless mode preference (hook always called, returns null if not available)
  // Task 13.1: Gasless mode is checked and passed to backend via clientContext
  const gasAbstraction = useGasAbstraction();
  const gaslessMode = gasAbstraction?.gaslessEnabled || false;
  
  const [initialMessages, setInitialMessages] = useState<any[]>([]);
  const [initialMessagesConversationId, setInitialMessagesConversationId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const previousStatusRef = useRef<string>('ready');
  const conversationMessagesSetRef = useRef<string | null>(null);
  
  // Task 13.3: Track previous balance to detect sponsored transactions
  const previousBalanceRef = useRef<number | null>(null);
  const lastToolExecutionTimeRef = useRef<number>(0);
  
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

  // Initialize useChat for active conversation
  // IMPORTANT: This must be declared BEFORE any useEffects that call stop()
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
          walletBalance: walletBalance,
          gaslessMode: gaslessMode // Task 13.1: Gasless mode checked before tool transactions
        })
      },
    }),
    id: currentConversationId || 'temp-loading',
    onError: error => console.error(error, 'AI Chat Error'),
    experimental_throttle: 100,
  });

  // Track previous conversationId to detect changes
  const previousConversationIdRef = useRef<string | null>(null);
  
  // Stop stream and clear cache when conversation changes
  useEffect(() => {
    const previousId = previousConversationIdRef.current;
    
    if (previousId && previousId !== currentConversationId) {
      console.log('🔄 [ChatManager] Conversation changed:', { from: previousId, to: currentConversationId });
      console.log('🛑 [ChatManager] Stopping previous conversation stream');
      stop();
      clearChatCache();
    }
    
    previousConversationIdRef.current = currentConversationId;
  }, [currentConversationId, stop]);

  // Load historical messages when conversation ID changes
  useEffect(() => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔄 [ChatManager] CONVERSATION CHANGE EFFECT TRIGGERED');
    console.log('   New conversationId:', currentConversationId);
    console.log('   Current messages.length:', messages.length);
    console.log('   Current initialMessages.length:', initialMessages.length);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (!currentConversationId || currentConversationId === 'temp-loading') {
      console.log('🔍 [ChatManager] Skipping history load - invalid conversationId:', currentConversationId);
      setIsLoadingHistory(false);
      updateChatCache({ isLoadingHistory: false });
      return;
    }
    
    // Clear messages immediately when conversation changes to prevent showing old messages
    console.log('🧹 [ChatManager] Clearing messages for conversation switch to:', currentConversationId);
    console.log('   Before clear - messages.length:', messages.length);
    console.log('   Before clear - initialMessages.length:', initialMessages.length);
    setMessages([]);
    setInitialMessages([]);
    setInitialMessagesConversationId(null); // Track what conversation initialMessages belong to
    conversationMessagesSetRef.current = null; // Reset ref so new messages can be set
    console.log('✅ [ChatManager] Messages cleared (setMessages([]) and setInitialMessages([]) called)');
    console.log('✅ [ChatManager] Ref and conversationId tracker reset');
    
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
            console.log('📝 [ChatManager] Setting initialMessages to', convertedMessages.length, 'cached messages');
            setInitialMessages(convertedMessages);
            setInitialMessagesConversationId(currentConversationId); // Track which conversation these messages belong to
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
          console.log('📝 [ChatManager] Setting initialMessages to', historicalMessages.length, 'DB messages');
          setInitialMessages(historicalMessages);
          setInitialMessagesConversationId(currentConversationId); // Track which conversation these messages belong to
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

  // Set initial messages after loading from database
  useEffect(() => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📖 [ChatManager] SET INITIAL MESSAGES EFFECT');
    console.log('   isLoadingHistory:', isLoadingHistory);
    console.log('   initialMessages.length:', initialMessages.length);
    console.log('   initialMessagesConversationId:', initialMessagesConversationId);
    console.log('   messages.length:', messages.length);
    console.log('   conversationId:', currentConversationId);
    console.log('   conversationMessagesSetRef.current:', conversationMessagesSetRef.current);
    
    // Only set messages if:
    // 1. History loading is complete
    // 2. We have initialMessages to set
    // 3. InitialMessages are for the CURRENT conversation (prevents React batching bug!)
    // 4. We haven't already set messages for this conversation
    if (!isLoadingHistory && 
        initialMessages.length > 0 &&
        initialMessagesConversationId === currentConversationId &&
        conversationMessagesSetRef.current !== currentConversationId) {
      console.log('✅ [ChatManager] CALLING setMessages() with', initialMessages.length, 'messages');
      console.log('   First message ID:', initialMessages[0]?.id);
      console.log('   Last message ID:', initialMessages[initialMessages.length - 1]?.id);
      setMessages(initialMessages);
      conversationMessagesSetRef.current = currentConversationId;
      console.log('✅ [ChatManager] setMessages() called successfully and ref updated');
    } else {
      console.log('⏭️  [ChatManager] Skipping setMessages - condition not met');
      if (conversationMessagesSetRef.current === currentConversationId) {
        console.log('   Reason: Already set messages for this conversation');
      }
      if (initialMessagesConversationId !== currentConversationId) {
        console.log('   Reason: initialMessages are for wrong conversation');
        console.log('   initialMessages conversation:', initialMessagesConversationId);
        console.log('   current conversation:', currentConversationId);
      }
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }, [isLoadingHistory, initialMessages.length, initialMessagesConversationId, currentConversationId, setMessages]);

  // Update cache whenever messages or status changes
  useEffect(() => {
    if (!currentConversationId || currentConversationId === 'temp-loading') return;
    
    // Filter out system messages for display
    const displayMessages = messages.filter(msg => msg.role !== 'system');
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 [ChatManager] UPDATING CACHE WITH MESSAGES');
    console.log('   conversationId:', currentConversationId);
    console.log('   messageCount:', displayMessages.length);
    console.log('   status:', status);
    if (displayMessages.length > 0) {
      console.log('   First message:', displayMessages[0]?.id, '-', displayMessages[0]?.role);
      console.log('   Last message:', displayMessages[displayMessages.length - 1]?.id, '-', displayMessages[displayMessages.length - 1]?.role);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    updateChatCache({
      conversationId: currentConversationId,
      messages: displayMessages,
      aiStatus: status as any,
      aiError: error || null,
    });
    
    // Task 13.3: Check for tool execution (when status changes from streaming to ready)
    // This indicates a tool may have been executed
    if (status === 'ready' && previousStatusRef.current === 'streaming') {
      lastToolExecutionTimeRef.current = Date.now();
    }
    previousStatusRef.current = status;
  }, [messages, status, error, currentConversationId]);
  
  // Task 13.3: Monitor gas balance changes to detect sponsored transactions
  useEffect(() => {
    if (!gaslessMode || !gasAbstraction) return;
    
    const currentBalance = gasAbstraction.balanceBaseUnits || 0;
    const previousBalance = previousBalanceRef.current;
    
    // If balance decreased and we recently executed a tool, show notification
    if (previousBalance !== null && currentBalance < previousBalance) {
      const balanceDecrease = previousBalance - currentBalance;
      const timeSinceToolExecution = Date.now() - lastToolExecutionTimeRef.current;
      
      // Only show notification if balance decreased within 10 seconds of tool execution
      // This indicates a sponsored transaction from a tool
      if (timeSinceToolExecution < 10000 && balanceDecrease > 0) {
        const billedUsdc = balanceDecrease / 1_000_000;
        Alert.alert(
          'Gasless Transaction Sponsored',
          `Your transaction was sponsored using gas credits. Charged: ${billedUsdc.toFixed(6)} USDC.`,
          [{ text: 'OK' }]
        );
      }
    }
    
    previousBalanceRef.current = currentBalance;
  }, [gasAbstraction?.balanceBaseUnits, gaslessMode, gasAbstraction]);

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

