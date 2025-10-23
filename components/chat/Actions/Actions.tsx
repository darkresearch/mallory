import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ActionsProps } from './types';

/**
 * Actions container component
 * Mirrors Vercel AI SDK Actions component API for React Native
 * Displays action buttons in a horizontal row
 */
export const Actions: React.FC<ActionsProps> = ({
  children,
  style,
  visible = true,
}) => {
  if (!visible) {
    return null;
  }

  return (
    <View style={[styles.actionsContainer, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
  },
});

export default Actions;
