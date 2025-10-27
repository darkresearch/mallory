import React, { useEffect, useRef } from 'react';
import { View, Image, Animated, StyleSheet } from 'react-native';

interface PulsingStarProps {
  size?: number;
  style?: any;
}

/**
 * PulsingStar - Animated logo for streaming states
 * Shows when AI is actively processing/thinking
 */
export const PulsingStar: React.FC<PulsingStarProps> = ({
  size = 16,
  style,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    pulse.start();

    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <View style={[styles.container, style]}>
      <Animated.View
        style={[
          styles.starContainer,
          {
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <Image 
          source={require('../../../assets/mallory-logo.png')}
          style={[styles.star, { width: size, height: size }]} 
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  starContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  star: {
    opacity: 0.8,
  },
});

export default PulsingStar;
