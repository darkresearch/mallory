import { View, Text, TouchableOpacity, ActivityIndicator, Image, StyleSheet, Platform, useWindowDimensions, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withDelay,
  Easing 
} from 'react-native-reanimated';
import { preview } from "radon-ide";
import { LAYOUT, config } from '@/lib';

export default function LoginScreen() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { width } = useWindowDimensions();

  // Mobile detection: native mobile OR narrow web viewport
  const isMobile = Platform.OS === 'ios' || Platform.OS === 'android' || width < 768;

  // Two-stage text state
  const [textStage, setTextStage] = useState<1 | 2>(1);

  // Animation values for stage 1 text
  const stage1Opacity = useSharedValue(0);
  const stage1TranslateY = useSharedValue(20);
  
  // Animation values for stage 2 text
  const stage2Opacity = useSharedValue(0);
  const stage2TranslateY = useSharedValue(40);
  
  // Animation values for buttons and terms
  const buttonsOpacity = useSharedValue(0);
  const buttonsTranslateY = useSharedValue(20);
  
  const termsOpacity = useSharedValue(0);
  const termsTranslateY = useSharedValue(20);

  // Trigger entrance animations on mount
  useEffect(() => {
    const fadeInConfig = {
      duration: 1200,
      easing: Easing.out(Easing.cubic),
    };

    const fadeOutConfig = {
      duration: 1200,
      easing: Easing.in(Easing.cubic),
    };

    // Stage 1: Fade in first text immediately
    stage1Opacity.value = withTiming(1, fadeInConfig);
    stage1TranslateY.value = withTiming(0, fadeInConfig);

    // After 3s, fade out stage 1 and trigger stage 2
    setTimeout(() => {
      // Fade out stage 1
      stage1Opacity.value = withTiming(0, fadeOutConfig);
      stage1TranslateY.value = withTiming(-20, fadeOutConfig);
      
      // Switch to stage 2 after fade-out completes
      setTimeout(() => {
        setTextStage(2);
        
        // Fade in stage 2 text immediately after switch
        stage2Opacity.value = withTiming(1, fadeInConfig);
        stage2TranslateY.value = withTiming(0, fadeInConfig);

        // Fade in buttons (200ms after stage 2 text starts)
        buttonsOpacity.value = withDelay(200, withTiming(1, fadeInConfig));
        buttonsTranslateY.value = withDelay(200, withTiming(0, fadeInConfig));

        // Fade in terms (300ms after stage 2 text starts)
        termsOpacity.value = withDelay(300, withTiming(1, fadeInConfig));
        termsTranslateY.value = withDelay(300, withTiming(0, fadeInConfig));
      }, 1200); // Wait for fade-out to complete
    }, 3000);
  }, []);

  // Animated styles
  const stage1AnimatedStyle = useAnimatedStyle(() => ({
    opacity: stage1Opacity.value,
    transform: [{ translateY: stage1TranslateY.value }],
  }));

  const stage2AnimatedStyle = useAnimatedStyle(() => ({
    opacity: stage2Opacity.value,
    transform: [{ translateY: stage2TranslateY.value }],
  }));

  const buttonsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonsOpacity.value,
    transform: [{ translateY: buttonsTranslateY.value }],
  }));

  const termsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: termsOpacity.value,
    transform: [{ translateY: termsTranslateY.value }],
  }));

  // Redirect if already authenticated
  if (isAuthenticated) {
    router.replace('/(main)');
    return null;
  }

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await login();
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleComingSoon = (provider: string) => {
    console.log(`${provider} login coming soon`);
  };

  const handleOpenLink = (url: string) => {
    Linking.openURL(url).catch((err) => console.error('Failed to open URL:', err));
  };

  return (
    <View 
      style={[
        styles.container,
        // On web, constrain to visible viewport (100dvh accounts for browser UI)
        Platform.OS === 'web' && {
          height: '100dvh' as any,
          maxHeight: '100dvh' as any,
        }
      ]}
    >
      <View style={[styles.content, isMobile && styles.contentMobile]}>
        {/* Hero container - Centers text on mobile */}
        <View style={isMobile && styles.heroContainerMobile}>
          {/* Hero Section - Two-stage text transition */}
          <View style={[styles.hero, isMobile && styles.heroMobile]}>
            {textStage === 1 && (
              <Animated.View style={stage1AnimatedStyle}>
                <Text style={[styles.heroText, isMobile && styles.heroTextMobile]}>
                  They've always said money talks.
                </Text>
              </Animated.View>
            )}
            {textStage === 2 && (
              <Animated.View style={stage2AnimatedStyle}>
                <Text style={[styles.heroText, isMobile && styles.heroTextMobile]}>
                  Now you can talk with money like never before.
                </Text>
              </Animated.View>
            )}
          </View>
        </View>

        {/* Bottom section - Button + Footer anchored to bottom on mobile */}
        <Animated.View style={[isMobile && styles.bottomSectionMobile, buttonsAnimatedStyle]}>
          {/* Auth Button - Google */}
          <View style={[styles.authSection, isMobile && styles.authSectionMobile]}>
            <TouchableOpacity
              style={[styles.googleButton, isMobile && styles.googleButtonMobile]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#666" />
              ) : (
                <>
                  <Image
                    source={{ uri: 'https://www.google.com/favicon.ico' }}
                    style={styles.googleIcon}
                    resizeMode="contain"
                  />
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Error Message */}
            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}
          </View>

          {/* Terms & Footer - Inline on mobile */}
          {isMobile && (config.termsUrl || config.privacyUrl) && (
            <Animated.View style={[styles.footer, styles.footerMobile, termsAnimatedStyle]}>
              <Text style={[styles.disclaimer, styles.disclaimerMobile]}>
                By continuing, you agree to our{' '}
                {config.termsUrl && (
                  <Text style={styles.termsLink} onPress={() => handleOpenLink(config.termsUrl)}>
                  Terms
                  </Text>
                )}
                {config.termsUrl && config.privacyUrl && ' and '}
                {config.privacyUrl && (
                  <Text style={styles.termsLink} onPress={() => handleOpenLink(config.privacyUrl)}>
                  Privacy Policy
                </Text>
                )}
              </Text>
            </Animated.View>
          )}
        </Animated.View>
      </View>

      {/* Terms & Footer - Fixed at bottom on web */}
      {!isMobile && (config.termsUrl || config.privacyUrl) && (
        <Animated.View style={[styles.footer, styles.footerWeb, termsAnimatedStyle]}>
          <Text style={styles.disclaimer}>
            By continuing, you agree to our{' '}
            {config.termsUrl && (
              <Text style={styles.termsLink} onPress={() => handleOpenLink(config.termsUrl)}>
              Terms
              </Text>
            )}
            {config.termsUrl && config.privacyUrl && ' and '}
            {config.privacyUrl && (
              <Text style={styles.termsLink} onPress={() => handleOpenLink(config.privacyUrl)}>
              Privacy Policy
            </Text>
            )}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05080C',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    maxWidth: LAYOUT.AUTH_MAX_WIDTH,
    width: '100%',
    alignSelf: 'center',
  },
  contentMobile: {
    justifyContent: 'space-between', // Space between hero and bottom section
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  
  // Hero container - Centers text vertically on mobile
  heroContainerMobile: {
    flex: 1,
    justifyContent: 'center',
  },
  
  // Hero section - Text with two-stage transition
  hero: {
    marginBottom: 32,
    alignItems: 'center',
  },
  heroMobile: {
    alignItems: 'flex-start', // Left-align on mobile
    marginBottom: 0, // Remove margin on mobile since container handles spacing
  },
  heroText: {
    fontSize: 32,
    color: '#EDEDED',
    lineHeight: 40,
    fontFamily: 'Satoshi',
    textAlign: 'center',
  },
  heroTextMobile: {
    textAlign: 'left', // Left-align text on mobile
  },
  
  // Bottom section - Button + Footer (mobile only)
  bottomSectionMobile: {
    width: '100%',
    paddingBottom: 24, // Closer to bottom edge
  },
  
  // Auth Section
  authSection: {
    width: '100%',
    alignItems: 'center',
  },
  authSectionMobile: {
    alignItems: 'stretch', // Full width button on mobile
  },
  
  // Google button - 28px pill with white background (web)
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 28,
    minWidth: 250,
  },
  googleButtonMobile: {
    borderRadius: 28, // Same pill shape on mobile
    width: '100%',
    minWidth: 0, // Override minWidth from web
    paddingVertical: 16,
  },
  googleIcon: {
    width: 20,
    height: 20,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F1F1F',
    marginLeft: 12,
    fontFamily: 'Satoshi',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
    width: '100%',
    fontFamily: 'Satoshi',
  },
  
  // Footer - Inline on mobile, fixed at bottom on web
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 32,
  },
  footerMobile: {
    // marginTop: 2, // Tight spacing from button
    alignItems: 'center', // Center on mobile
    paddingHorizontal: 0,
  },
  footerWeb: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#05080C',
    paddingBottom: 32,
  },
  termsLink: {
    color: '#4E81D9',
  },
  disclaimer: {
    fontSize: 10,
    color: '#5A5A5E',
    textAlign: 'center',
    lineHeight: 14,
    fontFamily: 'Satoshi',
  },
  disclaimerMobile: {
    textAlign: 'center', // Center on mobile
  },
});