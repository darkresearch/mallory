import React, { useEffect, useRef } from 'react';
import { Text, TouchableOpacity, StyleSheet, Animated, View } from 'react-native';
import { ChainOfThoughtHeaderProps } from './types';

/**
 * ChainOfThoughtHeader - Collapsible trigger with dynamic text
 * Shows "Thinking..." with pulsing animation while streaming
 * Shows "Thought for X seconds" when complete
 */
export const ChainOfThoughtHeader: React.FC<ChainOfThoughtHeaderProps> = ({
  children,
  isOpen,
  onPress,
  style,
  textStyle,
  isStreaming = false,
  totalDuration,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(isOpen ? 1 : 0)).current;

  // Warm pulsing animation while streaming
  useEffect(() => {
    if (isStreaming) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.5,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      // Reset to full opacity when not streaming
      pulseAnim.setValue(1);
    }
  }, [isStreaming, pulseAnim]);

  // Rotate chevron when open/closed
  useEffect(() => {
    Animated.timing(rotateAnim, {
      toValue: isOpen ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isOpen, rotateAnim]);

  // Determine text to display
  const getDisplayText = () => {
    if (children) return children;
    
    if (isStreaming) {
      return 'Thinking';
    }
    
    if (totalDuration !== undefined && totalDuration > 0) {
      const milliseconds = totalDuration;
      const seconds = milliseconds / 1000;
      const minutes = seconds / 60;
      const hours = minutes / 60;
      
      if (hours >= 1) {
        return `Thought for ${Math.floor(hours)}h`;
      } else if (minutes >= 1) {
        return `Thought for ${Math.floor(minutes)}m`;
      } else if (seconds >= 1) {
        return `Thought for ${Math.floor(seconds)}s`;
      } else {
        // Less than 1 second, don't show duration
        return 'Thought quickly';
      }
    }
    
    return 'Thought quickly';
  };

  const displayText = getDisplayText();

  const chevronRotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <TouchableOpacity
      style={[styles.header, style]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={isOpen ? "Collapse chain of thought" : "Expand chain of thought"}
      accessibilityState={{ expanded: isOpen }}
    >
      <Animated.Text 
        style={[
          styles.text, 
          textStyle,
          isStreaming && { opacity: pulseAnim }
        ]}
      >
        {displayText}
      </Animated.Text>
      
      {/* Subtle chevron indicator */}
      <Animated.Text
        style={[
          styles.chevron,
          { transform: [{ rotate: chevronRotation }] }
        ]}
      >
        ›
      </Animated.Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingVertical: 8,
    width: '100%',
  },
  text: {
    fontSize: 14,
    color: '#C95900',
    opacity: 0.8,
    fontWeight: '500',
  },
  chevron: {
    fontSize: 16,
    color: '#C95900',
    opacity: 0.5,
    marginLeft: 6,
    fontWeight: '400',
  },
});

export default ChainOfThoughtHeader;
