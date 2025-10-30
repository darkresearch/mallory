import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { ChainOfThoughtContentProps } from './types';

/**
 * ChainOfThoughtContent - Collapsible content container with animations
 * Replaces Radix Collapsible with React Native Animated API
 */
export const ChainOfThoughtContent: React.FC<ChainOfThoughtContentProps> = ({
  children,
  isOpen,
  style,
}) => {
  const animatedHeight = useRef(new Animated.Value(isOpen ? 1 : 0)).current;
  const animatedOpacity = useRef(new Animated.Value(isOpen ? 1 : 0)).current;
  const [isMounted, setIsMounted] = React.useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
    }
    Animated.parallel([
      Animated.timing(animatedHeight, {
        toValue: isOpen ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(animatedOpacity, {
        toValue: isOpen ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (!isOpen) {
        setIsMounted(false);
      }
    });
  }, [isOpen, animatedHeight, animatedOpacity]);

  if (!isMounted) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.content,
        {
          maxHeight: animatedHeight.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 1000], // Adjust based on expected content height
          }),
          opacity: animatedOpacity,
        },
        style,
      ]}
    >
      <View style={styles.innerContent}>
        {children}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  content: {
    overflow: 'hidden',
  },
  innerContent: {
    paddingTop: 8,
    gap: 12,
  },
});

export default ChainOfThoughtContent;
