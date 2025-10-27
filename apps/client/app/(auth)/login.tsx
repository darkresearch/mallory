import { View, Text, TouchableOpacity, ActivityIndicator, Image, StyleSheet, Platform, useWindowDimensions, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import AuthCarousel from '@/components/auth/AuthCarousel';
import { signInWithSolanaWallet, getAllWallets } from '@/features/auth/services/solana-wallet';
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
  const { login, loginWithWallet, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { width } = useWindowDimensions();

  // Mobile detection: native mobile OR narrow web viewport
  const isMobile = Platform.OS === 'ios' || Platform.OS === 'android' || width < 768;

  // Animation values for text
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(20);
  
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

    // Fade in text immediately
    textOpacity.value = withTiming(1, fadeInConfig);
    textTranslateY.value = withTiming(0, fadeInConfig);

    // Fade in buttons (200ms after text starts)
    buttonsOpacity.value = withDelay(200, withTiming(1, fadeInConfig));
    buttonsTranslateY.value = withDelay(200, withTiming(0, fadeInConfig));

    // Fade in terms (300ms after text starts)
    termsOpacity.value = withDelay(300, withTiming(1, fadeInConfig));
    termsTranslateY.value = withDelay(300, withTiming(0, fadeInConfig));
  }, []);

  // Fix background color for mobile Safari (and other web browsers)
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // Save original background colors
    const originalHtmlBg = document.documentElement.style.backgroundColor;
    const originalBodyBg = document.body.style.backgroundColor;

    // Set to dark orange to match login screen
    document.documentElement.style.backgroundColor = '#E67B25';
    document.body.style.backgroundColor = '#E67B25';

    // Restore original colors on unmount (when navigating away)
    return () => {
      document.documentElement.style.backgroundColor = originalHtmlBg;
      document.body.style.backgroundColor = originalBodyBg;
    };
  }, []);

  // Animated styles
  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
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

  const handleWalletLogin = async (walletName: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Find the wallet by name
      const wallets = getAllWallets();
      const selectedWallet = wallets.find(w => w.name === walletName);
      
      if (!selectedWallet) {
        throw new Error(`Wallet ${walletName} not found`);
      }
      
      // Sign in with selected wallet
      await signInWithSolanaWallet(selectedWallet.wallet);
    } catch (err: any) {
      setError(err.message || 'Wallet login failed. Please try again.');
      console.error('Wallet login error:', err);
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
        {/* Hero container - Centers lockup on mobile */}
        <View style={isMobile && styles.heroContainerMobile}>
          {/* Hero Section */}
          <View style={[styles.hero, isMobile && styles.heroMobile]}>
            <Animated.View style={[textAnimatedStyle, isMobile && { width: '100%' }]}>
              <Image 
                source={require('../../assets/lockup.png')}
                style={[styles.lockupImage, isMobile && styles.lockupImageMobile]}
                resizeMode="contain"
              />
              {/* Tagline - Only show on mobile, under lockup */}
              {isMobile && (
                <Text style={[styles.tagline, styles.taglineMobile]}>
                  Experience the magic of x402.
                </Text>
              )}
            </Animated.View>
          </View>
        </View>

        {/* Bottom section - Button + Footer anchored to bottom on mobile */}
        <Animated.View style={[isMobile && styles.bottomSectionMobile, buttonsAnimatedStyle]}>
          {/* Auth Carousel - Google + Wallets */}
          <View style={[styles.authSection, isMobile && styles.authSectionMobile]}>
            <AuthCarousel
              onGoogleLogin={handleLogin}
              onWalletLogin={handleWalletLogin}
              isLoading={isLoading}
              isMobile={isMobile}
            />

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

      {/* Tagline & Footer - Fixed at bottom on web */}
      {!isMobile && (
        <Animated.View style={[styles.footer, styles.footerWeb, termsAnimatedStyle]}>
          {/* Tagline on web */}
          <Text style={[styles.tagline, styles.taglineWeb]}>
            Experience the magic of x402.
          </Text>
          
          {/* Terms - only if URLs are configured */}
          {(config.termsUrl || config.privacyUrl) && (
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
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E67B25',
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
  
  // Hero section - Lockup with two-stage transition
  hero: {
    marginBottom: 26, // 20% less spacing (80% of 32 ≈ 26)
    alignItems: 'center',
  },
  heroMobile: {
    alignItems: 'flex-start', // Left-align on mobile
    marginBottom: 0, // Remove margin on mobile since container handles spacing
  },
  lockupImage: {
    width: 205,
    height: 73,
    alignSelf: 'center',
  },
  lockupImageMobile: {
    alignSelf: 'flex-start',
    marginLeft: -5, // Compensate for internal padding in lockup image
  },
  tagline: {
    fontSize: 20,
    color: '#F8CEAC',
    fontFamily: 'Satoshi',
    textAlign: 'center',
    marginTop: 24,
  },
  taglineMobile: {
    textAlign: 'left',
    marginTop: 11, // 30% less spacing (70% of 16 ≈ 11)
  },
  taglineWeb: {
    fontWeight: '700',
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
    width: '23%',
    minWidth: 250,
    maxWidth: 345,
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
    backgroundColor: '#E67B25',
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