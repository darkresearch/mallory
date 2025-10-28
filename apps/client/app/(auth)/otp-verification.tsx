import { View, Text, TouchableOpacity, ActivityIndicator, Image, StyleSheet, Platform, useWindowDimensions, TextInput } from 'react-native';
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
import { Ionicons } from '@expo/vector-icons';
import { PressableButton } from '@/components/ui/PressableButton';
import { gridClientService } from '@/features/grid/services/gridClient';

export default function OtpVerificationScreen() {
  const router = useRouter();
  const { user, logout, completeReauth } = useAuth();
  const { width } = useWindowDimensions();

  // Mobile detection: native mobile OR narrow web viewport
  const isMobile = Platform.OS === 'ios' || Platform.OS === 'android' || width < 768;

  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [verificationSuccess, setVerificationSuccess] = useState(false);

  // Get gridUser from session storage (set by AuthContext during startSignIn)
  const [gridUser, setGridUser] = useState<any>(null);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const storedGridUser = sessionStorage.getItem('gridUser');
      if (storedGridUser) {
        try {
          setGridUser(JSON.parse(storedGridUser));
        } catch (e) {
          console.error('Failed to parse gridUser from sessionStorage:', e);
        }
      }
    }
  }, []);

  // Animation values for OTP input
  const otpOpacity = useSharedValue(0);
  const otpTranslateY = useSharedValue(20);
  
  // Animation values for buttons
  const buttonsOpacity = useSharedValue(0);
  const buttonsTranslateY = useSharedValue(20);

  // Trigger entrance animations on mount
  useEffect(() => {
    const fadeInConfig = {
      duration: 1200,
      easing: Easing.out(Easing.cubic),
    };

    // Fade in OTP input immediately
    otpOpacity.value = withTiming(1, fadeInConfig);
    otpTranslateY.value = withTiming(0, fadeInConfig);

    // Fade in buttons (200ms after OTP input starts)
    buttonsOpacity.value = withDelay(200, withTiming(1, fadeInConfig));
    buttonsTranslateY.value = withDelay(200, withTiming(0, fadeInConfig));
  }, []);

  // Fix background color for mobile Safari (and other web browsers)
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // Save original background colors
    const originalHtmlBg = document.documentElement.style.backgroundColor;
    const originalBodyBg = document.body.style.backgroundColor;

    // Set to orange to match OTP screen
    document.documentElement.style.backgroundColor = '#E67B25';
    document.body.style.backgroundColor = '#E67B25';

    // Restore original colors on unmount (when navigating away)
    return () => {
      document.documentElement.style.backgroundColor = originalHtmlBg;
      document.body.style.backgroundColor = originalBodyBg;
    };
  }, []);

  // Animated styles
  const otpAnimatedStyle = useAnimatedStyle(() => ({
    opacity: otpOpacity.value,
    transform: [{ translateY: otpTranslateY.value }],
  }));

  const buttonsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonsOpacity.value,
    transform: [{ translateY: buttonsTranslateY.value }],
  }));

  const handleResendOtp = async () => {
    if (!user?.email) return;

    setIsVerifying(true);
    setError('');
    setOtp('');
    
    try {
      console.log('🔄 Resending OTP for:', user.email);
      const newGridUser = await gridClientService.startSignIn(user.email);
      setGridUser(newGridUser);
      
      // Store in sessionStorage for persistence
      if (Platform.OS === 'web') {
        sessionStorage.setItem('gridUser', JSON.stringify(newGridUser));
      }
      
      console.log('✅ OTP resent successfully');
      setError(''); // Clear any previous errors
    } catch (error) {
      console.error('❌ Failed to resend OTP:', error);
      setError(error instanceof Error ? error.message : 'Failed to resend code. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerify = async () => {
    if (otp.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      // Safety check - gridUser should be available
      if (!gridUser) {
        console.error('❌ [OTP Screen] gridUser is missing');
        throw new Error('Sign-in session not found. Please sign out and try again.');
      }

      console.log('🔐 Completing sign-in with OTP');
      
      // Backend automatically uses the correct flow (beginner or advanced)
      const authResult = await gridClientService.completeSignIn(gridUser, otp);
      
      console.log('🔐 [OTP Verification] Sign-in result:', {
        success: authResult.success,
        hasData: !!authResult.data,
        address: authResult.data?.address,
      });
      
      if (authResult.success && authResult.data) {
        console.log('✅ Grid sign-in complete:', authResult.data.address);
        setVerificationSuccess(true);
        
        // Clear gridUser from sessionStorage
        if (Platform.OS === 'web') {
          sessionStorage.removeItem('gridUser');
        }
        
        // Complete reauth and navigate to main app
        completeReauth();
        router.replace('/(main)');
        return;
      }
      
      // If we reach here without returning, verification failed
      setError('Verification failed. Please check your code and try again.');
    } catch (error) {
      console.error('❌ OTP verification error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An error occurred. Please try again.';
      
      // Provide more specific error messages
      if (errorMessage.toLowerCase().includes('session secrets not found')) {
        setError('Session expired. Please request a new code.');
      } else if (errorMessage.toLowerCase().includes('invalid email and code combination')) {
        setError('Invalid code. Please check and try again.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleButtonPress = () => {
    if (verificationSuccess) {
      // Navigate to main app
      router.replace('/(main)');
    } else if (error) {
      // Resend OTP if there was an error
      handleResendOtp();
    } else {
      // Normal verification flow
      handleVerify();
    }
  };

  const getButtonText = () => {
    if (verificationSuccess) {
      return 'Done';
    } else if (error) {
      return 'Resend Code';
    } else {
      return 'Continue';
    }
  };

  const handleSignOut = async () => {
    console.log('🚪 Sign out button pressed from OTP screen');
    
    // Clear gridUser from sessionStorage
    if (Platform.OS === 'web') {
      sessionStorage.removeItem('gridUser');
    }
    
    // Trigger logout which will redirect to login
    await logout();
    router.replace('/login');
  };

  if (!user?.email) {
    // If no user, redirect to login
    router.replace('/login');
    return null;
  }

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
        {/* Hero container - Centers OTP input on mobile */}
        <View style={isMobile && styles.heroContainerMobile}>
          {/* Hero Section - OTP Input */}
          <Animated.View style={[styles.hero, isMobile && styles.heroMobile, otpAnimatedStyle]}>
            {/* Title */}
            <Text style={[styles.title, isMobile && styles.titleMobile]}>
              Verify Your Wallet
            </Text>
            
            {/* Description */}
            <Text style={[styles.description, isMobile && styles.descriptionMobile]}>
              {`We've sent a 6-digit code to ${user.email}`}
            </Text>
            
            {/* OTP Input - 6 digits styled like lockup */}
            <TextInput
              style={[styles.otpInput, isMobile && styles.otpInputMobile]}
              placeholder="000000"
              placeholderTextColor="#C95900"
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />

            {/* Error Message */}
            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}
          </Animated.View>
        </View>

        {/* Bottom section - Button + Sign out anchored to bottom on mobile */}
        <Animated.View style={[isMobile && styles.bottomSectionMobile, buttonsAnimatedStyle]}>
          {/* Continue/Done/Resend Button */}
          <View style={[styles.authSection, isMobile && styles.authSectionMobile]}>
            <PressableButton
              fullWidth
              onPress={handleButtonPress}
              loading={isVerifying}
              style={[styles.continueButton, isMobile && styles.continueButtonMobile]}
              textStyle={styles.continueButtonText}
            >
              {getButtonText()}
            </PressableButton>

            {/* Sign Out Button */}
            <PressableButton
              variant="ghost"
              fullWidth
              onPress={handleSignOut}
              icon={<Ionicons name="log-out-outline" size={16} color="#FFEFE3" />}
              textStyle={styles.signOutText}
              style={styles.signOutButton}
            >
              Sign out
            </PressableButton>
          </View>
        </Animated.View>
      </View>
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
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  contentMobile: {
    justifyContent: 'space-between', // Space between hero and bottom section
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  
  // Hero container - Centers content vertically on mobile
  heroContainerMobile: {
    flex: 1,
    justifyContent: 'center',
  },
  
  // Hero section - OTP input area
  hero: {
    marginBottom: 32,
    alignItems: 'center',
  },
  heroMobile: {
    alignItems: 'flex-start', // Left-align on mobile
    marginBottom: 0, // Remove margin on mobile since container handles spacing
  },
  
  // Title
  title: {
    fontSize: 32,
    fontWeight: '600',
    color: '#FFEFE3',
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: 'Belwe-Medium',
  },
  titleMobile: {
    fontSize: 28,
    textAlign: 'left',
    width: '100%',
  },
  
  // Description
  description: {
    fontSize: 18,
    color: '#F8CEAC',
    marginBottom: 32,
    textAlign: 'center',
    fontFamily: 'Satoshi',
  },
  descriptionMobile: {
    fontSize: 16,
    textAlign: 'left',
    width: '100%',
    marginBottom: 24,
  },
  
  // OTP Input - Large, prominent like the lockup
  otpInput: {
    backgroundColor: '#FFEFE3',
    borderRadius: 16,
    padding: 20,
    fontSize: 36,
    color: '#000000',
    textAlign: 'center',
    letterSpacing: 12,
    fontFamily: 'Satoshi',
    fontWeight: '600',
    width: '100%',
    maxWidth: 300,
  },
  otpInputMobile: {
    fontSize: 32,
    padding: 18,
    maxWidth: '100%',
  },
  
  // Error text
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
    width: '100%',
    fontFamily: 'Satoshi',
  },
  
  // Bottom section - Button + Sign out (mobile only)
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
  
  // Continue/Done button
  continueButton: {
    backgroundColor: '#FBAA69',
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 28,
    width: '100%',
    maxWidth: 300,
    marginBottom: 12,
  },
  continueButtonMobile: {
    borderRadius: 28,
    paddingVertical: 16,
    maxWidth: '100%',
  },
  continueButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Satoshi',
  },
  
  // Sign out button
  signOutButton: {
    marginTop: 8,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFEFE3',
    letterSpacing: 0.5,
    fontFamily: 'Satoshi',
  },
});
