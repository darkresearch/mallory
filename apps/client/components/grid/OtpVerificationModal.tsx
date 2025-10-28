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
  gridUser: any; // User object from Grid startSignIn() - REQUIRED
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
      // Resend OTP - backend handles whether to use beginner or advanced flow
      console.log('🔄 Resending OTP for:', userEmail);
      await gridClientService.startSignIn(userEmail);
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
      // Safety check - gridUser should always be provided by upstream code
      if (!gridUser) {
        console.error('❌ [OTP Modal] gridUser is missing - this is a bug in calling code');
        throw new Error('Sign-in session not found. Please close this modal and try again.');
      }

      console.log('🔐 Completing sign-in with OTP - backend determines correct flow');
      
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
        onClose(true);
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
            Verify Your Wallet
          </Text>
          <Text style={styles.description}>
            {`We've sent a 6-digit code to ${userEmail}`}
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
