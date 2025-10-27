import React from 'react';
import { View, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';
import { ChatInput } from '../../components/chat/ChatInput';
import { useSmartScroll } from '../../hooks/useSmartScroll';
import { ChatHeader } from '../../components/chat/ChatHeader';
import { MessageList } from '../../components/chat/MessageList';
import { useChatState } from '../../hooks/useChatState';
import { useConversationLoader } from '../../hooks/useConversationLoader';

export default function ChatScreen() {
  const router = useRouter();
  const auth = useAuth(); // Must call hooks unconditionally
  const { user, isLoading } = auth;
  const { walletData } = useWallet(); // Get wallet data for balance context

  // Load conversation
  const { currentConversationId, conversationParam } = useConversationLoader({ 
    userId: user?.id 
  });

  // Extract SOL and USDC balances from wallet holdings
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

  // Chat state management
  const {
    showImmediateReasoning,
    liveReasoningText,
    hasInitialReasoning,
    isLoadingHistory,
    thinkingDuration,
    isThinking,
    hasStreamStarted,
    isOnboardingGreeting,
    aiMessages,
    aiError,
    aiStatus,
    regenerateMessage,
    handleSendMessage,
    stopStreaming,
  } = useChatState({ 
    currentConversationId,
    userId: user?.id,  // Pass userId for Supermemory memory management
    walletBalance: walletBalance  // Pass wallet balance for x402 threshold checking
  });

  // Smart scroll behavior for chat messages
  // IMPORTANT: Must call all hooks before any conditional returns
  const { 
    scrollViewRef, 
    showScrollButton, 
    scrollToBottom, 
    handleScroll, 
    handleContentSizeChange 
  } = useSmartScroll();
  
  // Redirect unauthenticated users to login (e.g., when accessing /chat directly on web)
  React.useEffect(() => {
    if (!isLoading && !user) {
      console.log('⚠️ [ChatScreen] No authenticated user, redirecting to login');
      router.replace('/(auth)/login');
    }
  }, [user, isLoading, router]);
  
  // If no user, show nothing while redirect happens
  // This check happens AFTER all hooks are called
  if (!user) {
    return null;
  }

  return (
    <View 
      style={[
        styles.outerContainer,
        // On web, use static 100dvh (doesn't change with keyboard)
        Platform.OS === 'web' && {
          height: '100dvh' as any,
          maxHeight: '100dvh' as any,
        }
      ]}
    >
      <SafeAreaView style={styles.wideContainer} edges={['top', 'bottom']}>
        {/* Header with navigation */}
        <ChatHeader user={user} styles={styles} />

        {/* Main chat content - uses wide container for more space */}
        <KeyboardAvoidingView 
          style={styles.wideContentContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'web' ? undefined : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          enabled={Platform.OS !== 'web'}
        >
          {/* Messages Area */}
          <MessageList
            aiMessages={aiMessages}
            aiStatus={aiStatus}
            aiError={aiError}
            hasInitialReasoning={hasInitialReasoning}
            liveReasoningText={liveReasoningText}
            thinkingDuration={thinkingDuration}
            isThinking={isThinking}
            hasStreamStarted={hasStreamStarted}
            isOnboardingGreeting={isOnboardingGreeting}
            isLoadingHistory={isLoadingHistory}
            regenerateMessage={regenerateMessage}
            scrollViewRef={scrollViewRef}
            onScroll={handleScroll}
            onContentSizeChange={handleContentSizeChange}
            currentConversationId={currentConversationId}
            conversationParam={conversationParam}
            styles={styles}
          />

          {/* Scroll to bottom button - appears when not at bottom */}
          {showScrollButton && (
            <TouchableOpacity 
              style={styles.scrollToBottomButton}
              onPress={scrollToBottom}
            >
              <Ionicons name="arrow-down" size={16} color="#fff" />
            </TouchableOpacity>
          )}

          {/* Chat Input - Simplified: just send to AI, server handles storage */}
          {currentConversationId && (
            <ChatInput
              onSend={handleSendMessage}
              onStop={stopStreaming}
              onVoiceStart={() => {
                console.log('🎤 Voice recording started');
                // TODO: Implement voice recording
              }}
              onAttachmentPress={() => {
                console.log('📎 Attachment pressed');
                // TODO: Implement attachment handling
              }}
              disabled={false} // No loading state needed - useChat handles it
              hasMessages={aiMessages.length > 0}
              isStreaming={aiStatus === 'streaming'}
            />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#FFEFE3',
  },
  wideContainer: {
    flex: 1,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
  },
  container: {
    flex: 1,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  wideContentContainer: {
    flex: 1,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#FFEFE3',
  },
  headerButton: {
    padding: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wordmarkContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmarkImage: {
    height: 20,
    width: 87.5,
  },
  profileButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileGradientBorder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  profilePlaceholder: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1a1e24',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 8, // Reduced from 16 to align with chat input
    paddingTop: 16, // Add top padding for first message
    width: '100%', // Ensure it respects container width
  },
  userMessageContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  assistantMessageContainer: {
    width: '100%',
    marginBottom: 12,
  },
  messageBubble: {
    maxWidth: '80%',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 18,
  },
  userBubble: {
    backgroundColor: '#F6C69F',
    borderTopRightRadius: 6,
  },
  // assistantBubble removed - using StreamdownRN for rich content
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'Satoshi',
  },
  userText: {
    color: '#000000',
    // Web-specific: wrap long strings (e.g., Solana addresses)
    // Using overflowWrap instead of word-break to avoid layout issues
    ...(Platform.OS === 'web' && {
      overflowWrap: 'break-word',
    }),
  } as any,
  assistantText: {
    color: '#000000',
  },
  errorContainer: {
    padding: 12,
    backgroundColor: '#ff3b30',
    borderRadius: 8,
    margin: 16,
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingBottom: 50,
  },
  scoutLogo: {
    marginBottom: 24,
  },
  scoutIcon: {
    width: 48,
    height: 44,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
    fontFamily: 'Satoshi',
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#000000',
    textAlign: 'center',
    marginBottom: 32,
    fontFamily: 'Satoshi',
  },
  conversationInfo: {
    fontSize: 12,
    color: '#E67B25',
    textAlign: 'center',
    fontFamily: 'Satoshi',
  },
  scrollToBottomButton: {
    position: 'absolute',
    bottom: 80, // Above the chat input
    left: '50%',
    marginLeft: -20, // Half of button width to center
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E67B25',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#000000',
    fontSize: 16,
    fontFamily: 'Satoshi',
  },
});
