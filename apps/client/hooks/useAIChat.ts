import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { fetch as expoFetch } from 'expo/fetch';
import { useWindowDimensions } from 'react-native';
import { generateAPIUrl } from '../lib';
import { saveMessagesToSupabase, loadMessagesFromSupabase } from '../features/chat';
import { secureStorage } from '../lib/storage';
import { getDeviceInfo } from '../lib/device';
import { useEffect, useRef, useState } from 'react';
import { useX402PaymentHandler } from './useX402PaymentHandler';

interface UseAIChatProps {
  conversationId: string;
  userId: string; // Required for Supermemory user-scoped memory
  onImmediateReasoning?: (text: string) => void;
  onImmediateToolCall?: (toolName: string) => void;
}

/**
 * AI Chat hook with required context
 * Server needs conversationId and clientContext for proper functionality
 */
export function useAIChat({ conversationId, userId, onImmediateReasoning, onImmediateToolCall }: UseAIChatProps) {
  const previousStatusRef = useRef<string>('ready');
  const [initialMessages, setInitialMessages] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const { width: viewportWidth } = useWindowDimensions();
  
  // Load historical messages when conversation ID changes
  useEffect(() => {
    const loadHistory = async () => {
      if (!conversationId || conversationId === 'temp-loading') return;
      
      setIsLoadingHistory(true);
      console.log('📖 Loading historical messages for conversation:', conversationId);
      
      try {
        const historicalMessages = await loadMessagesFromSupabase(conversationId);
        console.log('📖 Loaded historical messages:', {
          count: historicalMessages.length,
          messageIds: historicalMessages.map(m => m.id)
        });
        setInitialMessages(historicalMessages);
      } catch (error) {
        console.error('📖 Error loading historical messages:', error);
        setInitialMessages([]);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadHistory();
  }, [conversationId]);
  
  const { messages, error, sendMessage, regenerate, status, setMessages } = useChat({
    // Use DefaultChatTransport with API URL inside - required for Expo streaming
    transport: new DefaultChatTransport({
      fetch: async (url, options) => {
        // Get auth token and add to headers
        const token = await secureStorage.getItem('mallory_auth_token');
        const fetchOptions: any = {
          ...options,
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
        clientContext: {
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          currentTime: new Date().toISOString(),
          currentDate: new Date().toISOString(),
          device: getDeviceInfo(viewportWidth),
        }
      },
    }),
    id: conversationId,
    onError: error => console.error(error, 'AI Chat Error'),
    onData: (dataPart) => {
      console.log('🔄 useAIChat onData - IMMEDIATE:', dataPart.type, {
        hasText: !!(dataPart as any).text,
        textLength: (dataPart as any).text?.length || 0,
        timestamp: new Date().toISOString(),
        fullDataPart: dataPart
      });
      
      // The onData callback receives custom data, not reasoning parts
      // But we can use it to detect ANY streaming activity and show immediate feedback
      onImmediateReasoning?.('streaming detected');
    },
    
    // Add experimental throttling to see if it helps with immediate updates
    experimental_throttle: 100, // Update every 100ms instead of default
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

  // Save messages when streaming completes
  useEffect(() => {
    const saveMessages = async () => {
      console.log('💬 Save messages effect triggered:', {
        previousStatus: previousStatusRef.current,
        currentStatus: status,
        messageCount: messages.length,
        conversationId,
        shouldSave: previousStatusRef.current === 'streaming' && status === 'ready' && messages.length > 0
      });

      if (previousStatusRef.current === 'streaming' && status === 'ready' && messages.length > 0) {
        console.log('🏁 Stream completed - saving messages:', {
          messageCount: messages.length,
          conversationId,
          timestamp: new Date().toISOString(),
          messageIds: messages.map(m => m.id),
          messageRoles: messages.map(m => m.role)
        });

        try {
          console.log('🔄 Calling saveMessagesToSupabase...');
          const success = await saveMessagesToSupabase(conversationId, messages);
          console.log('🔄 saveMessagesToSupabase returned:', success);
          
          if (success) {
            console.log('✅ Messages saved successfully to Supabase');
          } else {
            console.error('❌ Failed to save messages - saveMessagesToSupabase returned false');
          }
        } catch (error) {
          console.error('❌ Error saving messages - exception thrown:', error);
          console.error('Error details:', {
            message: error instanceof Error ? error.message : 'Unknown',
            stack: error instanceof Error ? error.stack : 'N/A'
          });
        }
      }
      
      previousStatusRef.current = status;
    };

    saveMessages();
  }, [status, messages, conversationId]);

  // Handle x402 payments
  useX402PaymentHandler({
    messages,
    onPaymentFulfilled: (data, toolName) => {
      sendMessage({
        role: 'system',
        content: `[x402 Payment Completed] Tool: ${toolName}\nData: ${JSON.stringify(data)}`
      });
    }
  });

  return {
    messages,
    error, 
    sendMessage,
    regenerate,
    status,
    isLoadingHistory
  };
}
