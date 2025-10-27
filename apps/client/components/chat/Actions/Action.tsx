import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { ActionProps } from './types';

/**
 * Individual action button component
 * Mirrors Vercel AI SDK Action component API for React Native
 */
export const Action: React.FC<ActionProps> = ({
  children,
  label,
  onPress,
  disabled = false,
  style,
  contentStyle,
  isToggle = false,
  isActive = false,
}) => {
  const handlePress = () => {
    if (!disabled && onPress) {
      onPress();
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.actionButton,
        isToggle && isActive && styles.activeToggle,
        disabled && styles.disabled,
        style,
      ]}
      onPress={handlePress}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: isToggle ? isActive : undefined }}
    >
      {typeof children === 'string' ? (
        <Text style={[styles.actionText, contentStyle]}>{children}</Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  actionButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 32,
    minHeight: 28,
    opacity: 0.8,
  },
  actionText: {
    color: '#C95900',
    fontSize: 12,
    fontWeight: '500',
  },
  activeToggle: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)', // Blue tint for active state
    opacity: 1, // Full opacity for active states
  },
  disabled: {
    opacity: 0.5,
  },
});

export default Action;
