import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib';

const GLOBAL_TOKEN_ID = '00000000-0000-0000-0000-000000000000';

interface UseChatHistoryPreloaderProps {
  userId?: string;
  enabled?: boolean; // Allow conditional enabling
}

interface ConversationWithMessages {
  id: string;
  title: string;
  token_ca: string;
  created_at: string;
  updated_at: string;
  metadata?: any;
}

interface MessageData {
  id: string;
  conversation_id: string;
  content: string;
  role: 'user' | 'assistant';
  created_at: string;
  metadata?: any;
}

interface AllMessagesCache {
  [conversationId: string]: MessageData[];
}

/**
 * Hook to preload chat history data in the background
 * This loads ALL conversations and ALL their messages so that when the user
 * navigates to the chat history screen, everything is already loaded and ready
 */
export function useChatHistoryPreloader({ userId, enabled = true }: UseChatHistoryPreloaderProps) {
  const [isPreloading, setIsPreloading] = useState(false);
  const [isPreloaded, setIsPreloaded] = useState(false);
  const hasPreloadedRef = useRef(false);
  
  // Store preloaded data for potential use by chat history screen
  const [preloadedConversations, setPreloadedConversations] = useState<ConversationWithMessages[]>([]);
  const [preloadedMessages, setPreloadedMessages] = useState<AllMessagesCache>({});

  useEffect(() => {
    // Only preload once per session
    if (!enabled || !userId || hasPreloadedRef.current || isPreloading) {
      return;
    }

    const preloadChatHistoryData = async () => {
      try {
        setIsPreloading(true);
        console.log('🔄 [ChatHistoryPreloader] Starting background preload of chat history data');

        // Step 1: Get all general conversations for the user
        console.log('🔄 [ChatHistoryPreloader] Loading all conversations...');
        const { data: conversationsData, error: conversationsError } = await supabase
          .from('conversations')
          .select('id, title, token_ca, created_at, updated_at, metadata')
          .eq('user_id', userId)
          .eq('token_ca', GLOBAL_TOKEN_ID)
          .order('updated_at', { ascending: false });
        
        if (conversationsError) {
          console.error('🔄 [ChatHistoryPreloader] Error fetching conversations:', conversationsError);
          throw conversationsError;
        }
        
        if (!conversationsData || conversationsData.length === 0) {
          console.log('🔄 [ChatHistoryPreloader] No conversations found for user');
          setPreloadedConversations([]);
          setPreloadedMessages({});
          hasPreloadedRef.current = true;
          setIsPreloaded(true);
          return;
        }
        
        console.log('🔄 [ChatHistoryPreloader] Loaded', conversationsData.length, 'conversations');
        
        // Step 2: Get ALL messages for these conversations
        const conversationIds = conversationsData.map(conv => conv.id);
        console.log('🔄 [ChatHistoryPreloader] Loading messages for', conversationIds.length, 'conversations...');
        
        const { data: messagesData, error: messagesError } = await supabase
          .from('messages')
          .select('id, conversation_id, content, role, created_at, metadata')
          .in('conversation_id', conversationIds)
          .order('created_at', { ascending: false });
        
        if (messagesError) {
          console.error('🔄 [ChatHistoryPreloader] Error fetching messages:', messagesError);
          // Still store conversations even if messages fail
          setPreloadedConversations(conversationsData);
          setPreloadedMessages({});
          hasPreloadedRef.current = true;
          setIsPreloaded(true);
          return;
        }
        
        // Step 3: Group messages by conversation
        const messagesCache: AllMessagesCache = {};
        conversationsData.forEach((conv: any) => {
          const conversationMessages = messagesData?.filter(msg => msg.conversation_id === conv.id) || [];
          messagesCache[conv.id] = conversationMessages;
        });
        
        const totalMessages = Object.values(messagesCache).reduce((total, msgs) => total + msgs.length, 0);
        console.log('🔄 [ChatHistoryPreloader] Preloaded', totalMessages, 'messages across', conversationIds.length, 'conversations');
        
        // Store preloaded data
        setPreloadedConversations(conversationsData);
        setPreloadedMessages(messagesCache);
        
        // Mark as preloaded
        hasPreloadedRef.current = true;
        setIsPreloaded(true);
        console.log('✅ [ChatHistoryPreloader] Chat history data preloaded successfully');
      } catch (error) {
        console.error('❌ [ChatHistoryPreloader] Error preloading chat history data:', error);
        // Don't set isPreloaded on error, but mark as attempted
        hasPreloadedRef.current = true;
      } finally {
        setIsPreloading(false);
      }
    };

    preloadChatHistoryData();
  }, [userId, enabled, isPreloading]);

  return {
    isPreloading,
    isPreloaded,
    preloadedConversations,
    preloadedMessages,
  };
}
