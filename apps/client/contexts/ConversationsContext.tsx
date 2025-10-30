import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib';
import { useAuth } from './AuthContext';

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
  lastMessage?: {
    content: string;
    role: 'user' | 'assistant';
    created_at: string;
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

interface ConversationsContextType {
  conversations: ConversationWithPreview[];
  allMessages: AllMessagesCache;
  isLoading: boolean;
  isInitialized: boolean;
  refreshConversations: () => Promise<void>;
  searchConversations: (query: string) => ConversationWithPreview[];
}

const ConversationsContext = createContext<ConversationsContextType | undefined>(undefined);

const GLOBAL_TOKEN_ID = '00000000-0000-0000-0000-000000000000';


export function ConversationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationWithPreview[]>([]);
  const [allMessages, setAllMessages] = useState<AllMessagesCache>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Debug logging: Track when conversations state changes
  useEffect(() => {
    console.log('🟢 [STATE CHANGE] Conversations state updated:', {
      count: conversations.length,
      conversations: conversations.map(c => ({
        id: c.id.substring(0, 8),
        title: c.metadata?.summary_title || 'no title',
        updated_at: c.updated_at
      }))
    });
  }, [conversations]);

  // Load conversations and all messages with two separate queries
  const loadConversationsAndMessages = async () => {
    if (!user?.id) return;
    
    try {
      setIsLoading(true);
      
      // First query: Get all general conversations for the user (including metadata)
      const { data: conversationsData, error: conversationsError } = await supabase
        .from('conversations')
        .select('id, title, token_ca, created_at, updated_at, metadata')
        .eq('user_id', user.id)
        .eq('token_ca', GLOBAL_TOKEN_ID)
        .order('updated_at', { ascending: false });
      
      if (conversationsError) {
        console.error('Error fetching conversations:', conversationsError);
        // Set empty state but still mark as initialized
        setConversations([]);
        setAllMessages({});
        return;
      }
      
      if (!conversationsData || conversationsData.length === 0) {
        console.log('📱 No conversations found for user');
        setConversations([]);
        setAllMessages({});
        return;
      }
      
      // Get conversation IDs for message query
      const conversationIds = conversationsData.map(conv => conv.id);
      
      // Second query: Get ALL messages for these conversations (with metadata for search)
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('id, conversation_id, content, role, created_at, metadata')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false });
      
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
          lastMessage: conversationMessages[0] || undefined // Already sorted by created_at DESC
        });
      });
      
      setConversations(processedConversations);
      setAllMessages(messagesCache);
      console.log(`📱 Loaded ${processedConversations.length} conversations with ${Object.keys(messagesCache).reduce((total, convId) => total + messagesCache[convId].length, 0)} total messages`);
      
      // Note: Summary title generation is now handled by serverless edge function
      // triggered automatically by database webhook on message INSERT
      
    } catch (error) {
      console.error('Error in loadConversationsAndMessages:', error);
    } finally {
      setIsLoading(false);
      setIsInitialized(true);
    }
  };

  // In-memory search through cached messages (super fast!)
  const searchConversations = (query: string): ConversationWithPreview[] => {
    if (!query.trim()) {
      return conversations;
    }
    
    const lowerQuery = query.toLowerCase();
    const matchingConversations: ConversationWithPreview[] = [];
    
    // Search through all cached messages
    Object.entries(allMessages).forEach(([conversationId, messages]) => {
      const hasMatch = messages.some(message => 
        message.content.toLowerCase().includes(lowerQuery)
      );
      
      if (hasMatch) {
        const conversation = conversations.find(conv => conv.id === conversationId);
        if (conversation) {
          // Find the most recent matching message for preview
          const matchingMessage = messages.find(message =>
            message.content.toLowerCase().includes(lowerQuery)
          );
          
          matchingConversations.push({
            ...conversation,
            lastMessage: matchingMessage || conversation.lastMessage
          });
        }
      }
    });
    
    // Sort by conversation updated_at (most recent first)
    return matchingConversations.sort((a, b) => 
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  };

  // Load data when user is available
  useEffect(() => {
    if (user?.id && !isInitialized) {
      console.log('🔄 Loading conversations in background for user:', user.id);
      loadConversationsAndMessages();
    }
  }, [user?.id, isInitialized]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!user?.id || !isInitialized) return;

    console.log('🔴 [REALTIME] Setting up real-time subscriptions for user:', user.id);
    console.log('🔴 [REALTIME] isInitialized:', isInitialized);
    console.log('🔴 [REALTIME] Current timestamp:', new Date().toISOString());

    // Set up authentication and subscriptions using the working pattern from main branch
    const setupSubscriptions = async () => {
      try {
        console.log('🔴 [REALTIME] Step 1: Getting auth session...');
        
        // Set up authentication for realtime (critical step from main branch)
        const { data: session, error: sessionError } = await supabase.auth.getSession();
        
        console.log('🔴 [REALTIME] Step 1 Result:', {
          hasSession: !!session?.session,
          hasAccessToken: !!session?.session?.access_token,
          tokenPrefix: session?.session?.access_token?.substring(0, 20) + '...',
          sessionError: sessionError,
          expiresAt: session?.session?.expires_at,
          user: session?.session?.user?.id
        });

        if (sessionError) {
          console.error('🔴 [REALTIME] Session error:', sessionError);
          return null;
        }

        if (!session?.session?.access_token) {
          console.error('🔴 [REALTIME] No access token available');
          return null;
        }

        console.log('🔴 [REALTIME] Step 2: Setting realtime auth...');
        
        try {
          await supabase.realtime.setAuth(session.session.access_token);
          console.log('🔴 [REALTIME] Step 2: Realtime auth set successfully');
        } catch (authError) {
          console.error('🔴 [REALTIME] Step 2: Failed to set realtime auth:', authError);
          return null;
        }

        console.log('🔴 [REALTIME] Step 3: Creating channel...');
        
        const channelName = `conversations:user:${user.id}`;
        console.log('🔴 [REALTIME] Channel name:', channelName);
        console.log('🔴 [REALTIME] Channel config:', { config: { private: true } });

        // Subscribe to conversation changes using working pattern
        const conversationsChannel = supabase
          .channel(channelName, {
            config: { private: true }
          })
          .on('broadcast', { event: 'INSERT' }, (payload) => {
            console.log('🔴 [REALTIME] 📡 Conversation INSERT broadcast received:', payload);
            console.log('🔴 [REALTIME] 📡 Payload structure:', JSON.stringify(payload, null, 2));
            console.log('🔴 [REALTIME] 📡 Timestamp:', new Date().toISOString());
            
            // Use the working payload parsing pattern
            const newData = payload.payload?.record || payload.record || payload.new || payload;
            console.log('🔴 [REALTIME] 📡 Parsed newData:', newData);
            
            if (newData) {
              const mappedPayload = {
                payload: {
                  eventType: 'INSERT',
                  new: newData,
                  old: null
                }
              };
              console.log('🔴 [REALTIME] 📡 Calling handleConversationChange with:', mappedPayload);
              handleConversationChange(mappedPayload);
            } else {
              console.log('🔴 [REALTIME] 📡 No valid newData found in INSERT payload');
            }
          })
          .on('broadcast', { event: 'UPDATE' }, (payload) => {
            console.log('🔴 [REALTIME] 📡 Conversation UPDATE broadcast received:', payload);
            console.log('🔴 [REALTIME] 📡 Timestamp:', new Date().toISOString());
            console.log('🔴 [REALTIME] 📡 Full payload structure:', JSON.stringify(payload, null, 2));
            
            const newData = payload.payload?.record || payload.record || payload.new || payload;
            console.log('🔴 [REALTIME] 📡 Parsed newData:', JSON.stringify(newData, null, 2));
            console.log('🔴 [REALTIME] 📡 newData.metadata:', newData?.metadata);
            console.log('🔴 [REALTIME] 📡 newData.updated_at:', newData?.updated_at);
            
            if (newData) {
              const mappedPayload = {
                payload: {
                  eventType: 'UPDATE',
                  new: newData,
                  old: null
                }
              };
              console.log('🔴 [REALTIME] 📡 Calling handleConversationChange with:', JSON.stringify(mappedPayload, null, 2));
              handleConversationChange(mappedPayload);
            } else {
              console.log('🔴 [REALTIME] 📡 No valid newData found in UPDATE payload');
            }
          })
          .on('broadcast', { event: 'DELETE' }, (payload) => {
            console.log('🔴 [REALTIME] 📡 Conversation DELETE broadcast received:', payload);
            console.log('🔴 [REALTIME] 📡 Timestamp:', new Date().toISOString());
            
            const oldData = payload.payload?.record || payload.record || payload.old || payload;
            console.log('🔴 [REALTIME] 📡 Parsed oldData:', oldData);
            
            if (oldData) {
              const mappedPayload = {
                payload: {
                  eventType: 'DELETE',
                  new: null,
                  old: oldData
                }
              };
              console.log('🔴 [REALTIME] 📡 Calling handleConversationChange with:', mappedPayload);
              handleConversationChange(mappedPayload);
            } else {
              console.log('🔴 [REALTIME] 📡 No valid oldData found in DELETE payload');
            }
          })
          .subscribe((status, error) => {
            console.log('🔴 [REALTIME] Step 4: Subscription status changed:', {
              status,
              error,
              timestamp: new Date().toISOString(),
              channelName
            });
            
            // Log additional details based on status
            if (status === 'SUBSCRIBED') {
              console.log('🔴 [REALTIME] ✅ Successfully subscribed to conversations channel!');
            } else if (status === 'TIMED_OUT') {
              console.error('🔴 [REALTIME] ❌ Subscription timed out - this is the main issue!');
              console.error('🔴 [REALTIME] ❌ Error details:', error);
            } else if (status === 'CLOSED') {
              console.error('🔴 [REALTIME] ❌ Subscription closed');
              console.error('🔴 [REALTIME] ❌ Error details:', error);
            } else if (status === 'CHANNEL_ERROR') {
              console.error('🔴 [REALTIME] ❌ Channel error');
              console.error('🔴 [REALTIME] ❌ Error details:', error);
            }
          });

        console.log('🔴 [REALTIME] Step 5: Channel creation completed successfully');
        console.log('🔴 [REALTIME] Channel details:', {
          channelName,
          state: conversationsChannel?.state,
          topic: conversationsChannel?.topic
        });
        
        return conversationsChannel;
      } catch (error) {
        console.error('🔴 [REALTIME] ❌ Error setting up realtime subscriptions:', error);
        console.error('🔴 [REALTIME] ❌ Error stack:', error instanceof Error ? error.stack : String(error));
        return null;
      }
    };

    let conversationsChannel: any = null;

    console.log('🔴 [REALTIME] Starting subscription setup...');
    setupSubscriptions().then(channel => {
      console.log('🔴 [REALTIME] Setup completed, channel received:', !!channel);
      conversationsChannel = channel;
      
      if (channel) {
        console.log('🔴 [REALTIME] Final channel state:', {
          state: channel.state,
          topic: channel.topic,
          bindings: channel.bindings?.length || 0
        });
      }
    }).catch(error => {
      console.error('🔴 [REALTIME] ❌ Setup failed:', error);
    });

    // Cleanup subscriptions
    return () => {
      console.log('🔴 [REALTIME] 🧹 Cleaning up real-time subscriptions');
      console.log('🔴 [REALTIME] 🧹 Channel exists:', !!conversationsChannel);
      
      if (conversationsChannel) {
        console.log('🔴 [REALTIME] 🧹 Removing channel:', conversationsChannel.topic);
        try {
          supabase.removeChannel(conversationsChannel);
          console.log('🔴 [REALTIME] 🧹 Channel removed successfully');
        } catch (error) {
          console.error('🔴 [REALTIME] 🧹 Error removing channel:', error);
        }
      }
    };
  }, [user?.id, isInitialized]);

  // Handle conversation changes from real-time broadcasts
  const handleConversationChange = (payload: any) => {
    console.log('🔵 [REALTIME UPDATE] handleConversationChange called');
    console.log('🔵 [REALTIME UPDATE] Full payload:', JSON.stringify(payload, null, 2));
    
    const { eventType, new: newRecord, old: oldRecord } = payload.payload || {};
    
    console.log('🔵 [REALTIME UPDATE] Parsed:', {
      eventType,
      hasNewRecord: !!newRecord,
      hasOldRecord: !!oldRecord,
      newRecordId: newRecord?.id,
      newRecordMetadata: newRecord?.metadata,
      newRecordUpdatedAt: newRecord?.updated_at
    });
    
    if (eventType === 'INSERT' && newRecord) {
      // New conversation created
      const newConversation: ConversationWithPreview = {
        id: newRecord.id,
        title: newRecord.title,
        token_ca: newRecord.token_ca,
        created_at: newRecord.created_at,
        updated_at: newRecord.updated_at,
        metadata: newRecord.metadata,
        lastMessage: undefined
      };
      
      console.log('🔵 [REALTIME UPDATE] INSERT - Adding new conversation:', newConversation);
      setConversations(prev => {
        const updated = [newConversation, ...prev];
        console.log('🔵 [REALTIME UPDATE] INSERT - New conversations count:', updated.length);
        return updated;
      });
      console.log('✅ Added new conversation to cache:', newRecord.id);
      
    } else if (eventType === 'UPDATE' && newRecord) {
      // Conversation updated (usually updated_at when new message arrives, or metadata like summary_title)
      console.log('🔵 [REALTIME UPDATE] UPDATE - Before update, current conversations count:', conversations.length);
      console.log('🔵 [REALTIME UPDATE] UPDATE - Updating conversation:', {
        id: newRecord.id,
        oldMetadata: conversations.find(c => c.id === newRecord.id)?.metadata,
        newMetadata: newRecord.metadata,
        oldUpdatedAt: conversations.find(c => c.id === newRecord.id)?.updated_at,
        newUpdatedAt: newRecord.updated_at
      });
      
      setConversations(prev => {
        const updated = prev.map(conv => 
          conv.id === newRecord.id 
            ? { ...conv, updated_at: newRecord.updated_at, metadata: newRecord.metadata }
            : conv
        ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        
        console.log('🔵 [REALTIME UPDATE] UPDATE - After update, conversations count:', updated.length);
        console.log('🔵 [REALTIME UPDATE] UPDATE - Updated conversation:', 
          updated.find(c => c.id === newRecord.id)
        );
        
        return updated;
      });
      console.log('✅ Updated conversation in cache:', newRecord.id);
      
    } else if (eventType === 'DELETE' && oldRecord) {
      // Conversation deleted
      console.log('🔵 [REALTIME UPDATE] DELETE - Removing conversation:', oldRecord.id);
      setConversations(prev => {
        const updated = prev.filter(conv => conv.id !== oldRecord.id);
        console.log('🔵 [REALTIME UPDATE] DELETE - New conversations count:', updated.length);
        return updated;
      });
      setAllMessages(prev => {
        const updated = { ...prev };
        delete updated[oldRecord.id];
        return updated;
      });
      console.log('✅ Removed conversation from cache:', oldRecord.id);
    } else {
      console.log('⚠️ [REALTIME UPDATE] Unknown event or missing data:', { eventType, hasNewRecord: !!newRecord, hasOldRecord: !!oldRecord });
    }
  };

  // Handle message changes from real-time broadcasts
  const handleMessageChange = (payload: any) => {
    const { eventType, new: newRecord, old: oldRecord } = payload.payload || {};
    
    if (eventType === 'INSERT' && newRecord) {
      // New message added
      const conversationId = newRecord.conversation_id;
      
      // Add to messages cache
      setAllMessages(prev => ({
        ...prev,
        [conversationId]: [newRecord, ...(prev[conversationId] || [])]
      }));
      
      // Update conversation's last message
      setConversations(prev => 
        prev.map(conv => 
          conv.id === conversationId
            ? { 
                ...conv, 
                lastMessage: {
                  content: newRecord.content,
                  role: newRecord.role,
                  created_at: newRecord.created_at
                }
              }
            : conv
        )
      );
      
      console.log('✅ Added new message to cache for conversation:', conversationId);
      
    } else if (eventType === 'UPDATE' && newRecord) {
      // Message updated
      const conversationId = newRecord.conversation_id;
      
      setAllMessages(prev => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).map(msg =>
          msg.id === newRecord.id ? newRecord : msg
        )
      }));
      
      console.log('✅ Updated message in cache:', newRecord.id);
      
    } else if (eventType === 'DELETE' && oldRecord) {
      // Message deleted
      const conversationId = oldRecord.conversation_id;
      
      setAllMessages(prev => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).filter(msg => msg.id !== oldRecord.id)
      }));
      
      console.log('✅ Removed message from cache:', oldRecord.id);
    }
  };

  // Refresh function for manual refresh
  const refreshConversations = async () => {
    await loadConversationsAndMessages();
  };

  return (
    <ConversationsContext.Provider
      value={{
        conversations,
        allMessages,
        isLoading,
        isInitialized,
        refreshConversations,
        searchConversations
      }}
    >
      {children}
    </ConversationsContext.Provider>
  );
}

export function useConversations() {
  const context = useContext(ConversationsContext);
  if (context === undefined) {
    throw new Error('useConversations must be used within a ConversationsProvider');
  }
  return context;
}