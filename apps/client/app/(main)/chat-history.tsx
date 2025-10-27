import React, { useEffect, useState, useMemo } from 'react';
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
import { useConversations } from '../../contexts/ConversationsContext';
import { useAuth } from '../../contexts/AuthContext';
import { secureStorage } from '../../lib';
import { PressableButton } from '../../components/ui/PressableButton';

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

export default function ChatHistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { 
    conversations, 
    isLoading, 
    isInitialized, 
    refreshConversations, 
    searchConversations 
  } = useConversations();
  
  const translateX = useSharedValue(-Dimensions.get('window').width);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredConversations, setFilteredConversations] = useState<ConversationWithPreview[]>([]);
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

  // Redirect guard: if user is logged out, redirect to login
  // This provides a safety net if AuthContext navigation fails
  useEffect(() => {
    if (!user) {
      console.log('🚪 [ChatHistoryScreen] User is null, redirecting to login');
      router.replace('/(auth)/login');
    }
  }, [user]);
  
  console.log('📜 ChatHistoryScreen rendered, initialized:', isInitialized, 'conversations:', conversations.length);
  console.log('📜 ChatHistoryScreen conversations metadata:', conversations.map(c => ({ 
    id: c.id.substring(0, 8), 
    title: c.metadata?.summary_title || 'no title',
    updated_at: c.updated_at 
  })));

  // Helper function to get display title for a conversation
  const getConversationDisplayTitle = (
    metadata?: { summary_title?: string },
    fallback: string = 'New conversation'
  ): string => {
    return metadata?.summary_title || fallback;
  };

  // Load current conversation ID for active indicator
  useEffect(() => {
    const loadCurrentConversationId = async () => {
      try {
        const currentId = await secureStorage.getItem('current_conversation_id');
        setCurrentConversationId(currentId);
      } catch (error) {
        console.error('Error loading current conversation ID:', error);
      }
    };
    loadCurrentConversationId();
  }, []);

  // Handle search with instant response (no network calls!)
  useEffect(() => {
    if (searchQuery.trim()) {
      const results = searchConversations(searchQuery);
      setFilteredConversations(results);
    } else {
      setFilteredConversations(conversations);
    }
  }, [searchQuery, conversations, searchConversations]);

  // Initialize filtered conversations when conversations load
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredConversations(conversations);
    }
  }, [conversations]);

  // Handle pull-to-refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshConversations();
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
    // Slide out to left with callback
    translateX.value = withTiming(
      -Dimensions.get('window').width,
      {
        duration: 350,
        easing: Easing.in(Easing.cubic),
      },
      () => {
        // Navigate directly to chat instead of router.back() to avoid issues with empty history stack
        runOnJS(() => router.push('/(main)/chat'))();
      }
    );
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

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
  const handleConversationTap = (conversationId: string) => {
    console.log('📱 Opening conversation:', conversationId);
    // Navigate to chat with the specific conversation ID
    router.push(`/(main)/chat?conversationId=${conversationId}`);
  };

  // Handle new chat creation
  const handleNewChat = async () => {
    // Prevent multiple rapid clicks
    if (isCreatingChat) {
      console.log('💬 Already creating a chat, ignoring duplicate click');
      return;
    }
    
    console.log('💬 Creating new chat');
    setIsCreatingChat(true);
    
    try {
      // Create new conversation directly with user ID
      const { createNewConversation } = await import('../../features/chat');
      const conversationData = await createNewConversation(user?.id);
      
      console.log('💬 New conversation created:', conversationData.conversationId);
      
      // Refresh conversations to include the newly created one
      // This ensures the list updates even if real-time broadcast doesn't fire
      console.log('💬 Refreshing conversations list to include new conversation');
      await refreshConversations();
      
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
      // Reset state on error so user can try again
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
