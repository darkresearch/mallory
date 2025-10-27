import React from 'react';
import { Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator, View } from 'react-native';
import { TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'pill';
export type ButtonSize = 'small' | 'medium' | 'large';

interface PressableButtonProps {
  /** Button text or custom content */
  children: React.ReactNode;
  /** Press handler */
  onPress?: () => void;
  /** Visual style variant */
  variant?: ButtonVariant;
  /** Size variant */
  size?: ButtonSize;
  /** Disabled state */
  disabled?: boolean;
  /** Loading state - shows spinner */
  loading?: boolean;
  /** Icon to show before text */
  icon?: React.ReactNode;
  /** Full width button */
  fullWidth?: boolean;
  /** Custom styles for container */
  style?: ViewStyle;
  /** Custom styles for text */
  textStyle?: TextStyle;
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

/**
 * PressableButton - Mallory's delightful button component
 * 
 * Features:
 * - Smooth spring "squish" animation on press
 * - Consistent feedback across all buttons
 * - Multiple variants (primary, secondary, ghost, pill)
 * - Built-in loading states
 * - Accessible and responsive
 * 
 * @example
 * <PressableButton onPress={handlePress} variant="primary">
 *   Click me!
 * </PressableButton>
 */
export function PressableButton({
  children,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
  style,
  textStyle,
}: PressableButtonProps) {
  const scale = useSharedValue(1);
  const isDisabled = disabled || loading;

  // Spring configuration for that perfect "squish" feel
  const springConfig = {
    damping: 15,
    stiffness: 400,
  };

  const handlePressIn = () => {
    if (isDisabled) return;
    scale.value = withSpring(0.96, springConfig);
  };

  const handlePressOut = () => {
    if (isDisabled) return;
    scale.value = withSpring(1, springConfig);
  };

  const handlePress = () => {
    if (isDisabled) return;
    
    // Extra satisfying feedback - quick down-up sequence
    scale.value = withSequence(
      withSpring(0.96, { damping: 20, stiffness: 600 }),
      withSpring(1, springConfig)
    );
    
    onPress?.();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Get variant-specific styles
  const containerStyles = [
    styles.base,
    styles[`${variant}Container`],
    styles[`${size}Container`],
    fullWidth && styles.fullWidth,
    isDisabled && styles.disabled,
    style,
  ];

  // Extract justifyContent from style prop if provided (for custom alignment)
  const contentAlignment = (style && typeof style === 'object' && 'justifyContent' in style) 
    ? style.justifyContent 
    : 'center';

  const textStyles = [
    styles.baseText,
    styles[`${variant}Text`],
    styles[`${size}Text`],
    textStyle,
  ];

  const renderContent = () => {
    const contentRowStyle = [
      styles.contentRow,
      { justifyContent: contentAlignment }
    ];

    if (loading) {
      return (
        <View style={contentRowStyle}>
          <ActivityIndicator 
            size={size === 'small' ? 'small' : 'small'} 
            color={variant === 'primary' ? '#FBAA69' : '#000000'} 
          />
          {typeof children === 'string' && (
            <Text style={[textStyles, styles.loadingText]}>
              {children}
            </Text>
          )}
        </View>
      );
    }

    if (icon && typeof children === 'string') {
      return (
        <View style={contentRowStyle}>
          {icon}
          <Text style={textStyles}>{children}</Text>
        </View>
      );
    }

    if (typeof children === 'string') {
      return <Text style={textStyles}>{children}</Text>;
    }

    return children;
  };

  return (
    <AnimatedTouchableOpacity
      style={[containerStyles, animatedStyle]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
    >
      {renderContent()}
    </AnimatedTouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    overflow: 'hidden',
  },
  
  // Variant styles - matching Mallory's warm palette
  primaryContainer: {
    backgroundColor: '#984400',
  },
  secondaryContainer: {
    backgroundColor: '#FFEFE3',
    borderWidth: 1.5,
    borderColor: '#984400',
  },
  ghostContainer: {
    backgroundColor: 'transparent',
  },
  pillContainer: {
    backgroundColor: '#F6C69F',
  },
  
  // Size variants
  smallContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
  },
  mediumContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
  },
  largeContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 52,
  },
  
  // Text styles
  baseText: {
    fontFamily: 'Satoshi',
    fontWeight: '500',
    textAlign: 'center',
  },
  primaryText: {
    color: '#000000',
    fontSize: 16,
  },
  secondaryText: {
    color: '#000000',
    fontSize: 16,
  },
  ghostText: {
    color: '#000000',
    fontSize: 16,
  },
  pillText: {
    color: '#000000',
    fontSize: 16,
  },
  
  // Size text variants
  smallText: {
    fontSize: 14,
  },
  mediumText: {
    fontSize: 16,
  },
  largeText: {
    fontSize: 18,
  },
  
  // State styles
  disabled: {
    opacity: 0.6,
  },
  fullWidth: {
    width: '100%',
  },
  
  // Content layout
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    marginLeft: 8,
  },
});

