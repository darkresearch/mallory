import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
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
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [verificationSuccess, setVerificationSuccess] = useState(false);

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
      
      console.log('🔐 Verifying OTP:', isReauth ? 'Re-auth flow' : 'New account flow');
      
      // Use appropriate verification method
      const authResult = isReauth 
        ? await gridClientService.completeReauthentication(user, otp)
        : await gridClientService.verifyAccount(user, otp);
      
      console.log('🔐 [OTP Verification] Auth result:', {
        success: authResult.success,
        hasData: !!authResult.data,
        address: authResult.data?.address,
      });
      
      if (authResult.success && authResult.data) {
        console.log('✅ Grid account verified:', authResult.data.address);
        console.log('🔐 [OTP Verification] Setting verification success...');
        setVerificationSuccess(true);
        // Signal success - AuthContext will handle sync to server
        onClose(true);
        console.log('🔐 [OTP Verification] onClose(true) called');
      } else {
        console.log('❌ [OTP Verification] Verification failed - showing error');
        setError('Verification failed. Invalid email and code combination.');
      }
    } catch (error) {
      console.error('❌ OTP verification error:', error);
      setError(error instanceof Error ? error.message : 'An error occurred. Please try again.');
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

          <TouchableOpacity
            style={[styles.button, isVerifying && styles.buttonDisabled]}
            onPress={handleButtonPress}
            disabled={isVerifying}
          >
            {isVerifying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{getButtonText()}</Text>
            )}
          </TouchableOpacity>
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
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Satoshi',
  },
});
