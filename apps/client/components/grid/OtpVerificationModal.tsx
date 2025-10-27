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
      
      if (authResult.success && authResult.data) {
        console.log('✅ Grid account verified:', authResult.data.address);
        // Signal success - AuthContext will handle sync to server
        onClose(true);
      } else {
        setError('Verification failed. Please check your code and try again.');
      }
    } catch (error) {
      console.error('❌ OTP verification error:', error);
      setError(error instanceof Error ? error.message : 'An error occurred. Please try again.');
    } finally {
      setIsVerifying(false);
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
            placeholderTextColor="#666"
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
            onPress={handleVerify}
            disabled={isVerifying}
          >
            {isVerifying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Verify</Text>
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
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  // Web content (center modal style)
  webContent: {
    backgroundColor: '#1a1a1a',
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
    color: '#DCE9FF',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    color: '#DCE9FF',
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 16,
  },
  error: {
    color: '#FF3B30',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#4A9EFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
