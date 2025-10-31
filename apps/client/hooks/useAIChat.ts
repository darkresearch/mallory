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
  const hasSetInitialMessagesRef = useRef(false);
  const lastVerifiedMessageCountRef = useRef(0);
  const [initialMessages, setInitialMessages] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const { width: viewportWidth } = useWindowDimensions();
  
  // Load historical messages when conversation ID changes
  useEffect(() => {
    // Reset state when conversation ID changes
    setInitialMessages([]);
    hasSetInitialMessagesRef.current = false; // Reset flag for new conversation
    lastVerifiedMessageCountRef.current = 0; // Reset verification count
    
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
    if (!isLoadingHistory && initialMessages.length > 0 && !hasSetInitialMessagesRef.current) {
      console.log('📖 Setting initial messages in useChat:', {
        initialCount: initialMessages.length,
        currentCount: messages.length
      });
      setMessages(initialMessages);
      hasSetInitialMessagesRef.current = true; // Mark as set
      lastVerifiedMessageCountRef.current = initialMessages.length;
    }
  }, [isLoadingHistory, initialMessages.length, setMessages, messages.length]);

  // Verify sync with server after AI completes responding
  // This helps catch any desync issues without disrupting UX
  useEffect(() => {
    // Only verify when:
    // 1. AI just finished responding (status changed from 'awaiting_message' to 'ready')
    // 2. We have messages to verify
    // 3. Message count has changed since last verification
    const justFinished = previousStatusRef.current === 'awaiting_message' && status === 'ready';
    const shouldVerify = 
      justFinished && 
      messages.length > 0 && 
      messages.length !== lastVerifiedMessageCountRef.current &&
      conversationId &&
      conversationId !== 'temp-loading';

    if (shouldVerify) {
      console.log('🔍 Verifying message sync with server after AI response:', {
        localCount: messages.length,
        lastVerified: lastVerifiedMessageCountRef.current
      });

      // Verify in background without blocking UI
      const verifySync = async () => {
        try {
          const serverMessages = await loadMessagesFromSupabase(conversationId);
          
          // Check if server has significantly different message count
          const diff = Math.abs(serverMessages.length - messages.length);
          
          if (diff > 0) {
            console.warn('⚠️ Client/Server message count mismatch:', {
              client: messages.length,
              server: serverMessages.length,
              difference: diff,
              conversationId
            });
            
            // Log message IDs for debugging
            const clientIds = messages.map(m => m.id).sort();
            const serverIds = serverMessages.map(m => m.id).sort();
            const missingOnServer = clientIds.filter(id => !serverIds.includes(id));
            const missingOnClient = serverIds.filter(id => !clientIds.includes(id));
            
            if (missingOnServer.length > 0) {
              console.warn('⚠️ Messages on client but not server:', missingOnServer);
            }
            if (missingOnClient.length > 0) {
              console.warn('⚠️ Messages on server but not client:', missingOnClient);
            }
            
            // Note: We log but don't auto-fix to avoid disrupting user experience
            // The next conversation load or refresh will sync correctly
          } else {
            console.log('✅ Message sync verified - client and server match:', messages.length);
          }
          
          lastVerifiedMessageCountRef.current = messages.length;
        } catch (error) {
          console.error('🔍 Error verifying message sync:', error);
        }
      };

      verifySync();
    }

    // Track status for next comparison
    previousStatusRef.current = status;
  }, [status, messages.length, conversationId]);

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
