import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { PressableButton } from '../ui/PressableButton';
import { gridClientService } from '../../features/grid/services/gridClient';

interface OtpVerificationModalProps {
  visible: boolean;
  onClose: (success: boolean) => void;
  userEmail: string;
  gridUser?: any; // User object from Grid account creation
}

export default function OtpVerificationModal({
  visible,
  onClose,
  userEmail,
  gridUser
}: OtpVerificationModalProps) {
  const { logout } = useAuth();
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [verificationSuccess, setVerificationSuccess] = useState(false);

  // Reset local state when modal visibility changes
  useEffect(() => {
    if (!visible) {
      setVerificationSuccess(false);
      setOtp('');
      setError('');
    }
  }, [visible]);

  const handleResendOtp = async () => {
    setIsVerifying(true);
    setError('');
    setOtp('');
    
    try {
      // If we have gridUser, it means account already exists
      if (gridUser) {
        const isReauth = gridUser.isReauth === true;
        console.log('🔄 Resending OTP:', isReauth ? 'Re-auth flow' : 'New account flow');
        
        // For re-authentication, trigger a new login
        if (isReauth) {
          await gridClientService.reauthenticateAccount(userEmail);
        } else {
          // For new accounts, create account again (which sends new OTP)
          await gridClientService.createAccount(userEmail);
        }
      } else {
        // No gridUser, create account which sends OTP
        console.log('🔄 Sending initial OTP for:', userEmail);
        await gridClientService.createAccount(userEmail);
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
      // If we don't have gridUser, create account first
      let user = gridUser;
      if (!user) {
        console.log('🔐 Creating Grid account for:', userEmail);
        const createResult = await gridClientService.createAccount(userEmail);
        user = createResult.user;
      }

      // Determine if this is re-authentication or new account
      const isReauth = user.isReauth === true;
      
      console.log('🔐 Verifying OTP (attempt 1):', isReauth ? 'Re-auth flow' : 'New account flow');
      
      // Try the initial flow based on isReauth flag
      let authResult;
      try {
        authResult = isReauth 
          ? await gridClientService.completeReauthentication(user, otp)
          : await gridClientService.verifyAccount(user, otp);
        
        console.log('🔐 [OTP Verification] Auth result (attempt 1):', {
          success: authResult.success,
          hasData: !!authResult.data,
          address: authResult.data?.address,
        });
        
        if (authResult.success && authResult.data) {
          console.log('✅ Grid account verified on first attempt:', authResult.data.address);
          setVerificationSuccess(true);
          onClose(true);
          return;
        }
      } catch (firstError) {
        const errorMessage = firstError instanceof Error ? firstError.message : String(firstError);
        console.log('⚠️ [OTP Verification] First attempt failed:', errorMessage);
        
        // Check if error is "Invalid email and code combination" - likely wrong flow
        if (errorMessage.toLowerCase().includes('invalid email and code combination')) {
          console.log('🔄 [OTP Verification] Detected wrong flow, retrying with opposite method...');
          
          // Retry with the opposite flow
          try {
            const oppositeFlow = !isReauth;
            console.log('🔐 Verifying OTP (attempt 2):', oppositeFlow ? 'Re-auth flow' : 'New account flow');
            
            authResult = oppositeFlow
              ? await gridClientService.completeReauthentication(user, otp)
              : await gridClientService.verifyAccount(user, otp);
            
            console.log('🔐 [OTP Verification] Auth result (attempt 2):', {
              success: authResult.success,
              hasData: !!authResult.data,
              address: authResult.data?.address,
            });
            
            if (authResult.success && authResult.data) {
              console.log('✅ Grid account verified on second attempt (opposite flow):', authResult.data.address);
              setVerificationSuccess(true);
              onClose(true);
              return;
            }
          } catch (secondError) {
            console.error('❌ [OTP Verification] Both flows failed:', secondError);
            // Fall through to show error
          }
        }
        
        // If we get here, either it wasn't a flow error or both flows failed
        throw firstError;
      }
      
      // If we reach here without returning, verification failed
      console.log('❌ [OTP Verification] Verification failed - showing error');
      setError('Verification failed. Please check your code and try again.');
    } catch (error) {
      console.error('❌ OTP verification error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An error occurred. Please try again.';
      
      // Provide more specific error messages
      if (errorMessage.toLowerCase().includes('session secrets not found')) {
        setError('Session expired. Please request a new code.');
      } else if (errorMessage.toLowerCase().includes('invalid email and code combination')) {
        setError('Unable to verify code. Please request a new one.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleButtonPress = () => {
    if (verificationSuccess) {
      // Manual close when user clicks "Done"
      onClose(true);
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

  const isWeb = Platform.OS === 'web';
  const isReauth = gridUser?.isReauth === true;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isWeb ? "fade" : "slide"}
    >
      <KeyboardAvoidingView 
        style={isWeb ? styles.webContainer : styles.mobileContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.backdrop} />
        <View style={isWeb ? styles.webContent : styles.mobileContent}>
          <Text style={styles.title}>
            {isReauth ? 'Verify Your Wallet' : 'Set Up Your Wallet'}
          </Text>
          <Text style={styles.description}>
            {isReauth 
              ? `We've sent a verification code to ${userEmail}`
              : `We've sent a 6-digit code to ${userEmail}`}
          </Text>
          
          <TextInput
            style={styles.input}
            placeholder="000000"
            placeholderTextColor="#C95900"
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />

          {error ? (
            <Text style={styles.error}>{error}</Text>
          ) : null}

          <PressableButton
            fullWidth
            onPress={handleButtonPress}
            loading={isVerifying}
            style={styles.button}
            textStyle={styles.buttonText}
          >
            {getButtonText()}
          </PressableButton>

          {/* Sign Out Button */}
          <PressableButton
            variant="ghost"
            fullWidth
            onPress={() => {
              console.log('🚪 Sign out button pressed from OTP modal');
              // Close modal first to prevent blocking navigation
              onClose(false);
              // Then trigger logout
              setTimeout(() => {
                logout();
              }, 100);
            }}
            icon={<Ionicons name="log-out-outline" size={16} color="#FFEFE3" />}
            textStyle={styles.signOutText}
            style={styles.signOutButton}
          >
            Sign out
          </PressableButton>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Mobile container (bottom sheet)
  mobileContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  // Web container (center modal)
  webContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    ...(Platform.OS === 'web' && {
      backdropFilter: 'blur(4px)', // Modern web blur effect
    }),
  },
  // Mobile content (bottom sheet style)
  mobileContent: {
    backgroundColor: '#E67B25',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  // Web content (center modal style)
  webContent: {
    backgroundColor: '#E67B25',
    borderRadius: 16,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
    elevation: 20, // Android shadow
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFEFE3',
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: 'Belwe-Medium',
  },
  description: {
    fontSize: 16,
    color: '#F8CEAC',
    marginBottom: 24,
    textAlign: 'center',
    fontFamily: 'Satoshi',
  },
  input: {
    backgroundColor: '#FFEFE3',
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    color: '#000000',
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 16,
    fontFamily: 'Satoshi',
  },
  error: {
    color: '#FF3B30',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#FBAA69',
    borderRadius: 12,
    marginBottom: 12,
  },
  buttonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Satoshi',
  },
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
