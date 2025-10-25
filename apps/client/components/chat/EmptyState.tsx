import React from 'react';
import { View } from 'react-native';

interface EmptyStateProps {
  currentConversationId: string | null;
  conversationParam?: string;
  styles: any;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  currentConversationId,
  conversationParam,
  styles,
}) => {
  return (
    <View style={styles.emptyState} />
  );
};
