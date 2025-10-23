import React, { useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Alert, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Actions } from './Actions';
import { Action } from './Action';
import { MessageActionsData } from './types';

// Re-export components for external use
export { Actions, Action };
export type { ActionProps, ActionsProps, MessageActionsData } from './types';

/**
 * Pre-built MessageActions component with common actions
 * This is the main component you'll use for assistant messages
 */
export const MessageActions: React.FC<MessageActionsData> = ({
  messageId,
  messageContent,
  isLastMessage,
  onRegenerate,
  onLike,
  onDislike,
  onCopy,
  onShare,
}) => {
  const [likeState, setLikeState] = useState<'none' | 'liked' | 'disliked'>('none');

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(messageContent);
      Alert.alert('Copied', 'Message copied to clipboard');
      onCopy?.();
    } catch (error) {
      console.error('Failed to copy:', error);
      Alert.alert('Error', 'Failed to copy message');
    }
  };

  const handleShare = async () => {
    try {
      const result = await Share.share({
        message: messageContent,
        title: 'Scout AI Response',
      });
      
      if (result.action === Share.sharedAction) {
        onShare?.();
      }
    } catch (error) {
      console.error('Failed to share:', error);
      Alert.alert('Error', 'Failed to share message');
    }
  };

  const handleLike = () => {
    const newState = likeState === 'liked' ? 'none' : 'liked';
    setLikeState(newState);
    onLike?.();
  };

  const handleDislike = () => {
    const newState = likeState === 'disliked' ? 'none' : 'disliked';
    setLikeState(newState);
    onDislike?.();
  };

  const handleRegenerate = () => {
    onRegenerate?.();
  };

  return (
    <Actions>
      {/* Retry/Regenerate - only show for last message */}
      {isLastMessage && onRegenerate && (
        <Action
          label="Retry"
          onPress={handleRegenerate}
        >
          <Ionicons name="refresh" size={14} color="#DCE9FF" />
        </Action>
      )}
      
      {/* Like */}
      <Action
        label="Like"
        onPress={handleLike}
        isToggle={true}
        isActive={likeState === 'liked'}
      >
        <Ionicons 
          name={likeState === 'liked' ? "thumbs-up" : "thumbs-up-outline"} 
          size={14} 
          color={likeState === 'liked' ? "#3b82f6" : "#DCE9FF"} 
        />
      </Action>

      {/* Dislike */}
      <Action
        label="Dislike"
        onPress={handleDislike}
        isToggle={true}
        isActive={likeState === 'disliked'}
      >
        <Ionicons 
          name={likeState === 'disliked' ? "thumbs-down" : "thumbs-down-outline"} 
          size={14} 
          color={likeState === 'disliked' ? "#ef4444" : "#DCE9FF"} 
        />
      </Action>

      {/* Copy */}
      <Action
        label="Copy"
        onPress={handleCopy}
      >
        <Ionicons name="copy-outline" size={14} color="#DCE9FF" />
      </Action>

      {/* Share */}
      <Action
        label="Share"
        onPress={handleShare}
      >
        <Ionicons name="share-outline" size={14} color="#DCE9FF" />
      </Action>
    </Actions>
  );
};
