import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
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
import { storage, SECURE_STORAGE_KEYS, supabase } from '../../lib';
import { PressableButton } from '../../components/ui/PressableButton';
import { createNewConversation } from '../../features/chat';
import { useChatHistoryData } from '../../hooks/useChatHistoryData';
import { useActiveConversationContext } from '../../contexts/ActiveConversationContext';

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

export default function ChatHistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const { conversationId: contextConversationId, setConversationId: setGlobalConversationId } = useActiveConversationContext();
  
  const {
    conversations,
    allMessages,
    isLoading,
    isInitialized,
    refresh: refreshData,
    handleConversationInsert,
    handleConversationUpdate,
    handleConversationDelete,
    handleMessageInsert,
    handleMessageUpdate,
    handleMessageDelete,
  } = useChatHistoryData(user?.id);
  
  // Subscription channels refs for cleanup
  const conversationsChannelRef = useRef<any>(null);
  const messagesChannelRef = useRef<any>(null);
  
  const translateX = useSharedValue(-Dimensions.get('window').width);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  
  // Determine if we're on mobile (small screen) or desktop/tablet
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width);
  const isMobile = windowWidth < 768; // Mobile breakpoint
  
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setWindowWidth(window.width);
    });
    
    return () => subscription?.remove();
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
          matchingConversations.push(conversation);
        }
      }
    });
    
    // Sort by conversation updated_at (most recent first)
    return matchingConversations.sort((a, b) => 
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  }, [conversations, allMessages]);

  // Set up real-time subscriptions for conversations and messages
  // IMPORTANT: Only set up after initial load completes to prevent race conditions
  useEffect(() => {
    if (!user?.id || !isInitialized) return;

    console.log('🔴 [REALTIME] Setting up real-time subscriptions for user:', user.id);

    const setupSubscriptions = async () => {
      try {
        // Set up authentication for realtime
        const { data: session, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session?.session?.access_token) {
          console.error('🔴 [REALTIME] Session error:', sessionError);
          return;
        }

        try {
          await supabase.realtime.setAuth(session.session.access_token);
          console.log('🔴 [REALTIME] Realtime auth set successfully');
        } catch (authError) {
          console.error('🔴 [REALTIME] Failed to set realtime auth:', authError);
          return;
        }

        // Subscribe to conversation changes
        const conversationsChannelName = `conversations:user:${user.id}`;
        const conversationsChannel = supabase
          .channel(conversationsChannelName, {
            config: { private: true }
          })
          .on('broadcast', { event: 'INSERT' }, (payload) => {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🔴 [REALTIME RECEIVE] 📡 Conversation INSERT broadcast received!');
            console.log('🔴 [REALTIME RECEIVE] Full payload:', JSON.stringify(payload, null, 2));
            console.log('🔴 [REALTIME RECEIVE] payload.payload:', payload.payload);
            console.log('🔴 [REALTIME RECEIVE] payload.record:', payload.record);
            console.log('🔴 [REALTIME RECEIVE] payload.new:', payload.new);
            
            const newData = payload.payload?.record || payload.record || payload.new || payload;
            console.log('🔴 [REALTIME RECEIVE] Extracted newData:', newData);
            
            if (newData) {
              console.log('🔴 [REALTIME RECEIVE] Calling handleConversationInsert with:', newData);
              handleConversationInsert(newData);
              console.log('🔴 [REALTIME RECEIVE] handleConversationInsert called successfully');
            } else {
              console.error('🔴 [REALTIME RECEIVE] ❌ No valid data found in payload!');
            }
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          })
          .on('broadcast', { event: 'UPDATE' }, (payload) => {
            console.log('🔴 [REALTIME] 📡 Conversation UPDATE broadcast received:', payload);
            const newData = payload.payload?.record || payload.record || payload.new || payload;
            if (newData) {
              handleConversationUpdate(newData);
            }
          })
          .on('broadcast', { event: 'DELETE' }, (payload) => {
            console.log('🔴 [REALTIME] 📡 Conversation DELETE broadcast received:', payload);
            const oldData = payload.payload?.record || payload.record || payload.old || payload;
            if (oldData) {
              handleConversationDelete(oldData);
            }
          })
          .subscribe((status, error) => {
            console.log('🔴 [REALTIME] Conversations subscription status:', status, error);
            if (status === 'SUBSCRIBED') {
              console.log('🔴 [REALTIME] ✅ Successfully subscribed to conversations channel!');
            }
          });

        conversationsChannelRef.current = conversationsChannel;

        // Subscribe to message changes across all conversations
        const messagesChannelName = `messages:user:${user.id}`;
        const messagesChannel = supabase
          .channel(messagesChannelName, {
            config: { private: true }
          })
          .on('broadcast', { event: 'INSERT' }, (payload) => {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('💬 [REALTIME RECEIVE] 📡 Message INSERT broadcast received!');
            console.log('💬 [REALTIME RECEIVE] Full payload:', JSON.stringify(payload, null, 2));
            console.log('💬 [REALTIME RECEIVE] payload.payload:', payload.payload);
            console.log('💬 [REALTIME RECEIVE] payload.record:', payload.record);
            console.log('💬 [REALTIME RECEIVE] payload.new:', payload.new);
            
            const newData = payload.payload?.record || payload.record || payload.new || payload;
            console.log('💬 [REALTIME RECEIVE] Extracted newData:', newData);
            
            if (newData) {
              console.log('💬 [REALTIME RECEIVE] Calling handleMessageInsert with:', {
                messageId: newData.id,
                conversationId: newData.conversation_id,
                role: newData.role,
                contentLength: newData.content?.length
              });
              handleMessageInsert(newData);
              console.log('💬 [REALTIME RECEIVE] handleMessageInsert called successfully');
            } else {
              console.error('💬 [REALTIME RECEIVE] ❌ No valid data found in payload!');
            }
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          })
          .on('broadcast', { event: 'UPDATE' }, (payload) => {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('💬 [REALTIME RECEIVE] 📡 Message UPDATE broadcast received!');
            console.log('💬 [REALTIME RECEIVE] Full payload:', JSON.stringify(payload, null, 2));
            
            const newData = payload.payload?.record || payload.record || payload.new || payload;
            console.log('💬 [REALTIME RECEIVE] Extracted newData:', newData);
            
            if (newData) {
              console.log('💬 [REALTIME RECEIVE] Calling handleMessageUpdate with:', {
                messageId: newData.id,
                conversationId: newData.conversation_id
              });
              handleMessageUpdate(newData);
              console.log('💬 [REALTIME RECEIVE] handleMessageUpdate called successfully');
            } else {
              console.error('💬 [REALTIME RECEIVE] ❌ No valid data found in payload!');
            }
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          })
          .on('broadcast', { event: 'DELETE' }, (payload) => {
            console.log('🔴 [REALTIME] 📡 Message DELETE broadcast received:', payload);
            const oldData = payload.payload?.record || payload.record || payload.old || payload;
            if (oldData) {
              handleMessageDelete(oldData);
            }
          })
          .subscribe((status, error) => {
            console.log('🔴 [REALTIME] Messages subscription status:', status, error);
            if (status === 'SUBSCRIBED') {
              console.log('🔴 [REALTIME] ✅ Successfully subscribed to messages channel!');
            }
          });

        messagesChannelRef.current = messagesChannel;
        
      } catch (error) {
        console.error('🔴 [REALTIME] ❌ Error setting up realtime subscriptions:', error);
      }
    };

    setupSubscriptions();

    // Cleanup subscriptions
    return () => {
      console.log('🔴 [REALTIME] 🧹 Cleaning up real-time subscriptions');
      
      if (conversationsChannelRef.current) {
        try {
          supabase.removeChannel(conversationsChannelRef.current);
          console.log('🔴 [REALTIME] 🧹 Conversations channel removed');
        } catch (error) {
          console.error('🔴 [REALTIME] 🧹 Error removing conversations channel:', error);
        }
      }
      
      if (messagesChannelRef.current) {
        try {
          supabase.removeChannel(messagesChannelRef.current);
          console.log('🔴 [REALTIME] 🧹 Messages channel removed');
        } catch (error) {
          console.error('🔴 [REALTIME] 🧹 Error removing messages channel:', error);
        }
      }
    };
  }, [user?.id, isInitialized, handleConversationInsert, handleConversationUpdate, handleConversationDelete, handleMessageInsert, handleMessageUpdate, handleMessageDelete]);

  // Helper function to get display title for a conversation
  const getConversationDisplayTitle = (
    metadata?: { summary_title?: string },
    fallback: string = 'New conversation'
  ): string => {
    return metadata?.summary_title || fallback;
  };

  useEffect(() => {
    const loadCurrentConversationId = async () => {
      try {
        const currentId = contextConversationId || await storage.persistent.getItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID);
        setCurrentConversationId(currentId);
      } catch (error) {
        console.error('Error loading current conversation ID:', error);
        setCurrentConversationId(contextConversationId);
      }
    };
    loadCurrentConversationId();
  }, [contextConversationId]);

  useEffect(() => {
    setIsCreatingChat(false);
    return () => {
      setIsCreatingChat(false);
    };
  }, []);

  // Filtered conversations based on search (using useMemo for performance)
  const filteredConversations = useMemo(() => {
    return searchConversations(searchQuery);
  }, [searchQuery, searchConversations, conversations, allMessages]);

  // Handle pull-to-refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshData(); // Use refresh from hook
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
        // For conversations older than last week, we could add more groups
        // For now, put them in "Last week" to keep it simple
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
    translateX.value = withTiming(
      -Dimensions.get('window').width,
      {
        duration: 350,
        easing: Easing.in(Easing.cubic),
      },
      () => {
        runOnJS(async () => {
          try {
            const activeConversationId = await storage.persistent.getItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID);
            if (activeConversationId) {
              router.push(`/(main)/chat?conversationId=${activeConversationId}`);
            } else {
              router.push('/(main)/chat');
            }
          } catch (error) {
            console.error('Error reading conversationId from storage:', error);
            router.push('/(main)/chat');
          }
        })();
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
    
    // Save as active conversation in secure storage (persists across sessions)
    try {
      await storage.persistent.setItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversationId);
      console.log('✅ Saved active conversation:', conversationId);
    } catch (error) {
      console.error('Error saving active conversation:', error);
    }
    
    // Create navigation function to be called on the JS thread
    const navigateToChat = () => {
      console.log('📱 Navigating to conversation:', conversationId);
      router.push(`/(main)/chat?conversationId=${conversationId}`);
    };
    
    // Slide out to left with smooth transition, then navigate to chat
    translateX.value = withTiming(
      -Dimensions.get('window').width,
      {
        duration: 350,
        easing: Easing.in(Easing.cubic),
      },
      () => {
        runOnJS(navigateToChat)();
      }
    );
  };

  const handleNewChat = async () => {
    if (isCreatingChat) {
      return;
    }
    
    setIsCreatingChat(true);
    
    try {
      const conversationData = await createNewConversation(user?.id);
      setCurrentConversationId(conversationData.conversationId);
      router.push(`/(main)/chat?conversationId=${conversationData.conversationId}`);
      
      setTimeout(() => {
        setIsCreatingChat(false);
      }, 100);
    } catch (error) {
      console.error('Error creating new chat:', error);
      setIsCreatingChat(false);
    }
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
              {isLoading && (
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
          /* Desktop/tablet layout: back arrow and search on separate rows */
          <>
            <View style={styles.header}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={handleBack}
              >
                <Ionicons name="arrow-forward" size={24} color="#FBAA69" />
              </TouchableOpacity>
            </View>
          </>
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
              {isLoading && (
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
          {isLoading && filteredConversations.length === 0 ? (
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
    paddingHorizontal: 6, // Reduced screen-level padding to allow active pill to be wider
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
    marginRight: -8, // Align with edge
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
    justifyContent: 'flex-start', // Left align
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
    paddingHorizontal: 8, // Additional 8px padding to create 14px total from screen edge (6+8)
    fontFamily: 'Satoshi',
  },
  conversationWrapper: {
    marginBottom: 16,
  },
  conversationItem: {
    paddingHorizontal: 8, // Additional 8px padding to create 14px total from screen edge (6+8)
  },
  conversationItemActive: {
    backgroundColor: '#F6C69F',
    borderRadius: 14,
    paddingHorizontal: 10, // Active conversation gets less additional padding - closer to screen edge
    paddingVertical: 4, // Add some vertical padding for the pill
  },
  conversationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12, // Increased vertical padding for better visual balance
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
