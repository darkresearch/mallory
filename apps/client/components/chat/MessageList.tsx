import React, { useEffect, useRef } from 'react';
import { View, Text, ScrollView, Image, useWindowDimensions, Animated } from 'react-native';
import { SimpleMessageRenderer } from './SimpleMessageRenderer';
import { EmptyState } from './EmptyState';
import { PulsingStar } from './ChainOfThought/PulsingStar';
import { getDeviceInfo } from '@/lib/device';

/**
 * Immediate M logo placeholder - shows pulsing M instantly when user sends message
 * Same as the real M logo, so transition is seamless (no swap needed!)
 */
const ImmediateMLogoPlaceholder: React.FC<{ fadeOut?: boolean }> = ({ 
  fadeOut = false 
}) => {
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (fadeOut) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [fadeOut, fadeAnim]);

  return (
    <Animated.View style={{ alignItems: 'flex-start', paddingVertical: 4, paddingLeft: 0, opacity: fadeAnim }}>
      <PulsingStar size={16} />
    </Animated.View>
  );
};

interface MessageListProps {
  aiMessages: any[];
  aiStatus: string;
  aiError: any;
  hasInitialReasoning: boolean;
  liveReasoningText: string;
  thinkingDuration: number;
  isThinking: boolean;
  hasStreamStarted: boolean;
  isLoadingHistory?: boolean;
  regenerateMessage?: () => void;
  scrollViewRef: React.RefObject<ScrollView>;
  onScroll: (event: any) => void;
  onContentSizeChange: (width: number, height: number) => void;
  currentConversationId: string | null;
  conversationParam?: string;
  styles: any;
}

export const MessageList: React.FC<MessageListProps> = ({
  aiMessages,
  aiStatus,
  aiError,
  hasInitialReasoning,
  liveReasoningText,
  thinkingDuration,
  isThinking,
  hasStreamStarted,
  isLoadingHistory,
  regenerateMessage,
  scrollViewRef,
  onScroll,
  onContentSizeChange,
  currentConversationId,
  conversationParam,
  styles,
}) => {
  const { width: viewportWidth } = useWindowDimensions();
  const deviceInfo = getDeviceInfo(viewportWidth);
  
  console.log('🎬 MessageList render:', {
    aiMessagesLength: aiMessages.length,
    aiMessagesRoles: aiMessages.map(m => m.role),
    aiMessagesIds: aiMessages.map(m => m.id),
    aiStatus,
    hasInitialReasoning,
    liveReasoningTextLength: liveReasoningText.length,
    deviceInfo,
  });

  return (
    <ScrollView 
      ref={scrollViewRef}
      style={styles.messagesContainer} 
      contentContainerStyle={styles.messagesContent}
      onScroll={onScroll}
      onContentSizeChange={onContentSizeChange}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
    >
      {isLoadingHistory ? (
        // Loading historical messages
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading conversation history...</Text>
        </View>
      ) : aiMessages.length === 0 ? (
        // Empty state - only show when no messages AND no reasoning
        !hasInitialReasoning && (
          <EmptyState
            currentConversationId={currentConversationId}
            conversationParam={conversationParam}
            styles={styles}
          />
        )
      ) : (
        <>
          {/* Messages display in chronological order */}
          {aiMessages.map((message, index) => {
            const isUser = message.role === 'user';
            const textParts = message.parts.filter((part: any) => part.type === 'text');

            // For user messages, require text parts
            if (isUser && textParts.length === 0) {
              return null;
            }
            
            // For assistant messages, show even if no text parts (reasoning-only is fine)
            if (!isUser && message.parts.length === 0) {
              return null; // Only skip if completely empty
            }

            // Combine all text parts into a single string for processing
            const fullText = textParts.map((part: any) => part.text).join('');

            if (isUser) {
              // User messages: Keep existing chat bubble design
              return (
                <View
                  key={message.id}
                  style={styles.userMessageContainer}
                >
                  <View style={[styles.messageBubble, styles.userBubble]}>
                    <Text style={[styles.messageText, styles.userText]}>
                      {fullText}
                    </Text>
                  </View>
                </View>
              );
            } else {
              // Assistant messages: Simple, clean rendering
              const isLastMessage = index === aiMessages.length - 1;
              const isStreamingMessage = aiStatus === 'streaming' && isLastMessage;
              
              console.log('🤖 Rendering assistant message:', {
                messageId: message.id,
                index,
                isLastMessage,
                isStreamingMessage,
                aiStatus,
                liveReasoningTextLength: liveReasoningText.length,
                messagePartsLength: message.parts?.length || 0,
              });
              
              return (
                <View key={message.id} style={styles.assistantMessageContainer}>
                  <SimpleMessageRenderer
                    message={message}
                    isStreaming={isStreamingMessage}
                    isLastMessage={isLastMessage}
                    liveReasoningText={isStreamingMessage ? liveReasoningText : ''}
                    deviceInfo={deviceInfo}
                    onRegenerate={regenerateMessage}
                    onComponentError={(error) => {
                      console.warn('SimpleMessageRenderer component error:', error);
                    }}
                  />
                </View>
              );
            }
          })}
          
          {/* Show M logo immediately with smooth fade transition */}
          {(() => {
            if (!isThinking) return null;
            
            // M logo shows when: last message is REAL assistant (not placeholder), streaming, AND has parts
            const lastMessage = aiMessages[aiMessages.length - 1];
            const isRealAssistant = lastMessage?.role === 'assistant' && lastMessage.id !== 'placeholder-reasoning';
            const hasPartsToRender = lastMessage?.parts && lastMessage.parts.length > 0;
            const isMLogoShowing = isRealAssistant && aiStatus === 'streaming' && hasPartsToRender;
            
            // Show M logo placeholder - it will fade out when real M logo appears
            return <ImmediateMLogoPlaceholder fadeOut={isMLogoShowing} />;
          })()}
        </>
      )}
      
      {/* Show AI error if any */}
      {aiError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {aiError.message}</Text>
        </View>
      )}
    </ScrollView>
  );
};
