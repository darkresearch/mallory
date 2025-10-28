import { View, Text, TextInput, StyleSheet, Platform, useWindowDimensions, TouchableOpacity, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withDelay,
  Easing 
} from 'react-native-reanimated';
import { LAYOUT } from '@/lib';
import { PressableButton } from '@/components/ui/PressableButton';
import { gridClientService } from '@/features/grid';
import { useAuth } from '@/contexts/AuthContext';

/**
 * OTP Verification Screen
 * 
 * Matches the login screen design exactly:
 * - Same orange background (#E67B25)
 * - Same Mallory lockup (centered on web, left-aligned on mobile)
 * - Same button style at bottom
 * - Simple, focused, no modals
 * 
 * State Management:
 * - gridUser stored in sessionStorage (survives refresh)
 * - email passed via route params
 * - All logic self-contained in this screen
 */
export default function VerifyOtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email: string }>();
  const { width } = useWindowDimensions();
  const { logout } = useAuth();
  
  // Mobile detection
  const isMobile = Platform.OS === 'ios' || Platform.OS === 'android' || width < 768;

  // State
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [gridUser, setGridUser] = useState<any>(null);
  
  // Guard to prevent double-submission
  const verificationInProgress = useRef(false);
  
  // Ref for the hidden input to manage focus
  const inputRef = useRef<TextInput>(null);

  // Handle OTP input with number validation
  const handleOtpChange = (text: string) => {
    // Only allow numbers
    const numericOnly = text.replace(/[^0-9]/g, '');
    setOtp(numericOnly);
  };

  // Animation values
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(20);
  const buttonsOpacity = useSharedValue(0);
  const buttonsTranslateY = useSharedValue(20);

  // Animation for cursor blink
  const cursorOpacity = useSharedValue(1);
  
  useEffect(() => {
    // Blink cursor
    const blinkCursor = () => {
      cursorOpacity.value = withTiming(0, { duration: 500 }, () => {
        cursorOpacity.value = withTiming(1, { duration: 500 });
      });
    };
    
    const interval = setInterval(blinkCursor, 1000);
    return () => clearInterval(interval);
  }, []);
  
  const cursorAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  // Trigger entrance animations on mount
  useEffect(() => {
    const fadeInConfig = {
      duration: 1200,
      easing: Easing.out(Easing.cubic),
    };

    textOpacity.value = withTiming(1, fadeInConfig);
    textTranslateY.value = withTiming(0, fadeInConfig);
    buttonsOpacity.value = withDelay(200, withTiming(1, fadeInConfig));
    buttonsTranslateY.value = withDelay(200, withTiming(0, fadeInConfig));
  }, []);

  // Fix background color for web
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const originalHtmlBg = document.documentElement.style.backgroundColor;
    const originalBodyBg = document.body.style.backgroundColor;

    document.documentElement.style.backgroundColor = '#E67B25';
    document.body.style.backgroundColor = '#E67B25';

    return () => {
      document.documentElement.style.backgroundColor = originalHtmlBg;
      document.body.style.backgroundColor = originalBodyBg;
    };
  }, []);

  // Load gridUser from sessionStorage on mount
  useEffect(() => {
    const loadGridUser = () => {
      try {
        const stored = sessionStorage.getItem('mallory_grid_user');
        if (stored) {
          const parsed = JSON.parse(stored);
          setGridUser(parsed);
          console.log('✅ [OTP Screen] Loaded gridUser from sessionStorage');
        } else {
          console.error('❌ [OTP Screen] No gridUser in sessionStorage');
          setError('Session expired. Please sign in again.');
        }
      } catch (err) {
        console.error('❌ [OTP Screen] Failed to load gridUser:', err);
        setError('Session error. Please sign in again.');
      }
    };

    if (Platform.OS === 'web') {
      loadGridUser();
    }
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

  const handleVerify = async () => {
    // Guard against double-submission
    if (verificationInProgress.current) {
      console.log('⚠️  [OTP Screen] Verification already in progress');
      return;
    }

    // Validate OTP
    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6) {
      setError('Code must be exactly 6 digits');
      return;
    }

    if (!/^\d{6}$/.test(cleanOtp)) {
      setError('Code must contain only numbers');
      return;
    }

    // Check gridUser
    if (!gridUser) {
      setError('Session expired. Please sign in again.');
      return;
    }

    // Set guards
    verificationInProgress.current = true;
    setIsVerifying(true);
    setError('');

    try {
      console.log('🔐 [OTP Screen] Verifying OTP...');

      console.log('🔐 [OTP Screen]', gridUser, cleanOtp);
      
      const authResult = await gridClientService.completeSignIn(gridUser, cleanOtp);
      
      if (authResult.success && authResult.data) {
        console.log('✅ [OTP Screen] Verification successful!');
        console.log('   Address:', authResult.data.address);
        
        // Clear sessionStorage
        if (Platform.OS === 'web') {
          sessionStorage.removeItem('mallory_grid_user');
          sessionStorage.removeItem('mallory_oauth_in_progress');
          sessionStorage.removeItem('mallory_grid_is_existing_user');
        }

        // Navigate to main app
        router.replace('/(main)');
      } else {
        setError('Verification failed. Please try again.');
      }
    } catch (err: any) {
      console.error('❌ [OTP Screen] Verification error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Verification failed';
      
      if (errorMessage.toLowerCase().includes('invalid email and code combination')) {
        setError('Invalid code. Please check and try again, or request a new code.');
      } else if (errorMessage.toLowerCase().includes('invalid code')) {
        setError('Invalid code. This code may have been used already. Please request a new code.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsVerifying(false);
      verificationInProgress.current = false;
    }
  };

  const handleResendCode = async () => {
    setIsVerifying(true);
    setError('');
    setOtp('');

    try {
      console.log('🔄 [OTP Screen] Resending OTP...');
      
      const { user: newGridUser } = await gridClientService.startSignIn(params.email);
      
      // Update both state AND sessionStorage
      setGridUser(newGridUser);
      if (Platform.OS === 'web') {
        sessionStorage.setItem('mallory_grid_user', JSON.stringify(newGridUser));
      }
      
      console.log('✅ [OTP Screen] New OTP sent');
    } catch (err) {
      console.error('❌ [OTP Screen] Failed to resend:', err);
      setError(err instanceof Error ? err.message : 'Failed to resend code');
    } finally {
      setIsVerifying(false);
    }
  };

  // Button disabled logic
  const isButtonDisabled = () => {
    if (error) {
      return isVerifying; // Allow "Resend Code" unless currently resending
    }
    const cleanOtp = otp.trim();
    return isVerifying || cleanOtp.length !== 6;
  };

  const getButtonText = () => {
    if (isVerifying) {
      return 'Verifying...';
    } else if (error) {
      return 'Resend Code';
    } else {
      return 'Continue';
    }
  };

  const getButtonStyle = () => {
    // Active state: 6 digits entered, no error, not verifying
    const isActive = otp.length === 6 && !error && !isVerifying;
    
    return {
      backgroundColor: isActive ? 'rgb(251, 251, 251)' : '#FBAA69',
    };
  };

  const getButtonTextStyle = () => {
    // Active state: 6 digits entered, no error, not verifying
    const isActive = otp.length === 6 && !error && !isVerifying;
    
    return {
      color: isActive ? '#212121' : '#1F1F1F',
    };
  };

  const handleButtonPress = () => {
    if (error) {
      handleResendCode();
    } else {
      handleVerify();
    }
  };

  const handleSignOut = async () => {
    try {
      // Clear sessionStorage
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        sessionStorage.removeItem('mallory_grid_user');
      }
      await logout();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  // Focus the hidden input when clicking anywhere on the OTP area
  const focusInput = () => {
    inputRef.current?.focus();
  };

  return (
    <Pressable 
      style={{ flex: 1 }}
      onPress={focusInput}
    >
      <View 
        style={[
          styles.container,
          Platform.OS === 'web' && {
            height: '100dvh' as any,
            maxHeight: '100dvh' as any,
          }
        ]}
      >
      {/* Mobile header with sign out */}
      {isMobile && (
        <View style={styles.mobileHeader}>
          <TouchableOpacity onPress={handleSignOut} style={styles.signOutButtonMobile}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.content, isMobile && styles.contentMobile]}>
        {/* Top group - OTP + Instruction Text (like lockup + tagline on login) */}
        <Animated.View style={[textAnimatedStyle, isMobile && { width: '100%', flex: 1, justifyContent: 'center' }]}>
          {/* OTP Input - 6 underscores style */}
          <Pressable onPress={focusInput}>
            <View style={[
              styles.otpContainer,
              isMobile && { marginBottom: 11 } // Match lockup-to-tagline spacing on mobile
            ]}>
              {[0, 1, 2, 3, 4, 5].map((index) => {
                const isActive = index === otp.length && !isVerifying;
                return (
                  <View 
                    key={index} 
                    style={[
                      styles.digitBox,
                      isMobile && styles.digitBoxMobile
                    ]}
                  >
                    <Text style={styles.digitText}>
                      {otp[index] || ''}
                    </Text>
                    {/* Show cursor on active position */}
                    {isActive && (
                      <Animated.View style={[styles.cursor, cursorAnimatedStyle]} />
                    )}
                    <View style={[
                      styles.digitUnderline,
                      isActive && styles.digitUnderlineActive
                    ]} />
                  </View>
                );
              })}
            </View>
          </Pressable>
          
          {/* Hidden TextInput for capturing input */}
          <TextInput
            ref={inputRef}
            style={styles.hiddenInput}
            value={otp}
            onChangeText={handleOtpChange}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            editable={!isVerifying}
          />

          {/* Instruction Text - grouped with OTP like tagline with lockup */}
          <Text style={[styles.instruction, isMobile && styles.instructionMobile]}>
            {isVerifying 
              ? 'Verifying your code...'
              : `We've sent a 6-digit code to ${params.email}`
            }
          </Text>
          
          {/* Error only - no hint */}
          {error && (
            <Text style={styles.error}>{error}</Text>
          )}
        </Animated.View>

        {/* Bottom section - Button */}
        <Animated.View style={[isMobile && styles.bottomSectionMobile, buttonsAnimatedStyle]}>
          <View style={[styles.buttonSection, isMobile && styles.buttonSectionMobile]}>
            <PressableButton
              fullWidth={isMobile}
              onPress={handleButtonPress}
              loading={isVerifying}
              disabled={isButtonDisabled()}
              style={{
                ...(isMobile ? styles.buttonMobile : styles.button),
                ...getButtonStyle()
              }}
              textStyle={getButtonTextStyle()}
            >
              {getButtonText()}
            </PressableButton>
          </View>
        </Animated.View>
      </View>

      {/* Web footer with centered sign out */}
      {!isMobile && (
        <View style={styles.webFooter}>
          <TouchableOpacity onPress={handleSignOut} style={styles.signOutButtonWeb}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E67B25',
  },
  content: {
    flex: 1,
    justifyContent: 'center', // Centered on web (like login)
    alignItems: 'center',
    paddingHorizontal: 32,
    maxWidth: LAYOUT.AUTH_MAX_WIDTH,
    width: '100%',
    alignSelf: 'center',
  },
  contentMobile: {
    justifyContent: 'space-between', // Space between top group and button on mobile
    alignItems: 'stretch',
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  
  // Main section - OTP at top
  mainSectionMobile: {
    flex: 1,
    justifyContent: 'center',
  },
  
  // OTP Container - 6 digit boxes
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24, // Match lockup-to-tagline spacing on web
    marginLeft: -8, // Move 8px to the left
  },
  
  digitBox: {
    width: 48,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 4, // 4px padding between number and underscore
  },
  
  digitBoxMobile: {
    paddingBottom: 3, // Reduced by 1/3 on mobile (4px - 1.33px ≈ 3px)
  },
  
  digitText: {
    fontSize: 52, // Big and bold
    color: '#FFEFE3',
    fontFamily: 'Belwe-Medium', // Mallory special font
    textAlign: 'center',
  },
  
  cursor: {
    position: 'absolute',
    bottom: 14, // Adjusted for 4px padding
    left: '50%',
    marginLeft: -1,
    width: 2,
    height: 28,
    backgroundColor: '#FFEFE3',
    borderRadius: 1,
  },
  
  digitUnderline: {
    position: 'absolute',
    bottom: 4, // Adjusted for 4px padding
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#F8CEAC',
    borderRadius: 1,
    opacity: 0.5,
  },
  
  digitUnderlineActive: {
    backgroundColor: '#FFEFE3',
    opacity: 1,
  },
  
  // Hidden input (captures keyboard input)
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
  
  // Instruction text
  instruction: {
    fontSize: 16,
    color: '#F8CEAC',
    fontFamily: 'Satoshi',
    textAlign: 'center',
    marginBottom: 16,
  },
  instructionMobile: {
    textAlign: 'left', // Left-aligned on mobile like login screen
  },
  
  // Error
  error: {
    color: '#FF3B30',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    fontFamily: 'Satoshi',
  },
  
  // Bottom section
  bottomSectionMobile: {
    width: '100%',
    paddingBottom: 24,
  },
  
  // Button Section
  buttonSection: {
    width: '100%',
    alignItems: 'center',
  },
  buttonSectionMobile: {
    alignItems: 'stretch',
  },
  
  // Button
  button: {
    backgroundColor: '#FBAA69',
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 28,
    minWidth: 250,
    maxWidth: 345,
  },
  buttonMobile: {
    width: '100%',
    minWidth: 0,
    paddingVertical: 16,
  },
  
  // Mobile Header
  mobileHeader: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    paddingTop: 16, // Closer to top
    paddingRight: 24,
    paddingLeft: 24,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    zIndex: 10,
  },
  
  // Sign Out Buttons
  signOutButtonMobile: {
    padding: 8,
  },
  signOutButtonWeb: {
    padding: 12,
  },
  signOutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Satoshi',
    opacity: 0.8,
  },
  
  // Web Footer
  webFooter: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingBottom: 32,
  },
});

