import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, RefreshControl, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  runOnJS,
  Easing
} from 'react-native-reanimated';
import { Dimensions } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { secureStorage, SESSION_STORAGE_KEYS, SECURE_STORAGE_KEYS, supabase } from '../../lib';
import { PressableButton } from '../../components/ui/PressableButton';
import { createNewConversation } from '../../features/chat';

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
  lastMessage?: {
    content: string;
    role: 'user' | 'assistant';
    created_at: string;
  };
}

interface MessageCache {
  id: string;
  conversation_id: string;
  content: string;
  role: 'user' | 'assistant';
  created_at: string;
  metadata?: any;
}

interface AllMessagesCache {
  [conversationId: string]: MessageCache[];
}

export default function ChatHistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  // State management
  const [conversations, setConversations] = useState<ConversationWithPreview[]>([]);
  const [allMessages, setAllMessages] = useState<AllMessagesCache>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  
  const translateX = useSharedValue(-Dimensions.get('window').width);
  
  // Determine if we're on mobile (small screen) or desktop/tablet
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width);
  const isMobile = windowWidth < 768; // Mobile breakpoint
  
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setWindowWidth(window.width);
    });
    
    return () => subscription?.remove();
  }, []);

  // Load all conversations and messages for search
  const loadConversationsAndMessages = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setIsLoading(true);
      console.log('📱 [ChatHistory] Loading conversations and messages for user:', user.id);
      
      // Query 1: Get all general conversations for the user (including metadata)
      const { data: conversationsData, error: conversationsError } = await supabase
        .from('conversations')
        .select('id, title, token_ca, created_at, updated_at, metadata')
        .eq('user_id', user.id)
        .eq('token_ca', GLOBAL_TOKEN_ID)
        .order('updated_at', { ascending: false });
      
      if (conversationsError) {
        console.error('📱 [ChatHistory] Error fetching conversations:', conversationsError);
        setConversations([]);
        setAllMessages({});
        return;
      }
      
      if (!conversationsData || conversationsData.length === 0) {
        console.log('📱 [ChatHistory] No conversations found');
        setConversations([]);
        setAllMessages({});
        return;
      }
      
      const conversationIds = conversationsData.map(conv => conv.id);
      
      // Query 2: Get ALL messages for these conversations
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('id, conversation_id, content, role, created_at, metadata')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false });
      
      if (messagesError) {
        console.error('📱 [ChatHistory] Error fetching messages:', messagesError);
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
      
      const totalMessages = Object.values(messagesCache).reduce((sum, msgs) => sum + msgs.length, 0);
      console.log(`📱 [ChatHistory] Loaded ${processedConversations.length} conversations with ${totalMessages} total messages`);
      
    } catch (error) {
      console.error('📱 [ChatHistory] Error in loadConversationsAndMessages:', error);
    } finally {
      setIsLoading(false);
      setIsInitialized(true);
    }
  }, [user?.id]);

  // Load data on mount
  useEffect(() => {
    if (user?.id && !isInitialized) {
      console.log('📱 [ChatHistory] Initial load for user:', user.id);
      loadConversationsAndMessages();
    }
  }, [user?.id, isInitialized, loadConversationsAndMessages]);

  // Set up real-time subscriptions for conversations and messages
  useEffect(() => {
    if (!user?.id || !isInitialized) return;

    console.log('🔴 [ChatHistory] Setting up real-time subscriptions');

    let conversationsChannel: any = null;

    const setupSubscriptions = async () => {
      try {
        // Set up authentication for realtime
        const { data: session, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session?.session?.access_token) {
          console.error('🔴 [ChatHistory] Session error or no access token');
          return null;
        }

        await supabase.realtime.setAuth(session.session.access_token);
        console.log('🔴 [ChatHistory] Realtime auth set successfully');

        const channelName = `chat-history:user:${user.id}`;
        
        // Subscribe to conversation and message changes
        conversationsChannel = supabase
          .channel(channelName, {
            config: { private: true }
          })
          // Conversation INSERT
          .on('broadcast', { event: 'conversation:INSERT' }, (payload) => {
            console.log('🔴 [ChatHistory] Conversation INSERT:', payload);
            const newData = payload.payload?.record || payload.record || payload.new || payload;
            if (newData && newData.token_ca === GLOBAL_TOKEN_ID) {
              handleConversationInsert(newData);
            }
          })
          // Conversation UPDATE (for title updates)
          .on('broadcast', { event: 'conversation:UPDATE' }, (payload) => {
            console.log('🔴 [ChatHistory] Conversation UPDATE:', payload);
            const newData = payload.payload?.record || payload.record || payload.new || payload;
            if (newData) {
              handleConversationUpdate(newData);
            }
          })
          // Conversation DELETE
          .on('broadcast', { event: 'conversation:DELETE' }, (payload) => {
            console.log('🔴 [ChatHistory] Conversation DELETE:', payload);
            const oldData = payload.payload?.record || payload.record || payload.old || payload;
            if (oldData) {
              handleConversationDelete(oldData);
            }
          })
          // Message INSERT (for last message preview and search)
          .on('broadcast', { event: 'message:INSERT' }, (payload) => {
            console.log('🔴 [ChatHistory] Message INSERT:', payload);
            const newData = payload.payload?.record || payload.record || payload.new || payload;
            if (newData) {
              handleMessageInsert(newData);
            }
          })
          // Message UPDATE
          .on('broadcast', { event: 'message:UPDATE' }, (payload) => {
            console.log('🔴 [ChatHistory] Message UPDATE:', payload);
            const newData = payload.payload?.record || payload.record || payload.new || payload;
            if (newData) {
              handleMessageUpdate(newData);
            }
          })
          // Message DELETE
          .on('broadcast', { event: 'message:DELETE' }, (payload) => {
            console.log('🔴 [ChatHistory] Message DELETE:', payload);
            const oldData = payload.payload?.record || payload.record || payload.old || payload;
            if (oldData) {
              handleMessageDelete(oldData);
            }
          })
          .subscribe((status, error) => {
            console.log('🔴 [ChatHistory] Subscription status:', status, error);
            if (status === 'SUBSCRIBED') {
              console.log('🔴 [ChatHistory] ✅ Successfully subscribed!');
            }
          });
        
        return conversationsChannel;
      } catch (error) {
        console.error('🔴 [ChatHistory] Error setting up subscriptions:', error);
        return null;
      }
    };

    setupSubscriptions().then(channel => {
      conversationsChannel = channel;
    });

    // Cleanup subscriptions
    return () => {
      console.log('🔴 [ChatHistory] Cleaning up subscriptions');
      if (conversationsChannel) {
        supabase.removeChannel(conversationsChannel);
      }
    };
  }, [user?.id, isInitialized]);

  // Real-time event handlers
  const handleConversationInsert = useCallback((newRecord: any) => {
    const newConversation: ConversationWithPreview = {
      id: newRecord.id,
      title: newRecord.title,
      token_ca: newRecord.token_ca,
      created_at: newRecord.created_at,
      updated_at: newRecord.updated_at,
      metadata: newRecord.metadata,
      lastMessage: undefined
    };
    
    setConversations(prev => [newConversation, ...prev]);
    console.log('✅ [ChatHistory] Added new conversation:', newRecord.id);
  }, []);

  const handleConversationUpdate = useCallback((newRecord: any) => {
    setConversations(prev => {
      const updated = prev.map(conv => 
        conv.id === newRecord.id 
          ? { ...conv, updated_at: newRecord.updated_at, metadata: newRecord.metadata }
          : conv
      ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      
      return updated;
    });
    console.log('✅ [ChatHistory] Updated conversation:', newRecord.id);
  }, []);

  const handleConversationDelete = useCallback((oldRecord: any) => {
    setConversations(prev => prev.filter(conv => conv.id !== oldRecord.id));
    setAllMessages(prev => {
      const updated = { ...prev };
      delete updated[oldRecord.id];
      return updated;
    });
    console.log('✅ [ChatHistory] Removed conversation:', oldRecord.id);
  }, []);

  const handleMessageInsert = useCallback((newRecord: MessageCache) => {
    const conversationId = newRecord.conversation_id;
    
    // Add to messages cache
    setAllMessages(prev => ({
      ...prev,
      [conversationId]: [newRecord, ...(prev[conversationId] || [])]
    }));
    
    // Update conversation's last message and updated_at
    setConversations(prev => 
      prev.map(conv => 
        conv.id === conversationId
          ? { 
              ...conv,
              updated_at: newRecord.created_at, // Use message time as conversation update time
              lastMessage: {
                content: newRecord.content,
                role: newRecord.role,
                created_at: newRecord.created_at
              }
            }
          : conv
      ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    );
    
    console.log('✅ [ChatHistory] Added new message to conversation:', conversationId);
  }, []);

  const handleMessageUpdate = useCallback((newRecord: MessageCache) => {
    const conversationId = newRecord.conversation_id;
    
    setAllMessages(prev => ({
      ...prev,
      [conversationId]: (prev[conversationId] || []).map(msg =>
        msg.id === newRecord.id ? newRecord : msg
      )
    }));
    
    console.log('✅ [ChatHistory] Updated message:', newRecord.id);
  }, []);

  const handleMessageDelete = useCallback((oldRecord: MessageCache) => {
    const conversationId = oldRecord.conversation_id;
    
    setAllMessages(prev => ({
      ...prev,
      [conversationId]: (prev[conversationId] || []).filter(msg => msg.id !== oldRecord.id)
    }));
    
    console.log('✅ [ChatHistory] Removed message:', oldRecord.id);
  }, []);

  // In-memory search through cached messages
  const searchConversations = useCallback((query: string): ConversationWithPreview[] => {
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
  }, [conversations, allMessages]);

  // Filtered conversations based on search
  const filteredConversations = useMemo(() => {
    return searchConversations(searchQuery);
  }, [searchQuery, searchConversations]);

  // Load current conversation ID for active indicator
  useEffect(() => {
    const loadCurrentConversationId = async () => {
      try {
        const currentId = await secureStorage.getItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID);
        setCurrentConversationId(currentId);
      } catch (error) {
        console.error('Error loading current conversation ID:', error);
      }
    };
    loadCurrentConversationId();
  }, []);

  // Handle pull-to-refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadConversationsAndMessages();
    setIsRefreshing(false);
  };

  // Group conversations by time period
  const groupedConversations = useMemo(() => {
    if (!filteredConversations.length) return {};
    
    const now = new Date();
    const startOfThisWeek = new Date(now);
    startOfThisWeek.setDate(now.getDate() - now.getDay()); // Start of this week (Sunday)
    startOfThisWeek.setHours(0, 0, 0, 0);
    
    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfThisWeek.getDate() - 7); // Start of last week
    
    const groups: { [key: string]: ConversationWithPreview[] } = {
      'This week': [],
      'Last week': [],
    };
    
    filteredConversations.forEach(conv => {
      const convDate = new Date(conv.updated_at);
      
      if (convDate >= startOfThisWeek) {
        groups['This week'].push(conv);
      } else if (convDate >= startOfLastWeek) {
        groups['Last week'].push(conv);
      } else {
        groups['Last week'].push(conv);
      }
    });
    
    // Remove empty groups
    Object.keys(groups).forEach(key => {
      if (groups[key].length === 0) {
        delete groups[key];
      }
    });
    
    return groups;
  }, [filteredConversations]);

  useEffect(() => {
    // Slide in from left with modern easing
    translateX.value = withTiming(0, {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    });
  }, []);

  const handleBack = () => {
    // Slide out to left with callback
    translateX.value = withTiming(
      -Dimensions.get('window').width,
      {
        duration: 350,
        easing: Easing.in(Easing.cubic),
      },
      () => {
        runOnJS(() => router.push('/(main)/chat'))();
      }
    );
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  // If no user, show nothing while AuthContext handles redirect
  if (!user) {
    return null;
  }

  // Helper function to format dates
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays <= 7) {
      return date.toLocaleDateString('en-US', { weekday: 'long' });
    } else if (diffDays <= 30) {
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  // Handle conversation tap
  const handleConversationTap = async (conversationId: string) => {
    console.log('📱 Opening conversation:', conversationId);
    
    // Save as active conversation in secure storage
    try {
      await secureStorage.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversationId);
      console.log('✅ Saved active conversation:', conversationId);
    } catch (error) {
      console.error('Error saving active conversation:', error);
    }
    
    // Navigate to chat with the specific conversation ID
    router.push(`/(main)/chat?conversationId=${conversationId}`);
  };

  // Handle new chat creation
  const handleNewChat = async () => {
    if (isCreatingChat) {
      console.log('💬 Already creating a chat, ignoring duplicate click');
      return;
    }
    
    console.log('💬 Creating new chat');
    setIsCreatingChat(true);
    
    try {
      // Create new conversation directly with user ID
      const conversationData = await createNewConversation(user?.id);
      
      console.log('💬 New conversation created:', conversationData.conversationId);
      
      // Refresh conversations to include the newly created one
      console.log('💬 Refreshing conversations list to include new conversation');
      await loadConversationsAndMessages();
      
      // Create navigation function to be called on the JS thread
      const navigateToNewChat = () => {
        console.log('💬 Navigating to new chat:', conversationData.conversationId);
        router.push(`/(main)/chat?conversationId=${conversationData.conversationId}`);
      };
      
      // Slide out to left with smooth transition, then navigate to new chat
      translateX.value = withTiming(
        -Dimensions.get('window').width,
        {
          duration: 350,
          easing: Easing.in(Easing.cubic),
        },
        () => {
          runOnJS(navigateToNewChat)();
        }
      );
    } catch (error) {
      console.error('💬 Error creating new chat:', error);
      setIsCreatingChat(false);
    }
  };

  // Helper function to get display title for a conversation
  const getConversationDisplayTitle = (
    metadata?: { summary_title?: string },
    fallback: string = 'New conversation'
  ): string => {
    return metadata?.summary_title || fallback;
  };

  // Render conversation item
  const renderConversationItem = ({ item }: { item: ConversationWithPreview }) => {
    const isActive = currentConversationId === item.id;
    const displayTitle = getConversationDisplayTitle(item.metadata, 'New conversation');
    const dateLabel = formatDate(item.updated_at);
    
    return (
      <View style={styles.conversationWrapper}>
        <TouchableOpacity 
          style={[styles.conversationItem, isActive && styles.conversationItemActive]}
          onPress={() => handleConversationTap(item.id)}
          activeOpacity={0.7}
        >
          <View style={styles.conversationContent}>
            {isActive && <View style={styles.activeIndicator} />}
            <Text style={styles.conversationTitle} numberOfLines={1}>
              {displayTitle}
            </Text>
            <Text style={styles.conversationDate}>{dateLabel}</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Animated.View style={[styles.outerContainer, animatedStyle]}>
      <SafeAreaView style={styles.wideContainer} edges={['top']}>
        {isMobile ? (
          /* Mobile layout: search bar and back arrow on same row */
          <View style={styles.mobileHeader}>
            {/* Search bar takes remaining space */}
            <View style={styles.mobileSearchContainer}>
              <Ionicons name="search" size={20} color="#E0CBB9" style={styles.searchIcon} />
              <TextInput
                style={[
                  styles.searchInput,
                  Platform.OS === 'web' && ({ outline: 'none' } as any)
                ]}
                placeholder="Search in chats"
                placeholderTextColor="#E0CBB9"
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                selectionColor="rgba(0, 0, 0, 0.3)"
                underlineColorAndroid="transparent"
              />
              {!isInitialized && (
                <ActivityIndicator size="small" color="#E67B25" style={styles.searchSpinner} />
              )}
            </View>
            
            {/* Back arrow on the right */}
            <TouchableOpacity 
              style={styles.mobileBackButton}
              onPress={handleBack}
            >
              <Ionicons name="arrow-forward" size={24} color="#FBAA69" />
            </TouchableOpacity>
          </View>
        ) : (
          /* Desktop/tablet layout: back arrow on separate row */
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={handleBack}
            >
              <Ionicons name="arrow-forward" size={24} color="#FBAA69" />
            </TouchableOpacity>
          </View>
        )}

        {/* Narrow container for chat history content */}
        <View style={styles.container}>
          {/* Search bar - only shown for desktop/tablet since mobile has it in header */}
          {!isMobile && (
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#E0CBB9" style={styles.searchIcon} />
              <TextInput
                style={[
                  styles.searchInput,
                  Platform.OS === 'web' && ({ outline: 'none' } as any)
                ]}
                placeholder="Search in chats"
                placeholderTextColor="#E0CBB9"
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                selectionColor="rgba(0, 0, 0, 0.3)"
                underlineColorAndroid="transparent"
              />
              {!isInitialized && (
                <ActivityIndicator size="small" color="#E67B25" style={styles.searchSpinner} />
              )}
            </View>
          )}

          {/* New Chat Button */}
          <PressableButton
            variant="ghost"
            size="medium"
            fullWidth
            onPress={handleNewChat}
            loading={isCreatingChat}
            icon={!isCreatingChat ? <Ionicons name="create-outline" size={20} color="#FBAA69" /> : undefined}
            style={styles.newChatButton}
            textStyle={styles.newChatText}
          >
            {isCreatingChat ? 'Creating chat...' : 'New chat'}
          </PressableButton>

          {/* Content area */}
          <View style={styles.content}>
          {!isInitialized && filteredConversations.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#E67B25" />
              <Text style={styles.loadingText}>Loading conversations...</Text>
            </View>
          ) : filteredConversations.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={48} color="#E67B25" />
              <Text style={styles.emptyStateTitle}>
                {searchQuery ? 'No matching conversations' : 'No conversations yet'}
              </Text>
              <Text style={styles.emptyStateSubtitle}>
                {searchQuery 
                  ? `No conversations found matching "${searchQuery}"`
                  : 'Start a new conversation to see your chat history'
                }
              </Text>
            </View>
          ) : (
            <ScrollView 
              style={styles.scrollContainer}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handleRefresh}
                  tintColor="#E67B25"
                  colors={["#E67B25"]}
                />
              }
            >
              {Object.entries(groupedConversations).map(([groupTitle, groupConversations]) => (
                <View key={groupTitle} style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>{groupTitle}</Text>
                  
                  {groupConversations.map((conversation) => (
                    <View key={conversation.id}>
                      {renderConversationItem({ item: conversation })}
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
          )}
        </View>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#FFEFE3',
  },
  wideContainer: {
    flex: 1,
    maxWidth: 1111,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
  },
  container: {
    flex: 1,
    maxWidth: 750,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#FFEFE3',
  },
  backButton: {
    padding: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mobileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#FFEFE3',
    gap: 12,
  },
  mobileBackButton: {
    padding: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: -8,
  },
  mobileSearchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#984400',
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#984400',
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFF2E8',
    padding: 0,
    fontFamily: 'Satoshi',
  },
  searchSpinner: {
    marginLeft: 8,
  },
  newChatButton: {
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 5,
    paddingVertical: 12,
    justifyContent: 'flex-start',
    backgroundColor: 'transparent',
  },
  newChatText: {
    fontSize: 16,
    color: '#000000',
    fontFamily: 'Satoshi',
  },
  content: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 60,
  },
  loadingText: {
    fontSize: 16,
    color: '#000000',
    marginTop: 16,
    fontFamily: 'Satoshi',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 60,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 24,
    marginBottom: 8,
    fontFamily: 'Satoshi',
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#000000',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 32,
    fontFamily: 'Satoshi',
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
    paddingHorizontal: 8,
    fontFamily: 'Satoshi',
  },
  conversationWrapper: {
    marginBottom: 16,
  },
  conversationItem: {
    paddingHorizontal: 8,
  },
  conversationItemActive: {
    backgroundColor: '#F6C69F',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  conversationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  activeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    marginRight: 12,
  },
  conversationTitle: {
    fontSize: 16,
    fontWeight: '400',
    color: '#000000',
    flex: 1,
    fontFamily: 'Satoshi',
  },
  conversationDate: {
    fontSize: 14,
    color: '#000000',
    fontFamily: 'Satoshi',
  },
});
