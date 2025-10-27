import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChainOfThoughtHeaderProps } from './types';

/**
 * ChainOfThoughtHeader - Collapsible trigger with brain icon
 * Mirrors Vercel's AI SDK ChainOfThoughtHeader for React Native
 */
export const ChainOfThoughtHeader: React.FC<ChainOfThoughtHeaderProps> = ({
  children,
  isOpen,
  onPress,
  style,
  textStyle,
}) => {
  return (
    <TouchableOpacity
      style={[styles.header, style]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={isOpen ? "Collapse chain of thought" : "Expand chain of thought"}
      accessibilityState={{ expanded: isOpen }}
    >
      <Ionicons 
        name="layers" 
        size={16} 
        color="#C95900" 
        style={[styles.icon, { opacity: 0.8 }]} 
      />
      
      <Text style={[styles.text, textStyle]}>
        {children || 'Chain of Thought'}
      </Text>
      
      <Ionicons 
        name="chevron-down"
        size={16}
        color="#C95900"
        style={[
          styles.chevron,
          { opacity: 0.8 },
          isOpen && styles.chevronRotated,
        ]}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingVertical: 8,
    gap: 8,
  },
  icon: {
    // Layers icon styling
  },
  text: {
    flex: 1,
    fontSize: 14,
    color: '#C95900',
    opacity: 0.8,
    fontWeight: '500',
  },
  chevron: {
    transform: [{ rotate: '0deg' }],
  },
  chevronRotated: {
    transform: [{ rotate: '180deg' }],
  },
});

export default ChainOfThoughtHeader;
