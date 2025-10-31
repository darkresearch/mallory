import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { fetch as expoFetch } from 'expo/fetch';
import { useWindowDimensions } from 'react-native';
import { generateAPIUrl } from '../lib';
import { loadMessagesFromSupabase } from '../features/chat';
import { secureStorage } from '../lib/storage';
import { getDeviceInfo } from '../lib/device';
import { useEffect, useRef, useState } from 'react';
import { loadGridContextForX402, buildClientContext } from '@darkresearch/mallory-shared';
import { gridClientService } from '../features/grid';

interface UseAIChatProps {
  conversationId: string;
  userId: string; // Required for Supermemory user-scoped memory
  walletBalance?: {
    sol?: number;
    usdc?: number;
    totalUsd?: number;
  };
}

/**
 * AI Chat hook with required context
 * Server needs conversationId and clientContext for proper functionality
 */
export function useAIChat({ conversationId, userId, walletBalance }: UseAIChatProps) {
  const previousStatusRef = useRef<string>('ready');
  const [initialMessages, setInitialMessages] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const { width: viewportWidth } = useWindowDimensions();
  
  // Load historical messages when conversation ID changes
  useEffect(() => {
    // Reset state when conversation ID changes
    setInitialMessages([]);
    
    // Don't load if conversationId is invalid
    if (!conversationId || conversationId === 'temp-loading') {
      setIsLoadingHistory(false);
      return;
    }
    
    let isCancelled = false;
    
    const loadHistory = async () => {
      setIsLoadingHistory(true);
      console.log('📖 Loading historical messages for conversation:', conversationId);
      
      try {
        const historicalMessages = await loadMessagesFromSupabase(conversationId);
        
        // Only update if this effect hasn't been cancelled (conversationId changed)
        if (!isCancelled) {
          console.log('📖 Loaded historical messages:', {
            count: historicalMessages.length,
            messageIds: historicalMessages.map(m => m.id)
          });
          setInitialMessages(historicalMessages);
          setIsLoadingHistory(false);
        }
      } catch (error) {
        console.error('📖 Error loading historical messages:', error);
        if (!isCancelled) {
          setInitialMessages([]);
          setIsLoadingHistory(false);
        }
      }
    };

    loadHistory();
    
    // Cleanup: mark as cancelled if conversationId changes before loading completes
    return () => {
      isCancelled = true;
    };
  }, [conversationId]);
  
  const { messages, error, sendMessage, regenerate, status, setMessages, stop } = useChat({
    // Use DefaultChatTransport with API URL inside - required for Expo streaming
    transport: new DefaultChatTransport({
      fetch: async (url, options) => {
        // Get auth token and Grid session secrets
        const { SECURE_STORAGE_KEYS } = await import('@/lib/storage/keys');
        const token = await secureStorage.getItem(SECURE_STORAGE_KEYS.AUTH_TOKEN);
        
        // Get Grid context for x402 payments (shared utility)
        const { gridSessionSecrets, gridSession } = await loadGridContextForX402({
          getGridAccount: async () => {
            const account = await gridClientService.getAccount();
            console.log('🔐 [useAIChat] Grid account structure:', {
              hasAccount: !!account,
              accountKeys: account ? Object.keys(account) : [],
              hasAddress: !!account?.address,
              address: account?.address,
              hasAuthentication: !!account?.authentication
            });
            // Transform to match test structure (authentication + address at top level)
            // Grid SDK might store these differently, but backend needs both accessible
            return account ? {
              authentication: account.authentication || account,
              address: account.address
            } : null;
          },
          getSessionSecrets: async () => {
            return await secureStorage.getItem(SECURE_STORAGE_KEYS.GRID_SESSION_SECRETS);
          }
        });
        
        if (gridSessionSecrets && gridSession) {
          console.log('═══════════════════════════════════════════════════════════');
          console.log('✅ GRID CONTEXT LOADED FOR X402');
          console.log('═══════════════════════════════════════════════════════════');
          console.log('Grid Address:', gridSession.address);
          console.log('Has Session Secrets:', !!gridSessionSecrets);
          console.log('Has Authentication:', !!gridSession);
          console.log();
          console.log('🔍 SEARCH FOR THIS: "GRID CONTEXT LOADED FOR X402"');
          console.log('═══════════════════════════════════════════════════════════');
          console.log();
        } else {
          console.warn('⚠️ Grid context NOT available - x402 payments will not work');
        }
        
        // Parse existing body and add Grid context
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
        conversationId,
        // userId removed - now comes from authenticated token on server
        clientContext: buildClientContext({
          viewportWidth: viewportWidth || undefined,
          getDeviceInfo: () => getDeviceInfo(viewportWidth),
          walletBalance: walletBalance
        })
      },
    }),
    id: conversationId,
    onError: error => console.error(error, 'AI Chat Error'),
    
    // Add experimental throttling for smoother updates
    experimental_throttle: 100, // Update every 100ms
  });

  // Set initial messages after loading from database
  useEffect(() => {
    if (!isLoadingHistory && initialMessages.length > 0 && messages.length === 0) {
      console.log('📖 Setting initial messages in useChat:', {
        initialCount: initialMessages.length,
        currentCount: messages.length
      });
      setMessages(initialMessages);
    }
  }, [isLoadingHistory, initialMessages, messages.length, setMessages]);

  // Message persistence is now handled server-side
  // Complete messages are saved after streaming completes, ensuring reliability without incremental overhead

  // x402 payments now handled server-side - no client-side handler needed

  return {
    messages,
    error, 
    sendMessage,
    regenerate,
    status,
    isLoadingHistory,
    stop
  };
}
