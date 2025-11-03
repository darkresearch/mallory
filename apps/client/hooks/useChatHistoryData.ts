import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib';

const GLOBAL_TOKEN_ID = '00000000-0000-0000-0000-000000000000';

interface ConversationWithPreview {
  id: string;
  title: string;
  token_ca: string;
  created_at: string;
  updated_at: string;
  metadata?: {
    summary_title?: string;
    last_summary_generated_at?: string;
    message_count_at_last_summary?: number;
  };
}

interface AllMessagesCache {
  [conversationId: string]: {
    id: string;
    conversation_id: string;
    content: string;
    role: 'user' | 'assistant';
    created_at: string;
    metadata?: any;
  }[];
}

// Module-level cache (shared across all hook instances)
const cache = {
  conversations: null as ConversationWithPreview[] | null,
  allMessages: null as AllMessagesCache | null,
  timestamp: null as number | null,
  isLoading: false,
};

/**
 * Hook for loading and caching chat history data
 * Loads conversations and all messages, with module-level caching
 * to prevent redundant loads across screen navigations
 */
export function useChatHistoryData(userId?: string) {
  const [conversations, setConversations] = useState<ConversationWithPreview[]>(cache.conversations || []);
  const [allMessages, setAllMessages] = useState<AllMessagesCache>(cache.allMessages || {});
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Track if we've loaded for this user (prevents reload on remount)
  const hasLoadedForUserRef = useRef<string | null>(null);

  // Load conversations and all messages
  const loadConversationsAndMessages = useCallback(async (forceRefresh = false) => {
    if (!userId) return;
    
    // If forcing refresh, clear the cache
    if (forceRefresh) {
      console.log('🔄 [useChatHistoryData] Force refresh - clearing cache');
      cache.conversations = null;
      cache.allMessages = null;
      cache.timestamp = null;
      hasLoadedForUserRef.current = null;
    }
    
    // If we have cached data and not forcing refresh, use it
    if (cache.conversations && cache.allMessages && !forceRefresh) {
      console.log('📦 [useChatHistoryData] Using cached data');
      setConversations(cache.conversations);
      setAllMessages(cache.allMessages);
      setIsInitialized(true);
      return;
    }
    
    try {
      setIsLoading(true);
      
      console.log('🔄 [useChatHistoryData] Loading conversations for user:', userId);
      
      // First query: Get all general conversations for the user (including metadata)
      const { data: conversationsData, error: conversationsError } = await supabase
        .from('conversations')
        .select('id, title, token_ca, created_at, updated_at, metadata')
        .eq('user_id', userId)
        .eq('token_ca', GLOBAL_TOKEN_ID)
        .order('updated_at', { ascending: false });
      
      if (conversationsError) {
        console.error('Error fetching conversations:', conversationsError);
        setConversations([]);
        setAllMessages({});
        cache.conversations = [];
        cache.allMessages = {};
        return;
      }
      
      if (!conversationsData || conversationsData.length === 0) {
        console.log('📱 [useChatHistoryData] No conversations found for user');
        setConversations([]);
        setAllMessages({});
        cache.conversations = [];
        cache.allMessages = {};
        return;
      }
      
      // Get conversation IDs for message query
      const conversationIds = conversationsData.map(conv => conv.id);
      
      // Second query: Get ALL messages for these conversations (with metadata for search)
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('id, conversation_id, content, role, created_at, metadata')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: true }); // Oldest first for display order
      
      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
        // Still show conversations even if messages fail to load
        const conversationsOnly = conversationsData.map(conv => ({
          id: conv.id,
          title: conv.title,
          token_ca: conv.token_ca,
          created_at: conv.created_at,
          updated_at: conv.updated_at,
          metadata: conv.metadata,
          lastMessage: undefined
        }));
        setConversations(conversationsOnly);
        setAllMessages({});
        cache.conversations = conversationsOnly;
        cache.allMessages = {};
        return;
      }
      
      // Process the data
      const processedConversations: ConversationWithPreview[] = [];
      const messagesCache: AllMessagesCache = {};
      
      // Group messages by conversation
      conversationsData.forEach((conv: any) => {
        const conversationMessages = messagesData?.filter(msg => msg.conversation_id === conv.id) || [];
        
        // Store all messages for this conversation for search
        messagesCache[conv.id] = conversationMessages;
        
        // Add conversation with last message preview
        processedConversations.push({
          id: conv.id,
          title: conv.title,
          token_ca: conv.token_ca,
          created_at: conv.created_at,
          updated_at: conv.updated_at,
          metadata: conv.metadata,
        });
      });
      
      // Update both local state and cache
      setConversations(processedConversations);
      setAllMessages(messagesCache);
      cache.conversations = processedConversations;
      cache.allMessages = messagesCache;
      cache.timestamp = Date.now();
      
      console.log(`📱 [useChatHistoryData] Loaded ${processedConversations.length} conversations with ${Object.keys(messagesCache).reduce((total, convId) => total + messagesCache[convId].length, 0)} total messages`);
      
    } catch (error) {
      console.error('Error in loadConversationsAndMessages:', error);
    } finally {
      setIsLoading(false);
      setIsInitialized(true);
    }
  }, [userId]);

  // Real-time event handlers
  const handleConversationInsert = useCallback((newRecord: any) => {
    // Only add global conversations
    if (newRecord.token_ca !== GLOBAL_TOKEN_ID) return;
    
    const newConversation: ConversationWithPreview = {
      id: newRecord.id,
      title: newRecord.title,
      token_ca: newRecord.token_ca,
      created_at: newRecord.created_at,
      updated_at: newRecord.updated_at,
      metadata: newRecord.metadata,
    };
    
    setConversations(prev => {
      const updated = [newConversation, ...prev];
      cache.conversations = updated; // Update cache
      return updated;
    });
    console.log('✅ [useChatHistoryData] Added new conversation:', newRecord.id);
  }, []);

  const handleConversationUpdate = useCallback((newRecord: any) => {
    setConversations(prev => {
      const updated = prev.map(conv => 
        conv.id === newRecord.id 
          ? { ...conv, updated_at: newRecord.updated_at, metadata: newRecord.metadata }
          : conv
      ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      
      cache.conversations = updated; // Update cache
      return updated;
    });
    console.log('✅ [useChatHistoryData] Updated conversation:', newRecord.id);
  }, []);

  const handleConversationDelete = useCallback((oldRecord: any) => {
    setConversations(prev => {
      const updated = prev.filter(conv => conv.id !== oldRecord.id);
      cache.conversations = updated; // Update cache
      return updated;
    });
    setAllMessages(prev => {
      const updated = { ...prev };
      delete updated[oldRecord.id];
      cache.allMessages = updated; // Update cache
      return updated;
    });
    console.log('✅ [useChatHistoryData] Removed conversation:', oldRecord.id);
  }, []);

  const handleMessageInsert = useCallback((newRecord: any) => {
    const conversationId = newRecord.conversation_id;
    
    // Add to messages cache (at end, since oldest-first)
    setAllMessages(prev => {
      const updated = {
        ...prev,
        [conversationId]: [...(prev[conversationId] || []), newRecord]
      };
      cache.allMessages = updated; // Update cache
      return updated;
    });
    
    // Update conversation's updated_at
    setConversations(prev => {
      const updated = prev.map(conv => 
        conv.id === conversationId
          ? { 
              ...conv, 
              updated_at: newRecord.created_at, // Use message time as conversation update time
            }
          : conv
      ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      
      cache.conversations = updated; // Update cache
      return updated;
    });
    
    console.log('✅ [useChatHistoryData] Added new message to cache for conversation:', conversationId);
  }, []);

  const handleMessageUpdate = useCallback((newRecord: any) => {
    const conversationId = newRecord.conversation_id;
    
    setAllMessages(prev => {
      const updated = {
        ...prev,
        [conversationId]: (prev[conversationId] || []).map(msg =>
          msg.id === newRecord.id ? newRecord : msg
        )
      };
      cache.allMessages = updated; // Update cache
      return updated;
    });
    
    console.log('✅ [useChatHistoryData] Updated message in cache:', newRecord.id);
  }, []);

  const handleMessageDelete = useCallback((oldRecord: any) => {
    const conversationId = oldRecord.conversation_id;
    
    setAllMessages(prev => {
      const updated = {
        ...prev,
        [conversationId]: (prev[conversationId] || []).filter(msg => msg.id !== oldRecord.id)
      };
      cache.allMessages = updated; // Update cache
      return updated;
    });
    
    console.log('✅ [useChatHistoryData] Removed message from cache:', oldRecord.id);
  }, []);

  // Load data when userId changes (only if not already loaded for this user)
  useEffect(() => {
    if (userId && hasLoadedForUserRef.current !== userId) {
      console.log('🔄 [useChatHistoryData] New user or first load, loading data');
      hasLoadedForUserRef.current = userId;
      loadConversationsAndMessages();
    } else if (userId && cache.conversations) {
      // User hasn't changed and we have cached data - just update state from cache
      console.log('📦 [useChatHistoryData] Using existing cache for same user');
      setConversations(cache.conversations);
      setAllMessages(cache.allMessages || {});
      setIsInitialized(true);
    }
  }, [userId, loadConversationsAndMessages]);

  // Refresh function for pull-to-refresh
  const refresh = useCallback(async () => {
    await loadConversationsAndMessages(true);
  }, [loadConversationsAndMessages]);

  return {
    conversations,
    allMessages,
    isLoading,
    isInitialized,
    refresh,
    // Export handlers for real-time subscriptions (to be set up by the screen)
    handleConversationInsert,
    handleConversationUpdate,
    handleConversationDelete,
    handleMessageInsert,
    handleMessageUpdate,
    handleMessageDelete,
  };
}

/**
 * Export function to access messages for a specific conversation from cache
 * Allows other hooks/components to check cache without calling useChatHistoryData
 */
export function getCachedMessagesForConversation(conversationId: string): any[] | null {
  if (!cache.allMessages || !conversationId) return null;
  return cache.allMessages[conversationId] || null;
}

