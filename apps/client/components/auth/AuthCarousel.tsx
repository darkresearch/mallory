import { View, Text, TouchableOpacity, ActivityIndicator, Image, StyleSheet, Platform } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { getAllWallets } from '@/features/auth/services/solana-wallet';

interface AuthOption {
  id: string;
  name: string;
  icon?: string | number; // Can be URL string or require() module
  color: string;
  onPress: () => Promise<void>;
}

interface AuthCarouselProps {
  onGoogleLogin: () => Promise<void>;
  onWalletLogin: (walletName: string) => Promise<void>;
  isLoading: boolean;
  isMobile?: boolean;
}

/**
 * Auth Carousel
 * Elegant carousel of auth options (Google + detected wallets)
 * Auto-rotates through options or user can tap dots to switch
 */
export default function AuthCarousel({ onGoogleLogin, onWalletLogin, isLoading, isMobile }: AuthCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayIndex, setDisplayIndex] = useState(0); // What's actually shown during animation
  const [options, setOptions] = useState<AuthOption[]>([]);
  const fadeAnim = useSharedValue(1);
  const translateX = useSharedValue(0);
  const arrowOpacity = useSharedValue(0);
  const autoRotateRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Build auth options list
  useEffect(() => {
    const authOptions: AuthOption[] = [
      {
        id: 'google',
        name: 'Google',
        icon: 'https://www.google.com/favicon.ico',
        color: '#FFFFFF', // White background for all options
        onPress: onGoogleLogin,
      },
    ];

    // Add detected wallets (web only)
    // COMMENTED OUT: Wallet auth temporarily disabled
    // if (Platform.OS === 'web') {
    //   const wallets = getAllWallets();
    //   wallets.forEach((wallet) => {
    //     authOptions.push({
    //       id: wallet.name.toLowerCase(),
    //       name: wallet.name,
    //       icon: wallet.icon,
    //       color: '#FFFFFF', // White background for all options
    //       onPress: async () => onWalletLogin(wallet.name),
    //     });
    //   });
    // }

    setOptions(authOptions);
  }, []);

  // Auto-rotate every 4 seconds
  useEffect(() => {
    if (options.length <= 1 || isLoading) {
      return; // Don't rotate if only one option or loading
    }

    autoRotateRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % options.length);
    }, 4000);

    return () => {
      if (autoRotateRef.current) {
        clearInterval(autoRotateRef.current);
      }
    };
  }, [options.length, isLoading]);

  // Smooth crossfade when index changes
  useEffect(() => {
    if (currentIndex === displayIndex) return; // No change needed
    
    // Fade out, switch content, fade in
    fadeAnim.value = withTiming(0, {
      duration: 150,
      easing: Easing.out(Easing.ease),
    }, (finished) => {
      if (finished) {
        // Update displayed content when fully faded out
        runOnJS(setDisplayIndex)(currentIndex);
        // Fade back in
        fadeAnim.value = withTiming(1, {
          duration: 150,
          easing: Easing.in(Easing.ease),
        });
      }
    });
  }, [currentIndex]);

  // Animate arrows in on mount (hint that it's swipeable)
  useEffect(() => {
    if (options.length > 1) {
      // Pulse in arrows to hint at swipe functionality
      arrowOpacity.value = withSequence(
        withTiming(0.6, { duration: 400, easing: Easing.out(Easing.ease) }),
        withTiming(0.3, { duration: 600, easing: Easing.inOut(Easing.ease) })
      );
    }
  }, [options.length]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [
      { translateX: translateX.value * 0.3 }, // Dampen the swipe movement (30%)
    ],
  }));

  const arrowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: arrowOpacity.value,
  }));

  const goToNext = () => {
    if (options.length <= 1) return;
    stopAutoRotate(); // Stop auto-rotate when manually navigating
    setCurrentIndex((prev) => (prev + 1) % options.length);
  };

  const goToPrevious = () => {
    if (options.length <= 1) return;
    stopAutoRotate(); // Stop auto-rotate when manually navigating
    setCurrentIndex((prev) => (prev - 1 + options.length) % options.length);
  };

  const stopAutoRotate = () => {
    if (autoRotateRef.current) {
      clearInterval(autoRotateRef.current);
      autoRotateRef.current = null;
    }
  };

  const handleDotPress = (index: number) => {
    stopAutoRotate();
    setCurrentIndex(index);
  };

  // Gesture for swipe
  const panGesture = Gesture.Pan()
    .enabled(options.length > 1 && !isLoading)
    .onStart(() => {
      runOnJS(stopAutoRotate)();
    })
    .onUpdate((event) => {
      translateX.value = event.translationX;
    })
    .onEnd((event) => {
      const swipeThreshold = 50;
      
      if (event.translationX > swipeThreshold) {
        // Swiped right - go to previous
        runOnJS(goToPrevious)();
      } else if (event.translationX < -swipeThreshold) {
        // Swiped left - go to next
        runOnJS(goToNext)();
      }
      
      // Reset position
      translateX.value = withTiming(0, { duration: 200 });
    });

  const handlePress = async () => {
    const currentOption = options[currentIndex];
    if (currentOption && !isLoading) {
      await currentOption.onPress();
    }
  };

  if (options.length === 0) {
    return null; // Loading options
  }

  const currentOption = options[displayIndex]; // Use displayIndex for smooth crossfade

  return (
    <View style={styles.container}>
      {/* Container for button + arrows */}
      <View style={styles.buttonContainer}>
        {/* Left Arrow (outside on web, inside on mobile) */}
        {options.length > 1 && (
          <TouchableOpacity
            onPress={goToPrevious}
            disabled={isLoading}
            style={[
              styles.arrowTouchable,
              isMobile ? styles.arrowLeftMobile : styles.arrowLeftWeb,
            ]}
          >
            <Animated.View style={arrowAnimatedStyle}>
              <Text style={[
                styles.arrowText,
                { color: '#FFFFFF' }
              ]}>‹</Text>
            </Animated.View>
          </TouchableOpacity>
        )}

        {/* Main Button with Swipe Gesture */}
        <GestureDetector gesture={panGesture}>
          <Animated.View style={animatedStyle}>
            <TouchableOpacity
              style={[
                styles.button,
                isMobile && styles.buttonMobile,
                { backgroundColor: currentOption.color }
              ]}
              onPress={handlePress}
              disabled={isLoading}
            >
            {isLoading ? (
              <ActivityIndicator size="small" color="#666" />
            ) : (
              <>
                {currentOption.icon && (
                  <Image
                    source={typeof currentOption.icon === 'string' ? { uri: currentOption.icon } : currentOption.icon}
                    style={styles.icon}
                    resizeMode="contain"
                  />
                )}
                <Text style={styles.buttonText}>
                  Continue with {currentOption.name}
                </Text>
              </>
            )}
            </TouchableOpacity>
          </Animated.View>
        </GestureDetector>

        {/* Right Arrow (outside on web, inside on mobile) */}
        {options.length > 1 && (
          <TouchableOpacity
            onPress={goToNext}
            disabled={isLoading}
            style={[
              styles.arrowTouchable,
              isMobile ? styles.arrowRightMobile : styles.arrowRightWeb,
            ]}
          >
            <Animated.View style={arrowAnimatedStyle}>
              <Text style={[
                styles.arrowText,
                { color: '#FFFFFF' }
              ]}>›</Text>
            </Animated.View>
          </TouchableOpacity>
        )}
      </View>

      {/* Dots Indicator (only show if multiple options) */}
      {options.length > 1 && (
        <View style={styles.dotsContainer}>
          {options.map((option, index) => (
            <TouchableOpacity
              key={option.id}
              onPress={() => handleDotPress(index)}
              style={styles.dotTouchable}
              disabled={isLoading}
            >
              <View style={[
                styles.dot,
                index === currentIndex && styles.dotActive
              ]} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  buttonContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 28,
    minWidth: 250,
  },
  buttonMobile: {
    borderRadius: 28,
    width: '100%',
    minWidth: 0,
    paddingVertical: 16,
  },
  arrowTouchable: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    width: 32, // Square touchable area
    height: 32,
  },
  // Web arrows (outside button, very close)
  arrowLeftWeb: {
    left: 20,
  },
  arrowRightWeb: {
    right: 20,
  },
  // Mobile arrows (inside button)
  arrowLeftMobile: {
    left: 16,
    zIndex: 1,
  },
  arrowRightMobile: {
    right: 16,
    zIndex: 1,
  },
  arrowText: {
    fontSize: 28,
    fontWeight: '300',
    fontFamily: 'Satoshi',
  },
  icon: {
    width: 20,
    height: 20,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F1F1F', // Dark text on white background
    marginLeft: 12,
    fontFamily: 'Satoshi',
  },
  dotsContainer: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 8,
  },
  dotTouchable: {
    padding: 4, // Larger touch target
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#5A5A5E',
    opacity: 0.4,
  },
  dotActive: {
    backgroundColor: '#EDEDED',
    opacity: 1,
    width: 20, // Elongated when active
  },
});

